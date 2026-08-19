(() => {
  const PST = globalThis.ParamountSubtitles;
  const Core = PST.LearningModeCore;
  const PLAYER_ORIGIN = "https://www.youtube-nocookie.com";
  const hasExtensionApi = PST.hasExtensionContext();
  const pageParams = new URLSearchParams(location.search);
  const previewMode = pageParams.get("preview") === "1" || !hasExtensionApi;
  const previewState = pageParams.get("previewState") || "ready";
  const embeddedMode = pageParams.get("embedded") === "1";
  const sourceTabId = Number(pageParams.get("sourceTabId")) || null;
  if (embeddedMode) document.documentElement.classList.add("embedded-mode");

  const SAMPLE_CONTEXT = Object.freeze({
    ok: true,
    completeTimeline: true,
    video: {
      id: "dQw4w9WgXcQ",
      title: "solo travel will change your life",
      author: "Joshua Paine",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      duration: 1256,
      currentTime: 26,
      paused: true,
    },
    cues: [
      { start: 26, end: 31, text: "I think it's going to be roughly 8 hours.", translation: "我想大约需要八个小时。" },
      { start: 78, end: 83, text: "It is the one that I have been told by everyone to do.", translation: "这是每个人都告诉我应该做的一件事。" },
      { start: 81, end: 86, text: "The John Muir Mist Trail and four mile loop.", translation: "约翰·缪尔迷雾步道和四英里环线。" },
      { start: 87, end: 90, text: "I'm so hyped.", translation: "我太兴奋了。" },
      { start: 91, end: 97, text: "I'm going to smash this and we're going to go on this absolutely epic hike.", translation: "我要拿下它，我们要开始这场史诗般的徒步。" },
      { start: 95, end: 99, text: "This dude's a wilderness explorer.", translation: "这家伙是一位荒野探险家。" },
      { start: 260, end: 267, text: "The first climb is steeper than it looks, so I need to pace myself.", translation: "第一段爬坡比看起来更陡，所以我需要控制节奏。" },
      { start: 318, end: 324, text: "The view is already worth every step.", translation: "这景色已经让每一步都值得。" },
      { start: 382, end: 390, text: "Traveling alone forces you to make decisions and trust yourself.", translation: "独自旅行迫使你做决定并相信自己。" },
      { start: 472, end: 480, text: "That is why solo travel can change the way you see your own life.", translation: "这就是独自旅行能改变你看待自己生活方式的原因。" },
    ],
    displayCues: [
      { start: 26, end: 28, text: "I think it's going to be" },
      { start: 28, end: 31, text: "roughly 8 hours." },
    ],
  });

  const SAMPLE_UNAVAILABLE_CONTEXT = Object.freeze({
    ...SAMPLE_CONTEXT,
    completeTimeline: false,
    subtitleAvailability: {
      state: "unavailable",
      reason: "no_tracks",
      provider: "youtube",
      needsLogin: false,
    },
    video: {
      ...SAMPLE_CONTEXT.video,
      id: "sample-no-subtitles",
      title: "Video without English subtitles",
      author: "YouTube",
      url: "https://www.youtube.com/watch?v=sample-no-subtitles",
      duration: 713,
      currentTime: 10,
    },
    cues: [],
    displayCues: [],
  });

  const SAMPLE_ANALYSIS = Object.freeze({
    materialLevel: "B2",
    vocabularyLevel: "B2",
    speechLevel: "B1+",
    syntaxLevel: "B2",
    suitability: {
      assessmentStatus: "complete",
      basis: "general_english_from_transcript",
      materialQuality: "strong",
      materialVerdict: "worth_intensive_study",
      difficultyMatch: { materialLevel: "B2", learnerLevel: "B1", difficultyFit: "matched" },
      finalRecommendation: "intensive_study",
      confidence: "high",
      reasonCodes: ["strong_coherent_spans", "useful_transferable_language", "level_matched"],
      summary: "材料语境连续、信息充足，难度与你匹配，并且保留了适当挑战。",
      diagnostics: { transcriptComplete: true, usableWordCount: 118, groundedLearningItemCount: 8 },
      bestSpans: [],
    },
    learningOutcomes: [
      "掌握旅行计划、徒步体验和表达兴奋感的地道说法。",
      "练习被动语态、比较级以及解释个人观点的长句。",
      "用视频中的表达复述一次挑战并说明它带来的改变。",
    ],
    studyMinutes: 12,
    recommendedRange: { start: 260, end: 490 },
    difficultRanges: [{ start: 260, end: 330 }, { start: 382, end: 480 }],
    timelineSegments: [
      {
        start: 260, end: 330, timestamp: 260, level: "B1+", title: "描述徒步难度",
        analysis: "比较级 steeper than 和结果连接词 so 连在同一句中，需要同时跟上画面与因果关系。",
        focus: "比较级 + so 表达困难与应对方式",
        sourceText: "The first climb is steeper than it looks, so I need to pace myself.",
      },
      {
        start: 382, end: 480, timestamp: 382, level: "B2", title: "从经历上升到观点",
        analysis: "语义从具体旅行切换到抽象的自我信任与人生改变，句子更长、信息密度更高。",
        focus: "forces you to… 与 the way you… 句型",
        sourceText: "Traveling alone forces you to make decisions and trust yourself.",
      },
    ],
    coverage: { cueCount: 10, characterCount: 612, start: 26, end: 480, complete: true },
    discussionQuestions: {
      source: [
        "What are your thoughts on the speaker's plan to do the eight-hour hike alone?",
        "Why does the speaker decide to pace himself on the first climb?",
        "Which view or moment on the trail would you most like to experience?",
        "Have you ever had to change your pace during a difficult hike or activity?",
        "When can traveling alone help someone learn to trust themselves?",
      ],
      advanced: [
        "What part of traveling alone seems most difficult to you?",
        "Do you usually plan trips carefully, or decide things as you go?",
        "What is one place that is especially good for a first solo trip?",
        "Who is the most adventurous traveler you know?",
        "If you took a solo trip this year, where would you go and what would you do first?",
      ],
    },
    learningItems: [
      { category: "pattern", expression: "going to", meaningZh: "将要；打算", why: "", timestamp: 26 },
      { category: "grammar", expression: "have been told", meaningZh: "曾被告知", why: "", timestamp: 78 },
      { category: "slang", expression: "hyped", meaningZh: "非常兴奋的", why: "年轻人口语中表达强烈期待", timestamp: 87 },
      { category: "idiom", expression: "smash this", meaningZh: "漂亮地拿下这件事", why: "非正式口语中表达很有信心完成挑战", timestamp: 91 },
      { category: "pattern", expression: "absolutely epic hike", meaningZh: "非常精彩的徒步旅行", why: "", timestamp: 91 },
      { category: "word", expression: "wilderness explorer", meaningZh: "荒野探险家", why: "旅行与户外主题中的实用搭配", timestamp: 95 },
      { category: "idiom", expression: "pace myself", meaningZh: "控制自己的节奏", why: "谈运动、工作量和精力分配时常用", timestamp: 260 },
      { category: "pattern", expression: "worth every step", meaningZh: "每一步都值得", why: "", timestamp: 318 },
    ],
  });

  const elements = {
    shell: document.querySelector(".learning-shell"),
    title: document.querySelector("#video-title"),
    author: document.querySelector("#video-author"),
    progress: document.querySelector("#lesson-progress"),
    learnerLevel: document.querySelector("#learner-level"),
    back: document.querySelector("#back-button"),
    openSource: document.querySelector("#open-source"),
    playerFrame: document.querySelector("#player-frame"),
    poster: document.querySelector("#player-poster"),
    player: document.querySelector("#youtube-player"),
    playerError: document.querySelector("#player-error"),
    centerPlay: document.querySelector("#center-play"),
    playToggle: document.querySelector("#play-toggle"),
    previousCue: document.querySelector("#previous-cue"),
    nextCue: document.querySelector("#next-cue"),
    playerProgress: document.querySelector("#player-progress"),
    currentTime: document.querySelector("#current-time"),
    duration: document.querySelector("#duration"),
    currentSentenceContainer: document.querySelector("#current-sentence"),
    currentSentence: document.querySelector("#current-sentence p"),
    cueRail: document.querySelector("#cue-rail"),
    tabs: [...document.querySelectorAll("[data-tab]")],
    panels: [...document.querySelectorAll(".tab-panel")],
    analysisLoading: document.querySelector("#analysis-loading"),
    analysisError: document.querySelector("#analysis-error"),
    analysisStatusLabel: document.querySelector("#analysis-status-label"),
    analysisErrorTitle: document.querySelector("#analysis-error-title"),
    analysisErrorMessage: document.querySelector("#analysis-error-message"),
    analysisContent: document.querySelector("#analysis-content"),
    refreshAnalysis: document.querySelector("#refresh-analysis"),
    recommendationCard: document.querySelector("#recommendation-card"),
    recommendationTitle: document.querySelector("#recommendation-title"),
    recommendationSummary: document.querySelector("#recommendation-summary"),
    analysisSummary: document.querySelector("#analysis-summary"),
    analysisDetails: document.querySelector("#analysis-details"),
    analysisDetailsTitle: document.querySelector("#analysis-details-title"),
    materialLevel: document.querySelector("#material-level"),
    analysisLearnerLevel: document.querySelector("#analysis-learner-level"),
    learningOutcomes: document.querySelector("#learning-outcomes"),
    vocabularyLevel: document.querySelector("#vocabulary-level"),
    speechLevel: document.querySelector("#speech-level"),
    syntaxLevel: document.querySelector("#syntax-level"),
    expressionSection: document.querySelector(".expression-section"),
    expressionList: document.querySelector("#expression-list"),
    learningItemCount: document.querySelector("#learning-item-count"),
    difficultyTimeline: document.querySelector("#difficulty-timeline"),
    timelineSection: document.querySelector(".difficulty-timeline-section"),
    timelineSegmentList: document.querySelector("#timeline-segment-list"),
    recommendedRange: document.querySelector("#recommended-range"),
    transcriptSearch: document.querySelector("#transcript-search"),
    autoFollow: document.querySelector("#auto-follow"),
    transcriptStatus: document.querySelector("#transcript-status"),
    transcriptList: document.querySelector("#transcript-list"),
    discussionUnavailable: document.querySelector("#discussion-unavailable"),
    discussionUnavailableLabel: document.querySelector("#discussion-unavailable-label"),
    discussionUnavailableTitle: document.querySelector("#discussion-unavailable-title"),
    discussionUnavailableMessage: document.querySelector("#discussion-unavailable-message"),
    discussionOutline: document.querySelector("#discussion-outline"),
    sourceQuestionList: document.querySelector("#source-question-list"),
    advancedQuestionList: document.querySelector("#advanced-question-list"),
    discussionStartActions: document.querySelector("#discussion-start-actions"),
    startDiscussion: document.querySelector("#start-discussion"),
    discussionSession: document.querySelector("#discussion-session"),
    discussionPhaseLabel: document.querySelector("#discussion-phase-label"),
    discussionProgressCurrent: document.querySelector("#discussion-progress-current"),
    discussionProgressTotal: document.querySelector("#discussion-progress-total"),
    discussionProgressTrack: document.querySelector(".discussion-progress-track"),
    discussionProgressBar: document.querySelector("#discussion-progress-bar"),
    discussionOutlineToggle: document.querySelector("#discussion-outline-toggle"),
    discussionSessionOutline: document.querySelector("#discussion-session-outline"),
    discussionSessionQuestionList: document.querySelector("#discussion-session-question-list"),
    discussionIntro: document.querySelector("#discussion-intro"),
    discussionMessages: document.querySelector("#discussion-messages"),
    discussionForm: document.querySelector("#discussion-form"),
    discussionInput: document.querySelector("#discussion-input"),
    discussionSend: document.querySelector("#discussion-send"),
    discussionMicrophone: document.querySelector("#discussion-microphone"),
    discussionAutoSpeak: document.querySelector("#discussion-auto-speak"),
    voiceInputStatus: document.querySelector("#voice-input-status"),
    voiceInputDuration: document.querySelector("#voice-input-duration"),
    voicePrivacyDialog: document.querySelector("#voice-privacy-dialog"),
    requestHint: document.querySelector("#request-hint"),
  };

  const state = {
    context: null,
    cues: [],
    displayCues: [],
    analysis: null,
    activeTab: "analysis",
    currentTime: 0,
    duration: 0,
    playing: false,
    activeCue: null,
    discussionActive: false,
    discussionPhase: "outline",
    discussionQuestionIndex: 0,
    discussionPlan: [],
    messages: [],
    previewTimer: 0,
    playbackTimer: 0,
    voicePreviewTimer: 0,
    voiceInputState: "idle",
    speechOutputState: "idle",
    autoSpeak: true,
    voicePrivacyAcknowledged: false,
    voicePrefix: "",
    voiceSuffix: "",
    voiceFinalParts: [],
    voiceInterim: "",
    voiceSessionDuration: 0,
    sttSeconds: 0,
    ttsCharacters: 0,
    activeSpeechArticle: null,
    contextRetrying: false,
    playerReady: false,
    destroyed: false,
  };

  const extensionUnavailableMessage = "扩展已更新，请刷新页面后重试。";
  const VOICE_SESSION_SECONDS_LIMIT = 900;
  const TTS_SESSION_CHARACTER_LIMIT = 12_000;
  let speechToText = null;
  let textToSpeech = null;

  const extensionStorage = (area) => {
    try {
      if (!PST.hasExtensionContext()) return null;
      return globalThis.chrome?.storage?.[area] || null;
    } catch (error) {
      if (PST.isExtensionContextInvalidated(error)) return null;
      throw error;
    }
  };

  const readExtensionStorage = async (area, defaults) => {
    const storage = extensionStorage(area);
    if (!storage) return defaults;
    try {
      return await storage.get(defaults);
    } catch (error) {
      if (PST.isExtensionContextInvalidated(error)) return defaults;
      throw error;
    }
  };

  const writeExtensionStorage = async (area, patch) => {
    const storage = extensionStorage(area);
    if (!storage) return false;
    try {
      await storage.set(patch);
      return true;
    } catch (error) {
      if (PST.isExtensionContextInvalidated(error)) return false;
      throw error;
    }
  };

  const sendMessage = async (message) => {
    if (!hasExtensionApi) return null;
    if (!PST.hasExtensionContext()) return { ok: false, error: extensionUnavailableMessage, contextInvalidated: true };
    try { return await chrome.runtime.sendMessage(sourceTabId ? { ...message, sourceTabId } : message); }
    catch (error) {
      if (PST.isExtensionContextInvalidated(error)) {
        return { ok: false, error: extensionUnavailableMessage, contextInvalidated: true };
      }
      return { ok: false, error: error?.message || "扩展通信失败" };
    }
  };

  const getVoiceAccessToken = async () => {
    const response = await sendMessage({ type: "CREATE_VOICE_TOKEN" });
    if (!response?.ok || !response.accessToken) {
      throw new Error(response?.error || "语音服务尚未配置");
    }
    return { accessToken: response.accessToken, expiresIn: response.expiresIn };
  };

  const formatVoiceDuration = (seconds) => {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
  };

  const voiceStatusCopy = (status, detail) => ({
    idle: "可键入，也可点击麦克风用英语回答",
    requesting_permission: "正在请求麦克风权限…",
    connecting: "正在连接语音识别…",
    listening: "正在聆听，点击麦克风结束",
    finalizing: "正在整理最后一句…",
    unavailable: detail?.message || "当前设备不支持语音输入",
    error: detail?.message || "语音识别暂时不可用，可继续键入",
  }[status] || "可键入，也可点击麦克风用英语回答");

  const renderVoiceInputState = (status, detail) => {
    state.voiceInputState = status;
    const active = ["requesting_permission", "connecting", "listening", "finalizing"].includes(status);
    const listening = status === "listening";
    elements.voiceInputStatus.dataset.state = status;
    elements.voiceInputStatus.querySelector("span").textContent = voiceStatusCopy(status, detail);
    elements.discussionMicrophone.setAttribute("aria-pressed", String(listening));
    elements.discussionMicrophone.setAttribute("aria-label", active ? "结束语音输入" : "开始语音输入");
    elements.discussionInput.dataset.voiceActive = String(active);
    elements.discussionInput.readOnly = active;
    elements.discussionSend.disabled = active;
    elements.requestHint.disabled = active;
    if (!active && status !== "error") {
      elements.voiceInputDuration.textContent = "";
      elements.voiceInputDuration.removeAttribute("datetime");
    }
  };

  const setVoiceDuration = (seconds) => {
    state.voiceSessionDuration = Math.max(0, Number(seconds) || 0);
    elements.voiceInputDuration.textContent = formatVoiceDuration(state.voiceSessionDuration);
    elements.voiceInputDuration.setAttribute("datetime", `PT${Math.floor(state.voiceSessionDuration)}S`);
  };

  const updateSpeechButtons = () => {
    document.querySelectorAll(".message-speak-button").forEach((button) => {
      const active = button.closest(".message") === state.activeSpeechArticle;
      const status = active ? state.speechOutputState : "idle";
      button.dataset.state = status;
      button.setAttribute("aria-pressed", String(active && ["loading", "speaking"].includes(status)));
      const label = button.querySelector("span");
      if (label) label.textContent = status === "loading" ? "加载中" : status === "speaking" ? "停止" : "朗读";
      button.setAttribute("aria-label", status === "speaking" ? "停止朗读这条回复" : "朗读这条回复");
    });
  };

  const setSpeechOutputState = (status) => {
    state.speechOutputState = status;
    updateSpeechButtons();
  };

  const cancelSpeech = () => {
    clearTimeout(state.voicePreviewTimer);
    state.voicePreviewTimer = 0;
    textToSpeech?.cancel?.();
    state.speechOutputState = "idle";
    state.activeSpeechArticle = null;
    updateSpeechButtons();
  };

  const insertVoiceTranscript = () => {
    const spoken = [...state.voiceFinalParts, state.voiceInterim].map((part) => part.trim()).filter(Boolean).join(" ");
    const left = spoken && state.voicePrefix && !/\s$/.test(state.voicePrefix) ? `${state.voicePrefix} ` : state.voicePrefix;
    const right = spoken && state.voiceSuffix && !/^\s/.test(state.voiceSuffix) ? ` ${state.voiceSuffix}` : state.voiceSuffix;
    const maximum = Number(elements.discussionInput.maxLength) || 1200;
    const nextValue = `${left}${spoken}${right}`.slice(0, maximum);
    elements.discussionInput.value = nextValue;
    const cursor = Math.min(nextValue.length, left.length + spoken.length);
    elements.discussionInput.setSelectionRange(cursor, cursor);
  };

  const captureVoiceInsertionPoint = () => {
    const value = elements.discussionInput.value;
    const start = Math.max(0, elements.discussionInput.selectionStart || 0);
    const end = Math.max(start, elements.discussionInput.selectionEnd || start);
    state.voicePrefix = value.slice(0, start);
    state.voiceSuffix = value.slice(end);
    state.voiceFinalParts = [];
    state.voiceInterim = "";
    state.voiceSessionDuration = 0;
  };

  const stopVoiceInput = async ({ abort = false } = {}) => {
    clearTimeout(state.voicePreviewTimer);
    state.voicePreviewTimer = 0;
    if (previewMode) {
      if (!abort && ["listening", "connecting"].includes(state.voiceInputState)) {
        renderVoiceInputState("finalizing");
        await new Promise((resolve) => {
          state.voicePreviewTimer = setTimeout(resolve, 260);
        });
        state.voiceFinalParts = ["I would love to visit Iceland because the landscape feels completely different from home."];
        state.voiceInterim = "";
        insertVoiceTranscript();
        state.sttSeconds += Math.max(0, state.voiceSessionDuration);
      }
      renderVoiceInputState("idle");
      return;
    }
    if (!speechToText) return;
    if (abort) speechToText.abort();
    else {
      await speechToText.stop();
      state.sttSeconds += Math.max(0, state.voiceSessionDuration);
    }
  };

  const requestVoicePrivacy = () => {
    if (state.voicePrivacyAcknowledged) return Promise.resolve(true);
    if (typeof elements.voicePrivacyDialog.showModal !== "function") return Promise.resolve(false);
    elements.voicePrivacyDialog.showModal();
    return new Promise((resolve) => {
      elements.voicePrivacyDialog.addEventListener("close", () => {
        const confirmed = elements.voicePrivacyDialog.returnValue === "confirm";
        if (confirmed) {
          state.voicePrivacyAcknowledged = true;
          writeExtensionStorage("local", { discussionVoicePrivacyAcknowledged: true }).catch(() => undefined);
        }
        resolve(confirmed);
      }, { once: true });
    });
  };

  const startVoiceInput = async () => {
    if (state.sttSeconds >= VOICE_SESSION_SECONDS_LIMIT) {
      renderVoiceInputState("error", { message: "本次学习的语音输入已达 15 分钟上限" });
      return;
    }
    if (!await requestVoicePrivacy()) return;
    cancelSpeech();
    setPlaying(false);
    captureVoiceInsertionPoint();
    if (previewMode) {
      renderVoiceInputState("connecting");
      state.voicePreviewTimer = setTimeout(() => {
        if (state.voiceInputState !== "connecting") return;
        renderVoiceInputState("listening");
        setVoiceDuration(0);
      }, 180);
      return;
    }
    if (!speechToText?.isSupported?.()) {
      renderVoiceInputState("unavailable");
      return;
    }
    try {
      await speechToText.start();
    } catch (error) {
      renderVoiceInputState("error", error);
    }
  };

  const toggleVoiceInput = async () => {
    if (["requesting_permission", "connecting", "listening"].includes(state.voiceInputState)) {
      await stopVoiceInput();
      return;
    }
    if (state.voiceInputState === "finalizing") return;
    await startVoiceInput();
  };

  const createVoiceControllers = () => {
    if (previewMode) return;
    speechToText = PST.DiscussionSTT?.create({
      getAccessToken: getVoiceAccessToken,
      onStateChange: renderVoiceInputState,
      onInterim: (text) => {
        state.voiceInterim = String(text || "");
        insertVoiceTranscript();
      },
      onFinal: (text) => {
        if (String(text || "").trim()) state.voiceFinalParts.push(String(text).trim());
        state.voiceInterim = "";
        insertVoiceTranscript();
      },
      onDuration: setVoiceDuration,
      onLimit: () => renderVoiceInputState("finalizing", { message: "单次录音已达 2 分钟，正在整理文字" }),
    });
    textToSpeech = PST.DiscussionTTS?.create({
      getAccessToken: getVoiceAccessToken,
      onStateChange: setSpeechOutputState,
      onUsage: (characters) => { state.ttsCharacters += Math.max(0, Number(characters) || 0); },
      onError: (error) => renderVoiceInputState("error", error),
    });
  };

  const speakMessage = async (article, text) => {
    if (!article || !String(text || "").trim()) return;
    if (state.voiceInputState !== "idle" && state.voiceInputState !== "error") return;
    if (state.activeSpeechArticle === article && ["loading", "speaking"].includes(state.speechOutputState)) {
      cancelSpeech();
      return;
    }
    if (state.ttsCharacters + String(text).length > TTS_SESSION_CHARACTER_LIMIT) {
      renderVoiceInputState("error", { message: "本次学习的朗读已达字符上限" });
      return;
    }
    cancelSpeech();
    setPlaying(false);
    state.activeSpeechArticle = article;
    setSpeechOutputState("loading");
    if (previewMode) {
      state.voicePreviewTimer = setTimeout(() => {
        setSpeechOutputState("speaking");
        state.voicePreviewTimer = setTimeout(() => {
          state.speechOutputState = "idle";
          state.activeSpeechArticle = null;
          updateSpeechButtons();
        }, 900);
      }, 180);
      return;
    }
    if (!textToSpeech?.isSupported?.()) {
      renderVoiceInputState("error", { message: "当前设备暂不支持朗读" });
      state.activeSpeechArticle = null;
      setSpeechOutputState("idle");
      return;
    }
    await textToSpeech.speak(text);
    if (state.activeSpeechArticle === article) {
      state.activeSpeechArticle = null;
      setSpeechOutputState("idle");
    }
  };

  const openSource = () => {
    const url = state.context?.video?.url;
    if (!url) return;
    try {
      if (PST.hasExtensionContext() && chrome.tabs?.create) {
        chrome.tabs.create({ url }).catch(() => window.open(url, "_blank", "noopener"));
        return;
      }
    } catch (error) {
      if (!PST.isExtensionContextInvalidated(error)) throw error;
    }
    window.open(url, "_blank", "noopener");
  };

  const switchTab = (name) => {
    if (name !== "discussion" && state.activeTab === "discussion") {
      stopVoiceInput({ abort: true }).catch(() => undefined);
      cancelSpeech();
    }
    state.activeTab = name;
    for (const tab of elements.tabs) {
      const selected = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of elements.panels) panel.hidden = panel.id !== `panel-${name}`;
    if (name === "transcript" && state.activeCue && elements.autoFollow.checked) scrollToActiveTranscript();
  };

  const postPlayerMessage = (payload) => {
    if (!state.playerReady || state.destroyed) return false;
    try {
      elements.player.contentWindow?.postMessage(JSON.stringify(payload), PLAYER_ORIGIN);
      return Boolean(elements.player.contentWindow);
    } catch {
      state.playerReady = false;
      clearInterval(state.playbackTimer);
      state.playbackTimer = 0;
      return false;
    }
  };

  const playerCommand = (func, args = []) => {
    if (previewMode) return;
    if (embeddedMode) {
      const action = { playVideo: "play", pauseVideo: "pause", seekTo: "seek" }[func];
      if (action) sendMessage({ type: "CONTROL_LEARNING_VIDEO", action, time: args[0] });
      return;
    }
    postPlayerMessage({
      event: "command",
      func,
      args,
    });
  };

  const updateProgressDisplay = () => {
    const duration = Math.max(1, state.duration || 1);
    elements.currentTime.textContent = Core.formatTimestamp(state.currentTime);
    elements.duration.textContent = Core.formatTimestamp(state.duration);
    elements.playerProgress.max = String(duration);
    elements.playerProgress.value = String(Math.min(duration, state.currentTime));
    elements.playerFrame.dataset.playing = String(state.playing);
  };

  const setPlaying = (playing, { command = true } = {}) => {
    state.playing = Boolean(playing);
    if (state.playing) {
      stopVoiceInput({ abort: true }).catch(() => undefined);
      cancelSpeech();
    }
    if (previewMode) {
      clearInterval(state.previewTimer);
      if (state.playing) {
        state.previewTimer = setInterval(() => {
          state.currentTime = Math.min(state.duration, state.currentTime + 0.25);
          syncCurrentCue();
          updateProgressDisplay();
          if (state.currentTime >= state.duration) setPlaying(false);
        }, 250);
      }
    } else if (command) {
      playerCommand(state.playing ? "playVideo" : "pauseVideo");
    }
    updateProgressDisplay();
  };

  const seekTo = (time, { play = true } = {}) => {
    const target = Core.clamp(Number(time) || 0, 0, state.duration || Number.MAX_SAFE_INTEGER);
    state.currentTime = target;
    if (!previewMode) playerCommand("seekTo", [target, true]);
    syncCurrentCue();
    updateProgressDisplay();
    if (play) setPlaying(true);
  };

  const renderCueRail = () => {
    const cues = state.cues.slice(0, 48);
    elements.cueRail.replaceChildren(...cues.map((cue) => {
      const button = document.createElement("button");
      button.className = "cue-card";
      button.type = "button";
      button.dataset.start = String(cue.start);
      button.innerHTML = `<time>${Core.formatTimestamp(cue.start)}</time><p>${PST.escapeHtml(cue.text)}</p>`;
      button.addEventListener("click", () => seekTo(cue.start));
      return button;
    }));
  };

  const renderTranscript = () => {
    const query = elements.transcriptSearch.value.trim().toLowerCase();
    const visible = state.cues.filter((cue) => !query || cue.text.toLowerCase().includes(query) || cue.translation.toLowerCase().includes(query));
    const availability = state.context?.subtitleAvailability?.state;
    elements.transcriptStatus.textContent = state.context?.completeTimeline
      ? `${visible.length} 句字幕`
      : availability === "unavailable"
        ? "此视频没有可用英文字幕"
        : `字幕仍在读取 · 当前 ${visible.length} 句`;
    elements.transcriptList.replaceChildren(...visible.map((cue) => {
      const button = document.createElement("button");
      button.className = "transcript-row";
      button.type = "button";
      button.dataset.start = String(cue.start);
      button.innerHTML = `<time>${Core.formatTimestamp(cue.start)}</time><span><p>${PST.escapeHtml(cue.text)}</p>${cue.translation ? `<small>${PST.escapeHtml(cue.translation)}</small>` : ""}</span>`;
      button.addEventListener("click", () => seekTo(cue.start));
      return button;
    }));
    syncCueSelection();
  };

  const scrollToActiveTranscript = () => {
    const row = [...elements.transcriptList.querySelectorAll(".transcript-row")]
      .find((item) => Number(item.dataset.start) === state.activeCue?.start);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const syncCueSelection = () => {
    for (const node of document.querySelectorAll("[data-start]")) {
      node.setAttribute("aria-current", String(Number(node.dataset.start) === state.activeCue?.start));
    }
  };

  const syncCurrentCue = () => {
    const semanticCue = Core.cueAt(state.cues, state.currentTime);
    const displayCue = Core.cueAt(state.displayCues, state.currentTime);
    const nextCue = semanticCue || displayCue;
    if (
      nextCue?.start === state.activeCue?.start
      && nextCue?.text === state.activeCue?.text
    ) return;
    state.activeCue = nextCue;
    const nextText = String(nextCue?.text || "").trim();
    elements.currentSentence.textContent = nextText;
    elements.currentSentenceContainer.hidden = !nextText;
    syncCueSelection();
    if (state.activeTab === "transcript" && elements.autoFollow.checked) scrollToActiveTranscript();
    const railCard = [...elements.cueRail.children].find((item) => Number(item.dataset.start) === nextCue?.start);
    railCard?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  };

  const renderAnalysis = (analysis) => {
    elements.analysisLoading.hidden = true;
    elements.analysisError.hidden = true;
    elements.analysisContent.hidden = false;
    const recommendation = analysis.suitability.finalRecommendation;
    const recommendationCopy = {
      intensive_study: { title: "推荐精学" },
      extensive_viewing: { title: "建议泛看" },
      not_recommended: { title: "不推荐" },
    }[recommendation];
    elements.recommendationCard.dataset.recommendation = recommendation;
    elements.recommendationTitle.textContent = recommendationCopy.title;
    elements.recommendationSummary.textContent = analysis.suitability.summary;
    const detailsHidden = recommendation === "not_recommended"
      || (recommendation === "extensive_viewing" && analysis.learningItems.length === 0 && analysis.timelineSegments.length === 0);
    elements.analysisSummary.hidden = detailsHidden;
    elements.analysisDetails.hidden = detailsHidden;
    elements.analysisDetailsTitle.textContent = recommendation === "extensive_viewing" ? "可留意内容" : "主要收获";
    elements.materialLevel.textContent = analysis.materialLevel || "—";
    elements.analysisLearnerLevel.textContent = analysis.learnerLevel;
    elements.vocabularyLevel.textContent = analysis.vocabularyLevel || "—";
    elements.speechLevel.textContent = analysis.speechLevel || "—";
    elements.syntaxLevel.textContent = analysis.syntaxLevel || "—";
    const renderTextList = (element, items) => element.replaceChildren(...items.map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }));
    renderTextList(elements.learningOutcomes, analysis.learningOutcomes.slice(0, 2));
    const categoryLabels = {
      word: "单词",
      grammar: "语法",
      pattern: "句型",
      idiom: "习语",
      slang: "俚语",
    };
    elements.learningItemCount.textContent = `${analysis.learningItems.length} 项`;
    elements.expressionSection.hidden = analysis.learningItems.length === 0;
    elements.expressionList.replaceChildren(...analysis.learningItems.map((item) => {
      const button = document.createElement("button");
      button.className = "expression-row";
      button.type = "button";
      const meaning = String(item.meaningZh || "").trim();
      const occurrenceLabel = item.occurrences > 1 ? `出现 ${item.occurrences} 次` : "";
      const note = String(item.why || "").trim();
      const details = meaning || occurrenceLabel
        ? `<span class="expression-details">${meaning ? `<span class="expression-meaning">${PST.escapeHtml(meaning)}</span>` : ""}${occurrenceLabel ? `<span class="expression-occurrences">${PST.escapeHtml(occurrenceLabel)}</span>` : ""}</span>`
        : "";
      button.innerHTML = `<span class="expression-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5Z"/></svg></span><span class="expression-copy"><span class="expression-heading"><em data-category="${item.category}">${categoryLabels[item.category]}</em><strong>${PST.escapeHtml(item.expression)}</strong></span>${details}${note ? `<small>${PST.escapeHtml(note)}</small>` : ""}</span><time>${Core.formatTimestamp(item.timestamp)}</time>`;
      button.title = `跳转到 ${Core.formatTimestamp(item.timestamp)}：${item.sourceText}`;
      button.addEventListener("click", () => seekTo(item.timestamp));
      return button;
    }));
    const duration = Math.max(1, state.duration);
    const timelineSegments = analysis.timelineSegments.slice(0, 4);
    elements.timelineSection.hidden = timelineSegments.length === 0;
    elements.difficultyTimeline.replaceChildren(...timelineSegments.map((segment) => {
      const marker = document.createElement("button");
      marker.className = "timeline-range";
      marker.type = "button";
      marker.style.left = `${(segment.start / duration) * 100}%`;
      marker.style.width = `${Math.max(1.6, ((segment.end - segment.start) / duration) * 100)}%`;
      marker.title = `${Core.formatTimestamp(segment.start)}–${Core.formatTimestamp(segment.end)} · ${segment.title}`;
      marker.setAttribute("aria-label", `跳转到 ${Core.formatTimestamp(segment.timestamp)}，${segment.title}`);
      marker.addEventListener("click", () => seekTo(segment.timestamp));
      return marker;
    }));
    const rangeLabel = recommendation === "extensive_viewing" ? "可留意" : "建议精学";
    elements.recommendedRange.textContent = `${rangeLabel} ${Core.formatTimestamp(analysis.recommendedRange.start)}–${Core.formatTimestamp(analysis.recommendedRange.end)}`;
    elements.recommendedRange.onclick = () => seekTo(analysis.recommendedRange.start);
    elements.timelineSegmentList.replaceChildren(...timelineSegments.map((segment) => {
      const button = document.createElement("button");
      button.className = "timeline-segment-row";
      button.type = "button";
      const focus = String(segment.focus || "").trim();
      button.innerHTML = `<time>${Core.formatTimestamp(segment.start)}–${Core.formatTimestamp(segment.end)}</time><span><strong>${PST.escapeHtml(segment.title)}</strong><em>${segment.level}</em>${focus ? `<small>${PST.escapeHtml(focus)}</small>` : ""}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5Z"/></svg>`;
      button.addEventListener("click", () => seekTo(segment.timestamp));
      return button;
    }));
    renderDiscussionOutline();
  };

  const renderAnalysisStatus = ({
    label = "AI 材料分析",
    title,
    message,
    status = "loading",
  }) => {
    elements.analysisLoading.hidden = true;
    elements.analysisContent.hidden = true;
    elements.analysisError.hidden = false;
    elements.analysisError.dataset.state = status;
    elements.analysisError.setAttribute("aria-busy", String(status === "loading"));
    elements.analysisStatusLabel.textContent = label;
    elements.analysisErrorTitle.textContent = title;
    elements.analysisErrorMessage.textContent = message;
  };

  const renderSubtitlePending = (message = "正在从当前视频读取英文字幕；字幕准备好后会自动开始分析。") => {
    renderAnalysisStatus({
      label: "正在读取字幕",
      title: "正在读取英文字幕",
      message,
    });
  };

  const renderSubtitleUnavailable = ({ message = "" } = {}) => {
    const availability = state.context?.subtitleAvailability || {};
    const explicit = availability.state === "unavailable";
    const loginHint = availability.needsLogin ? " 如果你尚未登录当前网站，可登录后重新检测。" : "";
    renderAnalysisStatus({
      label: explicit ? "字幕不可用" : "等待英文字幕",
      title: explicit ? "此视频没有可用英文字幕" : "还没有读取到英文字幕",
      message: message || (explicit
        ? `当前网站没有为这个视频返回可用的英文字幕，因此暂时无法生成材料分析。${loginHint}`
        : "请确认视频已开始播放并选择英文字幕，然后重新检测。"),
      status: explicit ? "unavailable" : "loading",
    });
  };

  const applyLearningContext = (response) => {
    state.context = response;
    state.duration = Math.max(
      Number(response.video?.duration) || 0,
      Number(response.cues?.at(-1)?.end) || 0,
      Number(response.displayCues?.at(-1)?.end) || 0,
      1,
    );
    state.currentTime = Number(response.video?.currentTime) || state.currentTime || 0;
    state.cues = Core.normalizeCues(response.cues, state.duration);
    state.displayCues = Core.normalizeCues(response.displayCues || response.cues, state.duration);
    elements.title.textContent = response.video?.title || "学习视频";
    elements.author.textContent = response.video?.author || response.site?.name || "Video";
    renderCueRail();
    renderTranscript();
    renderDiscussionOutline();
    syncCurrentCue();
    updateProgressDisplay();
  };

  const waitForMoreLearningCues = async () => {
    if (previewMode || state.contextRetrying) return;
    state.contextRetrying = true;
    renderSubtitlePending();
    let lastContextError = "";
    for (let attempt = 0; attempt < 20 && !state.destroyed; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 500));
      if (state.destroyed) break;
      const response = await sendMessage({ type: "GET_LEARNING_CONTEXT" });
      if (!response?.ok) {
        lastContextError = response?.error || lastContextError;
        if (response?.contextInvalidated) break;
        continue;
      }
      const nextCues = Core.normalizeCues(response.cues, Number(response.video?.duration) || Number.POSITIVE_INFINITY);
      if (
        nextCues.length > state.cues.length
        || Boolean(response.completeTimeline) !== Boolean(state.context?.completeTimeline)
        || response.subtitleAvailability?.state !== state.context?.subtitleAvailability?.state
      ) {
        applyLearningContext(response);
      }
      if (response.subtitleAvailability?.state === "unavailable") {
        state.contextRetrying = false;
        renderSubtitleUnavailable();
        return;
      }
      if (response.completeTimeline && nextCues.length >= 3) {
        state.contextRetrying = false;
        await loadAnalysis({ allowPartial: false });
        return;
      }
    }
    state.contextRetrying = false;
    if (state.destroyed) return;
    if (state.cues.length >= 3) {
      await loadAnalysis({ allowPartial: true });
      return;
    }
    renderSubtitleUnavailable({ message: lastContextError });
  };

  const analysisCacheKey = () => `learning-analysis:v6:${state.context?.video?.id || "unknown"}:${Core.transcriptHash(state.cues)}:${elements.learnerLevel.value}`;

  const getCachedAnalysis = async () => {
    if (!hasExtensionApi) return null;
    const key = analysisCacheKey();
    const stored = await readExtensionStorage("local", { learningAnalysisCache: {} });
    const cached = stored.learningAnalysisCache?.[key];
    return Core.isCacheableAnalysis(cached) ? cached : null;
  };

  const cacheAnalysis = async (analysis) => {
    if (!hasExtensionApi || !Core.isCacheableAnalysis(analysis)) return;
    const key = analysisCacheKey();
    const stored = await readExtensionStorage("local", { learningAnalysisCache: {} });
    const entries = Object.entries(stored.learningAnalysisCache || {}).filter(([entryKey]) => entryKey !== key);
    const learningAnalysisCache = Object.fromEntries([[key, analysis], ...entries].slice(0, 20));
    await writeExtensionStorage("local", { learningAnalysisCache });
  };

  const saveAnalysisToHistory = async (analysis) => {
    const History = PST.LearningHistoryCore;
    if (!History || !hasExtensionApi || !state.context?.video) return;
    const stored = await readExtensionStorage("local", { [History.STORAGE_KEY]: [] });
    const history = History.normalizeHistory(stored[History.STORAGE_KEY]);
    const existing = History.findRecord(history, state.context.video);
    if (!existing) return;
    const record = History.buildRecord({
      video: state.context.video,
      currentTime: state.currentTime,
      duration: state.duration,
      analysis,
      existing,
      now: Date.now(),
    });
    await writeExtensionStorage("local", { [History.STORAGE_KEY]: History.upsertHistory(history, record) });
  };

  const renderUnavailableAnalysis = ({
    summary = "AI 分析暂时不可用，请稍后重试。",
  } = {}) => {
    state.analysis = null;
    renderAnalysisStatus({
      title: "材料分析正在准备中",
      message: "正在整理字幕、评估难度并提炼学习重点，请稍候。",
    });
    elements.analysisError.dataset.detail = summary;
    renderDiscussionOutline();
  };

  const loadAnalysis = async ({ force = false, allowPartial = false } = {}) => {
    if (!state.context?.completeTimeline && !allowPartial) {
      if (state.context?.subtitleAvailability?.state === "unavailable") renderSubtitleUnavailable();
      else {
        renderSubtitlePending();
        waitForMoreLearningCues();
      }
      return;
    }
    elements.analysisLoading.hidden = false;
    elements.analysisError.hidden = true;
    elements.analysisContent.hidden = true;
    try {
      if (state.cues.length < 3) throw new Error("字幕仍在准备，收集到足够内容后会自动分析");
      let raw = null;
      if (previewMode) raw = SAMPLE_ANALYSIS;
      else if (!force) raw = await getCachedAnalysis();
      if (!raw) {
        const response = await sendMessage({
          type: "ANALYZE_LEARNING_MATERIAL",
          learnerLevel: elements.learnerLevel.value,
          video: state.context.video,
          cues: state.cues,
          transcriptComplete: Boolean(state.context?.completeTimeline),
        });
        if (!response?.ok) throw new Error(response?.error || "材料分析暂时不可用");
        raw = response.analysis;
      }
      state.analysis = Core.sanitizeAnalysis(raw, {
        cues: state.cues,
        duration: state.duration,
        learnerLevel: elements.learnerLevel.value,
        videoTitle: state.context?.video?.title,
      });
      if (!previewMode) await cacheAnalysis(state.analysis);
      renderAnalysis(state.analysis);
      saveAnalysisToHistory(state.analysis).catch(() => undefined);
    } catch (error) {
      renderUnavailableAnalysis({
        summary: error?.message || "AI 分析暂时不可用，请稍后重试。",
      });
    }
  };

  const appendMessage = ({ role, text, citation, feedback, autoSpeak = false }) => {
    const article = document.createElement("article");
    article.className = "message";
    article.dataset.role = role;
    const heading = document.createElement("div");
    heading.className = "message-heading";
    const roleLabel = document.createElement("span");
    roleLabel.className = "message-role";
    roleLabel.textContent = role === "user" ? "你" : "AI 老师";
    heading.append(roleLabel);
    if (role === "assistant") {
      const speakButton = document.createElement("button");
      speakButton.className = "message-speak-button";
      speakButton.type = "button";
      speakButton.dataset.state = "idle";
      speakButton.setAttribute("aria-label", "朗读这条回复");
      speakButton.setAttribute("aria-pressed", "false");
      speakButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6 7 10H4v4h3l4 4Z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a8 8 0 0 1 0 11"/></svg><span>朗读</span>';
      speakButton.addEventListener("click", () => speakMessage(article, text));
      heading.append(speakButton);
    }
    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = text;
    article.append(heading, body);
    if (citation && Number.isFinite(Number(citation.timestamp))) {
      const citationButton = document.createElement("button");
      citationButton.className = "citation-button";
      citationButton.type = "button";
      citationButton.textContent = `${Core.formatTimestamp(citation.timestamp)} · ${String(citation.text || "播放引用").slice(0, 42)}`;
      citationButton.addEventListener("click", () => seekTo(citation.timestamp));
      article.append(citationButton);
    }
    if (feedback) {
      const note = document.createElement("p");
      note.className = "feedback-note";
      note.textContent = feedback;
      article.append(note);
    }
    elements.discussionMessages.append(article);
    elements.discussionMessages.scrollTop = elements.discussionMessages.scrollHeight;
    if (role === "assistant" && autoSpeak && state.autoSpeak) speakMessage(article, text).catch(() => undefined);
    return article;
  };

  const getDiscussionPlan = () => {
    if (state.analysis?.suitability?.finalRecommendation !== "intensive_study") return [];
    const questions = state.analysis?.discussionQuestions || { source: [], advanced: [] };
    const planItem = (question, type) => ({
      type,
      text: String(typeof question === "string" ? question : question?.text || "").trim(),
      evidence: Array.isArray(question?.evidence) ? question.evidence : [],
    });
    return [
      ...(questions.source || []).map((question) => planItem(question, "source")),
      ...(questions.advanced || []).map((question) => planItem(question, "advanced")),
    ].filter((item) => item.text && item.evidence.length);
  };

  const renderQuestionList = (target, questions) => {
    target.replaceChildren(...questions.map((question) => {
      const item = document.createElement("li");
      item.textContent = typeof question === "string" ? question : question?.text || "";
      return item;
    }));
  };

  const updateDiscussionProgress = () => {
    const total = state.discussionPlan.length;
    const completed = state.discussionPhase === "question"
      ? Math.min(state.discussionQuestionIndex, total)
      : total;
    const phaseLabel = state.discussionPhase === "casual"
      ? "自由讨论"
      : state.discussionPhase === "complete"
        ? "课堂完成"
        : `提纲问题 ${Math.min(state.discussionQuestionIndex + 1, total)}`;
    elements.discussionPhaseLabel.textContent = phaseLabel;
    elements.discussionProgressCurrent.textContent = String(completed);
    elements.discussionProgressTotal.textContent = String(total);
    elements.discussionProgressTrack.setAttribute("aria-valuemax", String(total));
    elements.discussionProgressTrack.setAttribute("aria-valuenow", String(completed));
    elements.discussionProgressBar.style.width = `${total ? (completed / total) * 100 : 0}%`;
    [...elements.discussionSessionQuestionList.children].forEach((item, index) => {
      const itemState = state.discussionPhase !== "question" || index < state.discussionQuestionIndex
        ? "complete"
        : index === state.discussionQuestionIndex
          ? "current"
          : "pending";
      item.dataset.state = itemState;
    });
  };

  const renderDiscussionOutline = () => {
    const recommendation = state.analysis?.suitability?.finalRecommendation;
    const subtitleUnavailable = state.context?.subtitleAvailability?.state === "unavailable";
    const questions = state.analysis?.discussionQuestions || { source: [], advanced: [] };
    state.discussionPlan = getDiscussionPlan();
    const discussionAvailable = !subtitleUnavailable
      && recommendation === "intensive_study"
      && state.discussionPlan.length > 0;
    elements.discussionUnavailable.hidden = discussionAvailable;
    if (!discussionAvailable) {
      const discussionPending = !subtitleUnavailable && !state.analysis;
      elements.discussionUnavailable.dataset.state = discussionPending ? "loading" : "unavailable";
      elements.discussionUnavailable.setAttribute("aria-busy", String(discussionPending));
      elements.discussionUnavailableLabel.textContent = subtitleUnavailable
        ? "字幕不可用"
        : discussionPending ? "AI 讨论准备中" : "讨论说明";
      elements.discussionUnavailableTitle.textContent = subtitleUnavailable
        ? "此视频没有可用英文字幕"
        : state.analysis ? "这份材料不生成讨论课" : "正在生成讨论提纲";
      elements.discussionUnavailableMessage.textContent = subtitleUnavailable
        ? "没有字幕证据，无法生成可靠的讨论问题。"
        : recommendation === "extensive_viewing"
          ? "这份材料更适合泛看，不生成完整讨论课。"
          : state.analysis
            ? "当前学习建议不是精学，仍可继续观看或查看字幕。"
            : "材料分析完成后，AI 会根据视频内容整理讨论问题，请稍候。";
      elements.discussionOutline.hidden = true;
      elements.discussionStartActions.hidden = true;
      elements.discussionSession.hidden = true;
      elements.discussionForm.hidden = true;
      state.discussionPlan = [];
      renderQuestionList(elements.sourceQuestionList, []);
      renderQuestionList(elements.advancedQuestionList, []);
      return;
    }
    elements.discussionOutline.hidden = false;
    elements.discussionStartActions.hidden = false;
    const groundedQuestions = (items) => (items || []).filter((question) => Array.isArray(question?.evidence) && question.evidence.length);
    renderQuestionList(elements.sourceQuestionList, groundedQuestions(questions.source));
    renderQuestionList(elements.advancedQuestionList, groundedQuestions(questions.advanced));
    elements.discussionSessionQuestionList.replaceChildren(...state.discussionPlan.map((question, index) => {
      const item = document.createElement("li");
      item.textContent = `${index + 1}. ${question.text}`;
      return item;
    }));
    updateDiscussionProgress();
  };

  const resetDiscussionSession = () => {
    stopVoiceInput({ abort: true }).catch(() => undefined);
    cancelSpeech();
    state.discussionActive = false;
    state.discussionPhase = "outline";
    state.discussionQuestionIndex = 0;
    state.messages = [];
    elements.discussionMessages.replaceChildren();
    elements.discussionSession.hidden = true;
    elements.discussionForm.hidden = true;
    elements.discussionIntro.hidden = true;
    elements.discussionSessionOutline.hidden = true;
    elements.discussionOutlineToggle.setAttribute("aria-expanded", "false");
    renderDiscussionOutline();
  };

  const startDiscussion = async () => {
    if (!state.analysis) await loadAnalysis();
    if (state.analysis?.suitability?.finalRecommendation !== "intensive_study") return;
    state.discussionPlan = getDiscussionPlan();
    if (!state.discussionPlan.length) return;
    setPlaying(false);
    stopVoiceInput({ abort: true }).catch(() => undefined);
    cancelSpeech();
    state.discussionActive = true;
    state.discussionPhase = "question";
    state.discussionQuestionIndex = 0;
    state.messages = [];
    elements.discussionMessages.replaceChildren();
    elements.discussionOutline.hidden = true;
    elements.discussionStartActions.hidden = true;
    elements.discussionSession.hidden = false;
    elements.discussionForm.hidden = false;
    elements.discussionIntro.hidden = false;
    const openingQuestion = state.discussionPlan[0].text;
    state.messages.push({ role: "assistant", content: openingQuestion });
    appendMessage({ role: "assistant", text: openingQuestion, autoSpeak: true });
    updateDiscussionProgress();
    elements.progress.textContent = "2";
    elements.discussionInput.focus();
  };

  const previewDiscussion = ({ hint = false } = {}) => {
    const expression = state.analysis?.expressions?.[0]?.expression || "go on a hike";
    if (hint) return {
      reply: `提示：先说你认同还是不认同，再解释原因。可以使用 “${expression}”。`,
      citation: { timestamp: 91, text: "I'm going to smash this and we're going to go on this absolutely epic hike." },
    };
    if (state.discussionPhase === "casual") return {
      reply: "课堂总结\n\n你能清楚表达观点，也会用原因支撑答案。接下来注意用 build confidence，而不是 make confidence；描述经历时也可以多用具体例子。整体表达自然、有逻辑，今天的讨论完成了。",
      citation: { timestamp: 382, text: "Traveling alone forces you to make decisions and trust yourself." },
      feedback: "建议复习：build confidence · trust yourself · roughly",
    };
    return {
      reply: "Good answer. You connected the idea to your own experience clearly.",
      citation: { timestamp: 382, text: "Traveling alone forces you to make decisions and trust yourself." },
      feedback: "表达升级：可以用 “build confidence” 代替 “make confidence”。",
    };
  };

  const requestDiscussion = async ({ hint = false } = {}) => {
    const currentQuestion = state.discussionPlan[state.discussionQuestionIndex];
    const response = previewMode ? { ok: true, discussion: previewDiscussion({ hint }) } : await sendMessage({
      type: "DISCUSS_LEARNING_MATERIAL",
      mode: currentQuestion?.type || "advanced",
      phase: state.discussionPhase,
      questionIndex: state.discussionQuestionIndex,
      questionPlan: state.discussionPlan,
      hint,
      learnerLevel: elements.learnerLevel.value,
      video: state.context.video,
      cues: state.cues,
      expressions: state.analysis?.expressions || [],
      messages: state.messages,
    });
    if (!response?.ok) throw new Error(response?.error || "AI 讨论暂时不可用");
    return response.discussion;
  };

  const runDiscussion = async ({ hint = false } = {}) => {
    await stopVoiceInput({ abort: true });
    cancelSpeech();
    elements.discussionInput.disabled = true;
    elements.requestHint.disabled = true;
    elements.discussionMicrophone.disabled = true;
    elements.discussionSend.disabled = true;
    try {
      const result = await requestDiscussion({ hint });
      let text = result.reply || result.question || "";
      if (!hint && state.discussionPhase === "question") {
        const nextIndex = state.discussionQuestionIndex + 1;
        if (nextIndex < state.discussionPlan.length) {
          state.discussionQuestionIndex = nextIndex;
          text = [text, state.discussionPlan[nextIndex].text].filter(Boolean).join("\n\n");
        } else {
          state.discussionPhase = "casual";
          text = [
            text,
            "Before we wrap up, is there anything else from this video—or from your own experience—that you'd like to talk about?",
          ].filter(Boolean).join("\n\n");
        }
      } else if (!hint && state.discussionPhase === "casual") {
        state.discussionPhase = "complete";
        elements.discussionForm.hidden = true;
        elements.progress.textContent = "3";
      }
      state.messages.push({ role: "assistant", content: text });
      state.messages = state.messages.slice(-24);
      appendMessage({ role: "assistant", text, citation: result.citation, feedback: result.feedback, autoSpeak: true });
      updateDiscussionProgress();
    } catch (error) {
      appendMessage({ role: "assistant", text: error?.message || "AI 讨论暂时不可用，请稍后再试。" });
    } finally {
      elements.discussionInput.disabled = false;
      elements.requestHint.disabled = false;
      elements.discussionMicrophone.disabled = false;
      elements.discussionSend.disabled = false;
      if (state.discussionPhase !== "complete") elements.discussionInput.focus();
    }
  };

  const showRuntimeError = (error) => {
    if (state.destroyed) return;
    const contextInvalidated = PST.isExtensionContextInvalidated(error);
    state.playerReady = false;
    clearInterval(state.playbackTimer);
    state.playbackTimer = 0;
    elements.analysisLoading.hidden = true;
    elements.analysisContent.hidden = true;
    elements.analysisError.hidden = false;
    elements.analysisErrorMessage.textContent = contextInvalidated
      ? extensionUnavailableMessage
      : error?.message || "学习模式初始化失败，请刷新页面后重试。";
    if (contextInvalidated) elements.title.textContent = "扩展需要刷新";
  };

  const syncEmbeddedPlayback = async () => {
    if (state.destroyed) return;
    const playback = await sendMessage({ type: "GET_LEARNING_PLAYBACK" });
    if (!playback?.ok) {
      if (playback?.contextInvalidated) {
        clearInterval(state.playbackTimer);
        state.playbackTimer = 0;
      }
      return;
    }
    state.currentTime = Number(playback.currentTime) || 0;
    if (Number(playback.duration) > 0) state.duration = Number(playback.duration);
    state.playing = !playback.paused;
    syncCurrentCue();
    updateProgressDisplay();
  };

  const startPlaybackPolling = () => {
    clearInterval(state.playbackTimer);
    state.playbackTimer = 0;
    if (state.destroyed || previewMode) return;
    if (embeddedMode) {
      syncEmbeddedPlayback();
      state.playbackTimer = setInterval(syncEmbeddedPlayback, 500);
      return;
    }
    if (!state.playerReady) return;
    state.playbackTimer = setInterval(() => {
      playerCommand("getCurrentTime");
      playerCommand("getDuration");
    }, 500);
  };

  const configurePlayer = () => {
    if (previewMode || embeddedMode) return;
    const videoId = state.context.video.id || Core.extractYouTubeVideoId(state.context.video.url);
    if (!videoId) {
      elements.playerError.hidden = false;
      elements.centerPlay.hidden = true;
      return;
    }
    const origin = encodeURIComponent(location.origin);
    state.playerReady = false;
    elements.player.addEventListener("load", () => {
      state.playerReady = true;
      if (!postPlayerMessage({ event: "listening", id: "engram-player" })) return;
      playerCommand("getDuration");
      playerCommand("getCurrentTime");
      startPlaybackPolling();
    }, { once: true });
    elements.player.src = `${PLAYER_ORIGIN}/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1&rel=0&origin=${origin}&start=${Math.floor(state.currentTime)}`;
    elements.player.hidden = false;
    elements.poster.hidden = true;
  };

  const initialize = async () => {
    const [storedLevel, storedVoiceSettings, storedVoicePrivacy] = await Promise.all([
      hasExtensionApi
        ? readExtensionStorage("sync", { learnerLevel: "B1" })
        : { learnerLevel: "B1" },
      hasExtensionApi
        ? readExtensionStorage("sync", { discussionAutoSpeak: true })
        : { discussionAutoSpeak: true },
      hasExtensionApi
        ? readExtensionStorage("local", { discussionVoicePrivacyAcknowledged: false })
        : { discussionVoicePrivacyAcknowledged: false },
    ]);
    elements.learnerLevel.value = Core.sanitizeLevel(storedLevel.learnerLevel, "B1").replace("+", "") || "B1";
    state.autoSpeak = storedVoiceSettings.discussionAutoSpeak !== false;
    state.voicePrivacyAcknowledged = storedVoicePrivacy.discussionVoicePrivacyAcknowledged === true;
    elements.discussionAutoSpeak.setAttribute("aria-pressed", String(state.autoSpeak));
    createVoiceControllers();
    renderVoiceInputState("idle");
    let response = previewMode
      ? (previewState === "no-subtitles" ? SAMPLE_UNAVAILABLE_CONTEXT : SAMPLE_CONTEXT)
      : null;
    if (!previewMode) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        response = await sendMessage({ type: "GET_LEARNING_CONTEXT" });
        if (
          !response?.ok
          || (response.cues?.length || 0) >= 3
          || response.subtitleAvailability?.state === "unavailable"
        ) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!response?.ok) {
      elements.analysisLoading.hidden = true;
      elements.analysisError.hidden = false;
      elements.analysisErrorMessage.textContent = response?.error || "没有连接到可学习的视频。";
      elements.title.textContent = "未连接视频";
      return;
    }
    applyLearningContext(response);
    if (hasExtensionApi && !embeddedMode && !previewMode) {
      try {
        const nativeUrl = PST.buildLearningModeUrl?.(
          response.video?.url,
          state.currentTime,
          response.site,
        );
        if (!nativeUrl) throw new Error("Unsupported learning site");
        location.replace(nativeUrl);
        return;
      } catch {
        // The regular error state below remains available for malformed legacy links.
      }
    }
    elements.shell.dataset.state = "ready";
    configurePlayer();
    if (embeddedMode) startPlaybackPolling();
    if (previewMode && previewState === "loading") return;
    await loadAnalysis();
  };

  elements.tabs.forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  document.querySelectorAll("[data-open-source]").forEach((button) => button.addEventListener("click", openSource));
  elements.openSource.addEventListener("click", openSource);
  elements.back.addEventListener("click", () => history.length > 1 ? history.back() : openSource());
  elements.centerPlay.addEventListener("click", () => setPlaying(true));
  elements.playToggle.addEventListener("click", () => setPlaying(!state.playing));
  elements.playerProgress.addEventListener("input", () => seekTo(Number(elements.playerProgress.value), { play: false }));
  elements.previousCue.addEventListener("click", () => {
    const previous = [...state.cues].reverse().find((cue) => cue.start < state.currentTime - 0.45);
    if (previous) seekTo(previous.start);
  });
  elements.nextCue.addEventListener("click", () => {
    const next = state.cues.find((cue) => cue.start > state.currentTime + 0.35);
    if (next) seekTo(next.start);
  });
  elements.transcriptSearch.addEventListener("input", renderTranscript);
  elements.refreshAnalysis.addEventListener("click", () => loadAnalysis({ force: true }));
  elements.learnerLevel.addEventListener("change", () => {
    (async () => {
      if (hasExtensionApi) await writeExtensionStorage("sync", { learnerLevel: elements.learnerLevel.value });
      state.analysis = null;
      resetDiscussionSession();
      await loadAnalysis();
    })().catch(showRuntimeError);
  });
  elements.startDiscussion.addEventListener("click", startDiscussion);
  elements.discussionOutlineToggle.addEventListener("click", () => {
    const expanded = elements.discussionOutlineToggle.getAttribute("aria-expanded") !== "true";
    elements.discussionOutlineToggle.setAttribute("aria-expanded", String(expanded));
    elements.discussionSessionOutline.hidden = !expanded;
  });
  elements.requestHint.addEventListener("click", () => runDiscussion({ hint: true }));
  elements.discussionMicrophone.addEventListener("click", () => {
    toggleVoiceInput().catch((error) => renderVoiceInputState("error", error));
  });
  elements.discussionAutoSpeak.addEventListener("click", () => {
    state.autoSpeak = !state.autoSpeak;
    elements.discussionAutoSpeak.setAttribute("aria-pressed", String(state.autoSpeak));
    if (!state.autoSpeak) cancelSpeech();
    writeExtensionStorage("sync", { discussionAutoSpeak: state.autoSpeak }).catch(() => undefined);
  });
  elements.discussionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = elements.discussionInput.value.trim();
    if (!content) return;
    state.messages.push({ role: "user", content });
    state.messages = state.messages.slice(-24);
    appendMessage({ role: "user", text: content });
    elements.discussionInput.value = "";
    await runDiscussion();
  });

  window.addEventListener("message", (event) => {
    if (!/^https:\/\/www\.youtube(?:-nocookie)?\.com$/.test(event.origin)) return;
    let payload;
    try { payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data; }
    catch { return; }
    if (payload?.event === "onStateChange") setPlaying(Number(payload.info) === 1, { command: false });
    if (payload?.event === "onError") {
      elements.playerError.hidden = false;
      elements.centerPlay.hidden = true;
      state.playing = false;
    }
    const info = payload?.info;
    if (Number.isFinite(info?.currentTime)) state.currentTime = info.currentTime;
    if (Number.isFinite(info?.duration) && info.duration > 0) state.duration = info.duration;
    syncCurrentCue();
    updateProgressDisplay();
  });

  window.addEventListener("pagehide", () => {
    state.destroyed = true;
    state.playerReady = false;
    state.contextRetrying = false;
    clearInterval(state.previewTimer);
    clearInterval(state.playbackTimer);
    clearTimeout(state.voicePreviewTimer);
    speechToText?.dispose?.();
    textToSpeech?.dispose?.();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    stopVoiceInput({ abort: true }).catch(() => undefined);
    cancelSpeech();
  });
  initialize().catch(showRuntimeError);
})();
