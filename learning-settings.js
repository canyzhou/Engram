(() => {
  const PST = globalThis.ParamountSubtitles;
  const DEFAULTS = Object.freeze({
    uiLanguage: "en",
    learningHints: false,
    learningLevels: ["c1", "c2"],
  });
  const LEVELS = Object.freeze(["b1", "b2", "c1", "c2"]);
  const t = (key, substitutions) => PST.t(key, substitutions);
  const PREVIEW_WORDS = Object.freeze([
    { text: "The" },
    { text: "mysterious", level: "b1", gloss: "神秘的" },
    { text: "survivor" },
    { text: "remained" },
    { text: "reluctant", level: "b2", gloss: "不情愿的" },
    { text: "to" },
    { text: "explain" },
    { text: "the" },
    { text: "ambiguous", level: "c1", gloss: "模棱两可的" },
    { text: "and" },
    { text: "esoteric", level: "c2", gloss: "深奥的" },
    { text: "ritual." },
  ]);

  const elements = {
    learningHints: document.querySelector("#learning-hints"),
    masterCopy: document.querySelector("#master-copy"),
    levelInputs: [...document.querySelectorAll('[name="learning-level"]')],
    selectedCount: document.querySelector("#selected-count"),
    previewSummary: document.querySelector("#preview-summary"),
    previewSentence: document.querySelector("#preview-sentence"),
    emptyPreview: document.querySelector("#empty-preview"),
    saveStatus: document.querySelector("#save-status"),
  };
  const saveStatusCopy = elements.saveStatus.querySelector("[data-i18n]");
  const hasExtensionApi = Boolean(globalThis.chrome?.runtime?.id && chrome.storage?.sync);
  let settings = { ...DEFAULTS };
  let saveTimer = 0;

  const storageGet = async () => {
    if (hasExtensionApi) return chrome.storage.sync.get(DEFAULTS);
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("pst-preview-settings") || "{}") }; }
    catch { return { ...DEFAULTS }; }
  };

  const storageSet = async (patch) => {
    if (hasExtensionApi) return chrome.storage.sync.set(patch);
    localStorage.setItem("pst-preview-settings", JSON.stringify({ ...settings, ...patch }));
  };

  const selectedLevels = () => elements.levelInputs
    .filter((input) => input.checked)
    .map((input) => input.value);

  const renderPreview = (levels) => {
    const selected = new Set(levels);
    elements.previewSentence.replaceChildren();
    let highlighted = 0;
    PREVIEW_WORDS.forEach((word, index) => {
      if (index > 0) elements.previewSentence.append(document.createTextNode(" "));
      if (!word.level || !selected.has(word.level)) {
        elements.previewSentence.append(document.createTextNode(word.text));
        return;
      }
      highlighted += 1;
      const wrapper = document.createElement("span");
      wrapper.className = "preview-word";
      wrapper.dataset.level = word.level;
      const text = document.createElement("span");
      text.textContent = word.text;
      const gloss = document.createElement("small");
      gloss.lang = "zh-CN";
      gloss.textContent = word.gloss;
      wrapper.append(text, gloss);
      elements.previewSentence.append(wrapper);
    });
    elements.previewSentence.hidden = highlighted === 0;
    elements.emptyPreview.hidden = highlighted !== 0;
  };

  const render = () => {
    PST.setUiLanguage(settings.uiLanguage);
    PST.applyI18n();
    const validLevels = (Array.isArray(settings.learningLevels) ? settings.learningLevels : DEFAULTS.learningLevels)
      .filter((level) => LEVELS.includes(level));
    elements.learningHints.checked = Boolean(settings.learningHints);
    elements.masterCopy.textContent = settings.learningHints ? t("enabled") : t("disabled");
    elements.levelInputs.forEach((input) => { input.checked = validLevels.includes(input.value); });
    elements.selectedCount.textContent = validLevels.length ? t("selectedTiers", validLevels.length) : t("noneSelected");
    elements.previewSummary.textContent = validLevels.length
      ? validLevels.map((level) => level.toUpperCase()).join(" · ")
      : t("noHighlight");
    renderPreview(validLevels);
  };

  const showSaved = () => {
    clearTimeout(saveTimer);
    elements.saveStatus.dataset.state = "saved";
    saveStatusCopy.textContent = t("autoSaved");
    saveTimer = setTimeout(() => {
      saveStatusCopy.textContent = t("autoSave");
    }, 1400);
  };

  const update = async (patch) => {
    settings = { ...settings, ...patch };
    render();
    elements.saveStatus.dataset.state = "saving";
    saveStatusCopy.textContent = t("saving");
    await storageSet(patch);
    showSaved();
  };

  elements.learningHints.addEventListener("change", () => update({
    learningHints: elements.learningHints.checked,
  }));
  elements.levelInputs.forEach((input) => input.addEventListener("change", () => update({
    learningLevels: selectedLevels(),
  })));

  storageGet().then((stored) => {
    settings = { ...DEFAULTS, ...stored };
    render();
  });
})();
