/** 짧은 발진음만 생성한다. 백그라운드 유지용 무음 오디오를 사용하지 않는다. */
class AudioCueManager110 {
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

export const AudioCueManager = (function createAudioClass120(Base) {
    const clampVolume = value => {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 1;
    };
    const patterns = {
      prepare: [[0, 520, 0.12, 0.8], [0.20, 520, 0.12, 0.8]],
      work: [[0, 880, 0.17, 1], [0.24, 1320, 0.26, 1]],
      rest: [[0, 480, 0.30, 0.95], [0.40, 300, 0.45, 0.95]],
      emom: [[0, 980, 0.17, 1], [0.24, 1480, 0.26, 1]],
      finish: [[0, 700, 0.16, 1], [0.23, 980, 0.20, 1], [0.50, 1400, 0.70, 1]],
      countdown: [[0, 660, 0.10, 0.7]],
      halfway: [[0, 740, 0.09, 0.28]]
    };
    return class AudioCueManager extends Base {
      constructor(options = {}) {
        let capturedContext = null;
        const contextFactory = options.contextFactory || (() => {
          const Constructor = globalThis.AudioContext || globalThis.webkitAudioContext;
          if (!Constructor) throw new Error('이 환경은 Web Audio를 지원하지 않습니다.');
          return new Constructor();
        });
        const volume = clampVolume(options.volume === undefined ? 1 : options.volume);
        super({ ...options, volume, contextFactory: (...args) => {
          capturedContext = contextFactory(...args);
          return capturedContext;
        } });
        this._context120 = () => capturedContext;
        this._tones120 = new Set();
        this._utterance120 = null;
        this._cueMode120 = 'effects';
        this._enabled120 = options.enabled !== false;
        this._volume120 = volume;
        this.setVolume(volume);
        this.setCueMode(options.cueMode || 'effects');
      }
      setEnabled(enabled) {
        this._enabled120 = Boolean(enabled);
        const result = super.setEnabled(enabled);
        if (!this._enabled120) this._stop120();
        return result;
      }
      setVolume(value) {
        this._volume120 = clampVolume(value);
        const result = super.setVolume(this._volume120);
        if (this._volume120 === 0) this._stop120();
        return result;
      }
      setCueMode(mode) {
        const next = ['effects', 'ko', 'en'].includes(mode) ? mode : 'effects';
        if (this._cueMode120 !== next) this._stop120();
        this._cueMode120 = next;
      }
      cancel() {
        this._stop120();
        return super.cancel();
      }
      _stop120() {
        if (this._tones120) {
          for (const record of this._tones120) {
            try { record.oscillator.stop(); } catch (_) {}
            try { record.oscillator.disconnect(); } catch (_) {}
            try { record.gain.disconnect(); } catch (_) {}
          }
          this._tones120.clear();
        }
        if (this._utterance120) {
          this._utterance120 = null;
          try { globalThis.speechSynthesis.cancel(); } catch (_) {}
        }
      }
      _tone120(context, note) {
        const [offset, frequency, duration, strength] = note;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + 0.015 + offset;
        const peak = 0.5 * this._volume120 * strength;
        oscillator.type = 'triangle';
        if (typeof oscillator.frequency.setValueAtTime === 'function') {
          oscillator.frequency.setValueAtTime(frequency, start);
        } else {
          oscillator.frequency.value = frequency;
        }
        if (typeof gain.gain.setValueAtTime === 'function') {
          gain.gain.setValueAtTime(0, start);
          if (typeof gain.gain.linearRampToValueAtTime === 'function') {
            gain.gain.linearRampToValueAtTime(peak, start + 0.008);
            gain.gain.setValueAtTime(peak, start + Math.max(0.009, duration - 0.04));
            gain.gain.linearRampToValueAtTime(0, start + duration);
          } else {
            gain.gain.setValueAtTime(peak, start + 0.008);
            gain.gain.setValueAtTime(0, start + duration);
          }
        } else {
          gain.gain.value = peak;
        }
        oscillator.connect(gain);
        gain.connect(context.destination);
        const record = { oscillator, gain };
        this._tones120.add(record);
        oscillator.onended = () => {
          this._tones120.delete(record);
          try { oscillator.disconnect(); } catch (_) {}
          try { gain.disconnect(); } catch (_) {}
        };
        try {
          oscillator.start(start);
          oscillator.stop(start + duration + 0.02);
        } catch (error) {
          this._tones120.delete(record);
          try { oscillator.stop(); } catch (_) {}
          try { oscillator.disconnect(); } catch (_) {}
          try { gain.disconnect(); } catch (_) {}
          throw error;
        }
      }
      _speak120(type, cue) {
        if (this._cueMode120 === 'effects') return false;
        const synth = globalThis.speechSynthesis;
        const Utterance = globalThis.SpeechSynthesisUtterance;
        if (!synth || !Utterance) return false;
        const korean = this._cueMode120 === 'ko';
        const prefix = korean ? 'ko' : 'en';
        const labels = korean
          ? { prepare: '준비', work: '운동', rest: '휴식', emom: '시작', finish: '운동 완료', halfway: '절반' }
          : { prepare: 'Ready', work: 'Work', rest: 'Rest', emom: 'Go', finish: 'Workout complete', halfway: 'Halfway' };
        const spoken = type === 'countdown' && [1, 2, 3].includes(Number(cue.seconds))
          ? String(cue.seconds) : labels[type];
        if (!spoken) return false;
        try {
          const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
          const matches = voices.filter(voice => String(voice.lang).toLowerCase().startsWith(prefix));
          if (voices.length && !matches.length) return false;
          const utterance = new Utterance(spoken);
          utterance.lang = korean ? 'ko-KR' : 'en-US';
          const voice = matches.find(item => item.localService) || matches[0];
          if (voice) utterance.voice = voice;
          utterance.rate = korean ? 1.1 : 1.15;
          utterance.volume = this._volume120 * (type === 'halfway' ? 0.4 : 1);
          const clear = () => {
            if (this._utterance120 === utterance) this._utterance120 = null;
          };
          utterance.onend = clear;
          // 구분 효과음은 이미 함께 재생한다. 음성 실패 때 지난 신호를 다시 울리지 않는다.
          utterance.onerror = clear;
          this._utterance120 = utterance;
          if (typeof synth.resume === 'function') synth.resume();
          synth.speak(utterance);
          return true;
        } catch (_) {
          this._utterance120 = null;
          return false;
        }
      }
      playCue(cue) {
        if (typeof cue === 'string') cue = { type: cue };
        if (!cue || !this._enabled120 || this._volume120 <= 0) return false;
        const aliases = { complete: 'finish', completed: 'finish', finished: 'finish', done: 'finish', test: 'work' };
        const type = aliases[cue.type] || cue.type;
        const pattern = patterns[type];
        const context = this._context120 && this._context120();
        if (!pattern || !context || context.state !== 'running') return false;
        this._stop120();
        let played = false;
        try {
          for (const note of pattern) { this._tone120(context, note); played = true; }
        } catch (_) {
          this._stop120();
          played = false;
        }
        return this._speak120(type, cue) || played;
      }
    };
  })(AudioCueManager110);
