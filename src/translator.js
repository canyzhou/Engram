(() => {
  const PST = globalThis.ParamountSubtitles;
  const t = (key, substitutions) => PST.t?.(key, substitutions) || key;

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
        message: t("checkingLocalTranslation"),
      };
    }

    setStatus(patch) {
      this.status = { ...this.status, ...patch };
      this.dispatchEvent(new CustomEvent("status", { detail: this.status }));
    }

    localizeStatus() {
      const { engine, state, progress } = this.status;
      let message = this.status.message;
      if (state === "checking") message = t("checkingLocalTranslation");
      else if (state === "unavailable") message = t("chromeLocalUnavailable");
      else if (state === "downloadable") message = t("prepareOnPlayback");
      else if (state === "downloading") message = t("preparingLanguagePack", Math.round((progress || 0) * 100));
      else if (state === "translating" && engine === "deepseek") message = t("deepseekTranslating");
      else if (state === "ready" && engine === "deepseek") message = t("deepseekReady");
      else if (state === "ready" && engine === "google") message = t("googleTranslation");
      else if (state === "ready") message = t("chromeLocalReady");
      this.setStatus({ message });
    }

    async inspectLocal() {
      if (!("Translator" in globalThis)) {
        this.setStatus({
          engine: "local",
          state: "unavailable",
          message: t("chromeLocalUnavailable"),
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
          message: ready ? t("chromeLocalReady") : t("prepareOnPlayback"),
        });
        return availability;
      } catch (error) {
        this.setStatus({
          engine: "local",
          state: "error",
          message: error?.message || t("cannotInspectLocalTranslation"),
        });
        return "unavailable";
      }
    }

    async prepareLocal() {
      if (this.localTranslator) return this.localTranslator;
      if (this.preparePromise) return this.preparePromise;
      if (!("Translator" in globalThis)) {
        throw new Error(t("translatorApiUnsupported"));
      }

      this.setStatus({ state: "downloading", progress: 0, message: t("preparingLanguagePack", 0) });
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
                ? t("chromeLocalReady")
                : t("preparingLanguagePack", Math.round(progress * 100)),
            });
          });
        },
      }).then((translator) => {
        this.localTranslator = translator;
        this.setStatus({ state: "ready", progress: 1, message: t("chromeLocalReady") });
        return translator;
      }).catch((error) => {
        this.preparePromise = null;
        this.setStatus({ state: "error", message: error?.message || t("languagePackFailed") });
        throw error;
      });

      return this.preparePromise;
    }

    translate(text, settings, options = {}) {
      const cleanText = PST.normalizeSubtitle(text);
      if (!cleanText) return Promise.resolve("");
      const task = () => this.translateNow(cleanText, settings, options);
      // LLM requests carry their own context and may take longer than a subtitle
      // remains on screen. Do not let an older request block the next cue.
      if (settings.engine === "deepseek") return task();
      const result = this.queue.then(task, task);
      this.queue = result.catch(() => undefined);
      return result;
    }

    async translateNow(text, settings, options) {
      const engine = settings.engine || "local";
      const source = settings.sourceLanguage || "en";
      const target = settings.targetLanguage || "zh";
      const context = (options.context || [])
        .map((line) => PST.normalizeSubtitle(line))
        .filter(Boolean)
        .slice(-4);
      const cacheText = engine === "deepseek"
        ? `v2:deepseek-v4-flash:${context.join("\n")}\n---\n${text}`
        : text;
      const cached = await this.cache.get(cacheText, source, target, engine);
      if (cached) return cached;

      let translated;
      if (engine === "deepseek") {
        this.setStatus({ engine, state: "translating", message: t("deepseekTranslating") });
        const response = await PST.safeSendMessage({
          type: "DEEPSEEK_TRANSLATE",
          text,
          context,
          source,
          target,
        });
        if (!response?.ok) {
          const message = response?.error || t("deepseekFailed");
          this.setStatus({ engine, state: "error", message });
          throw new Error(message);
        }
        translated = response.translation;
        this.setStatus({ engine, state: "ready", progress: 1, message: t("deepseekReady") });
      } else if (engine === "google") {
        this.setStatus({ engine, state: "ready", message: t("googleTranslation") });
        const response = await PST.safeSendMessage({
          type: "GOOGLE_TRANSLATE",
          text,
          source,
          target,
        });
        if (!response?.ok) throw new Error(response?.error || t("googleTranslationFailed"));
        translated = response.translation;
      } else {
        const availability = this.localTranslator ? "available" : await this.inspectLocal();
        if (!this.localTranslator && availability === "unavailable") {
          throw new Error(t("chromeLocalCannotTranslate"));
        }
        if (!this.localTranslator && availability !== "available" && !navigator.userActivation?.isActive) {
          const error = new Error(t("firstPlaybackPrepares"));
          error.code = "NEEDS_ACTIVATION";
          throw error;
        }
        const translator = await this.prepareLocal();
        translated = await translator.translate(text);
      }

      const cleanTranslation = PST.normalizeSubtitle(translated);
      if (!options.skipCache) {
        await this.cache.set(cacheText, source, target, engine, cleanTranslation);
      }
      return cleanTranslation;
    }
  }

  PST.SubtitleTranslator = SubtitleTranslator;
})();
