import { TimerEngine, defaultConfig as productionDefaultConfig, validateConfig, buildPlan, formatSeconds, MODES } from '../timer-core.js';
import { CueTracker } from '../cue-controller.js';
import { AudioCueManager } from '../audio.js';
import { SafeStorage, loadPreferences, defaultPreferences } from '../storage.js';

// 기존 회귀 검사는 명시적으로 준비0. 새 기본 준비10초는 추가 검사에서 확인한다.
function defaultConfig(mode = 'tabata') {
  return { ...productionDefaultConfig(mode), prepareSeconds: 0 };
}
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(value, message = '조건이 참이어야 합니다.') {
  if (!value) throw new Error(message);
}
function equal(actual, expected) {
  if (actual !== expected) {
    throw new Error(`예상 ${JSON.stringify(expected)}, 실제 ${JSON.stringify(actual)}`);
  }
}
function throws(fn) {
  let threw = false;
  try { fn(); } catch (_) { threw = true; }
  assert(threw, '예외가 발생해야 합니다.');
}
function fixture(config = defaultConfig()) {
  let now = 1700000000000;
  return {
    engine: new TimerEngine(config, () => now),
    clock: () => now,
    advance(ms) { now += ms; },
    setNow(value) { now = value; }
  };
}
function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key)
  };
}
class FakeParam {
  constructor() { this.value = 0; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}
class FakeContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = {};
    this.created = 0;
    this.stopped = 0;
  }
  resume() {
    this.state = 'running';
    if (this.onstatechange) this.onstatechange();
    return Promise.resolve();
  }
  createGain() {
    return { gain: new FakeParam(), connect() {}, disconnect() {} };
  }
  createOscillator() {
    this.created++;
    const context = this;
    return {
      frequency: new FakeParam(), type: '',
      connect() {}, disconnect() {}, start() {},
      stop() { context.stopped++; },
      onended: null
    };
  }
}

test('Tabata 준비0 총 시간은 마지막 회복 포함 240초', () => {
  const p = buildPlan(defaultConfig());
  equal(p.totalMs, 240000);
  equal(p.segments.length, 16);
  equal(p.segments[15].kind, 'rest');
  assert(p.segments[15].finalRecovery);
});
test('Interval 준비0은 마지막 휴식 없이 230초', () => {
  const p = buildPlan(defaultConfig('interval'));
  equal(p.totalMs, 230000);
  equal(p.segments.length, 15);
  equal(p.segments[14].kind, 'work');
});
test('EMOM 준비0 60초 × 10라운드', () => {
  const p = buildPlan(defaultConfig('emom'));
  equal(p.totalMs, 600000);
  equal(p.segments.length, 10);
});
test('AMRAP 준비0은 600초 단일 구간', () => {
  const p = buildPlan(defaultConfig('amrap'));
  equal(p.totalMs, 600000);
  equal(p.segments.length, 1);
});
test('Interval 1라운드는 휴식 없음', () => {
  const p = buildPlan({ mode: 'interval', workSeconds: 12, restSeconds: 99, rounds: 1 });
  equal(p.totalMs, 12000);
  equal(p.segments.length, 1);
});
test('Tabata 1라운드는 회복 포함', () => {
  equal(buildPlan({ mode: 'tabata', workSeconds: 20, restSeconds: 10, rounds: 1 }).totalMs, 30000);
});
test('휴식 0초는 0길이 구간을 생성하지 않음', () => {
  for (const mode of ['tabata', 'interval']) {
    const p = buildPlan({ mode, workSeconds: 5, restSeconds: 0, rounds: 3 });
    equal(p.segments.length, 3);
    equal(p.totalMs, 15000);
  }
});

