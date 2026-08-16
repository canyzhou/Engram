(() => {
  const PST = globalThis.ParamountSubtitles;
  const Core = PST.LearningModeCore;
  const hasExtensionApi = Boolean(globalThis.chrome?.runtime?.id);
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
    studyMinutes: 12,
    recommendedRange: { start: 260, end: 490 },
    difficultRanges: [{ start: 260, end: 330 }, { start: 382, end: 480 }],
    expressions: [
      { expression: "absolutely epic hike", meaningZh: "非常精彩的徒步旅行", why: "用加强语气描述一次难忘的行程", timestamp: 91 },
      { expression: "roughly", meaningZh: "大约；大致", why: "估算时间和数量时很常用", timestamp: 26 },
      { expression: "have been told", meaningZh: "曾被告知；别人一直这样告诉我", why: "转述他人建议时很常用", timestamp: 78 },
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
    loopToggle: document.querySelector("#loop-toggle"),
    playerProgress: document.querySelector("#player-progress"),
    currentTime: document.querySelector("#current-time"),
    duration: document.querySelector("#duration"),
    currentSentence: document.querySelector("#current-sentence p"),
    cueRail: document.querySelector("#cue-rail"),
    tabs: [...document.querySelectorAll("[data-tab]")],
    panels: [...document.querySelectorAll(".tab-panel")],
    analysisLoading: document.querySelector("#analysis-loading"),
    analysisError: document.querySelector("#analysis-error"),
    analysisErrorMessage: document.querySelector("#analysis-error-message"),
    analysisContent: document.querySelector("#analysis-content"),
    retryAnalysis: document.querySelector("#retry-analysis"),
    materialLevel: document.querySelector("#material-level"),
    analysisLearnerLevel: document.querySelector("#analysis-learner-level"),
    fitVerdict: document.querySelector("#fit-verdict"),
    startLabel: document.querySelector("#start-label"),
    startLearning: document.querySelector("#start-learning"),
    vocabularyLevel: document.querySelector("#vocabulary-level"),
    speechLevel: document.querySelector("#speech-level"),
    syntaxLevel: document.querySelector("#syntax-level"),
    expressionList: document.querySelector("#expression-list"),
    difficultyTimeline: document.querySelector("#difficulty-timeline"),
    recommendedRange: document.querySelector("#recommended-range"),
    transcriptSearch: document.querySelector("#transcript-search"),
    autoFollow: document.querySelector("#auto-follow"),
    transcriptStatus: document.querySelector("#transcript-status"),
    transcriptList: document.querySelector("#transcript-list"),
    discussionModes: [...document.querySelectorAll("[data-discussion-mode]")],
    discussionMessages: document.querySelector("#discussion-messages"),
    discussionEmpty: document.querySelector("#discussion-empty"),
    startDiscussion: document.querySelector("#start-discussion"),
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
    loopCue: false,
    activeCue: null,
    discussionMode: "source",
    messages: [],
    previewTimer: 0,
    playbackTimer: 0,
    contextRetrying: false,
  };

  const sendMessage = async (message) => {
    if (!hasExtensionApi) return null;
    try { return await chrome.runtime.sendMessage(sourceTabId ? { ...message, sourceTabId } : message); }
    catch (error) { return { ok: false, error: error?.message || "扩展通信失败" }; }
  };

  const openSource = () => {
    const url = state.context?.video?.url;
    if (!url) return;
    if (hasExtensionApi && chrome.tabs?.create) chrome.tabs.create({ url });
    else window.open(url, "_blank", "noopener");
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

  const playerCommand = (func, args = []) => {
    if (previewMode) return;
    if (embeddedMode) {
      const action = { playVideo: "play", pauseVideo: "pause", seekTo: "seek" }[func];
      if (action) sendMessage({ type: "CONTROL_LEARNING_VIDEO", action, time: args[0] });
      return;
    }
    elements.player.contentWindow?.postMessage(JSON.stringify({
      event: "command",
      func,
      args,
    }), "https://www.youtube-nocookie.com");
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
    if (state.loopCue && state.activeCue && state.currentTime >= state.activeCue.end - 0.08) {
      seekTo(state.activeCue.start, { play: true });
      return;
    }
    if (nextCue?.start === state.activeCue?.start) return;
    state.activeCue = nextCue;
    elements.currentSentence.textContent = nextCue?.text || "当前时间点没有字幕。";
    syncCueSelection();
    if (state.activeTab === "transcript" && elements.autoFollow.checked) scrollToActiveTranscript();
    const railCard = [...elements.cueRail.children].find((item) => Number(item.dataset.start) === nextCue?.start);
    railCard?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  };

  const renderAnalysis = (analysis) => {
    elements.analysisLoading.hidden = true;
    elements.analysisError.hidden = true;
    elements.analysisContent.hidden = false;
    elements.materialLevel.textContent = analysis.materialLevel;
    elements.analysisLearnerLevel.textContent = analysis.learnerLevel;
    elements.fitVerdict.textContent = analysis.fitVerdict;
    elements.startLabel.textContent = `开始 ${analysis.studyMinutes} 分钟学习`;
    elements.vocabularyLevel.textContent = analysis.vocabularyLevel;
    elements.speechLevel.textContent = analysis.speechLevel;
    elements.syntaxLevel.textContent = analysis.syntaxLevel;
    elements.expressionList.replaceChildren(...analysis.expressions.map((item) => {
      const button = document.createElement("button");
      button.className = "expression-row";
      button.type = "button";
      const occurrenceText = item.occurrences > 1 ? `出现 ${item.occurrences} 次 · ` : "";
      button.innerHTML = `<span class="expression-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5Z"/></svg></span><span class="expression-copy"><strong>${PST.escapeHtml(item.expression)}</strong><span>${PST.escapeHtml(`${occurrenceText}${item.meaningZh}`)}</span></span><time>${Core.formatTimestamp(item.timestamp)}</time>`;
      button.addEventListener("click", () => seekTo(item.timestamp));
      return button;
    }));
    const duration = Math.max(1, state.duration);
    const ranges = [
      ...analysis.difficultRanges.map((range) => ({ ...range, recommended: false })),
      { ...analysis.recommendedRange, recommended: true },
    ];
    elements.difficultyTimeline.replaceChildren(...ranges.map((range) => {
      const marker = document.createElement("span");
      marker.className = `timeline-range${range.recommended ? " timeline-range--recommended" : ""}`;
      marker.style.left = `${(range.start / duration) * 100}%`;
      marker.style.width = `${Math.max(1.6, ((range.end - range.start) / duration) * 100)}%`;
      marker.title = `${Core.formatTimestamp(range.start)}–${Core.formatTimestamp(range.end)}`;
      return marker;
    }));
    elements.recommendedRange.textContent = `推荐精学 ${Core.formatTimestamp(analysis.recommendedRange.start)}–${Core.formatTimestamp(analysis.recommendedRange.end)}`;
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
    syncCurrentCue();
    updateProgressDisplay();
  };

  const waitForMoreLearningCues = async () => {
    if (!embeddedMode || state.contextRetrying) return;
    state.contextRetrying = true;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const response = await sendMessage({ type: "GET_LEARNING_CONTEXT" });
      if (!response?.ok) continue;
      const nextCues = Core.normalizeCues(response.cues, Number(response.video?.duration) || Number.POSITIVE_INFINITY);
      if (nextCues.length > state.cues.length) applyLearningContext(response);
      if (nextCues.length >= 3) {
        state.contextRetrying = false;
        await loadAnalysis({ force: true });
        return;
      }
    }
    state.contextRetrying = false;
  };

  const analysisCacheKey = () => `learning-analysis:${state.context?.video?.id || "unknown"}:${Core.transcriptHash(state.cues)}:${elements.learnerLevel.value}`;

  const getCachedAnalysis = async () => {
    if (!hasExtensionApi || !chrome.storage?.local) return null;
    const key = analysisCacheKey();
    const stored = await chrome.storage.local.get({ learningAnalysisCache: {} });
    return stored.learningAnalysisCache?.[key] || null;
  };

  const cacheAnalysis = async (analysis) => {
    if (!hasExtensionApi || !chrome.storage?.local) return;
    const key = analysisCacheKey();
    const stored = await chrome.storage.local.get({ learningAnalysisCache: {} });
    const entries = Object.entries(stored.learningAnalysisCache || {}).filter(([entryKey]) => entryKey !== key);
    const learningAnalysisCache = Object.fromEntries([[key, analysis], ...entries].slice(0, 20));
    await chrome.storage.local.set({ learningAnalysisCache });
  };

  const loadAnalysis = async ({ force = false } = {}) => {
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
        });
        if (!response?.ok) throw new Error(response?.error || "材料分析暂时不可用");
        raw = response.analysis;
      }
      state.analysis = Core.sanitizeAnalysis(raw, {
        cues: state.cues,
        duration: state.duration,
        learnerLevel: elements.learnerLevel.value,
      });
      if (!previewMode) await cacheAnalysis(state.analysis);
      renderAnalysis(state.analysis);
    } catch (error) {
      try {
        state.analysis = Core.sanitizeAnalysis(Core.createFallbackAnalysis({
          cues: state.cues,
          duration: state.duration,
          learnerLevel: elements.learnerLevel.value,
        }), {
          cues: state.cues,
          duration: state.duration,
          learnerLevel: elements.learnerLevel.value,
        });
        renderAnalysis(state.analysis);
      } catch {
        elements.analysisLoading.hidden = true;
        elements.analysisContent.hidden = true;
        elements.analysisError.hidden = false;
        elements.analysisErrorMessage.textContent = error?.message || "材料分析暂时不可用，你仍然可以先从字幕开始。";
        waitForMoreLearningCues();
      }
    }
  };

  const appendMessage = ({ role, text, citation, feedback }) => {
    const article = document.createElement("article");
    article.className = "message";
    article.dataset.role = role;
    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = text;
    article.append(body);
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

  const previewDiscussion = ({ hint = false } = {}) => {
    const expression = state.analysis?.expressions?.[0]?.expression || "go on a hike";
    if (hint) return {
      reply: `提示：先说你认同还是不认同，再解释原因。可以使用 “${expression}”。`,
      citation: { timestamp: 91, text: "I'm going to smash this and we're going to go on this absolutely epic hike." },
    };
    if (!state.messages.length) return state.discussionMode === "source" ? {
      reply: "In your own words, why does the speaker believe this trip could change his life?",
      citation: { timestamp: 472, text: "That is why solo travel can change the way you see your own life." },
    } : {
      reply: `Imagine a friend is nervous about traveling alone. What would you tell them? Try using “${expression}”.`,
      citation: { timestamp: 91, text: "I'm going to smash this and we're going to go on this absolutely epic hike." },
    };
    return {
      reply: "You connected challenge with confidence clearly. What is one risk of solo travel, and how could someone prepare for it?",
      citation: { timestamp: 382, text: "Traveling alone forces you to make decisions and trust yourself." },
      feedback: "表达升级：可以用 “build confidence” 代替 “make confidence”。",
    };
  };

  const requestDiscussion = async ({ hint = false } = {}) => {
    const response = previewMode ? { ok: true, discussion: previewDiscussion({ hint }) } : await sendMessage({
      type: "DISCUSS_LEARNING_MATERIAL",
      mode: state.discussionMode,
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
      const text = [result.reply, result.question].filter(Boolean).join("\n\n");
      state.messages.push({ role: "assistant", content: text });
      state.messages = state.messages.slice(-8);
      appendMessage({ role: "assistant", text, citation: result.citation, feedback: result.feedback });
    } catch (error) {
      appendMessage({ role: "assistant", text: error?.message || "AI 讨论暂时不可用，请稍后再试。" });
    } finally {
      elements.discussionInput.disabled = false;
      elements.requestHint.disabled = false;
      elements.discussionInput.focus();
    }
  };

  const startDiscussion = async () => {
    if (!state.analysis) await loadAnalysis();
    elements.discussionEmpty.hidden = true;
    elements.discussionForm.hidden = false;
    elements.progress.textContent = "2";
    await runDiscussion();
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
    elements.player.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1&rel=0&origin=${origin}&start=${Math.floor(state.currentTime)}`;
    elements.player.hidden = false;
    elements.poster.hidden = true;
    elements.player.addEventListener("load", () => {
      elements.player.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "engram-player" }), "https://www.youtube-nocookie.com");
      playerCommand("getDuration");
      playerCommand("getCurrentTime");
    }, { once: true });
  };

  const initialize = async () => {
    const storedLevel = hasExtensionApi && chrome.storage?.sync
      ? await chrome.storage.sync.get({ learnerLevel: "B1" })
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
  elements.loopToggle.addEventListener("click", () => {
    state.loopCue = !state.loopCue;
    elements.loopToggle.setAttribute("aria-pressed", String(state.loopCue));
  });
  elements.transcriptSearch.addEventListener("input", renderTranscript);
  elements.retryAnalysis.addEventListener("click", () => loadAnalysis({ force: true }));
  elements.startLearning.addEventListener("click", () => {
    elements.progress.textContent = "1";
    switchTab("transcript");
    seekTo(state.analysis.recommendedRange.start);
  });
  elements.learnerLevel.addEventListener("change", async () => {
    if (hasExtensionApi && chrome.storage?.sync) await chrome.storage.sync.set({ learnerLevel: elements.learnerLevel.value });
    state.analysis = null;
    state.messages = [];
    elements.discussionMessages.replaceChildren();
    elements.discussionEmpty.hidden = false;
    elements.discussionForm.hidden = true;
    await loadAnalysis();
  });
  elements.discussionModes.forEach((button) => button.addEventListener("click", () => {
    state.discussionMode = button.dataset.discussionMode;
    elements.discussionModes.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    state.messages = [];
    elements.discussionMessages.replaceChildren();
    elements.discussionEmpty.hidden = false;
    elements.discussionForm.hidden = true;
  }));
  elements.startDiscussion.addEventListener("click", startDiscussion);
  elements.requestHint.addEventListener("click", () => runDiscussion({ hint: true }));
  elements.discussionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = elements.discussionInput.value.trim();
    if (!content) return;
    state.messages.push({ role: "user", content });
    state.messages = state.messages.slice(-8);
    appendMessage({ role: "user", text: content });
    elements.discussionInput.value = "";
    elements.progress.textContent = "3";
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

  if (embeddedMode) {
    const syncPlayback = async () => {
      const playback = await sendMessage({ type: "GET_LEARNING_PLAYBACK" });
      if (!playback?.ok) return;
      state.currentTime = Number(playback.currentTime) || 0;
      if (Number(playback.duration) > 0) state.duration = Number(playback.duration);
      state.playing = !playback.paused;
      syncCurrentCue();
      updateProgressDisplay();
    };
    syncPlayback();
    state.playbackTimer = setInterval(syncPlayback, 500);
  } else if (!previewMode) {
    state.playbackTimer = setInterval(() => {
      playerCommand("getCurrentTime");
      playerCommand("getDuration");
    }, 500);
  }

  window.addEventListener("pagehide", () => {
    clearInterval(state.previewTimer);
    clearInterval(state.playbackTimer);
  });
  initialize();
})();
