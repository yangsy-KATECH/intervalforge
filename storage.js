import { MODES, defaultConfig, validateConfig } from './timer-core.js';

export class SafeStorage {
  constructor(storage, prefix, onError = () => {}) {
    this.storage = storage;
    this.prefix = prefix;
    this.onError = onError;
  }
  read(key) {
    try {
      if (!this.storage) throw new Error('저장소 없음');
      const value = this.storage.getItem(this.prefix + key);
      return value === null ? null : JSON.parse(value);
    } catch (_) {
      this.onError('저장된 데이터를 읽지 못했습니다. 설정·상태 복원이 제한될 수 있습니다.');
      return null;
    }
  }
  write(key, value) {
    try {
      if (!this.storage) throw new Error('저장소 없음');
      this.storage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch (_) {
      this.onError('기기에 저장하지 못했습니다. 현재 타이머는 작동하지만 다시 열었을 때 복원이 안 될 수 있습니다.');
      return false;
    }
  }
  remove(key) {
    try {
      if (this.storage) this.storage.removeItem(this.prefix + key);
    } catch (_) {
      this.onError('저장된 데이터를 삭제하지 못했습니다.');
    }
  }
}

export function defaultPreferences() {
  return {
    schema: 1, mode: 'tabata',
    configs: Object.fromEntries(MODES.map(mode => [mode, defaultConfig(mode)])),
    sound: true, volume: 70, keepAwake: true
  };
}

export function loadPreferences(store) {
  const defaults = defaultPreferences();
  const raw = store.read('preferences');
  if (!raw || raw.schema !== 1) return defaults;
  if (MODES.includes(raw.mode)) defaults.mode = raw.mode;
  for (const mode of MODES) {
    const result = validateConfig(raw.configs && raw.configs[mode]);
    if (result.ok && result.config.mode === mode) defaults.configs[mode] = result.config;
  }
  if (typeof raw.sound === 'boolean') defaults.sound = raw.sound;
  if (Number.isInteger(raw.volume) && raw.volume >= 0 && raw.volume <= 100) {
    defaults.volume = raw.volume;
  }
  if (typeof raw.keepAwake === 'boolean') defaults.keepAwake = raw.keepAwake;
  return defaults;
}
