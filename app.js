import { TimerEngine, MODES, validateConfig, buildPlan, formatSeconds } from './timer-core.js';
import { CueTracker } from './cue-controller.js';
import { AudioCueManager } from './audio.js';
import { SafeStorage, loadPreferences } from './storage.js';
import { setupPWA } from './pwa.js';

const $ = id => document.getElementById(id);
const names = { tabata: 'TABATA', emom: 'EMOM', amrap: 'AMRAP', interval: 'INTERVAL' };
const scopePath = new URL('./', import.meta.url).pathname;

let local = null;
try { local = window.localStorage; } catch (_) { /* 메모리 모드로 계속 진행 */ }

function storageWarning(message) {
  $('storage-warning').hidden = false;
  $('storage-warning').textContent = message;
}
const store = new SafeStorage(local, `intervalforge:${scopePath}:v1:`, storageWarning);
const prefs = loadPreferences(store);
let engine;
let restored = false;
const savedSession = store.read('session');
if (savedSession) {
  try {
    engine = TimerEngine.restore(savedSession);
    restored = engine.status !== 'idle';
  } catch (_) {
    store.remove('session');
    storageWarning('저장된 진행 상태가 올바르지 않아 대기로 시작합니다. 운동 설정은 유지합니다.');
  }
}
if (!engine) engine = new TimerEngine(prefs.configs[prefs.mode]);
prefs.mode = engine.config.mode;
prefs.configs[prefs.mode] = { ...engine.config };

const cues = new CueTracker();
let frameId = 0;
let lastPaint = -Infinity;
let previousState = null;
let lastSavedAt = 0;
let commandToken = 0;
let waitingUpdate = false;
let pwa = null;
let confirmPending = false;

const audioDescriptions = {
  off: '효과음 꺼짐',
  unsupported: 'Web Audio 미지원 · 타이머는 계속 작동합니다.',
  error: '소리 활성화/재생 실패 · 활성화 버튼을 다시 누르세요. 타이머는 계속 진행합니다.',
  'zero-volume': '앱 효과음 음량이 0%입니다.',
  running: '효과음 활성화됨 · 기기 음량과 출력 장치도 확인하세요.',
  'needs-gesture': '시작 또는 효과음 테스트 / 활성화를 눌러 소리를 허용하세요.'
};
const audio = new AudioCueManager({
  enabled: prefs.sound,
  volume: prefs.volume / 100,
  onStatus: value => { $('audio-status').textContent = audioDescriptions[value]; }
});

function isBusy() { return engine.status === 'running' || engine.status === 'paused'; }
function savePrefs() { store.write('preferences', prefs); }
function saveSession() {
  store.write('session', engine.serialize());
  lastSavedAt = Date.now();
}
function text(id, value) {
  const element = $(id);
  if (element.textContent !== value) element.textContent = value;
}
function showRestore(message) {
  text('restore-notice', message);
  $('restore-notice').hidden = false;
}

let wakeHandle = null;
let wakePending = false;
let wakeGeneration = 0;
function wantsWake() {
  return prefs.keepAwake && engine.status === 'running' &&
    document.visibilityState === 'visible';
}
async function syncWakeLock() {
  if (!('wakeLock' in navigator)) {
    text('wake-status', '화면 유지: 미지원 · 자동 잠금 설정을 직접 확인하세요.');
    return;
  }
  if (!wantsWake()) {
    wakeGeneration++;
    const handle = wakeHandle;
    wakeHandle = null;
    if (handle) {
      try { await handle.release(); } catch (_) { /* 이미 해제됨 */ }
    }
    text('wake-status', prefs.keepAwake
      ? '화면 유지: 대기 · 전면에서 운동할 때 요청' : '화면 유지: 꺼짐');
    return;
  }
  if (wakeHandle || wakePending) return;
  const generation = wakeGeneration;
  wakePending = true;
  text('wake-status', '화면 유지: 요청 중');
  let retryForNewState = false;
  try {
    const handle = await navigator.wakeLock.request('screen');
    if (generation !== wakeGeneration || !wantsWake()) {
      await handle.release();
      retryForNewState = wantsWake();
    } else {
      wakeHandle = handle;
      text('wake-status', '화면 유지: 사용 중 · 수동 잠금/시스템 해제는 막을 수 없음');
      handle.addEventListener('release', () => {
        if (wakeHandle === handle) {
          wakeHandle = null;
          text('wake-status', '화면 유지: 시스템에서 해제됨 · 잠금에 주의하세요.');
        }
      });
    }
  } catch (_) {
    text('wake-status', '화면 유지: 허용되지 않음 · 저전력 모드/브라우저 설정을 확인하세요.');
  } finally {
    wakePending = false;
  }
  if (retryForNewState) void syncWakeLock();
}

