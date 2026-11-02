/** 구간·초 단위 중복 방지. 늦은 콜백과 화면 복귀 시 지나간 효과음은 버린다. */
class CueTracker110 {
  constructor() { this.reset(); }
  reset() {
    this.previous = null;
    this.emitted = new Set();
  }
  observe(state, { silent = false } = {}) {
    const previous = this.previous;
    this.previous = state;
    const events = [];
    if (state.status === 'idle') return events;

    const startKey = `phase:${state.phaseIndex}:start`;
    const secondKey = `phase:${state.phaseIndex}:second:${state.remainingSeconds}`;
    const isCountdown = state.remainingSeconds >= 1 && state.remainingSeconds <= 3;
    const phaseChanged = !previous || previous.status === 'idle' ||
      previous.phaseIndex !== state.phaseIndex;
    const delayed = previous && state.elapsedMs - previous.elapsedMs > 1800;
    const canSpeak = !silent && !delayed;

    if (state.status === 'finished') {
      if (!this.emitted.has('finish')) {
        this.emitted.add('finish');
        if (canSpeak && previous && previous.status === 'running' &&
            state.finishedAgoMs <= 800) events.push({ type: 'finish' });
      }
      return events;
    }
    if (state.status === 'paused') {
      this.emitted.add(startKey);
      if (isCountdown) this.emitted.add(secondKey);
      return events;
    }
    if (phaseChanged && !this.emitted.has(startKey)) {
      this.emitted.add(startKey);
      if (canSpeak && state.elapsedMs - state.segmentStartMs <= 650) {
        events.push({
          type: state.phaseKind === 'prepare' ? 'prepare' :
            state.phaseKind === 'rest' ? 'rest' :
            state.mode === 'emom' ? 'round' : 'work'
        });
      }
      // 3초 이하 구간의 첫 순간에는 구간 시작음을 우선한다.
      if (isCountdown) this.emitted.add(secondKey);
    } else if (isCountdown && !this.emitted.has(secondKey)) {
      this.emitted.add(secondKey);
      if (canSpeak && previous && previous.status === 'running') {
        events.push({ type: 'countdown', seconds: state.remainingSeconds });
      }
    }
    if (silent && isCountdown) this.emitted.add(secondKey);
    return events;
  }
}

export const CueTracker = (function createCueClass120(Base) {
    return class CueTracker extends Base {
      constructor(...args) {
        super(...args);
        this._halfwayEnabled120 = false;
        this._configProvider120 = null;
        this._previous120 = null;
        this._halfwayDone120 = new Set();
      }
      reset(...args) {
        const result = super.reset(...args);
        this._previous120 = null;
        this._halfwayDone120 = new Set();
        return result;
      }
      setHalfwayEnabled(enabled) { this._halfwayEnabled120 = Boolean(enabled); }
      setConfigProvider(provider) {
        this._configProvider120 = typeof provider === 'function' ? provider : null;
      }
      observe(state, options = {}) {
        const events = [...super.observe(state, options)];
        const previous = this._previous120;
        this._previous120 = {
          status: state.status, phaseIndex: state.phaseIndex,
          remaining: Number(state.phaseRemainingMs), elapsed: Number(state.elapsedMs)
        };
        if (!['work', 'rest'].includes(state.phaseKind)) return events;
        let config = {};
        try { config = this._configProvider120 ? this._configProvider120() : (state.config || {}); } catch (_) {}
        const seconds = state.phaseKind === 'rest' ? config.restSeconds
          : state.mode === 'amrap' ? config.durationSeconds
          : state.mode === 'emom' ? config.intervalSeconds : config.workSeconds;
        const duration = Number(seconds) * 1000 || Number(state.phaseDurationMs);
        const remaining = Number(state.phaseRemainingMs);
        if (!Number.isFinite(duration) || duration <= 6000 || !Number.isFinite(remaining)) return events;
        const halfway = duration / 2;
        const key = String(state.phaseIndex);
        if (remaining > halfway || this._halfwayDone120.has(key)) return events;
        // 비활성·일시정지·복원 상태에서도 이미 지난 경계는 소비한다.
        this._halfwayDone120.add(key);
        const delta = previous ? Number(state.elapsedMs) - previous.elapsed : Infinity;
        const crossedNormally = previous && previous.status === 'running'
          && state.status === 'running' && previous.phaseIndex === state.phaseIndex
          && previous.remaining > halfway && delta >= 0 && delta <= 750;
        if (this._halfwayEnabled120 && !options.silent && crossedNormally && remaining > 3000) {
          events.push({ type: 'halfway', phaseIndex: state.phaseIndex, round: state.round });
        }
        return events;
      }
    };
  })(CueTracker110);
