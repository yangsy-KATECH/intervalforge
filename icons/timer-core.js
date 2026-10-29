/** DOM·오디오·반복 콜백에 의존하지 않는 밀리초 단위 시간 엔진. */
export const MODES = Object.freeze(['tabata', 'emom', 'amrap', 'interval']);
export const MAX_TOTAL_SECONDS = 21600;
export const LIMITS = Object.freeze({ prepare: 600, phase: 3600, rounds: 200, total: MAX_TOTAL_SECONDS });

const DEFAULTS = {
  tabata: { mode: 'tabata', prepareSeconds: 10, workSeconds: 20, restSeconds: 10, rounds: 8 },
  emom: { mode: 'emom', prepareSeconds: 10, intervalSeconds: 60, rounds: 10 },
  amrap: { mode: 'amrap', prepareSeconds: 10, durationSeconds: 600 },
  interval: { mode: 'interval', prepareSeconds: 10, workSeconds: 20, restSeconds: 10, rounds: 8 }
};

export function defaultConfig(mode = 'tabata') {
  if (!MODES.includes(mode)) throw new Error('알 수 없는 타이머 모드입니다.');
  return { ...DEFAULTS[mode] };
}

function integerInput(value, min, max, label, errors) {
  const validType = typeof value === 'number' || typeof value === 'string';
  const str = typeof value === 'string' ? value.trim() : String(value);
  const n = Number(str);
  if (!validType || !/^\d+$/.test(str) || !Number.isSafeInteger(n) || n < min || n > max) {
    errors.push(`${label}: ${min}~${max} 범위의 정수를 입력하세요.`);
    return null;
  }
  return n;
}

export function validateConfig(raw) {
  const errors = [];
  if (!raw || !MODES.includes(raw.mode)) {
    return { ok: false, config: null, errors: ['타이머 모드를 선택하세요.'] };
  }
  const config = {
    mode: raw.mode,
    prepareSeconds: integerInput(raw.prepareSeconds === undefined ? 0 : raw.prepareSeconds,
      0, LIMITS.prepare, '준비 시간(초)', errors)
  };
  if (raw.mode === 'tabata' || raw.mode === 'interval') {
    config.workSeconds = integerInput(raw.workSeconds, 1, LIMITS.phase, '운동 시간(초)', errors);
    config.restSeconds = integerInput(raw.restSeconds, 0, LIMITS.phase, '휴식 시간(초)', errors);
    config.rounds = integerInput(raw.rounds, 1, LIMITS.rounds, '라운드', errors);
  } else if (raw.mode === 'emom') {
    config.intervalSeconds = integerInput(raw.intervalSeconds, 1, LIMITS.phase, '라운드 간격(초)', errors);
    config.rounds = integerInput(raw.rounds, 1, LIMITS.rounds, '라운드', errors);
  } else {
    config.durationSeconds = integerInput(raw.durationSeconds, 1, LIMITS.total, '전체 운동 시간(초)', errors);
  }
  if (errors.length === 0) {
    let total;
    if (raw.mode === 'amrap') total = config.durationSeconds;
    else if (raw.mode === 'emom') total = config.intervalSeconds * config.rounds;
    else {
      total = config.workSeconds * config.rounds +
        config.restSeconds * (config.rounds - (raw.mode === 'interval' ? 1 : 0));
    }
    total += config.prepareSeconds;
    if (total > MAX_TOTAL_SECONDS) errors.push('준비를 포함한 전체 시간은 6시간(21600초)을 넘을 수 없습니다.');
  }
  return { ok: errors.length === 0, config: errors.length === 0 ? config : null, errors };
}

export function buildPlan(raw) {
  const result = validateConfig(raw);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  const config = result.config;
  const segments = [];
  let cursor = 0;
  function add(kind, seconds, round, finalRecovery = false) {
    if (seconds === 0) return;
    segments.push(Object.freeze({
      kind, seconds, round, startMs: cursor, endMs: cursor + seconds * 1000, finalRecovery
    }));
    cursor += seconds * 1000;
  }
  add('prepare', config.prepareSeconds, 0);
  if (config.mode === 'amrap') {
    add('work', config.durationSeconds, 1);
  } else if (config.mode === 'emom') {
    for (let round = 1; round <= config.rounds; round++) {
      add('work', config.intervalSeconds, round);
    }
  } else {
    for (let round = 1; round <= config.rounds; round++) {
      add('work', config.workSeconds, round);
      if (config.mode === 'tabata' || round < config.rounds) {
        add('rest', config.restSeconds, round, config.mode === 'tabata' && round === config.rounds);
      }
    }
  }
  return Object.freeze({
    config: Object.freeze(config), segments: Object.freeze(segments),
    totalMs: cursor, prepareMs: config.prepareSeconds * 1000,
    exerciseMs: cursor - config.prepareSeconds * 1000, rounds: config.rounds || 1
  });
}

function finiteTime(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 8640000000000000;
}