function fillInputs(config) {
  $('mode-select').value = config.mode;
  if ('workSeconds' in config) $('work-input').value = config.workSeconds;
  if ('restSeconds' in config) $('rest-input').value = config.restSeconds;
  if ('rounds' in config) $('rounds-input').value = config.rounds;
  if ('intervalSeconds' in config) $('interval-input').value = config.intervalSeconds;
  if ('durationSeconds' in config) $('duration-input').value = config.durationSeconds;
  const visible = {
    work: ['tabata', 'interval'].includes(config.mode),
    rest: ['tabata', 'interval'].includes(config.mode),
    rounds: config.mode !== 'amrap',
    interval: config.mode === 'emom',
    duration: config.mode === 'amrap'
  };
  for (const [key, show] of Object.entries(visible)) {
    $(`${key}-field`).hidden = !show;
    $(`${key}-input`).disabled = !show;
    $(`${key}-input`).removeAttribute('aria-invalid');
  }
  const explanations = {
    tabata: '마지막 회복 휴식까지 포함합니다. 기본 20초/10초 × 8회 = 4분입니다.',
    emom: '라운드 시작에 신호가 울립니다. 기본 60초 간격 × 10라운드이며 간격을 바꿀 수 있습니다.',
    amrap: '설정한 전체 시간 동안 운동합니다. 횟수 입력 없이 카운트다운만으로 사용할 수 있습니다.',
    interval: '운동 → 휴식을 반복하고 마지막 운동 이후 휴식은 제외합니다. 휴식 0초도 가능합니다.'
  };
  text('mode-explanation', explanations[config.mode]);
  showValidation([]);
  updatePreview(config);
}
function readInputs() {
  return {
    mode: $('mode-select').value,
    workSeconds: $('work-input').value,
    restSeconds: $('rest-input').value,
    rounds: $('rounds-input').value,
    intervalSeconds: $('interval-input').value,
    durationSeconds: $('duration-input').value
  };
}
function showValidation(errors) {
  $('config-error').hidden = errors.length === 0;
  text('config-error', errors.join(' '));
  for (const key of ['work', 'rest', 'rounds', 'interval', 'duration']) {
    const input = $(`${key}-input`);
    if (!input.disabled && errors.length) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}
function updatePreview(config) {
  const plan = buildPlan(config);
  text('estimated-total', formatSeconds(plan.totalMs / 1000));
  let preview;
  if (config.mode === 'amrap') {
    preview = `운동 ${config.durationSeconds}초 → 완료`;
  } else if (config.mode === 'emom') {
    preview = `${config.intervalSeconds}초 간격 × ${config.rounds}라운드 → 완료`;
  } else if (config.restSeconds === 0) {
    preview = `운동 ${config.workSeconds}초 × ${config.rounds}라운드 → 완료 (휴식 없음)`;
  } else if (config.mode === 'tabata') {
    preview = `[운동 ${config.workSeconds}초 → 휴식 ${config.restSeconds}초] × ${config.rounds} → 완료`;
  } else if (config.rounds === 1) {
    preview = `운동 ${config.workSeconds}초 → 완료 (마지막 휴식 없음)`;
  } else {
    preview = `[운동 ${config.workSeconds}초 → 휴식 ${config.restSeconds}초] × ${config.rounds - 1} → 운동 ${config.workSeconds}초 → 완료`;
  }
  text('sequence-preview', preview);
}
function commitInputs() {
  if (isBusy()) return true;
  const result = validateConfig(readInputs());
  showValidation(result.errors);
  if (!result.ok) {
    text('estimated-total', '—');
    text('sequence-preview', '입력값을 확인하세요. 전체 6시간 이내, 라운드 1~200회.');
    return false;
  }
  prefs.mode = result.config.mode;
  prefs.configs[prefs.mode] = result.config;
  engine.reset(result.config);
  cues.reset();
  previousState = null;
  savePrefs();
  saveSession();
  updatePreview(result.config);
  step({ silent: true });
  return true;
}

function render(state) {
  const phase = state.status === 'idle' ? 'READY'
    : state.status === 'finished' ? 'FINISHED' : state.phaseKind.toUpperCase();
  text('timer-title', names[state.mode]);
  $('timer-card').dataset.kind = state.status === 'paused' ? 'ready' : state.kind;
  text('phase-badge', state.status === 'paused' ? `PAUSED · ${phase}` : phase);
  const description = state.status === 'paused' ? '일시정지 · 재개하면 이어서 진행합니다'
    : state.status === 'idle' ? '시작할 준비가 되었습니다'
    : state.status === 'finished' ? '모든 구간이 끝났습니다'
    : state.finalRecovery ? '마지막 회복 구간'
    : state.phaseKind === 'rest' ? '호흡을 정리하고 다음 운동을 준비하세요'
    : state.mode === 'emom' ? '이번 라운드 운동을 시작하세요' : '지금은 운동할 시간입니다';
  text('phase-description', description);
  const digits = formatSeconds(state.remainingSeconds);
  text('countdown', digits);
  $('countdown').dataset.long = String(digits.length > 5);
  text('time-caption', state.status === 'finished' ? '운동 완료'
    : state.mode === 'amrap' ? '전체 운동 남은 시간' : '현재 구간 남은 시간');
  text('round-caption', state.mode === 'amrap' ? '운동 세션' : '라운드');
  text('round-value', `${state.round} / ${state.totalRounds}`);
  $('workout-progress').value = state.progress;
  text('progress-value', `${Math.floor(state.progress * 100)}%`);
  text('elapsed-value', formatSeconds(Math.floor(state.elapsedMs / 1000)));
  text('remaining-value', formatSeconds(Math.ceil(state.workoutRemainingMs / 1000)));
  text('total-value', formatSeconds(state.totalMs / 1000));

  const next = engine.plan.segments[state.phaseIndex + 1];
  text('next-phase', state.status === 'finished'
    ? '완료 · 다시 시작하거나 설정을 바꿀 수 있습니다.'
    : next
      ? `다음: ${next.kind === 'rest' ? '휴식' : '운동'} ${next.seconds}초 · ${next.round}라운드`
      : '다음: 운동 완료');
  $('finish-panel').hidden = state.status !== 'finished';
  if (state.status === 'finished') {
    text('finish-summary',
      `${names[state.mode]} · ${state.totalRounds} ${state.mode === 'amrap' ? '세션' : '라운드'} · ${formatSeconds(state.totalMs / 1000)}`);
  }

  text('primary-button', {
    idle: '시작', running: '일시정지', paused: '재개', finished: '다시 시작'
  }[state.status]);
  $('primary-button').dataset.action = state.status === 'running' ? 'pause' : 'start';
  $('reset-button').disabled = state.status === 'idle';
  $('workout-fields').disabled = isBusy();
  text('settings-lock', isBusy() ? '초기화 후 변경' : '자동 저장');
  text('running-hint', isBusy()
    ? '운동 설정은 잠겨 있습니다. 소리·화면 유지 설정은 변경할 수 있습니다.'
    : '시작 버튼을 누르면 효과음이 활성화됩니다.');
  $('sound-button').disabled = !prefs.sound;
  $('apply-update-button').disabled = isBusy();
  $('update-hint').hidden = !waitingUpdate || !isBusy();
}

function dispatch(events, state, retryPromise = null) {
  if (document.visibilityState !== 'visible') return;
  for (const event of events) {
    if (!audio.playCue(event) && retryPromise && prefs.sound) {
      const token = commandToken;
      retryPromise.then(ok => {
        const current = engine.snapshot();
        if (ok && token === commandToken &&
            document.visibilityState === 'visible' &&
            current.status === 'running' &&
            current.phaseIndex === state.phaseIndex &&
            current.elapsedMs - state.elapsedMs < 600) audio.playCue(event);
      }).catch(() => { /* 소리 실패는 타이머를 중단하지 않는다. */ });
    }
  }
}

function step({ silent = false, retryPromise = null } = {}) {
  const state = engine.snapshot();
  const events = cues.observe(state, {
    silent: silent || document.visibilityState !== 'visible'
  });
  render(state);
  dispatch(events, state, retryPromise);
  const changed = !previousState || state.status !== previousState.status ||
    state.phaseIndex !== previousState.phaseIndex;
  if (changed) {
    if (!silent) {
      const spoken = state.status === 'paused' ? '일시정지'
        : state.kind === 'finished' ? '운동 완료'
        : state.kind === 'ready' ? '준비'
        : state.phaseKind === 'work' ? '운동' : '휴식';
      text('phase-announcement', `${names[state.mode]} ${spoken}, ${state.round}라운드`);
    }
    saveSession();
    void syncWakeLock();
  } else if (state.status === 'running' && Date.now() - lastSavedAt >= 5000) {
    saveSession();
  }
  previousState = state;
  return state;
}

function stopLoop() {
  if (frameId) cancelAnimationFrame(frameId);
  frameId = 0;
}
function ensureLoop() {
  if (!frameId && document.visibilityState === 'visible' && engine.status === 'running') {
    frameId = requestAnimationFrame(frame);
  }
}
function frame(timestamp) {
  frameId = 0;
  if (document.visibilityState !== 'visible') return;
  if (timestamp - lastPaint >= 70) {
    lastPaint = timestamp;
    step();
  }
  ensureLoop();
}
function resetWorkout() {
  commandToken++;
  stopLoop();
  audio.cancel();
  engine.reset();
  cues.reset();
  previousState = null;
  $('restore-notice').hidden = true;
  saveSession();
  step({ silent: true });
}
function confirmReset() {
  if (confirmPending) return;
  const dialog = $('reset-dialog');
  if (typeof dialog.showModal !== 'function') {
    if (window.confirm('운동을 초기화할까요? 진행 시간은 삭제됩니다.')) resetWorkout();
    return;
  }
  confirmPending = true;
  dialog.returnValue = '';
  dialog.addEventListener('close', () => {
    confirmPending = false;
    if (dialog.returnValue === 'reset') resetWorkout();
  }, { once: true });
  dialog.showModal();
}

$('primary-button').addEventListener('click', () => {
  commandToken++;
  if (engine.status === 'running') {
    engine.pause();
    audio.cancel();
    stopLoop();
    step();
  } else {
    if (engine.status !== 'paused' && !commitInputs()) {
      $('config-error').scrollIntoView({ block: 'nearest' });
      return;
    }
    const retryPromise = audio.unlock();
    if (engine.status === 'paused') engine.resume();
    else engine.start();
    $('restore-notice').hidden = true;
    step({ retryPromise });
    lastPaint = -Infinity;
    ensureLoop();
  }
  saveSession();
});
$('reset-button').addEventListener('click', confirmReset);
$('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!isBusy()) commitInputs();
});
$('mode-select').addEventListener('change', () => {
  if (isBusy()) {
    $('mode-select').value = engine.config.mode;
    return;
  }
  const mode = $('mode-select').value;
  if (!MODES.includes(mode)) return;
  fillInputs(prefs.configs[mode]);
  commitInputs();
});
for (const key of ['work', 'rest', 'rounds', 'interval', 'duration']) {
  $(`${key}-input`).addEventListener('input', () => {
    if (!isBusy()) commitInputs();
  });
}

