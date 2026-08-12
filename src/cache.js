(() => {
  const PST = globalThis.ParamountSubtitles;

  class TranslationCache {
    constructor() {
      this.dbPromise = null;
      this.memory = new Map();
    }

    open() {
      if (!globalThis.indexedDB) return Promise.resolve(null);
      if (this.dbPromise) return this.dbPromise;

      this.dbPromise = new Promise((resolve) => {
        const request = indexedDB.open("paramount-subtitle-translator", 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("translations")) {
            db.createObjectStore("translations", { keyPath: "key" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
      return this.dbPromise;
    }

    key(text, source, target, engine) {
      return `${source}:${target}:${engine}:${PST.hash(text)}`;
    }

    async get(text, source, target, engine) {
      const key = this.key(text, source, target, engine);
      if (this.memory.has(key)) return this.memory.get(key);
      const db = await this.open();
      if (!db) return null;

      return new Promise((resolve) => {
        const transaction = db.transaction("translations", "readonly");
        const request = transaction.objectStore("translations").get(key);
        request.onsuccess = () => {
          const value = request.result?.value || null;
          if (value) this.memory.set(key, value);
          resolve(value);
        };
        request.onerror = () => resolve(null);
      });
    }

    async set(text, source, target, engine, value) {
      const key = this.key(text, source, target, engine);
      this.memory.set(key, value);
      const db = await this.open();
      if (!db) return;

      const transaction = db.transaction("translations", "readwrite");
      transaction.objectStore("translations").put({
        key,
        value,
        updatedAt: Date.now(),
      });
    }
  }

  PST.TranslationCache = TranslationCache;
})();
