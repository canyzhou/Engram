(() => {
  const PST = globalThis.ParamountSubtitles || (globalThis.ParamountSubtitles = {});

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const formatTimestamp = (seconds) => {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const remainder = value % 60;
    if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  };

  const extractYouTubeVideoId = (input) => {
    try {
      const url = new URL(String(input || ""));
      if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
      if (url.hostname.endsWith("youtube.com") || url.hostname.endsWith("youtube-nocookie.com")) {
        if (url.pathname === "/watch") return url.searchParams.get("v") || "";
        const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/);
        return match?.[1] || "";
      }
    } catch {
      return "";
    }
    return "";
  };

  const normalizeCues = (input, duration = Number.POSITIVE_INFINITY) => {
    const maximum = Number.isFinite(duration) && duration > 0 ? duration : Number.POSITIVE_INFINITY;
    const cues = (Array.isArray(input) ? input : []).map((cue) => {
      const start = Number(cue?.start ?? cue?.time);
      const endValue = Number(cue?.end);
      const text = String(cue?.text || "").replace(/\s+/g, " ").trim();
      if (!Number.isFinite(start) || start < 0 || !text) return null;
      const end = Number.isFinite(endValue) && endValue > start
        ? endValue
        : start + 3;
      return {
        start: clamp(start, 0, maximum),
        end: clamp(end, 0, maximum),
        text: text.slice(0, 500),
        translation: String(cue?.translation || "").replace(/\s+/g, " ").trim().slice(0, 500),
        source: String(cue?.source || ""),
      };
    }).filter(Boolean).sort((left, right) => left.start - right.start);

    return cues.filter((cue, index) => (
      index === 0
      || cue.text !== cues[index - 1].text
      || Math.abs(cue.start - cues[index - 1].start) > 0.35
    ));
  };

  const cueAt = (cues, time) => {
    const value = Number(time) || 0;
    let current = null;
    for (const cue of cues || []) {
      if (cue.start > value + 0.2) break;
      if (value >= cue.start - 0.2 && value <= cue.end + 0.2) current = cue;
    }
    return current;
  };

  const sanitizeLevel = (value, fallback = "B1") => {
    const level = String(value || "").toUpperCase();
    return ["A1", "A2", "B1", "B1+", "B2", "B2+", "C1", "C1+", "C2"].includes(level)
      ? level
      : fallback;
  };

  const MATERIAL_VERDICTS = new Set(["worth_intensive_study", "viewing_only", "not_suitable"]);
  const ASSESSMENT_STATUSES = new Set(["complete", "pending", "failed"]);
  const LEVEL_RANKS = new Map([
    ["A1", 0], ["A2", 1], ["B1", 2], ["B1+", 2.5], ["B2", 3],
    ["B2+", 3.5], ["C1", 4], ["C1+", 4.5], ["C2", 5],
  ]);
  const SUITABILITY_REASON_CODES = new Set([
    "transcript_incomplete", "analysis_unavailable", "too_little_english", "mostly_non_speech",
    "highly_repetitive", "fragmented_context", "low_semantic_density", "low_learning_yield",
    "specialized_terse_language", "strong_coherent_spans", "useful_transferable_language",
    "level_too_easy", "level_matched", "level_too_hard",
  ]);

  const deriveDifficultyFit = (materialLevel, learnerLevel) => {
    const difference = LEVEL_RANKS.get(sanitizeLevel(materialLevel, "B1"))
      - LEVEL_RANKS.get(sanitizeLevel(learnerLevel, "B1"));
    if (difference <= -1) return "too_easy";
    if (difference >= 1.5) return "too_hard";
    return "matched";
  };

  const deriveFinalRecommendation = (materialVerdict, difficultyFit) => {
    if (materialVerdict === "not_suitable" || difficultyFit === "unknown") return "not_recommended";
    if (difficultyFit === "too_hard") return "not_recommended";
    if (materialVerdict === "viewing_only" || difficultyFit === "too_easy") return "extensive_viewing";
    return "intensive_study";
  };

  const includesChinese = (value) => /[\u3400-\u9fff]/u.test(String(value || ""));

  const clipDiscussionQuote = (text, maximumWords = 9) => {
    const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (!words.length) return "";
    return `${words.slice(0, maximumWords).join(" ")}${words.length > maximumWords ? "…" : ""}`;
  };

  const selectDiscussionCues = (cues) => {
    const candidates = normalizeCues(cues).filter((cue) => {
      const wordCount = (cue.text.match(/[A-Za-z][A-Za-z'-]*/g) || []).length;
      return wordCount >= 5;
    });
    if (!candidates.length) return [];
    return [0.08, 0.3, 0.52, 0.74, 0.94].map((position) => (
      candidates[Math.min(candidates.length - 1, Math.round((candidates.length - 1) * position))]
    ));
  };

  const createGroundedQuestion = (text, cue) => ({
    text,
    evidence: cue ? [{ timestamp: cue.start, sourceText: cue.text }] : [],
  });

  const createDiscussionQuestions = (videoTitle = "this video", cues = []) => {
    const title = String(videoTitle || "this video").replace(/\s+/g, " ").trim().slice(0, 160) || "this video";
    const anchorCues = selectDiscussionCues(cues);
    const anchors = anchorCues.map((cue) => clipDiscussionQuote(cue.text));
    if (anchorCues.length === 5) {
      return {
        source: [
          createGroundedQuestion(`The speaker mentions “${anchors[0]}.” What are your thoughts on this?`, anchorCues[0]),
          createGroundedQuestion(`Why is “${anchors[1]}” important in the video?`, anchorCues[1]),
          createGroundedQuestion(`Which example in the video best shows “${anchors[2]}”?`, anchorCues[2]),
          createGroundedQuestion(`Have you ever tried the idea in “${anchors[3]}”? What happened?`, anchorCues[3]),
          createGroundedQuestion(`When would “${anchors[4]}” be most useful?`, anchorCues[4]),
        ],
        advanced: [
          createGroundedQuestion(`What part of “${title}” seems most difficult in practice?`, anchorCues[0]),
          createGroundedQuestion("Do you usually plan this kind of task in advance, or decide as you go?", anchorCues[1]),
          createGroundedQuestion("What simple tool or habit would help someone get a better result?", anchorCues[2]),
          createGroundedQuestion("Who have you seen do this especially well? What did they do?", anchorCues[3]),
          createGroundedQuestion("If you tried one idea from the video this weekend, what exactly would you do?", anchorCues[4]),
        ],
      };
    }
    const fallbackCue = normalizeCues(cues)[0] || null;
    return {
      source: [
        createGroundedQuestion(`What specific problem is the speaker trying to solve in “${title}”?`, fallbackCue),
        createGroundedQuestion("Which technique from the video would you most like to try?", fallbackCue),
        createGroundedQuestion("Why does the speaker recommend that technique?", fallbackCue),
        createGroundedQuestion("Have you tried anything similar before? What happened?", fallbackCue),
        createGroundedQuestion("When would this technique be most useful?", fallbackCue),
      ],
      advanced: [
        createGroundedQuestion(`What part of “${title}” seems most difficult in practice?`, fallbackCue),
        createGroundedQuestion("Do you usually plan this kind of task in advance, or decide as you go?", fallbackCue),
        createGroundedQuestion("What simple tool or habit would help someone get a better result?", fallbackCue),
        createGroundedQuestion("Who have you seen do this especially well? What did they do?", fallbackCue),
        createGroundedQuestion("If you tried one idea from the video this weekend, what exactly would you do?", fallbackCue),
      ],
    };
  };

  const sanitizeDiscussionQuestions = (input, videoTitle, cues = []) => {
    const normalizedCues = normalizeCues(cues);
    const fallback = createDiscussionQuestions(videoTitle, cues);
    const sanitizeSet = (value, defaults) => {
      const questions = (Array.isArray(value) ? value : []).map((item, index) => {
        const text = String(typeof item === "string" ? item : item?.text || "")
          .replace(/\s+/g, " ").trim().slice(0, 280);
        if (!text) return null;
        const evidence = (Array.isArray(item?.evidence) ? item.evidence : []).slice(0, 2).map((entry) => {
          const sourceText = String(entry?.sourceText || entry?.text || "").replace(/\s+/g, " ").trim();
          const requestedTime = Number(entry?.timestamp ?? entry?.start);
          const matches = normalizedCues.filter((cue) => cue.text === sourceText);
          const cue = matches.sort((left, right) => (
            Math.abs(left.start - requestedTime) - Math.abs(right.start - requestedTime)
          ))[0];
          return cue ? { timestamp: cue.start, sourceText: cue.text } : null;
        }).filter(Boolean);
        return {
          text,
          evidence: evidence.length ? evidence : (defaults[index]?.evidence || []),
        };
      }).filter(Boolean).slice(0, 5);
      for (const question of defaults) {
        if (questions.length === 5) break;
        if (!questions.some((item) => item.text === question.text)) questions.push(question);
      }
      return questions;
    };
    return {
      source: sanitizeSet(input?.source, fallback.source),
      advanced: sanitizeSet(input?.advanced, fallback.advanced),
    };
  };

  const createFallbackAnalysis = ({ cues = [], duration = 0, learnerLevel = "B1" } = {}) => {
    const normalizedCues = normalizeCues(cues, duration || Number.POSITIVE_INFINITY);
    const fallbackCue = normalizedCues[0] || { start: 0, end: 0 };
    return {
      localFallback: true,
      materialLevel: null,
      vocabularyLevel: null,
      speechLevel: null,
      syntaxLevel: null,
      learnerLevel,
      suitability: {
        assessmentStatus: "failed",
        basis: "general_english_from_transcript",
        materialQuality: "unknown",
        materialVerdict: "not_suitable",
        difficultyMatch: { materialLevel: null, learnerLevel, difficultyFit: "unknown" },
        finalRecommendation: "not_recommended",
        confidence: "low",
        reasonCodes: ["analysis_unavailable"],
        summary: "分析未完成，当前不推荐使用这份材料生成课程。",
        diagnostics: {
          transcriptComplete: false,
          usableWordCount: normalizedCues.reduce((sum, cue) => (
            sum + (cue.text.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
          ), 0),
          groundedLearningItemCount: 0,
        },
        bestSpans: [],
      },
      learningOutcomes: [],
      studyMinutes: 0,
      recommendedRange: { start: fallbackCue.start, end: fallbackCue.end },
      difficultRanges: [],
      learningItems: [],
      expressions: [],
      timelineSegments: [],
      coverage: {
        cueCount: normalizedCues.length,
        characterCount: normalizedCues.reduce((sum, cue) => sum + cue.text.length, 0),
        start: normalizedCues[0]?.start || 0,
        end: normalizedCues.at(-1)?.end || 0,
        complete: false,
      },
      discussionQuestions: { source: [], advanced: [] },
    };
  };

  const sanitizeAnalysis = (input, { cues = [], duration = 0, learnerLevel = "B1", videoTitle = "this video" } = {}) => {
    if (!input || typeof input !== "object") throw new Error("材料分析格式无效");
    const normalizedCues = normalizeCues(cues, duration || Number.POSITIVE_INFINITY);
    const maximum = Math.max(1, Number(duration) || normalizedCues.at(-1)?.end || 1);
    const normalizeRange = (range) => {
      const start = clamp(Number(range?.start) || 0, 0, maximum);
      const end = clamp(Number(range?.end) || start, start, maximum);
      return { start, end };
    };
    const sanitizeTextList = (value, { requireChinese = false } = {}) => (
      (Array.isArray(value) ? value : []).map((item) => (
        String(item || "").replace(/\s+/g, " ").trim().slice(0, 220)
      )).filter((item) => item && (!requireChinese || includesChinese(item))).slice(0, 3)
    );
    const categories = new Set(["word", "grammar", "pattern", "idiom", "slang"]);
    const sourceItems = Array.isArray(input.learningItems) ? input.learningItems : input.expressions;
    const learningItems = (Array.isArray(sourceItems) ? sourceItems : []).slice(0, 8).map((item) => {
      const expression = String(item?.expression || "").replace(/\s+/g, " ").trim().slice(0, 100);
      const requestedTime = Number(item?.timestamp);
      const matches = normalizedCues.filter((cue) => cue.text.toLowerCase().includes(expression.toLowerCase()));
      const source = matches.sort((left, right) => (
        Math.abs(left.start - requestedTime) - Math.abs(right.start - requestedTime)
      ))[0];
      if (!expression || !source) return null;
      return {
        category: categories.has(item?.category) ? item.category : "word",
        expression,
        occurrences: matches.length,
        meaningZh: includesChinese(item?.meaningZh)
          ? String(item.meaningZh).replace(/\s+/g, " ").trim().slice(0, 120)
          : "",
        why: includesChinese(item?.why)
          ? String(item.why).replace(/\s+/g, " ").trim().slice(0, 160)
          : "",
        timestamp: source.start,
        sourceText: source.text,
      };
    }).filter(Boolean).filter((item, index, items) => items.findIndex((candidate) => (
      candidate.expression.toLowerCase() === item.expression.toLowerCase()
      && candidate.timestamp === item.timestamp
    )) === index);
    let recommendedRange = normalizeRange(input.recommendedRange);
    const timelineSegments = (Array.isArray(input.timelineSegments) ? input.timelineSegments : []).slice(0, 4).map((item) => {
      const sourceText = String(item?.sourceText || "").replace(/\s+/g, " ").trim();
      const requestedTime = Number(item?.timestamp ?? item?.start);
      const matches = normalizedCues.filter((cue) => cue.text === sourceText);
      const candidates = matches.length ? matches : normalizedCues;
      const source = Number.isFinite(requestedTime)
        ? candidates.sort((left, right) => Math.abs(left.start - requestedTime) - Math.abs(right.start - requestedTime))[0]
        : matches[0];
      if (!source) return null;
      let range = normalizeRange({ start: item?.start ?? source.start, end: item?.end ?? source.end });
      if (range.end <= range.start) range = { start: source.start, end: source.end };
      else if (source.start < range.start - 0.5 || source.start > range.end + 0.5) {
        range = { start: Math.min(range.start, source.start), end: Math.max(range.end, source.end) };
      }
      const title = String(item?.title || "").replace(/\s+/g, " ").trim().slice(0, 80);
      const focus = String(item?.focus || "").replace(/\s+/g, " ").trim().slice(0, 160);
      return {
        ...range,
        timestamp: source.start,
        level: sanitizeLevel(item?.level, learnerLevel),
        title: includesChinese(title) ? title : "重点片段",
        analysis: String(item?.analysis || "").replace(/\s+/g, " ").trim().slice(0, 220),
        focus: includesChinese(focus) ? focus : "",
        sourceText: source.text,
      };
    }).filter(Boolean).filter((item, index, items) => items.findIndex((candidate) => (
      candidate.start === item.start && candidate.end === item.end
    )) === index).sort((left, right) => left.start - right.start);
    if (recommendedRange.end <= recommendedRange.start) {
      const fallbackCue = normalizedCues.find((cue) => cue.start === learningItems[0]?.timestamp) || normalizedCues[0];
      recommendedRange = timelineSegments[0]
        ? { start: timelineSegments[0].start, end: timelineSegments[0].end }
        : { start: fallbackCue.start, end: fallbackCue.end };
    }
    const coverageMatches = Number(input.coverage?.cueCount) === normalizedCues.length;
    const sourceSuitability = input.suitability && typeof input.suitability === "object"
      ? input.suitability
      : {};
    const assessmentStatus = ASSESSMENT_STATUSES.has(sourceSuitability.assessmentStatus)
      ? sourceSuitability.assessmentStatus
      : input.localFallback ? "failed" : "complete";
    let materialVerdict = MATERIAL_VERDICTS.has(sourceSuitability.materialVerdict)
      ? sourceSuitability.materialVerdict
      : learningItems.length >= 5
        ? "worth_intensive_study"
        : learningItems.length >= 2 || timelineSegments.length > 0
          ? "viewing_only"
          : "not_suitable";
    if (materialVerdict === "worth_intensive_study" && learningItems.length < 5) {
      materialVerdict = learningItems.length >= 2 || timelineSegments.length > 0
        ? "viewing_only"
        : "not_suitable";
    }
    if (assessmentStatus !== "complete") materialVerdict = "not_suitable";
    const normalizedLearnerLevel = sanitizeLevel(learnerLevel, "B1");
    const materialLevel = input.materialLevel ? sanitizeLevel(input.materialLevel, "B2") : null;
    let difficultyFit = materialVerdict === "not_suitable" || !materialLevel
      ? "unknown"
      : deriveDifficultyFit(materialLevel, normalizedLearnerLevel);
    if (assessmentStatus !== "complete" || materialVerdict === "not_suitable") difficultyFit = "unknown";
    const finalRecommendation = deriveFinalRecommendation(materialVerdict, difficultyFit);
    const finalLearningItems = finalRecommendation === "intensive_study"
      ? learningItems
      : finalRecommendation === "extensive_viewing" ? learningItems.slice(0, 4) : [];
    const finalTimelineSegments = finalRecommendation === "not_recommended"
      ? []
      : timelineSegments.slice(0, finalRecommendation === "extensive_viewing" ? 3 : 4);
    const candidateLearningOutcomes = sanitizeTextList(input.learningOutcomes, { requireChinese: true });
    const finalLearningOutcomes = finalRecommendation === "intensive_study" ? candidateLearningOutcomes : [];
    const materialReasonCodes = (Array.isArray(sourceSuitability.reasonCodes) ? sourceSuitability.reasonCodes : [])
      .map((value) => String(value || "").trim())
      .filter((value, index, values) => SUITABILITY_REASON_CODES.has(value) && values.indexOf(value) === index)
      .filter((value) => !value.startsWith("level_"))
      .slice(0, 2);
    const difficultyReasonCode = difficultyFit === "too_easy"
      ? "level_too_easy"
      : difficultyFit === "matched"
        ? "level_matched"
        : difficultyFit === "too_hard" ? "level_too_hard" : "";
    const reasonCodes = [...materialReasonCodes, difficultyReasonCode].filter(Boolean).slice(0, 3);
    const sourceSummary = String(sourceSuitability.summary || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const summary = assessmentStatus === "pending"
      ? "字幕仍在收集，当前不推荐生成课程。"
      : assessmentStatus === "failed"
        ? includesChinese(sourceSummary)
          ? sourceSummary
          : "分析未完成，当前不推荐使用这份材料生成课程。"
        : materialVerdict === "worth_intensive_study" && difficultyFit === "too_easy"
        ? "材料本身有学习价值，但对你偏简单，不必投入时间反复精学。"
        : difficultyFit === "too_hard"
          ? "材料本身有学习价值，但目前对你偏难，精学成本较高。"
          : includesChinese(sourceSummary)
            ? sourceSummary
          : finalRecommendation === "intensive_study"
            ? "材料语境连续、信息充足，难度与你匹配，推荐精学。"
            : finalRecommendation === "extensive_viewing"
              ? "材料可以作为英语输入，但不值得投入时间反复精学。"
              : "当前字幕不足以支撑可靠的英语学习。";
    const numericDiagnostic = (key) => Math.max(0, Number(sourceSuitability.diagnostics?.[key]) || 0);
    const diagnostics = {
      transcriptComplete: Boolean(sourceSuitability.diagnostics?.transcriptComplete ?? input.coverage?.complete),
      usableWordCount: numericDiagnostic("usableWordCount"),
      usableWordsPerMinute: numericDiagnostic("usableWordsPerMinute"),
      nonSpeechRatio: clamp(numericDiagnostic("nonSpeechRatio"), 0, 1),
      repetitionRatio: clamp(numericDiagnostic("repetitionRatio"), 0, 1),
      fragmentRatio: clamp(numericDiagnostic("fragmentRatio"), 0, 1),
      coherentSpanCount: numericDiagnostic("coherentSpanCount"),
      coherentSpanSeconds: numericDiagnostic("coherentSpanSeconds"),
      groundedLearningItemCount: finalLearningItems.length,
    };
    const discussionQuestions = finalRecommendation === "intensive_study"
      ? sanitizeDiscussionQuestions(input.discussionQuestions, videoTitle, normalizedCues)
      : { source: [], advanced: [] };

    return {
      localFallback: Boolean(input.localFallback),
      materialLevel,
      learnerLevel: normalizedLearnerLevel,
      vocabularyLevel: input.vocabularyLevel ? sanitizeLevel(input.vocabularyLevel, "B2") : null,
      speechLevel: input.speechLevel ? sanitizeLevel(input.speechLevel, "B1+") : null,
      syntaxLevel: input.syntaxLevel ? sanitizeLevel(input.syntaxLevel, "B2") : null,
      suitability: {
        assessmentStatus,
        basis: "general_english_from_transcript",
        materialQuality: materialVerdict === "worth_intensive_study"
          ? "strong"
          : materialVerdict === "viewing_only" ? "segmental" : "weak",
        materialVerdict,
        difficultyMatch: { materialLevel, learnerLevel: normalizedLearnerLevel, difficultyFit },
        finalRecommendation,
        confidence: ["high", "medium", "low"].includes(sourceSuitability.confidence)
          ? sourceSuitability.confidence
          : assessmentStatus === "complete" ? "medium" : "low",
        reasonCodes,
        summary,
        diagnostics,
        bestSpans: finalTimelineSegments.map(({ start, end, title, focus: reason, timestamp, sourceText }) => ({
          start, end, title, reason, timestamp, sourceText,
        })),
      },
      learningOutcomes: finalLearningOutcomes,
      studyMinutes: finalRecommendation === "intensive_study"
        ? clamp(Math.round(Number(input.studyMinutes) || 12), 3, 45)
        : 0,
      recommendedRange,
      difficultRanges: finalTimelineSegments.map(({ start, end }) => ({ start, end })),
      learningItems: finalLearningItems,
      expressions: finalLearningItems,
      timelineSegments: finalTimelineSegments,
      coverage: {
        cueCount: normalizedCues.length,
        characterCount: normalizedCues.reduce((sum, cue) => sum + cue.text.length, 0),
        start: normalizedCues[0]?.start || 0,
        end: normalizedCues.at(-1)?.end || 0,
        complete: Boolean(input.coverage?.complete && coverageMatches),
      },
      discussionQuestions,
    };
  };

  const transcriptHash = (cues) => {
    const value = (cues || []).map((cue) => `${cue.start}:${cue.text}`).join("|");
    return PST.hash ? PST.hash(value) : String(value.length);
  };

  const isCacheableAnalysis = (analysis) => Boolean(
    analysis
    && typeof analysis === "object"
    && !analysis.localFallback
    && analysis.suitability?.assessmentStatus === "complete"
  );

  PST.LearningModeCore = Object.freeze({
    clamp,
    createDiscussionQuestions,
    createFallbackAnalysis,
    cueAt,
    deriveDifficultyFit,
    deriveFinalRecommendation,
    extractYouTubeVideoId,
    formatTimestamp,
    isCacheableAnalysis,
    normalizeCues,
    sanitizeAnalysis,
    sanitizeLevel,
    transcriptHash,
  });
})();
