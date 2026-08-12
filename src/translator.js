(() => {
  const PST = globalThis.ParamountSubtitles;

  class SubtitleTranslator extends EventTarget {
    constructor(cache) {
      super();
      this.cache = cache;
      this.localTranslator = null;
      this.preparePromise = null;
      this.queue = Promise.resolve();
      this.status = {
        engine: "local",
        state: "checking",
        progress: 0,
        message: "正在检查本地翻译",
      };
    }

    setStatus(patch) {
      this.status = { ...this.status, ...patch };
      this.dispatchEvent(new CustomEvent("status", { detail: this.status }));
    }

    async inspectLocal() {
      if (!("Translator" in globalThis)) {
        this.setStatus({
          engine: "local",
          state: "unavailable",
          message: "当前 Chrome 不支持本地翻译",
        });
        return "unavailable";
      }

      try {
        const availability = await Translator.availability({
          sourceLanguage: "en",
          targetLanguage: "zh",
        });
        const ready = availability === "available";
        this.setStatus({
          engine: "local",
          state: ready ? "ready" : availability,
          progress: ready ? 1 : 0,
          message: ready ? "Chrome 本地翻译已就绪" : "播放时自动准备本地翻译",
        });
        return availability;
      } catch (error) {
        this.setStatus({
          engine: "local",
          state: "error",
          message: error?.message || "无法检查本地翻译",
        });
        return "unavailable";
      }
    }

    async prepareLocal() {
      if (this.localTranslator) return this.localTranslator;
      if (this.preparePromise) return this.preparePromise;
      if (!("Translator" in globalThis)) {
        throw new Error("当前 Chrome 不支持 Translator API");
      }

      this.setStatus({ state: "downloading", progress: 0, message: "正在准备语言包 0%" });
      this.preparePromise = Translator.create({
        sourceLanguage: "en",
        targetLanguage: "zh",
        monitor: (monitor) => {
          monitor.addEventListener("downloadprogress", (event) => {
            const progress = Math.max(0, Math.min(1, Number(event.loaded) || 0));
            this.setStatus({
              state: progress >= 1 ? "ready" : "downloading",
              progress,
              message: progress >= 1
                ? "Chrome 本地翻译已就绪"
                : `正在准备语言包 ${Math.round(progress * 100)}%`,
            });
          });
        },
      }).then((translator) => {
        this.localTranslator = translator;
        this.setStatus({ state: "ready", progress: 1, message: "Chrome 本地翻译已就绪" });
        return translator;
      }).catch((error) => {
        this.preparePromise = null;
        this.setStatus({ state: "error", message: error?.message || "语言包准备失败" });
        throw error;
      });

      return this.preparePromise;
    }

    translate(text, settings, options = {}) {
      const cleanText = PST.normalizeSubtitle(text);
      if (!cleanText) return Promise.resolve("");
      const task = () => this.translateNow(cleanText, settings, options);
      const result = this.queue.then(task, task);
      this.queue = result.catch(() => undefined);
      return result;
    }

    async translateNow(text, settings, options) {
      const engine = settings.engine || "local";
      const source = settings.sourceLanguage || "en";
      const target = settings.targetLanguage || "zh";
      const cached = await this.cache.get(text, source, target, engine);
      if (cached) return cached;

      let translated;
      if (engine === "google") {
        this.setStatus({ engine, state: "ready", message: "Google 备用翻译" });
        const response = await PST.safeSendMessage({
          type: "GOOGLE_TRANSLATE",
          text,
          source,
          target,
        });
        if (!response?.ok) throw new Error(response?.error || "Google 翻译失败");
        translated = response.translation;
      } else {
        const availability = this.localTranslator ? "available" : await this.inspectLocal();
        if (!this.localTranslator && availability === "unavailable") {
          throw new Error("当前 Chrome 无法使用本地翻译");
        }
        if (!this.localTranslator && availability !== "available" && !navigator.userActivation?.isActive) {
          const error = new Error("首次播放交互时会自动准备本地翻译");
          error.code = "NEEDS_ACTIVATION";
          throw error;
        }
        const translator = await this.prepareLocal();
        translated = await translator.translate(text);
      }

      const cleanTranslation = PST.normalizeSubtitle(translated);
      if (!options.skipCache) {
        await this.cache.set(text, source, target, engine, cleanTranslation);
      }
      return cleanTranslation;
    }
  }

  PST.SubtitleTranslator = SubtitleTranslator;
})();
