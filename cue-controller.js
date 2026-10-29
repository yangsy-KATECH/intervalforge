/** 구간·초 단위 중복 방지. 늦은 콜백과 화면 복귀 시 지나간 효과음은 버린다. */
export class CueTracker {
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
