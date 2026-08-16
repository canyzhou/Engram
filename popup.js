(() => {
  const PST = globalThis.ParamountSubtitles;
  const DEFAULTS = {
    uiLanguage: "en",
    enabled: true,
    mode: "bilingual",
    engine: "local",
    fontSize: 28,
    backgroundOpacity: 0.45,
    position: 13,
    rewindSeconds: 5,
    learningHints: false,
    learningLevels: ["c1", "c2"],
    hoverDictionary: true,
    debugToast: false,
    captionPlacement: null,
    statusPlacement: null,
  };

  const elements = {
    enabled: document.querySelector("#enabled"),
    uiLanguage: document.querySelector("#ui-language"),
    modeButtons: [...document.querySelectorAll("[data-mode]")],
    engine: document.querySelector("#engine"),
    engineNote: document.querySelector("#engine-note"),
    fontSize: document.querySelector("#font-size"),
    fontDecrease: document.querySelector("#font-decrease"),
    fontIncrease: document.querySelector("#font-increase"),
    background: document.querySelector("#background-opacity"),
    backgroundValue: document.querySelector("#background-value"),
    positionUp: document.querySelector("#position-up"),
    positionDown: document.querySelector("#position-down"),
    rewindSeconds: document.querySelector("#rewind-seconds"),
    rewindDecrease: document.querySelector("#rewind-decrease"),
    rewindIncrease: document.querySelector("#rewind-increase"),
    learningHints: document.querySelector("#learning-hints"),
    learningSummary: document.querySelector("#learning-summary"),
    openLearningSettings: document.querySelector("#open-learning-settings"),
    hoverDictionary: document.querySelector("#hover-dictionary"),
    debugToast: document.querySelector("#debug-toast"),
    resetPlacements: document.querySelector("#reset-placements"),
    connection: document.querySelector("#connection"),
    connectionText: document.querySelector(".connection__text"),
    openDashboard: document.querySelector("#open-dashboard"),
    openVocabulary: document.querySelector("#open-vocabulary"),
    openDebug: document.querySelector("#open-debug"),
    settingsShortcut: document.querySelector("#settings-shortcut"),
    styleSettings: document.querySelector("#style-settings"),
    openLearningMode: document.querySelector("#open-learning-mode"),
  };

  let settings = { ...DEFAULTS };
  let activeTabId = null;
  let activeTabUrl = "";
  const hasExtensionApi = Boolean(globalThis.chrome?.runtime?.id && chrome.storage?.sync);
  const t = (key, substitutions) => PST.t(key, substitutions);
  const LEARNING_LEVEL_KEYS = Object.freeze({
    b1: "levelIntermediate",
    b2: "levelUpperIntermediate",
    c1: "levelAdvanced",
    c2: "levelMastery",
  });

  const selectedLearningLevels = () => {
    const levels = Array.isArray(settings.learningLevels) ? settings.learningLevels : DEFAULTS.learningLevels;
    return levels.filter((level) => LEARNING_LEVEL_KEYS[level]);
  };

  const storageGet = async () => {
    if (hasExtensionApi) return chrome.storage.sync.get(DEFAULTS);
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("pst-preview-settings") || "{}") }; }
    catch { return { ...DEFAULTS }; }
  };

  const storageSet = async (patch) => {
    if (hasExtensionApi) return chrome.storage.sync.set(patch);
    localStorage.setItem("pst-preview-settings", JSON.stringify({ ...settings, ...patch }));
  };

  const render = () => {
    PST.setUiLanguage(settings.uiLanguage);
    PST.applyI18n();
    elements.uiLanguage.value = PST.getUiLanguage();
    elements.enabled.checked = settings.enabled;
    elements.modeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mode === settings.mode));
      button.disabled = !settings.enabled;
    });
    elements.engine.value = settings.engine;
    elements.engine.disabled = !settings.enabled;
    elements.engineNote.textContent = {
      local: t("engineNoteLocal"),
      deepseek: t("engineNoteDeepseek"),
      google: t("engineNoteGoogle"),
    }[settings.engine] || "";
    elements.fontSize.textContent = String(settings.fontSize);
    elements.background.value = String(settings.backgroundOpacity);
    elements.backgroundValue.textContent = `${Math.round(settings.backgroundOpacity * 100)}%`;
    elements.rewindSeconds.textContent = t("secondsShort", settings.rewindSeconds);
    elements.learningHints.checked = settings.learningHints;
    elements.learningHints.disabled = !settings.enabled || settings.mode === "chinese";
    elements.learningHints.closest(".learning-row").setAttribute(
      "aria-disabled",
      String(!settings.enabled || settings.mode === "chinese"),
    );
    const levelLabels = selectedLearningLevels().map((level) => t(LEARNING_LEVEL_KEYS[level]));
    elements.learningSummary.textContent = levelLabels.length
      ? t("highlightLevels", levelLabels.join(PST.getUiLanguage() === "zh-CN" ? "、" : ", "))
      : t("noHighlightLevels");
    elements.hoverDictionary.checked = settings.hoverDictionary;
    elements.debugToast.checked = settings.debugToast;
  };

  const sendToTab = async (message) => {
    if (!hasExtensionApi || !activeTabId) return null;
    try { return await chrome.tabs.sendMessage(activeTabId, message); }
    catch { return null; }
  };

  const update = async (patch) => {
    settings = { ...settings, ...patch };
    render();
    await storageSet(patch);
    await sendToTab({ type: "SETTINGS_UPDATED", patch });
  };

  const connect = async () => {
    if (!hasExtensionApi) {
      elements.connection.dataset.state = "connected";
      elements.connectionText.textContent = t("previewConnection");
      elements.openLearningMode.disabled = false;
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id || null;
    activeTabUrl = tab?.url || "";
    let site = { id: "unknown", name: "Video" };
    try { site = PST.detectVideoSite(new URL(tab?.url || "").hostname); } catch {}
    if (site.id === "unknown") {
      elements.connection.dataset.state = "disconnected";
      elements.connectionText.textContent = t("openSupportedVideo");
      elements.openLearningMode.disabled = true;
      return;
    }
    const response = await sendToTab({ type: "GET_STATUS" });
    elements.connection.dataset.state = response?.ok ? "connected" : "checking";
    elements.connectionText.textContent = response?.ok
      ? t("connectedVideo", [response.site?.name || site.name, response.capture?.source || t("waitingForSubtitles")])
      : t("waitingForVideoPlayer", site.name);
    elements.openLearningMode.disabled = !(response?.ok && (response.site?.id || site.id) === "youtube");
  };

  elements.uiLanguage.addEventListener("change", async () => {
    await update({ uiLanguage: elements.uiLanguage.value });
    await connect();
  });
  elements.enabled.addEventListener("change", () => update({ enabled: elements.enabled.checked }));
  elements.modeButtons.forEach((button) => button.addEventListener("click", () => update({ mode: button.dataset.mode })));
  elements.engine.addEventListener("change", () => update({ engine: elements.engine.value }));
  elements.fontDecrease.addEventListener("click", () => update({ fontSize: Math.max(20, settings.fontSize - 2) }));
  elements.fontIncrease.addEventListener("click", () => update({ fontSize: Math.min(40, settings.fontSize + 2) }));
  elements.background.addEventListener("input", () => update({ backgroundOpacity: Number(elements.background.value) }));
  elements.positionUp.addEventListener("click", () => update({
    position: Math.min(32, settings.position + 2),
    captionPlacement: null,
  }));
  elements.positionDown.addEventListener("click", () => update({
    position: Math.max(6, settings.position - 2),
    captionPlacement: null,
  }));
  elements.rewindDecrease.addEventListener("click", () => update({
    rewindSeconds: Math.max(2, settings.rewindSeconds - 1),
  }));
  elements.rewindIncrease.addEventListener("click", () => update({
    rewindSeconds: Math.min(15, settings.rewindSeconds + 1),
  }));
  elements.learningHints.addEventListener("change", () => update({ learningHints: elements.learningHints.checked }));
  elements.openLearningSettings.addEventListener("click", () => {
    if (hasExtensionApi) chrome.tabs.create({ url: chrome.runtime.getURL("learning-settings.html") });
    else window.open("learning-settings.html", "_blank");
  });
  elements.hoverDictionary.addEventListener("change", () => update({ hoverDictionary: elements.hoverDictionary.checked }));
  elements.debugToast.addEventListener("change", () => update({ debugToast: elements.debugToast.checked }));
  elements.resetPlacements.addEventListener("click", () => update({
    captionPlacement: null,
    statusPlacement: null,
  }));
  elements.settingsShortcut.addEventListener("click", () => elements.styleSettings.scrollIntoView({ behavior: "smooth", block: "start" }));
  elements.openDashboard.addEventListener("click", () => {
    if (hasExtensionApi) chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    else window.open("dashboard.html?preview=1", "_blank");
  });
  elements.openVocabulary.addEventListener("click", () => {
    if (hasExtensionApi) chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html?view=vocabulary") });
    else window.open("dashboard.html?preview=1&view=vocabulary", "_blank");
  });
  elements.openDebug.addEventListener("click", () => {
    if (hasExtensionApi) chrome.tabs.create({ url: chrome.runtime.getURL("debug.html") });
    else window.open("debug.html", "_blank");
  });
  elements.openLearningMode.addEventListener("click", async () => {
    if (!hasExtensionApi) {
      window.open("learning-mode.html?preview=1", "_blank");
      return;
    }
    const context = await sendToTab({ type: "GET_LEARNING_CONTEXT" });
    const sourceUrl = context?.video?.url || activeTabUrl;
    try {
      const url = new URL(sourceUrl);
      url.searchParams.set("engram_learning", "1");
      const currentTime = Math.floor(Number(context?.video?.currentTime) || 0);
      if (currentTime > 0) url.searchParams.set("t", `${currentTime}s`);
      await chrome.tabs.create({ url: url.toString() });
    } catch {
      const videoId = context?.video?.id;
      if (!videoId) return;
      await chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&engram_learning=1` });
    }
  });

  storageGet().then((stored) => {
    settings = { ...DEFAULTS, ...stored };
    render();
    connect();
  });
})();
