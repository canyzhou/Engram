(() => {
  const PST = globalThis.ParamountSubtitles;
  const dictionary = {
    async lookup(word) {
      const lower = word.toLowerCase();
      if (lower === "idols") {
        return {
          original: "idols",
          lemma: "idol",
          phonetic: "/ˈaɪdl/",
          partOfSpeech: "noun",
          gloss: "偶像；崇拜对象",
          definition: "a person or thing that is greatly admired",
        };
      }
      return {
        original: lower,
        lemma: lower,
        phonetic: "",
        partOfSpeech: "word",
        gloss: "预览释义",
        definition: "Hover lookup preview",
      };
    },
  };
  const overlay = new PST.SubtitleOverlay(dictionary);
  const capture = new PST.CaptureCoordinator();
  const previewVideo = document.createElement("video");
  previewVideo.hidden = true;
  let previewPaused = false;
  Object.defineProperties(previewVideo, {
    paused: { get: () => previewPaused },
    ended: { get: () => false },
  });
  previewVideo.pause = () => {
    previewPaused = true;
    document.body.dataset.playback = "paused";
  };
  previewVideo.play = () => {
    previewPaused = false;
    document.body.dataset.playback = "playing";
    return Promise.resolve();
  };
  document.body.dataset.playback = "playing";
  document.body.append(previewVideo);
  overlay.mount();
  overlay.updateSettings({
    ...PST.DEFAULT_SETTINGS,
    fontSize: 28,
    position: 12,
    backgroundOpacity: 0.52,
    debugToast: false,
    mode: "english",
    learningHints: true,
  });
  overlay.setCue({
    text: "I want to, like, run around, find idols.",
    translation: "",
    wordHints: [{ original: "idols", gloss: "偶像；崇拜对象" }],
    source: "WebVTT",
  });
  overlay.setStatus({
    message: "已捕获 WebVTT · 高难词辅助",
    tone: "ok",
    open: true,
  });
  overlay.addEventListener("placement:change", (event) => {
    const key = event.detail.target === "status" ? "statusPlacement" : "captionPlacement";
    overlay.updateSettings({ [key]: event.detail.placement });
  });
  overlay.addEventListener("status:dismiss", () => overlay.updateSettings({ debugToast: false }));
  overlay.addEventListener("cue:previous", () => {
    overlay.showRewindResult({ ok: true, usedCue: true, secondsBack: 4.8 });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" || event.composedPath().includes(overlay.host)) return;
    event.preventDefault();
    overlay.showRewindResult({ ok: true, usedCue: true, secondsBack: 4.8 });
  });
  overlay.addEventListener("vocabulary:add", (event) => {
    setTimeout(() => {
      const shouldFail = new URLSearchParams(location.search).get("vocabulary") === "fail";
      overlay.showVocabularyResult(shouldFail
        ? { state: "error", lemma: event.detail.lemma, error: "预览存储失败" }
        : { state: "success", lemma: event.detail.lemma });
    }, 320);
  });
  overlay.addEventListener("playback:hover", (event) => {
    capture.setSubtitleHover(Boolean(event.detail?.active));
  });
  document.addEventListener("click", (event) => {
    if (event.composedPath().includes(overlay.host)) previewVideo.play();
  });
  globalThis.previewOverlay = overlay;
  globalThis.previewCapture = capture;
})();
