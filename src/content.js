(() => {
  if (globalThis.__PARAMOUNT_SUBTITLE_CONTENT__) return;
  globalThis.__PARAMOUNT_SUBTITLE_CONTENT__ = true;

  const PST = globalThis.ParamountSubtitles;
  const settingsStore = new PST.SettingsStore();
  const cache = new PST.TranslationCache();
  const translator = new PST.SubtitleTranslator(cache);
  const dictionary = new PST.DictionaryService(translator);
  const overlay = new PST.SubtitleOverlay(dictionary);
  const capture = new PST.CaptureCoordinator();
  let settings = { ...PST.DEFAULT_SETTINGS };
  let cueToken = 0;
  let currentCue = { text: "", translation: "", source: "", wordHints: [] };
  let preparingFromInteraction = false;

  const mount = () => {
    if (!document.documentElement) return;
    overlay.mount();
    capture.start();
    PST.safeSendMessage({ type: "REGISTER_PARAMOUNT_TAB" });
  };

  const statusMessage = () => {
    const source = capture.lastCue.source || "字幕探针";
    const engine = settings.engine === "google" ? "Google 备用翻译" : "Chrome 本地翻译";
    return `已捕获 ${source} · ${engine}`;
  };

  const renderTranslatorStatus = (state) => {
    if (!settings.enabled) {
      overlay.setStatus({ message: "", open: false });
      return;
    }
    if (!settings.debugToast) {
      overlay.setStatus({ message: "", open: false });
      return;
    }
    if (settings.engine === "google") {
      overlay.setStatus({ message: statusMessage(), tone: "ok", open: settings.debugToast });
      return;
    }
    if (state.state === "ready") {
      overlay.setStatus({ message: statusMessage(), tone: "ok", open: settings.debugToast });
    } else if (["downloadable", "unavailable"].includes(state.state)) {
      overlay.setStatus({
        message: state.state === "unavailable" ? state.message : "播放时自动准备本地翻译",
        tone: state.state === "unavailable" ? "error" : "warn",
        actionable: state.state !== "unavailable",
        open: true,
      });
    } else if (state.state === "downloading") {
      overlay.setStatus({ message: state.message, tone: "warn", progress: state.progress, open: true });
    } else if (state.state === "error") {
      overlay.setStatus({ message: state.message, tone: "error", actionable: true, open: true });
    }
  };

  const loadLearningHints = async (token, text, settingsSnapshot) => {
    const difficultWords = PST.selectDifficultWords(text, 3);
    if (!difficultWords.length) return;
    const entries = await dictionary.lookupMany(difficultWords, settingsSnapshot);
    if (token !== cueToken) return;
    currentCue = { ...currentCue, wordHints: entries };
    overlay.setLearningHints(entries);
    renderTranslatorStatus(translator.status);
  };

  const handleCue = async (cue) => {
    const token = ++cueToken;
    currentCue = { text: cue.text, translation: "", source: cue.source, wordHints: [] };
    if (!settings.enabled || !cue.text) {
      overlay.clearCue();
      return;
    }

    overlay.setCue(currentCue);
    renderTranslatorStatus(translator.status);
    if (settings.learningHints && settings.mode !== "chinese") {
      loadLearningHints(token, cue.text, { ...settings }).catch(() => undefined);
    }
    if (settings.mode === "english") return;

    try {
      const translation = await translator.translate(cue.text, settings);
      if (token !== cueToken) return;
      currentCue = { ...currentCue, translation };
      overlay.setCue(currentCue);
      renderTranslatorStatus(translator.status);
    } catch (error) {
      if (token !== cueToken) return;
      if (error?.code === "NEEDS_ACTIVATION") {
        overlay.setStatus({
          message: "播放时自动准备本地翻译",
          tone: "warn",
          actionable: true,
          open: true,
        });
      } else {
        overlay.setStatus({
          message: error?.message || "字幕翻译失败",
          tone: "error",
          open: true,
        });
      }
    }
  };

  settingsStore.subscribe((nextSettings) => {
    settings = { ...nextSettings };
    overlay.updateSettings(settings);
    capture.configure({
      enabled: settings.enabled,
      hideNative: settings.hideNative,
      sourceLanguage: settings.sourceLanguage,
    });
    if (!settings.enabled) overlay.clearCue();
    else if (currentCue.text) handleCue({ text: currentCue.text, source: currentCue.source });
    renderTranslatorStatus(translator.status);
  });

  translator.addEventListener("status", (event) => renderTranslatorStatus(event.detail));
  const rewindPreviousCue = () => {
    if (!settings.enabled) return;
    const result = capture.rewindPrevious(settings.rewindSeconds);
    overlay.showRewindResult(result);
  };
  const prepareFromNaturalInteraction = async () => {
    if (
      preparingFromInteraction
      || !settings.enabled
      || settings.engine !== "local"
      || translator.localTranslator
      || translator.status.state === "unavailable"
    ) return;
    preparingFromInteraction = true;
    try {
      await translator.prepareLocal();
      if (currentCue.text) handleCue({ text: currentCue.text, source: currentCue.source });
    } catch {
      // A later trusted player interaction can retry if Chrome did not grant activation yet.
    } finally {
      preparingFromInteraction = false;
    }
  };
  document.addEventListener("pointerdown", prepareFromNaturalInteraction, { capture: true, passive: true });
  document.addEventListener("keydown", prepareFromNaturalInteraction, { capture: true });
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const insideOverlay = event.composedPath().includes(overlay.host);
    const isTyping = target instanceof HTMLElement && (
      target.matches("input, textarea, select") || target.isContentEditable
    );
    if (
      insideOverlay
      || isTyping
      || event.repeat
      || event.ctrlKey
      || event.metaKey
      || event.altKey
      || event.key !== "ArrowLeft"
    ) return;
    event.preventDefault();
    event.stopPropagation();
    rewindPreviousCue();
  }, { capture: true });
  settingsStore.ready.then(() => translator.inspectLocal());

  overlay.addEventListener("cue:previous", rewindPreviousCue);
  overlay.addEventListener("playback:hover", (event) => {
    capture.setSubtitleHover(Boolean(event.detail?.active));
  });
  overlay.addEventListener("translator:activate", async () => {
    try {
      await translator.prepareLocal();
      if (currentCue.text) handleCue({ text: currentCue.text, source: currentCue.source });
    } catch (error) {
      overlay.setStatus({ message: error?.message || "本地翻译准备失败", tone: "error", open: true });
    }
  });
  overlay.addEventListener("status:dismiss", () => settingsStore.update({ debugToast: false }));
  overlay.addEventListener("placement:change", (event) => {
    const key = event.detail.target === "status" ? "statusPlacement" : "captionPlacement";
    settingsStore.update({ [key]: event.detail.placement });
  });
  overlay.addEventListener("vocabulary:add", async (event) => {
    const lemma = event.detail?.lemma;
    try {
      if (!chrome.storage?.local) throw new Error("存储不可用");
      const { vocabulary = [] } = await chrome.storage.local.get({ vocabulary: [] });
      const entry = { ...event.detail, sentence: currentCue.text, addedAt: Date.now() };
      const next = [entry, ...vocabulary.filter((item) => item.lemma !== entry.lemma)].slice(0, 500);
      await chrome.storage.local.set({ vocabulary: next });
      overlay.showVocabularyResult({ state: "success", lemma });
      overlay.setStatus({ message: `已加入生词：${entry.lemma}`, tone: "ok", open: true });
    } catch (error) {
      const message = error?.message || "请稍后重试";
      overlay.showVocabularyResult({ state: "error", lemma, error: message });
      overlay.setStatus({ message: `加入生词失败：${message}`, tone: "error", open: true });
    }
  });

  capture.addEventListener("cue", (event) => handleCue(event.detail));
  capture.addEventListener("status", () => renderTranslatorStatus(translator.status));
  capture.addEventListener("network", () => renderTranslatorStatus(translator.status));

  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area !== "sync") return;
    const patch = {};
    for (const [key, change] of Object.entries(changes)) patch[key] = change.newValue;
    settingsStore.value = { ...settingsStore.value, ...patch };
    settingsStore.emit();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "GET_STATUS") {
      sendResponse({
        ok: true,
        version: PST.VERSION,
        settings,
        capture: capture.status(),
        translator: translator.status,
        cue: currentCue,
        url: location.href,
      });
      return false;
    }
    if (message?.type === "PREVIEW_CUE") {
      capture.simulate(message.text);
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type === "SETTINGS_UPDATED") {
      settingsStore.value = { ...settingsStore.value, ...message.patch };
      settingsStore.emit();
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });

  globalThis.__PST_CONTROLLER__ = {
    settingsStore,
    translator,
    overlay,
    capture,
    simulate: (text) => capture.simulate(text),
  };

  if (document.documentElement) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
})();