$('sound-toggle').checked = prefs.sound;
$('volume-input').value = prefs.volume;
text('volume-value', `${prefs.volume}%`);
$('awake-toggle').checked = prefs.keepAwake;

$('sound-toggle').addEventListener('change', () => {
  prefs.sound = $('sound-toggle').checked;
  audio.setEnabled(prefs.sound);
  $('sound-button').disabled = !prefs.sound;
  if (prefs.sound) void audio.unlock();
  savePrefs();
});
$('volume-input').addEventListener('input', () => {
  prefs.volume = Math.max(0, Math.min(100, Number($('volume-input').value)));
  text('volume-value', `${prefs.volume}%`);
  audio.setVolume(prefs.volume / 100);
  savePrefs();
});
$('sound-button').addEventListener('click', () => {
  const token = commandToken;
  void audio.unlock().then(ok => {
    if (ok && token === commandToken && engine.status !== 'running' &&
        document.visibilityState === 'visible') audio.playCue({ type: 'work' });
  });
});
$('awake-toggle').addEventListener('change', () => {
  prefs.keepAwake = $('awake-toggle').checked;
  savePrefs();
  void syncWakeLock();
});

document.addEventListener('visibilitychange', () => {
  commandToken++;
  audio.cancel();
  if (document.visibilityState === 'hidden') {
    stopLoop();
    saveSession();
    void syncWakeLock();
  } else {
    step({ silent: true });
    if (engine.status !== 'idle') {
      showRestore('현재 시각으로 운동 상태를 보정했습니다. 지나간 효과음은 재생하지 않습니다. 필요하면 소리를 다시 활성화하세요.');
    }
    lastPaint = -Infinity;
    ensureLoop();
    audio.report();
    void syncWakeLock();
  }
});
window.addEventListener('pagehide', () => {
  commandToken++;
  saveSession();
  stopLoop();
  audio.cancel();
});
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    commandToken++;
    step({ silent: true });
    lastPaint = -Infinity;
    ensureLoop();
    audio.report();
    void syncWakeLock();
  }
});
function onlineStatus() {
  text('online-status', navigator.onLine
    ? '연결 상태: 온라인으로 보고됨 · 실제 접속 가능 여부는 다를 수 있습니다.'
    : '연결 상태: 오프라인 · 저장된 파일로 실행합니다.');
}
window.addEventListener('online', onlineStatus);
window.addEventListener('offline', onlineStatus);
$('check-update-button').addEventListener('click', () => {
  if (pwa) void pwa.check();
});
$('apply-update-button').addEventListener('click', () => {
  saveSession();
  if (pwa) pwa.apply();
});
$('tests-link').addEventListener('click', event => {
  if (isBusy()) {
    event.preventDefault();
    showRestore('운동을 완료하거나 초기화한 뒤 자동 테스트를 여세요.');
  }
});

fillInputs(engine.config);
text('display-mode',
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
    ? '홈 화면 앱' : '브라우저');
text('notification-capability',
  `이 환경의 API 감지: Notifications ${'Notification' in window ? '있음' : '없음'}, Push ${'PushManager' in window ? '있음' : '없음'}. API가 있어도 잠금 중 예약 알림을 의미하지 않습니다.`);
if (restored) {
  showRestore(engine.status === 'finished'
    ? '저장된 운동은 현재 시각 기준으로 이미 완료되었습니다. 지나간 효과음은 재생하지 않습니다.'
    : engine.status === 'paused'
      ? '일시정지된 운동을 복원했습니다. 재개 버튼을 누르세요.'
      : '진행 중이던 운동을 현재 시각으로 복원했습니다. 효과음은 직접 다시 활성화해야 할 수 있습니다.');
}
step({ silent: true });
audio.report();
onlineStatus();
ensureLoop();

void setupPWA({
  busy: isBusy,
  status: value => text('pwa-status', value),
  waiting: value => {
    waitingUpdate = value;
    $('apply-update-button').hidden = !value;
    $('apply-update-button').disabled = isBusy();
    $('update-hint').hidden = !value || !isBusy();
  }
}).then(value => { pwa = value; });
