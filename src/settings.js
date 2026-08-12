(() => {
  const PST = globalThis.ParamountSubtitles;

  const DEFAULTS = Object.freeze({
    uiLanguage: "en",
    enabled: true,
    mode: "bilingual",
    sourceLanguage: "en",
    targetLanguage: "zh",
    engine: "local",
    fontSize: 28,
    backgroundOpacity: 0.45,
    position: 13,
    rewindSeconds: 5,
    learningHints: false,
    learningLevels: ["c1", "c2"],
    hoverDictionary: true,
    hideNative: true,
    debugToast: false,
    captionPlacement: null,
    statusPlacement: null,
  });

  const isInvalidatedContextError = (error) => (
    /extension context invalidated/i.test(String(error?.message || error))
  );

  const getSyncStorage = () => {
    try {
      if (!globalThis.chrome?.runtime?.id) return null;
      return chrome.storage?.sync || null;
    } catch (error) {
      if (isInvalidatedContextError(error)) return null;
      throw error;
    }
  };

  class SettingsStore {
    constructor() {
      this.value = { ...DEFAULTS };
      this.listeners = new Set();
      this.ready = this.load();
    }

    async load() {
      const storage = getSyncStorage();
      if (storage) {
        try {
          const stored = await storage.get(DEFAULTS);
          this.value = { ...DEFAULTS, ...stored };
        } catch (error) {
          if (!isInvalidatedContextError(error)) throw error;
        }
      }
      this.emit();
      return this.value;
    }

    async update(patch) {
      this.value = { ...this.value, ...patch };
      const storage = getSyncStorage();
      if (storage) {
        try {
          await storage.set(patch);
        } catch (error) {
          if (!isInvalidatedContextError(error)) throw error;
        }
      }
      this.emit();
      return this.value;
    }

    subscribe(listener) {
      this.listeners.add(listener);
      listener(this.value);
      return () => this.listeners.delete(listener);
    }

    emit() {
      for (const listener of this.listeners) listener(this.value);
    }
  }

  PST.DEFAULT_SETTINGS = DEFAULTS;
  PST.SettingsStore = SettingsStore;
})();