export class TimerEngine {
  constructor(config = defaultConfig(), clock = () => Date.now()) {
    this.clock = clock;
    this.reset(config);
  }
  reset(config = this.config) {
    const plan = buildPlan(config);
    this.plan = plan;
    this.config = plan.config;
    this.status = 'idle';
    this.elapsedBeforeRunMs = 0;
    this.runStartedAt = null;
    this.highWaterMs = 0;
    this.completedAt = null;
    return this.snapshot();
  }
  start(now = this.clock()) {
    if (this.status !== 'idle') return this.snapshot(now);
    this.status = 'running';
    this.runStartedAt = now;
    return this.snapshot(now);
  }
  pause(now = this.clock()) {
    const state = this.snapshot(now);
    if (this.status === 'running') {
      this.elapsedBeforeRunMs = state.elapsedMs;
      this.highWaterMs = state.elapsedMs;
      this.runStartedAt = null;
      this.status = 'paused';
    }
    return this.snapshot(now);
  }
  resume(now = this.clock()) {
    if (this.status === 'paused') {
      this.runStartedAt = now;
      this.status = 'running';
    }
    return this.snapshot(now);
  }
  snapshot(now = this.clock()) {
    let elapsed = this.elapsedBeforeRunMs;
    if (this.status === 'running') {
      elapsed = Math.max(
        this.highWaterMs,
        this.elapsedBeforeRunMs + Math.max(0, now - this.runStartedAt)
      );
      elapsed = Math.min(elapsed, this.plan.totalMs);
      this.highWaterMs = elapsed;
      if (elapsed >= this.plan.totalMs) {
        this.completedAt = this.runStartedAt + this.plan.totalMs - this.elapsedBeforeRunMs;
        this.elapsedBeforeRunMs = this.plan.totalMs;
        this.runStartedAt = null;
        this.status = 'finished';
      }
    }
    elapsed = Math.min(this.plan.totalMs, Math.max(0, elapsed));
    let index = 0;
    while (index < this.plan.segments.length - 1 &&
           elapsed >= this.plan.segments[index].endMs) index++;
    const segment = this.plan.segments[index];
    const finished = this.status === 'finished';
    const phaseRemainingMs = finished ? 0 : Math.max(0, segment.endMs - elapsed);
    return Object.freeze({
      mode: this.config.mode, status: this.status,
      kind: finished ? 'finished' : this.status === 'idle' ? 'ready' : segment.kind,
      phaseKind: segment.kind, phaseIndex: index,
      round: segment.round, totalRounds: this.plan.rounds,
      totalMs: this.plan.totalMs, elapsedMs: elapsed,
      prepareMs: this.plan.prepareMs, exerciseMs: this.plan.exerciseMs,
      preparing: !finished && segment.kind === 'prepare',
      workoutRemainingMs: this.plan.totalMs - elapsed,
      phaseRemainingMs, remainingSeconds: Math.ceil(phaseRemainingMs / 1000),
      phaseDurationMs: segment.seconds * 1000,
      segmentStartMs: segment.startMs, segmentEndMs: segment.endMs,
      progress: elapsed / this.plan.totalMs,
      finalRecovery: segment.finalRecovery,
      targetEndAt: this.status === 'running'
        ? this.runStartedAt + this.plan.totalMs - this.elapsedBeforeRunMs : null,
      finishedAgoMs: finished && this.completedAt !== null
        ? Math.max(0, now - this.completedAt) : 0
    });
  }
  serialize(now = this.clock()) {
    this.snapshot(now);
    return {
      schema: 2, config: { ...this.config }, status: this.status,
      elapsedBeforeRunMs: this.elapsedBeforeRunMs,
      runStartedAt: this.runStartedAt,
      highWaterMs: this.highWaterMs,
      completedAt: this.completedAt,
      savedAt: now
    };
  }
  static restore(data, clock = () => Date.now()) {
    if (!data || ![1, 2].includes(data.schema) ||
        !['idle', 'running', 'paused', 'finished'].includes(data.status)) {
      throw new Error('저장된 타이머의 형식 또는 버전이 올바르지 않습니다.');
    }
    const config = data.schema === 1 ? { ...data.config, prepareSeconds: 0 } : data.config;
    const engine = new TimerEngine(config, clock);
    const total = engine.plan.totalMs;
    if (!finiteTime(data.elapsedBeforeRunMs) || data.elapsedBeforeRunMs > total ||
        !finiteTime(data.highWaterMs) || data.highWaterMs > total ||
        data.highWaterMs < data.elapsedBeforeRunMs) {
      throw new Error('저장된 경과 시간이 올바르지 않습니다.');
    }
    if (data.status === 'running' && !finiteTime(data.runStartedAt)) {
      throw new Error('시작 시각을 복원할 수 없습니다.');
    }
    if (data.status !== 'running' && data.runStartedAt !== null) {
      throw new Error('타이머 상태와 시작 시각이 일치하지 않습니다.');
    }
    if (data.status === 'idle' &&
        (data.elapsedBeforeRunMs !== 0 || data.highWaterMs !== 0)) {
      throw new Error('대기 상태의 저장값이 올바르지 않습니다.');
    }
    if (data.status === 'paused' && data.elapsedBeforeRunMs !== data.highWaterMs) {
      throw new Error('일시정지 상태의 저장값이 올바르지 않습니다.');
    }
    if (data.status === 'finished' &&
        (data.elapsedBeforeRunMs !== total || data.highWaterMs !== total ||
         !finiteTime(data.completedAt))) {
      throw new Error('완료 상태의 저장값이 올바르지 않습니다.');
    }
    if (data.status !== 'finished' && data.completedAt !== null) {
      throw new Error('완료 시각이 현재 상태와 일치하지 않습니다.');
    }
    engine.status = data.status;
    engine.elapsedBeforeRunMs = data.elapsedBeforeRunMs;
    engine.runStartedAt = data.runStartedAt;
    engine.highWaterMs = data.highWaterMs;
    engine.completedAt = data.completedAt;
    engine.snapshot();
    return engine;
  }
}

export function formatSeconds(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
