(() => {
  if (globalThis.__PARAMOUNT_SUBTITLE_CONTENT__) return;
  globalThis.__PARAMOUNT_SUBTITLE_CONTENT__ = true;

  const PST = globalThis.ParamountSubtitles;
  const t = (key, substitutions) => PST.t?.(key, substitutions) || key;
  const settingsStore = new PST.SettingsStore();
  const cache = new PST.TranslationCache();
  const translator = new PST.SubtitleTranslator(cache);
  const dictionary = new PST.DictionaryService(translator);
  const overlay = new PST.SubtitleOverlay(dictionary);
  const capture = new PST.CaptureCoordinator();
  let settings = { ...PST.DEFAULT_SETTINGS };
  let cueToken = 0;
  let currentCue = { text: "", translation: "", source: "", context: [], wordHints: [] };
  const cueHistory = [];
  const cueTranslations = new Map();
  let lastContextTime = null;
  let preparingFromInteraction = false;
  const videoSite = PST.detectVideoSite();

  const readVideoMetadata = () => {
    const url = location.href;
    let id = "";
    try { id = new URL(url).searchParams.get("v") || ""; } catch {}
    const title = document.querySelector("meta[name='title']")?.content
      || document.querySelector("meta[property='og:title']")?.content
      || document.title.replace(/\s*-\s*YouTube\s*$/i, "").trim()
      || "YouTube video";
    const author = document.querySelector("link[itemprop='name']")?.getAttribute("content")
      || document.querySelector("#channel-name a, ytd-channel-name a")?.textContent?.trim()
      || "YouTube";
    return { id, title, author, url };
  };

  const getLearningContext = () => {
    const learning = capture.learningContext();
    return {
      ok: true,
      completeTimeline: learning.completeTimeline,
      cues: learning.cues.map((cue) => ({
        ...cue,
        translation: cueTranslations.get(PST.normalizeSubtitle(cue.text)) || "",
      })),
      video: {
        ...readVideoMetadata(),
        duration: learning.duration,
        currentTime: learning.currentTime,
        paused: learning.paused,
      },
      site: videoSite,
    };
  };

  const openLearningMode = () => {
    const context = getLearningContext();
    const sourceUrl = context.video?.url || location.href;
    try {
      const url = new URL(sourceUrl);
      url.searchParams.set("engram_learning", "1");
      const currentTime = Math.floor(Number(context.video?.currentTime) || 0);
      if (currentTime > 0) url.searchParams.set("t", `${currentTime}s`);
      window.open(url.toString(), "_blank", "noopener");
    } catch {
      const videoId = context.video?.id;
      if (!videoId) return;
      window.open(
        `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&engram_learning=1`,
        "_blank",
        "noopener",
      );
    }
  };

  const playerSettings = videoSite.id === "youtube" && PST.YouTubePlayerSettings
    ? new PST.YouTubePlayerSettings(settingsStore, { onOpenLearningMode: openLearningMode })
    : null;

  const storeVocabularyEntry = async (wordEntry, sentence = currentCue.text) => {
    if (!chrome.storage?.local) throw new Error(t("storageUnavailable"));
    const { vocabulary = [] } = await chrome.storage.local.get({ vocabulary: [] });
    const entry = { ...wordEntry, sentence, addedAt: Date.now() };
    const next = [entry, ...vocabulary.filter((item) => item.lemma !== entry.lemma)].slice(0, 500);
    await chrome.storage.local.set({ vocabulary: next });
    return entry;
  };

  const mount = async () => {
    if (!document.documentElement) return;
    overlay.mount();
    playerSettings?.mount();
    capture.start();
    const registration = await PST.safeSendMessage({ type: "REGISTER_VIDEO_TAB", site: videoSite });
    if (
      videoSite.id === "youtube"
      && new URLSearchParams(location.search).get("engram_learning") === "1"
      && PST.YouTubeLearningWorkspace
    ) {
      const workspace = new PST.YouTubeLearningWorkspace({
        getContext: async () => getLearningContext(),
        overlay,
        dictionary,
        getSettings: () => settings,
        onAddWord: storeVocabularyEntry,
      });
      globalThis.__PST_LEARNING_WORKSPACE__ = workspace;
      await workspace.mount(registration?.tabId);
    }
  };

  const statusMessage = () => {
    const source = capture.lastCue.source || t("subtitleProbe");
    const engine = {
      deepseek: "DeepSeek V4 Flash",
      google: t("googleTranslation"),
      local: t("chromeLocalTranslation"),
    }[settings.engine] || t("chromeLocalTranslation");
    return t("capturedStatus", [source, engine]);
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
    if (["deepseek", "google"].includes(settings.engine)) {
      if (state.engine === settings.engine && state.state === "translating") {
        overlay.setStatus({ message: state.message, tone: "warn", open: settings.debugToast });
        return;
      }
      overlay.setStatus({ message: statusMessage(), tone: "ok", open: settings.debugToast });
      return;
    }
    if (state.state === "ready") {
      overlay.setStatus({ message: statusMessage(), tone: "ok", open: settings.debugToast });
    } else if (["downloadable", "unavailable"].includes(state.state)) {
      overlay.setStatus({
        message: state.state === "unavailable" ? state.message : t("prepareOnPlayback"),
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
    const difficultWords = PST.selectDifficultWords(text, {
      levels: settingsSnapshot.learningLevels,
      limit: 3,
    });
    if (!difficultWords.length) return;
    // Automatic learning hints keep using the lightweight dictionary path.
    // Contextual LLM lookup is reserved for an explicit word hover.
    const entries = await dictionary.lookupMany(difficultWords, settingsSnapshot);
    if (token !== cueToken) return;
    currentCue = { ...currentCue, wordHints: entries };
    overlay.setLearningHints(entries);
    renderTranslatorStatus(translator.status);
  };

  const handleCue = async (cue) => {
    const token = ++cueToken;
    const cleanText = PST.normalizeSubtitle(cue.text);
    const cueTime = Number.isFinite(cue.startTime)
      ? cue.startTime
      : Number.isFinite(cue.start)
        ? cue.start
        : Number.isFinite(cue.videoTime)
          ? cue.videoTime
          : null;
    if (
      cueTime !== null
      && lastContextTime !== null
      && (cueTime < lastContextTime - 1 || cueTime > lastContextTime + 45)
    ) cueHistory.length = 0;
    if (cueTime !== null) lastContextTime = cueTime;
    const repeatedCurrentCue = cleanText && cueHistory.at(-1) === cleanText;
    const context = (repeatedCurrentCue ? cueHistory.slice(0, -1) : cueHistory).slice(-4);
    if (cleanText && !repeatedCurrentCue) {
      cueHistory.push(cleanText);
      if (cueHistory.length > 12) cueHistory.splice(0, cueHistory.length - 12);
    }
    currentCue = { text: cue.text, translation: "", source: cue.source, context, wordHints: [] };
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
      const translation = await translator.translateLatest(cue.text, settings, { context });
      if (token !== cueToken) return;
      currentCue = { ...currentCue, translation };
      cueTranslations.set(cleanText, translation);
      if (cueTranslations.size > 1000) cueTranslations.delete(cueTranslations.keys().next().value);
      overlay.setCue(currentCue);
      renderTranslatorStatus(translator.status);
    } catch (error) {
      if (token !== cueToken) return;
      if (error?.code === "NEEDS_ACTIVATION") {
        overlay.setStatus({
          message: t("prepareOnPlayback"),
          tone: "warn",
          actionable: true,
          open: true,
        });
      } else {
        overlay.setStatus({
          message: error?.message || t("subtitleTranslationFailed"),
          tone: "error",
          open: true,
        });
      }
    }
  };

  const unsubscribeSettings = settingsStore.subscribe((nextSettings) => {
    const previousSettings = settings;
    settings = { ...nextSettings };
    if (!settings.enabled || settings.engine !== previousSettings.engine) cueToken += 1;
    if (!settings.enabled || settings.engine !== "local") translator.releaseLocal();
    PST.setUiLanguage(settings.uiLanguage);
    translator.localizeStatus?.();
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
  settingsStore.ready.then(() => {
    if (settings.engine === "local") translator.inspectLocal();
  });

  overlay.addEventListener("cue:previous", rewindPreviousCue);
  overlay.addEventListener("playback:hover", (event) => {
    capture.setSubtitleHover(Boolean(event.detail?.active));
  });
  overlay.addEventListener("translator:activate", async () => {
    try {
      await translator.prepareLocal();
      if (currentCue.text) handleCue({ text: currentCue.text, source: currentCue.source });
    } catch (error) {
      overlay.setStatus({ message: error?.message || t("localTranslationPrepareFailed"), tone: "error", open: true });
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
      const entry = await storeVocabularyEntry(event.detail);
      overlay.showVocabularyResult({ state: "success", lemma });
      overlay.setStatus({ message: t("wordAddedStatus", entry.lemma), tone: "ok", open: true });
    } catch (error) {
      const message = error?.message || t("tryAgainLater");
      overlay.showVocabularyResult({ state: "error", lemma, error: message });
      overlay.setStatus({ message: t("addWordFailedStatus", message), tone: "error", open: true });
    }
  });

  capture.addEventListener("cue", (event) => handleCue(event.detail));
  capture.addEventListener("status", () => renderTranslatorStatus(translator.status));
  capture.addEventListener("network", () => renderTranslatorStatus(translator.status));

  window.addEventListener("pagehide", (event) => {
    globalThis.__PST_LEARNING_WORKSPACE__?.destroy?.();
    capture.stop();
    translator.releaseLocal();
    if (!event.persisted) {
      playerSettings?.destroy();
      unsubscribeSettings();
      translator.dispose();
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) capture.start();
  });

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
        site: videoSite,
      });
      return false;
    }
    if (message?.type === "GET_LEARNING_CONTEXT") {
      sendResponse(getLearningContext());
      return false;
    }
    if (message?.type === "GET_LEARNING_PLAYBACK") {
      const video = document.querySelector("#movie_player video, video.html5-main-video, video");
      sendResponse(video ? {
        ok: true,
        currentTime: Number(video.currentTime) || 0,
        duration: Number(video.duration) || 0,
        paused: video.paused,
      } : { ok: false, error: "未找到 YouTube 播放器" });
      return false;
    }
    if (message?.type === "CONTROL_LEARNING_VIDEO") {
      const video = document.querySelector("#movie_player video, video.html5-main-video, video");
      if (!video) {
        sendResponse({ ok: false, error: "未找到 YouTube 播放器" });
        return false;
      }
      const time = Number(message.time);
      if (message.action === "seek" && Number.isFinite(time)) video.currentTime = Math.max(0, time);
      if (message.action === "play") video.play().catch(() => undefined);
      if (message.action === "pause") video.pause();
      sendResponse({ ok: true, currentTime: video.currentTime, duration: video.duration, paused: video.paused });
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
    playerSettings,
    capture,
    simulate: (text) => capture.simulate(text),
  };

  if (document.documentElement) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
})();