for (const [label, patch] of [
  ['운동 0초', { workSeconds: 0 }],
  ['운동 음수', { workSeconds: -1 }],
  ['휴식 음수', { restSeconds: -1 }],
  ['소수', { workSeconds: 1.5 }],
  ['라운드 0회', { rounds: 0 }],
  ['라운드 상한 초과', { rounds: 201 }],
  ['구간 상한 초과', { workSeconds: 3601 }],
  ['빈 입력', { workSeconds: '' }],
  ['문자', { workSeconds: 'abc' }],
  ['지수 표기', { workSeconds: '1e2' }],
  ['NaN', { workSeconds: NaN }],
  ['무한대', { workSeconds: Infinity }],
  ['불리언', { rounds: true }]
]) {
  test(`입력 검증: ${label} 거부`, () => {
    assert(!validateConfig({ ...defaultConfig(), ...patch }).ok);
  });
}
test('정상 숫자 문자열 변환', () => {
  const r = validateConfig({ mode: 'interval', workSeconds: '20', restSeconds: '0', rounds: '8' });
  assert(r.ok);
  equal(r.config.workSeconds, 20);
});
test('전체 6시간 상한 검증', () => {
  assert(validateConfig({ mode: 'amrap', durationSeconds: 21600 }).ok);
  assert(!validateConfig({ mode: 'amrap', durationSeconds: 21601 }).ok);
  assert(!validateConfig({ mode: 'emom', intervalSeconds: 3600, rounds: 7 }).ok);
});
test('알 수 없는 모드와 누락 설정 거부', () => {
  assert(!validateConfig({ mode: 'other' }).ok);
  assert(!validateConfig(null).ok);
  throws(() => defaultConfig('other'));
  throws(() => buildPlan({}));
});
test('준비0 READY는 첫 운동과 경과0 표시', () => {
  const s = fixture().engine.snapshot();
  equal(s.status, 'idle');
  equal(s.remainingSeconds, 20);
  equal(s.elapsedMs, 0);
});
test('목표 종료 시각 계산', () => {
  const f = fixture();
  equal(f.engine.start().targetEndAt, f.clock() + 240000);
});
test('콜백 없이 19.25초 경과한 시간 계산', () => {
  const f = fixture();
  f.engine.start();
  f.advance(19250);
  const s = f.engine.snapshot();
  equal(s.remainingSeconds, 1);
  equal(s.elapsedMs, 19250);
});
test('정확히 20초에 운동에서 휴식으로', () => {
  const f = fixture();
  f.engine.start();
  f.advance(20000);
  const s = f.engine.snapshot();
  equal(s.kind, 'rest');
  equal(s.round, 1);
  equal(s.remainingSeconds, 10);
});
test('정확히 30초에 2라운드 운동', () => {
  const f = fixture();
  f.engine.start();
  f.advance(30000);
  const s = f.engine.snapshot();
  equal(s.kind, 'work');
  equal(s.round, 2);
  equal(s.remainingSeconds, 20);
});
test('Tabata 마지막 회복 후 240초에 완료', () => {
  const f = fixture();
  f.engine.start();
  f.advance(230000);
  equal(f.engine.snapshot().kind, 'rest');
  f.advance(10000);
  const s = f.engine.snapshot();
  equal(s.status, 'finished');
  equal(s.remainingSeconds, 0);
  equal(s.progress, 1);
});
test('여러 구간이 지난 95.5초 상태 보정', () => {
  const f = fixture();
  f.engine.start();
  f.advance(95500);
  const s = f.engine.snapshot();
  equal(s.round, 4);
  equal(s.kind, 'work');
  equal(s.phaseRemainingMs, 14500);
});
test('EMOM 60초에 2라운드', () => {
  const f = fixture(defaultConfig('emom'));
  f.engine.start();
  f.advance(60000);
  equal(f.engine.snapshot().round, 2);
  equal(f.engine.snapshot().remainingSeconds, 60);
});
test('사용자 지정 EMOM 간격과 종료', () => {
  const f = fixture({ mode: 'emom', intervalSeconds: 15, rounds: 3 });
  f.engine.start();
  f.advance(30000);
  equal(f.engine.snapshot().round, 3);
  f.advance(15000);
  equal(f.engine.snapshot().status, 'finished');
});
test('AMRAP 종료 뒤 음수 없음', () => {
  const f = fixture({ mode: 'amrap', durationSeconds: 5 });
  f.engine.start();
  f.advance(99999);
  const s = f.engine.snapshot();
  equal(s.status, 'finished');
  equal(s.remainingSeconds, 0);
  equal(s.workoutRemainingMs, 0);
});
test('일시정지 중 시간 고정', () => {
  const f = fixture();
  f.engine.start();
  f.advance(7250);
  const before = f.engine.pause();
  f.advance(60000);
  equal(f.engine.snapshot().elapsedMs, before.elapsedMs);
  equal(f.engine.status, 'paused');
});
test('재개는 새 기준 시각으로 계산', () => {
  const f = fixture();
  f.engine.start();
  f.advance(7000);
  f.engine.pause();
  f.advance(60000);
  equal(f.engine.resume().targetEndAt, f.clock() + 233000);
  f.advance(2000);
  equal(f.engine.snapshot().elapsedMs, 9000);
});
test('반복 일시정지/재개 시 중복 계산 없음', () => {
  const f = fixture();
  f.engine.start();
  for (let i = 0; i < 30; i++) {
    f.advance(111);
    f.engine.pause();
    f.advance(10000);
    f.engine.resume();
  }
  equal(f.engine.snapshot().elapsedMs, 3330);
});
test('중복 start/resume은 실행 중인 시간을 초기화하지 않음', () => {
  const f = fixture();
  f.engine.start();
  f.advance(1000);
  f.engine.start();
  f.engine.resume();
  equal(f.engine.snapshot().elapsedMs, 1000);
});
test('종료 시각에 pause해도 FINISHED 유지', () => {
  const f = fixture({ mode: 'amrap', durationSeconds: 1 });
  f.engine.start();
  f.advance(1000);
  equal(f.engine.pause().status, 'finished');
});
test('초기화는 READY/1라운드/경과0', () => {
  const f = fixture();
  f.engine.start();
  f.advance(31000);
  const s = f.engine.reset();
  equal(s.status, 'idle');
  equal(s.round, 1);
  equal(s.elapsedMs, 0);
});
test('잘못된 reset 설정은 기존 상태를 손상시키지 않음', () => {
  const f = fixture();
  f.engine.start();
  f.advance(1000);
  throws(() => f.engine.reset({ mode: 'tabata', workSeconds: 0 }));
  equal(f.engine.snapshot().status, 'running');
  equal(f.engine.snapshot().elapsedMs, 1000);
});
test('실행 상태 직렬화 후 여러 구간이 지난 상태 복원', () => {
  const f = fixture();
  f.engine.start();
  f.advance(5000);
  const data = JSON.parse(JSON.stringify(f.engine.serialize()));
  f.advance(90500);
  const s = TimerEngine.restore(data, f.clock).snapshot();
  equal(s.round, 4);
  equal(s.kind, 'work');
  equal(s.elapsedMs, 95500);
});
test('일시정지 저장은 재실행 후에도 고정', () => {
  const f = fixture();
  f.engine.start();
  f.advance(4000);
  f.engine.pause();
  const data = f.engine.serialize();
  f.advance(999999);
  const s = TimerEngine.restore(data, f.clock).snapshot();
  equal(s.status, 'paused');
  equal(s.elapsedMs, 4000);
});
test('종료 후 재실행하면 FINISHED 복원', () => {
  const f = fixture();
  f.engine.start();
  const data = f.engine.serialize();
  f.advance(500000);
  const s = TimerEngine.restore(data, f.clock).snapshot();
  equal(s.status, 'finished');
  equal(s.progress, 1);
});
test('완료 상태 재저장/복원', () => {
  const f = fixture({ mode: 'amrap', durationSeconds: 1 });
  f.engine.start();
  f.advance(1000);
  equal(TimerEngine.restore(f.engine.serialize(), f.clock).status, 'finished');
});
test('대기 상태 저장/복원', () => {
  const f = fixture();
  equal(TimerEngine.restore(f.engine.serialize(), f.clock).status, 'idle');
});
test('저장값 손상 및 버전 불일치 거부', () => {
  const f = fixture();
  const data = f.engine.serialize();
  throws(() => TimerEngine.restore({ ...data, schema: 9 }, f.clock));
  throws(() => TimerEngine.restore({ ...data, elapsedBeforeRunMs: -1 }, f.clock));
  throws(() => TimerEngine.restore({ ...data, runStartedAt: 10 }, f.clock));
});
test('활성 상태에서 시계가 뒤로 가도 표시 경과 시간 감소 방지', () => {
  const f = fixture();
  f.engine.start();
  f.advance(10000);
  f.engine.snapshot();
  f.advance(-2000);
  equal(f.engine.snapshot().elapsedMs, 10000);
});
test('시간 표기', () => {
  equal(formatSeconds(240), '04:00');
  equal(formatSeconds(3661), '1:01:01');
  equal(formatSeconds(-1), '00:00');
});
test('시작 신호는 한 번', () => {
  const f = fixture();
  const c = new CueTracker();
  c.observe(f.engine.snapshot(), { silent: true });
  const s = f.engine.start();
  equal(c.observe(s)[0].type, 'work');
  equal(c.observe(s).length, 0);
});
test('3·2·1은 각 초당 한 번', () => {
  const f = fixture();
  const c = new CueTracker();
  c.observe(f.engine.start());
  const counts = [];
  for (let ms = 70; ms < 20000; ms += 70) {
    f.setNow(1700000000000 + ms);
    for (const e of c.observe(f.engine.snapshot())) {
      if (e.type === 'countdown') counts.push(e.seconds);
    }
  }
  equal(counts.join(','), '3,2,1');
});
test('휴식 시작은 다른 효과음 이벤트', () => {
  const f = fixture();
  const c = new CueTracker();
  c.observe(f.engine.start());
  f.advance(19500);
  c.observe(f.engine.snapshot(), { silent: true });
  f.advance(500);
  equal(c.observe(f.engine.snapshot())[0].type, 'rest');
});
test('EMOM 전환은 라운드 효과음', () => {
  const f = fixture(defaultConfig('emom'));
  const c = new CueTracker();
  c.observe(f.engine.start());
  f.advance(59500);
  c.observe(f.engine.snapshot(), { silent: true });
  f.advance(500);
  equal(c.observe(f.engine.snapshot())[0].type, 'round');
});
test('일시정지 후 같은 카운트다운 재생 방지', () => {
  const f = fixture();
  const c = new CueTracker();
  c.observe(f.engine.start());
  f.advance(16500);
  c.observe(f.engine.snapshot(), { silent: true });
  f.advance(550);
  equal(c.observe(f.engine.snapshot())[0].seconds, 3);
  c.observe(f.engine.pause());
  f.advance(50000);
  equal(c.observe(f.engine.resume()).length, 0);
  f.advance(50);
  equal(c.observe(f.engine.snapshot()).length, 0);
});
test('복귀 시 지나간 신호를 몰아서 재생하지 않음', () => {
  const f = fixture();
  const c = new CueTracker();
  c.observe(f.engine.start());
  f.advance(95500);
  equal(c.observe(f.engine.snapshot(), { silent: true }).length, 0);
  equal(c.observe(f.engine.snapshot()).length, 0);
});
test('지연된 콜백의 과거 신호 생략', () => {
  const f = fixture();
  const c = new CueTracker();
  c.observe(f.engine.start());
  f.advance(30050);
  equal(c.observe(f.engine.snapshot()).length, 0);
});
test('완료 신호 한 번', () => {
  const f = fixture({ mode: 'amrap', durationSeconds: 4 });
  const c = new CueTracker();
  c.observe(f.engine.start());
  f.advance(3500);
  c.observe(f.engine.snapshot(), { silent: true });
  f.advance(500);
  const s = f.engine.snapshot();
  equal(c.observe(s)[0].type, 'finish');
  equal(c.observe(s).length, 0);
});
test('잠금 중 끝난 운동의 뒤늦은 완료음 생략', () => {
  const f = fixture({ mode: 'amrap', durationSeconds: 4 });
  const c = new CueTracker();
  c.observe(f.engine.start());
  f.advance(50000);
  equal(c.observe(f.engine.snapshot(), { silent: true }).length, 0);
});
test('짧은 구간의 시작음과 카운트다운 겹침 방지', () => {
  const f = fixture({ mode: 'amrap', durationSeconds: 3 });
  const c = new CueTracker();
  const s = f.engine.start();
  const events = c.observe(s);
  equal(events.length, 1);
  equal(events[0].type, 'work');
  equal(c.observe(s).length, 0);
});
test('AudioContext는 unlock 전 생성하지 않음', () => {
  let calls = 0;
  const a = new AudioCueManager({
    contextFactory: () => { calls++; return new FakeContext(); }
  });
  equal(calls, 0);
  assert(!a.playCue({ type: 'work' }));
  equal(calls, 0);
});
test('효과음 켜기/끄기와 노드 취소', async () => {
  const ctx = new FakeContext();
  const a = new AudioCueManager({ contextFactory: () => ctx });
  assert(await a.unlock());
  assert(a.playCue({ type: 'work' }));
  equal(ctx.created, 2);
  a.setEnabled(false);
  equal(a.nodes.size, 0);
  assert(!a.playCue({ type: 'rest' }));
  a.setEnabled(true);
  assert(a.playCue({ type: 'rest' }));
});
test('음량 0이면 발진기 생성 없음', async () => {
  const ctx = new FakeContext();
  const a = new AudioCueManager({ contextFactory: () => ctx });
  await a.unlock();
  a.setVolume(0);
  assert(!a.playCue({ type: 'work' }));
  equal(ctx.created, 0);
});
test('오디오 생성 실패는 false로 처리', async () => {
  const a = new AudioCueManager({
    contextFactory: () => { throw new Error('생성 실패'); }
  });
  equal(await a.unlock(), false);
  equal(a.status(), 'error');
});
test('오디오 resume 실패와 타이머 분리', async () => {
  const ctx = new FakeContext();
  ctx.resume = () => Promise.reject(new Error('거부'));
  const a = new AudioCueManager({ contextFactory: () => ctx });
  equal(await a.unlock(), false);
  assert(!a.playCue({ type: 'work' }));
  const f = fixture();
  f.engine.start();
  f.advance(20000);
  equal(f.engine.snapshot().kind, 'rest');
});
test('오디오 출력 실패도 외부 예외 없음', async () => {
  const ctx = new FakeContext();
  ctx.createOscillator = () => { throw new Error('출력 실패'); };
  const a = new AudioCueManager({ contextFactory: () => ctx });
  await a.unlock();
  equal(a.playCue({ type: 'work' }), false);
  equal(a.nodes.size, 0);
});
test('소리 OFF면 AudioContext를 열지 않음', async () => {
  let calls = 0;
  const a = new AudioCueManager({
    enabled: false,
    contextFactory: () => { calls++; return new FakeContext(); }
  });
  equal(await a.unlock(), false);
  equal(calls, 0);
});
test('모드별 설정과 오디오 옵션 저장/복원', () => {
  const s = new SafeStorage(memoryStorage(), 'test:');
  const p = defaultPreferences();
  p.mode = 'interval';
  p.sound = false;
  p.configs.interval.workSeconds = 45;
  s.write('preferences', p);
  const loaded = loadPreferences(s);
  equal(loaded.mode, 'interval');
  equal(loaded.sound, false);
  equal(loaded.configs.interval.workSeconds, 45);
});
test('설정 일부 손상 시 해당 모드만 기본값', () => {
  const s = new SafeStorage(memoryStorage(), 'test:');
  const p = defaultPreferences();
  p.configs.tabata.workSeconds = -1;
  p.configs.emom.rounds = 3;
  s.write('preferences', p);
  const loaded = loadPreferences(s);
  equal(loaded.configs.tabata.workSeconds, 20);
  equal(loaded.configs.emom.rounds, 3);
});
test('저장소 접근 오류는 앱을 중단하지 않음', () => {
  let warnings = 0;
  const bad = {
    getItem() { throw new Error(); },
    setItem() { throw new Error(); }
  };
  const s = new SafeStorage(bad, 'test:', () => warnings++);
  equal(s.read('session'), null);
  equal(s.write('session', {}), false);
  equal(warnings, 2);
});
test('손상 JSON 무시', () => {
  const mem = memoryStorage();
  mem.setItem('test:session', '{bad');
  equal(new SafeStorage(mem, 'test:').read('session'), null);
});
test('프로젝트 경로별 저장소 분리', () => {
  const mem = memoryStorage();
  const a = new SafeStorage(mem, 'scope-a:');
  const b = new SafeStorage(mem, 'scope-b:');
  a.write('session', { x: 1 });
  equal(b.read('session'), null);
});
test('1,000개 유효 설정의 경계·복원·종료 불변조건', () => {
  let seed = 192837;
  const rand = max => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return Math.floor(seed / 4294967296 * max);
  };
  for (let n = 0; n < 1000; n++) {
    const mode = MODES[rand(4)];
    let config;
    if (mode === 'amrap') config = { mode, durationSeconds: rand(300) + 1 };
    else if (mode === 'emom') {
      config = { mode, intervalSeconds: rand(100) + 1, rounds: rand(20) + 1 };
    } else {
      config = {
        mode, workSeconds: rand(100) + 1,
        restSeconds: rand(50), rounds: rand(20) + 1
      };
    }
    const f = fixture(config);
    const p = f.engine.plan;
    let end = 0;
    for (const segment of p.segments) {
      equal(segment.startMs, end);
      assert(segment.endMs > segment.startMs);
      end = segment.endMs;
    }
    equal(end, p.totalMs);
    f.engine.start();
    f.advance(rand(p.totalMs + 5000));
    const state = f.engine.snapshot();
    assert(state.progress >= 0 && state.progress <= 1);
    assert(state.phaseRemainingMs >= 0);
    assert(state.round <= state.totalRounds);
    const restored = TimerEngine.restore(f.engine.serialize(), f.clock).snapshot();
    equal(restored.elapsedMs, state.elapsedMs);
    equal(restored.phaseIndex, state.phaseIndex);
    f.advance(p.totalMs + 1000);
    equal(f.engine.snapshot().status, 'finished');
    equal(f.engine.snapshot().workoutRemainingMs, 0);
  }
});

