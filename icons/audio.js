/** 짧은 발진음만 생성한다. 백그라운드 유지용 무음 오디오를 사용하지 않는다. */
export class AudioCueManager {
  constructor({
    enabled = true, volume = 0.7, contextFactory = null, onStatus = () => {}
  } = {}) {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
    this.factory = contextFactory;
    this.onStatus = onStatus;
    this.context = null;
    this.master = null;
    this.nodes = new Set();
    this.failed = false;
  }
  supported() {
    return !!(this.factory || globalThis.AudioContext || globalThis.webkitAudioContext);
  }
  status() {
    if (!this.enabled) return 'off';
    if (!this.supported()) return 'unsupported';
    if (this.failed) return 'error';
    if (this.volume === 0) return 'zero-volume';
    return this.context && this.context.state === 'running'
      ? 'running' : 'needs-gesture';
  }
  report() { this.onStatus(this.status()); }
  setEnabled(value) {
    this.enabled = !!value;
    if (!this.enabled) this.cancel();
    this.report();
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.master) this.master.gain.value = this.volume * 0.4;
    this.report();
  }
  // 시작·재개·활성화 버튼의 직접 이벤트에서 호출한다.
  unlock() {
    if (!this.enabled || !this.supported()) {
      this.report();
      return Promise.resolve(false);
    }
    try {
      if (!this.context || this.context.state === 'closed') {
        const Constructor = globalThis.AudioContext || globalThis.webkitAudioContext;
        this.context = this.factory ? this.factory() : new Constructor();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume * 0.4;
        this.master.connect(this.context.destination);
        this.context.onstatechange = () => this.report();
      }
      this.failed = false;
      const operation = this.context.state === 'running'
        ? Promise.resolve() : this.context.resume();
      return Promise.resolve(operation).then(() => {
        this.report();
        return this.context.state === 'running';
      }).catch(() => {
        this.failed = true;
        this.report();
        return false;
      });
    } catch (_) {
      this.failed = true;
      this.report();
      return Promise.resolve(false);
    }
  }
  cancel() {
    for (const node of this.nodes) {
      try {
        node.oscillator.onended = null;
        node.oscillator.stop();
      } catch (_) { /* 이미 종료된 노드 */ }
      try {
        node.oscillator.disconnect();
        node.gain.disconnect();
      } catch (_) { /* 안전 정리 */ }
    }
    this.nodes.clear();
  }
  playCue(event) {
    if (!this.enabled || this.volume === 0 || !this.context ||
        this.context.state !== 'running') return false;
    const patterns = {
      prepare: [[0, 520, 0.12], [0.18, 520, 0.12]],
      work: [[0, 1050, 0.12], [0.17, 1450, 0.16]],
      rest: [[0, 390, 0.27]],
      round: [[0, 850, 0.13], [0.18, 1150, 0.15]],
      finish: [[0, 660, 0.16], [0.22, 880, 0.16], [0.44, 1320, 0.28]],
      countdown: [[0, event.seconds === 1 ? 880 : 640, 0.075]]
    };
    const pattern = patterns[event.type];
    if (!pattern) return false;
    this.cancel();
    try {
      const base = this.context.currentTime + 0.005;
      for (const [offset, frequency, duration] of pattern) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        const start = base + offset;
        oscillator.type = event.type === 'rest' ? 'sine' : 'triangle';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.6, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain);
        gain.connect(this.master);
        const node = { oscillator, gain };
        this.nodes.add(node);
        oscillator.onended = () => {
          this.nodes.delete(node);
          try {
            oscillator.disconnect();
            gain.disconnect();
          } catch (_) { /* 안전 정리 */ }
        };
        oscillator.start(start);
        oscillator.stop(start + duration + 0.01);
      }
      this.failed = false;
      this.report();
      return true;
    } catch (_) {
      this.cancel();
      this.failed = true;
      this.report();
      return false;
    }
  }
}
