(() => {
  const PST = globalThis.ParamountSubtitles;
  const Core = PST.LearningModeCore;
  const PLAYER_ORIGIN = "https://www.youtube-nocookie.com";
  const hasExtensionApi = PST.hasExtensionContext();
  const pageParams = new URLSearchParams(location.search);
  const previewMode = pageParams.get("preview") === "1" || !hasExtensionApi;
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
  });

  const SAMPLE_ANALYSIS = Object.freeze({
    materialLevel: "B2",
    vocabularyLevel: "B2",
    speechLevel: "B1+",
    syntaxLevel: "B2",
    fitVerdict: "有挑战，但适合精学",
    fitReasons: [
      "叙事清楚、上下文连续，B1 学习者能抓住主线，同时会遇到少量 B2 旅行与自我成长表达。",
      "说话者会用自然口语描述计划、感受和观点，适合练习从听懂事实过渡到理解态度。",
    ],
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
    analysisErrorMessage: document.querySelector("#analysis-error-message"),
    analysisContent: document.querySelector("#analysis-content"),
    retryAnalysis: document.querySelector("#retry-analysis"),
    useLocalAnalysis: document.querySelector("#use-local-analysis"),
    refreshAnalysis: document.querySelector("#refresh-analysis"),
    analysisSource: document.querySelector("#analysis-source"),
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
    requestHint: document.querySelector("#request-hint"),
  };

  const state = {
    context: null,
    cues: [],
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
    contextRetrying: false,
    playerReady: false,
    destroyed: false,
  };

  const extensionUnavailableMessage = "扩展已更新，请刷新页面后重试。";

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
    elements.transcriptStatus.textContent = state.context?.completeTimeline
      ? `${visible.length} 句字幕`
      : `字幕仍在收集 · 当前 ${visible.length} 句`;
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
    const nextCue = Core.cueAt(state.cues, state.currentTime);
    if (nextCue?.start === state.activeCue?.start) return;
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
    elements.analysisSource.hidden = !analysis.localFallback;
    elements.materialLevel.textContent = analysis.materialLevel;
    elements.analysisLearnerLevel.textContent = analysis.learnerLevel;
    const renderTextList = (element, items) => element.replaceChildren(...items.map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }));
    renderTextList(elements.learningOutcomes, analysis.learningOutcomes);
    elements.vocabularyLevel.textContent = analysis.vocabularyLevel;
    elements.speechLevel.textContent = analysis.speechLevel;
    elements.syntaxLevel.textContent = analysis.syntaxLevel;
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
    elements.recommendedRange.textContent = `建议精学 ${Core.formatTimestamp(analysis.recommendedRange.start)}–${Core.formatTimestamp(analysis.recommendedRange.end)}`;
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

  const applyLearningContext = (response) => {
    state.context = response;
    state.duration = Math.max(Number(response.video?.duration) || 0, Number(response.cues?.at(-1)?.end) || 0, 1);
    state.currentTime = Number(response.video?.currentTime) || state.currentTime || 0;
    state.cues = Core.normalizeCues(response.cues, state.duration);
    elements.title.textContent = response.video?.title || "YouTube 视频";
    elements.author.textContent = response.video?.author || "YouTube";
    renderCueRail();
    renderTranscript();
    renderDiscussionOutline();
    syncCurrentCue();
    updateProgressDisplay();
  };

  const waitForMoreLearningCues = async () => {
    if (previewMode || state.contextRetrying) return;
    state.contextRetrying = true;
    let lastContextError = "";
    for (let attempt = 0; attempt < 60 && !state.destroyed; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (state.destroyed) break;
      const response = await sendMessage({ type: "GET_LEARNING_CONTEXT" });
      if (!response?.ok) {
        lastContextError = response?.error || lastContextError;
        if (response?.contextInvalidated) break;
        continue;
      }
      const nextCues = Core.normalizeCues(response.cues, Number(response.video?.duration) || Number.POSITIVE_INFINITY);
      if (nextCues.length > state.cues.length || Boolean(response.completeTimeline) !== Boolean(state.context?.completeTimeline)) {
        applyLearningContext(response);
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
    elements.analysisLoading.hidden = true;
    elements.analysisContent.hidden = true;
    elements.analysisError.hidden = false;
    elements.useLocalAnalysis.hidden = true;
    elements.analysisErrorMessage.textContent = lastContextError
      || "未能从 YouTube 取得足够的英文字幕。请刷新视频页后重试，并确认该视频提供英文字幕。";
  };

  const analysisCacheKey = () => `learning-analysis:v5:${state.context?.video?.id || "unknown"}:${Core.transcriptHash(state.cues)}:${elements.learnerLevel.value}`;

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

  const renderLocalAnalysis = () => {
    state.analysis = Core.sanitizeAnalysis(Core.createFallbackAnalysis({
      cues: state.cues,
      duration: state.duration,
      learnerLevel: elements.learnerLevel.value,
      videoTitle: state.context?.video?.title,
    }), {
      cues: state.cues,
      duration: state.duration,
      learnerLevel: elements.learnerLevel.value,
      videoTitle: state.context?.video?.title,
    });
    renderAnalysis(state.analysis);
    saveAnalysisToHistory(state.analysis).catch(() => undefined);
  };

  const loadAnalysis = async ({ force = false, allowPartial = false } = {}) => {
    elements.analysisLoading.hidden = false;
    elements.analysisError.hidden = true;
    elements.analysisContent.hidden = true;
    elements.useLocalAnalysis.hidden = false;
    if (!previewMode && !state.context?.completeTimeline && !allowPartial) {
      waitForMoreLearningCues();
      return;
    }
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
      elements.analysisLoading.hidden = true;
      elements.analysisContent.hidden = true;
      elements.analysisError.hidden = false;
      elements.analysisErrorMessage.textContent = error?.message || "AI 没有返回完整结果，请重试或暂时使用本地简版。";
      if (!state.context?.completeTimeline) waitForMoreLearningCues();
    }
  };

  const appendMessage = ({ role, text, citation, feedback }) => {
    const article = document.createElement("article");
    article.className = "message";
    article.dataset.role = role;
    const roleLabel = document.createElement("span");
    roleLabel.className = "message-role";
    roleLabel.textContent = role === "user" ? "你" : "AI 老师";
    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = text;
    article.append(roleLabel, body);
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
  };

  const getDiscussionPlan = () => {
    const fallback = Core.createDiscussionQuestions(state.context?.video?.title, state.cues);
    const questions = state.analysis?.discussionQuestions || fallback;
    const planItem = (question, type) => ({
      type,
      text: String(typeof question === "string" ? question : question?.text || "").trim(),
      evidence: Array.isArray(question?.evidence) ? question.evidence : [],
    });
    return [
      ...(questions.source || fallback.source).map((question) => planItem(question, "source")),
      ...(questions.advanced || fallback.advanced).map((question) => planItem(question, "advanced")),
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
    const fallback = Core.createDiscussionQuestions(state.context?.video?.title, state.cues);
    const questions = state.analysis?.discussionQuestions || fallback;
    state.discussionPlan = getDiscussionPlan();
    renderQuestionList(elements.sourceQuestionList, questions.source || fallback.source);
    renderQuestionList(elements.advancedQuestionList, questions.advanced || fallback.advanced);
    elements.discussionSessionQuestionList.replaceChildren(...state.discussionPlan.map((question, index) => {
      const item = document.createElement("li");
      item.textContent = `${index + 1}. ${question.text}`;
      return item;
    }));
    updateDiscussionProgress();
  };

  const resetDiscussionSession = () => {
    state.discussionActive = false;
    state.discussionPhase = "outline";
    state.discussionQuestionIndex = 0;
    state.messages = [];
    elements.discussionMessages.replaceChildren();
    elements.discussionOutline.hidden = false;
    elements.discussionStartActions.hidden = false;
    elements.discussionSession.hidden = true;
    elements.discussionForm.hidden = true;
    elements.discussionIntro.hidden = true;
    elements.discussionSessionOutline.hidden = true;
    elements.discussionOutlineToggle.setAttribute("aria-expanded", "false");
    renderDiscussionOutline();
  };

  const startDiscussion = async () => {
    if (!state.analysis) await loadAnalysis();
    state.discussionPlan = getDiscussionPlan();
    if (!state.discussionPlan.length) return;
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
    appendMessage({ role: "assistant", text: openingQuestion });
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
    elements.discussionInput.disabled = true;
    elements.requestHint.disabled = true;
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
      appendMessage({ role: "assistant", text, citation: result.citation, feedback: result.feedback });
      updateDiscussionProgress();
    } catch (error) {
      appendMessage({ role: "assistant", text: error?.message || "AI 讨论暂时不可用，请稍后再试。" });
    } finally {
      elements.discussionInput.disabled = false;
      elements.requestHint.disabled = false;
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
    const storedLevel = hasExtensionApi
      ? await readExtensionStorage("sync", { learnerLevel: "B1" })
      : { learnerLevel: "B1" };
    elements.learnerLevel.value = Core.sanitizeLevel(storedLevel.learnerLevel, "B1").replace("+", "") || "B1";
    let response = previewMode ? SAMPLE_CONTEXT : null;
    if (!previewMode) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        response = await sendMessage({ type: "GET_LEARNING_CONTEXT" });
        if (!response?.ok || (response.cues?.length || 0) >= 3) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!response?.ok) {
      elements.analysisLoading.hidden = true;
      elements.analysisError.hidden = false;
      elements.analysisErrorMessage.textContent = response?.error || "没有连接到可学习的 YouTube 视频。";
      elements.title.textContent = "未连接视频";
      return;
    }
    applyLearningContext(response);
    if (hasExtensionApi && !embeddedMode && !previewMode) {
      try {
        const nativeUrl = new URL(response.video?.url);
        nativeUrl.searchParams.set("engram_learning", "1");
        if (state.currentTime > 0) nativeUrl.searchParams.set("t", `${Math.floor(state.currentTime)}s`);
        location.replace(nativeUrl.toString());
        return;
      } catch {
        // The regular error state below remains available for malformed legacy links.
      }
    }
    elements.shell.dataset.state = "ready";
    configurePlayer();
    if (embeddedMode) startPlaybackPolling();
    await loadAnalysis();
  };

  elements.tabs.forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  document.querySelectorAll("[data-switch-tab]").forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.switchTab)));
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
  elements.retryAnalysis.addEventListener("click", () => loadAnalysis({ force: true }));
  elements.useLocalAnalysis.addEventListener("click", renderLocalAnalysis);
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
  });
  initialize().catch(showRuntimeError);
})();
