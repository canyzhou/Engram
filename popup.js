(() => {
  const DEFAULTS = {
    enabled: true,
    mode: "bilingual",
    engine: "local",
    fontSize: 28,
    backgroundOpacity: 0.45,
    position: 13,
    rewindSeconds: 5,
    learningHints: false,
    hoverDictionary: true,
    debugToast: false,
    captionPlacement: null,
    statusPlacement: null,
  };

  const elements = {
    enabled: document.querySelector("#enabled"),
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
    hoverDictionary: document.querySelector("#hover-dictionary"),
    debugToast: document.querySelector("#debug-toast"),
    resetPlacements: document.querySelector("#reset-placements"),
    connection: document.querySelector("#connection"),
    connectionText: document.querySelector(".connection__text"),
    openVocabulary: document.querySelector("#open-vocabulary"),
    openDebug: document.querySelector("#open-debug"),
    settingsShortcut: document.querySelector("#settings-shortcut"),
    styleSettings: document.querySelector("#style-settings"),
  };

  let settings = { ...DEFAULTS };
  let activeTabId = null;
  const hasExtensionApi = Boolean(globalThis.chrome?.runtime?.id && chrome.storage?.sync);

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
    elements.enabled.checked = settings.enabled;
    elements.modeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mode === settings.mode));
      button.disabled = !settings.enabled;
    });
    elements.engine.value = settings.engine;
    elements.engine.disabled = !settings.enabled;
    elements.engineNote.textContent = settings.engine === "local"
      ? "字幕留在设备上；首次播放交互时自动准备语言包。"
      : "当前字幕会发送到 Google；仅建议个人临时使用。";
    elements.fontSize.textContent = String(settings.fontSize);
    elements.background.value = String(settings.backgroundOpacity);
    elements.backgroundValue.textContent = `${Math.round(settings.backgroundOpacity * 100)}%`;
    elements.rewindSeconds.textContent = `${settings.rewindSeconds}秒`;
    elements.learningHints.checked = settings.learningHints;
    elements.learningHints.disabled = !settings.enabled || settings.mode === "chinese";
    elements.learningHints.closest("label").setAttribute(
      "aria-disabled",
      String(!settings.enabled || settings.mode === "chinese"),
    );
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
      elements.connectionText.textContent = "设计预览 · Paramount+";
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id || null;
    const isParamount = /^https:\/\/(?:www\.)?paramountplus\.com\//.test(tab?.url || "");
    if (!isParamount) {
      elements.connection.dataset.state = "disconnected";
      elements.connectionText.textContent = "请打开 Paramount+ 播放页面";
      return;
    }
    const response = await sendToTab({ type: "GET_STATUS" });
    elements.connection.dataset.state = response?.ok ? "connected" : "checking";
    elements.connectionText.textContent = response?.ok
      ? `已连接到 Paramount+ · ${response.capture?.source || "等待字幕"}`
      : "已打开 Paramount+，正在等待播放器";
  };

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
  elements.hoverDictionary.addEventListener("change", () => update({ hoverDictionary: elements.hoverDictionary.checked }));
  elements.debugToast.addEventListener("change", () => update({ debugToast: elements.debugToast.checked }));
  elements.resetPlacements.addEventListener("click", () => update({
    captionPlacement: null,
    statusPlacement: null,
  }));
  elements.settingsShortcut.addEventListener("click", () => elements.styleSettings.scrollIntoView({ behavior: "smooth", block: "start" }));
  elements.openVocabulary.addEventListener("click", () => {
    if (hasExtensionApi) chrome.tabs.create({ url: chrome.runtime.getURL("vocabulary.html") });
    else window.open("vocabulary.html", "_blank");
  });
  elements.openDebug.addEventListener("click", () => {
    if (hasExtensionApi) chrome.tabs.create({ url: chrome.runtime.getURL("debug.html") });
    else window.open("debug.html", "_blank");
  });

  storageGet().then((stored) => {
    settings = { ...DEFAULTS, ...stored };
    render();
    connect();
  });
})();