export async function runSuite() {
  const results = [];
  for (const item of tests) {
    const start = Date.now();
    try {
      await item.fn();
      results.push({ name: item.name, passed: true, ms: Date.now() - start });
    } catch (error) {
      results.push({
        name: item.name, passed: false,
        error: String(error.message || error), ms: Date.now() - start
      });
    }
  }
  return {
    total: results.length,
    passed: results.filter(x => x.passed).length,
    failed: results.filter(x => !x.passed).length,
    results
  };
}

function preparationTests110() {
    test('준비: 모든 모드의 새 기본값은 10초', () => {
      const totals = { tabata: 250000, emom: 610000, amrap: 610000, interval: 240000 };
      for (const mode of MODES) {
        const config = productionDefaultConfig(mode);
        equal(config.prepareSeconds, 10);
        const plan = buildPlan(config);
        equal(plan.totalMs, totals[mode]);
        equal(plan.prepareMs, 10000);
        equal(plan.exerciseMs, totals[mode] - 10000);
      }
    });
    test('준비: 모드별 첫 구간에 딱 한 번만 생성', () => {
      for (const mode of MODES) {
        const plan = buildPlan(productionDefaultConfig(mode));
        equal(plan.segments[0].kind, 'prepare');
        equal(plan.segments[0].round, 0);
        equal(plan.segments.filter(s => s.kind === 'prepare').length, 1);
        equal(plan.segments[1].kind, 'work');
        equal(plan.segments[1].round, 1);
      }
    });
    test('준비: 0초이면 완전히 생략', () => {
      for (const mode of MODES) {
        const plan = buildPlan({ ...productionDefaultConfig(mode), prepareSeconds: 0 });
        equal(plan.prepareMs, 0);
        equal(plan.segments[0].kind, 'work');
        equal(plan.segments.filter(s => s.kind === 'prepare').length, 0);
      }
    });
    test('준비: 시작 직후 READY 구간 10초, 운동 라운드 소모 없음', () => {
      const f = fixture(productionDefaultConfig());
      equal(f.engine.snapshot().remainingSeconds, 10);
      const s = f.engine.start();
      equal(s.phaseKind, 'prepare'); equal(s.round, 0); equal(s.remainingSeconds, 10);
    });
    test('준비: 정확히 10초 뒤 첫 운동 시작', () => {
      const f = fixture(productionDefaultConfig());
      f.engine.start(); f.advance(10000);
      const s = f.engine.snapshot();
      equal(s.kind, 'work'); equal(s.round, 1); equal(s.remainingSeconds, 20);
    });
    test('준비: 30초에 첫 휴식, 40초에 두 번째 운동', () => {
      const f = fixture(productionDefaultConfig());
      f.engine.start(); f.advance(30000);
      equal(f.engine.snapshot().kind, 'rest'); equal(f.engine.snapshot().round, 1);
      f.advance(10000);
      equal(f.engine.snapshot().kind, 'work'); equal(f.engine.snapshot().round, 2);
      equal(f.engine.snapshot().remainingSeconds, 20);
    });
    test('준비: 일시정지 중 준비시간 고정', () => {
      const f = fixture(productionDefaultConfig());
      f.engine.start(); f.advance(4250); const s = f.engine.pause();
      f.advance(60000);
      equal(f.engine.snapshot().phaseRemainingMs, s.phaseRemainingMs);
      equal(f.engine.snapshot().phaseKind, 'prepare');
    });
    test('준비: 재개하면 남은 준비만 진행', () => {
      const f = fixture(productionDefaultConfig());
      f.engine.start(); f.advance(4000); f.engine.pause(); f.advance(60000);
      f.engine.resume(); f.advance(6000);
      equal(f.engine.snapshot().kind, 'work'); equal(f.engine.snapshot().remainingSeconds, 20);
      equal(f.engine.snapshot().elapsedMs, 10000);
    });
    test('준비: 운동 도중 재개해도 준비를 다시 실행하지 않음', () => {
      const f = fixture(productionDefaultConfig());
      f.engine.start(); f.advance(15000); f.engine.pause(); f.advance(60000);
      f.engine.resume(); f.advance(1000);
      equal(f.engine.snapshot().kind, 'work'); equal(f.engine.snapshot().remainingSeconds, 14);
      equal(f.engine.snapshot().phaseIndex, 1);
    });
    test('준비: 여러 구간 뒤 복원은 준비를 다시 끼워 넣지 않음', () => {
      const f = fixture(productionDefaultConfig());
      f.engine.start(); f.advance(1000); const data = f.engine.serialize(); f.advance(44000);
      const s = TimerEngine.restore(data, f.clock).snapshot();
      equal(s.round, 2); equal(s.kind, 'work'); equal(s.remainingSeconds, 15);
    });
    test('준비: 일시정지 상태의 저장/복원', () => {
      const f = fixture(productionDefaultConfig());
      f.engine.start(); f.advance(2500); f.engine.pause(); const data = f.engine.serialize();
      f.advance(100000); const s = TimerEngine.restore(data, f.clock).snapshot();
      equal(s.status, 'paused'); equal(s.phaseKind, 'prepare'); equal(s.phaseRemainingMs, 7500);
    });
    test('준비: 구버전 실행 세션은 준비0으로 복원하여 시각 유지', () => {
      const f = fixture(defaultConfig()); f.engine.start();
      const data = f.engine.serialize(); data.schema = 1; delete data.config.prepareSeconds;
      f.advance(35000); const restored = TimerEngine.restore(data, f.clock);
      equal(restored.config.prepareSeconds, 0);
      equal(restored.snapshot().totalMs, 240000);
      equal(restored.snapshot().round, 2); equal(restored.snapshot().remainingSeconds, 15);
    });
    test('준비: 음수·빈값·소수·상한초과·null 거부', () => {
      for (const prepareSeconds of [-1, '', 0.5, 601, null, 'abc']) {
        assert(!validateConfig({ ...productionDefaultConfig(), prepareSeconds }).ok);
      }
      assert(validateConfig({ ...productionDefaultConfig(), prepareSeconds: 600 }).ok);
      assert(validateConfig({ ...productionDefaultConfig(), prepareSeconds: '0' }).ok);
    });
    test('준비: 준비 포함 전체6시간 상한 적용', () => {
      assert(validateConfig({ mode: 'amrap', durationSeconds: 21590, prepareSeconds: 10 }).ok);
      assert(!validateConfig({ mode: 'amrap', durationSeconds: 21600, prepareSeconds: 1 }).ok);
    });
    test('준비: 이전 설정은 운동값 보존하며 준비10초 추가', () => {
      const store = new SafeStorage(memoryStorage(), 'prepare:');
      const p = defaultPreferences(); p.configs.tabata.workSeconds = 35;
      for (const mode of MODES) delete p.configs[mode].prepareSeconds;
      store.write('preferences', p); const loaded = loadPreferences(store);
      equal(loaded.configs.tabata.workSeconds, 35);
      for (const mode of MODES) equal(loaded.configs[mode].prepareSeconds, 10);
    });
    test('준비: 모드별 준비시간 저장 및 0초 유지', () => {
      const store = new SafeStorage(memoryStorage(), 'prepare:'); const p = defaultPreferences();
      p.configs.tabata.prepareSeconds = 0; p.configs.emom.prepareSeconds = 7;
      store.write('preferences', p); const loaded = loadPreferences(store);
      equal(loaded.configs.tabata.prepareSeconds, 0); equal(loaded.configs.emom.prepareSeconds, 7);
    });
    test('준비: 시작 효과음은 준비 신호 한 번', () => {
      const f = fixture(productionDefaultConfig()); const cues = new CueTracker();
      const s = f.engine.start(); equal(cues.observe(s)[0].type, 'prepare');
      equal(cues.observe(s).length, 0);
    });
    test('준비: 3·2·1 각1회 후 운동 시작 신호1회', () => {
      const f = fixture(productionDefaultConfig()); const cues = new CueTracker();
      cues.observe(f.engine.start()); const base = f.clock(); const events = [];
      for (let ms = 50; ms <= 10100; ms += 50) {
        f.setNow(base + ms); events.push(...cues.observe(f.engine.snapshot()));
      }
      equal(events.filter(e => e.type === 'countdown').map(e => e.seconds).join(','), '3,2,1');
      equal(events.filter(e => e.type === 'work').length, 1);
      equal(events.filter(e => e.type === 'prepare').length, 0);
    });
    test('준비: 일시정지 후 같은 초의 준비 카운트다운 중복 없음', () => {
      const f = fixture(productionDefaultConfig()); const cues = new CueTracker();
      cues.observe(f.engine.start()); f.advance(6500); cues.observe(f.engine.snapshot(), { silent: true });
      f.advance(550); equal(cues.observe(f.engine.snapshot())[0].seconds, 3);
      cues.observe(f.engine.pause()); f.advance(10000);
      equal(cues.observe(f.engine.resume()).length, 0);
    });
    test('준비: 복귀 시 과거 준비음/카운트다운 생략', () => {
      const f = fixture(productionDefaultConfig()); const cues = new CueTracker();
      cues.observe(f.engine.start()); f.advance(45000);
      equal(cues.observe(f.engine.snapshot(), { silent: true }).length, 0);
      equal(cues.observe(f.engine.snapshot()).length, 0);
    });
    test('준비: 오디오 준비 패턴과 OFF 동작', async () => {
      const ctx = new FakeContext(); const audio = new AudioCueManager({ contextFactory: () => ctx });
      await audio.unlock(); assert(audio.playCue({ type: 'prepare' })); equal(ctx.created, 2);
      audio.setEnabled(false); assert(!audio.playCue({ type: 'prepare' })); equal(audio.nodes.size, 0);
    });
    test('준비: Tabata 마지막 회복 포함 총250초에 완료', () => {
      const f = fixture(productionDefaultConfig()); f.engine.start(); f.advance(240000);
      equal(f.engine.snapshot().kind, 'rest'); assert(f.engine.snapshot().finalRecovery);
      f.advance(10000); equal(f.engine.snapshot().status, 'finished'); equal(f.engine.snapshot().remainingSeconds, 0);
    });
    test('준비: EMOM 라운드는 준비 종료 후 기준으로 전환', () => {
      const f = fixture(productionDefaultConfig('emom')); f.engine.start(); f.advance(10000);
      equal(f.engine.snapshot().round, 1); equal(f.engine.snapshot().remainingSeconds, 60);
      f.advance(60000); equal(f.engine.snapshot().round, 2); equal(f.engine.snapshot().remainingSeconds, 60);
    });
    test('준비: AMRAP 종료시간에 준비 추가', () => {
      const f = fixture({ mode: 'amrap', prepareSeconds: 10, durationSeconds: 7 });
      f.engine.start(); f.advance(10000); equal(f.engine.snapshot().remainingSeconds, 7);
      f.advance(7000); equal(f.engine.snapshot().status, 'finished');
    });
    test('준비: Interval은 준비 후 마지막 휴식 제외', () => {
      const f = fixture({ mode: 'interval', prepareSeconds: 2, workSeconds: 5, restSeconds: 4, rounds: 2 });
      equal(f.engine.plan.totalMs, 16000); equal(f.engine.plan.segments.length, 4);
      f.engine.start(); f.advance(11000); equal(f.engine.snapshot().kind, 'work'); equal(f.engine.snapshot().round, 2);
      f.advance(5000); equal(f.engine.snapshot().status, 'finished');
    });
    test('준비: 반복 일시정지/재개에도 준비는 한 번', () => {
      const f = fixture(productionDefaultConfig()); f.engine.start();
      for (let i = 0; i < 50; i++) {
        f.advance(250); f.engine.pause(); f.advance(1000); f.engine.resume();
      }
      equal(f.engine.snapshot().elapsedMs, 12500);
      equal(f.engine.snapshot().kind, 'work'); equal(f.engine.snapshot().remainingSeconds, 18);
    });
    test('준비: schema2 저장과 준비 구간 round-trip', () => {
      const f = fixture(productionDefaultConfig()); f.engine.start(); f.advance(3700);
      const data = JSON.parse(JSON.stringify(f.engine.serialize())); equal(data.schema, 2);
      const restored = TimerEngine.restore(data, f.clock).snapshot();
      equal(restored.elapsedMs, 3700); equal(restored.phaseKind, 'prepare'); equal(restored.phaseRemainingMs, 6300);
    });
    test('회귀: 준비0 Tabata 20초/30초 구간 전환', () => {
      const f = fixture(defaultConfig()); f.engine.start(); f.advance(20000);
      equal(f.engine.snapshot().kind, 'rest'); f.advance(10000);
      equal(f.engine.snapshot().kind, 'work'); equal(f.engine.snapshot().round, 2);
    });
    test('회귀: 준비0 Interval 1라운드는 마지막 휴식 없음', () => {
      const p = buildPlan({ mode: 'interval', prepareSeconds: 0, workSeconds: 5, restSeconds: 99, rounds: 1 });
      equal(p.totalMs, 5000); equal(p.segments.length, 1);
    });
    test('회귀: 준비0 휴식0의 연속 라운드', () => {
      const f = fixture({ mode: 'interval', prepareSeconds: 0, workSeconds: 5, restSeconds: 0, rounds: 3 });
      f.engine.start(); f.advance(10000); equal(f.engine.snapshot().round, 3); equal(f.engine.snapshot().remainingSeconds, 5);
    });
    test('회귀: 완료 뒤 음수시간 없음', () => {
      const f = fixture({ mode: 'amrap', prepareSeconds: 0, durationSeconds: 1 });
      f.engine.start(); f.advance(100000); equal(f.engine.snapshot().remainingSeconds, 0); equal(f.engine.snapshot().progress, 1);
    });
    test('회귀: 초기화하면 준비를 포함해 처음부터', () => {
      const f = fixture(productionDefaultConfig()); f.engine.start(); f.advance(45000);
      const s = f.engine.reset(); equal(s.status, 'idle'); equal(s.remainingSeconds, 10);
      equal(s.elapsedMs, 0); equal(s.phaseKind, 'prepare');
    });
  }
preparationTests110();
