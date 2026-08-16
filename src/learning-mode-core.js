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

  const createFallbackAnalysis = ({ cues = [], duration = 0, learnerLevel = "B1", videoTitle = "this video" } = {}) => {
    const normalizedCues = normalizeCues(cues, duration || Number.POSITIVE_INFINITY);
    if (normalizedCues.length < 3) throw new Error("字幕太少，暂时无法生成本地分析");
    const stopwords = new Set(["about", "after", "again", "because", "before", "could", "every", "first", "from", "have", "into", "just", "really", "some", "that", "their", "there", "these", "they", "this", "those", "very", "what", "when", "where", "which", "while", "with", "would", "your"]);
    const candidates = [];
    const addCandidate = ({ expression, cue, category = "word", meaningZh = "", why = "" }) => {
      const value = String(expression || "").trim();
      if (!value || candidates.some((item) => item.expression.toLowerCase() === value.toLowerCase())) return;
      candidates.push({ category, expression: value, meaningZh, why, timestamp: cue.start, sourceText: cue.text });
    };
    for (const cue of normalizedCues) {
      const words = [...cue.text.matchAll(/[A-Za-z][A-Za-z'-]*/g)];
      if (!words.length) continue;
      for (const match of words) {
        if (match[0].length < 5 || stopwords.has(match[0].toLowerCase())) continue;
        addCandidate({ expression: match[0], cue });
        if (candidates.length === 8) break;
      }
      if (candidates.length === 8) break;
    }
    for (const cue of normalizedCues) {
      if (candidates.length >= 5) break;
      const words = [...cue.text.matchAll(/[A-Za-z][A-Za-z'-]*/g)].slice(0, 5);
      for (let size = Math.min(4, words.length); size >= 2 && candidates.length < 5; size -= 1) {
        const start = words[0]?.index || 0;
        const end = words[size - 1]?.index + words[size - 1]?.[0].length;
        addCandidate({
          expression: cue.text.slice(start, end),
          cue,
          category: "pattern",
        });
      }
    }
    if (candidates.length < 5) throw new Error("字幕太少，暂时无法生成本地分析");

    const wordCounts = normalizedCues.map((cue) => (cue.text.match(/[A-Za-z][A-Za-z'-]*/g) || []).length);
    const averageWords = wordCounts.reduce((sum, count) => sum + count, 0) / Math.max(1, wordCounts.length);
    const materialLevel = averageWords >= 13 ? "B2" : averageWords >= 8 ? "B1+" : "B1";
    const startCue = normalizedCues[Math.floor(normalizedCues.length * 0.25)] || normalizedCues[0];
    const endCue = normalizedCues[Math.min(normalizedCues.length - 1, Math.floor(normalizedCues.length * 0.6))] || normalizedCues.at(-1);
    const laterCue = normalizedCues[Math.min(normalizedCues.length - 1, Math.floor(normalizedCues.length * 0.8))] || normalizedCues.at(-1);
    return {
      localFallback: true,
      materialLevel,
      vocabularyLevel: materialLevel,
      speechLevel: "B1+",
      syntaxLevel: materialLevel,
      fitVerdict: "AI 未连接，先按本地难度精学",
      fitReasons: [
        `字幕平均每句约 ${Math.max(1, Math.round(averageWords))} 个词，难度与 ${learnerLevel} 学习者接近`,
        "时间轴和学习项均来自当前已采集字幕，可直接定位练习",
      ],
      learningOutcomes: [
        "掌握视频中的高信息量词汇和可复用句型",
        "通过推荐片段进行听辨、跟读和复述",
      ],
      studyMinutes: 10,
      recommendedRange: { start: startCue.start, end: endCue.end },
      difficultRanges: [{ start: startCue.start, end: endCue.end }],
      learningItems: candidates,
      expressions: candidates,
      timelineSegments: [
        {
          start: startCue.start,
          end: Math.max(startCue.end, endCue.end),
          timestamp: startCue.start,
          level: materialLevel,
          title: "核心精学片段",
          analysis: "句子信息量较集中，适合逐句听辨和复述。",
          focus: "先听关键词，再模仿语音并复述大意。",
          sourceText: startCue.text,
        },
        {
          start: laterCue.start,
          end: laterCue.end,
          timestamp: laterCue.start,
          level: materialLevel,
          title: "后段巩固片段",
          analysis: "用于检查前面学到的词汇和句型能否迁移到后文。",
          focus: "关闭中文字幕复听，再用英文概括。",
          sourceText: laterCue.text,
        },
      ],
      coverage: {
        cueCount: normalizedCues.length,
        characterCount: normalizedCues.reduce((sum, cue) => sum + cue.text.length, 0),
        start: normalizedCues[0].start,
        end: normalizedCues.at(-1).end,
        complete: false,
      },
      discussionQuestions: createDiscussionQuestions(videoTitle, normalizedCues),
      learnerLevel,
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
    const sanitizeTextList = (value, minimum = 2, { requireChinese = false } = {}) => {
      const items = (Array.isArray(value) ? value : []).map((item) => (
        String(item || "").replace(/\s+/g, " ").trim().slice(0, 220)
      )).filter((item) => item && (!requireChinese || includesChinese(item))).slice(0, 3);
      if (items.length < minimum) throw new Error("材料分析缺少具体的适合原因或学习收获");
      return items;
    };
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
    if (learningItems.length < 5) throw new Error("材料分析必须包含 5–8 个可定位学习项");

    let recommendedRange = normalizeRange(input.recommendedRange);
    const timelineSegments = (Array.isArray(input.timelineSegments) ? input.timelineSegments : []).slice(0, 4).map((item) => {
      const sourceText = String(item?.sourceText || "").replace(/\s+/g, " ").trim();
      const requestedTime = Number(item?.timestamp ?? item?.start);
      const matches = normalizedCues.filter((cue) => cue.text === sourceText);
      const source = matches.sort((left, right) => Math.abs(left.start - requestedTime) - Math.abs(right.start - requestedTime))[0];
      if (!source) return null;
      const range = normalizeRange({ start: item?.start ?? source.start, end: item?.end ?? source.end });
      if (range.end <= range.start || source.start < range.start - 0.5 || source.start > range.end + 0.5) return null;
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
    if (timelineSegments.length < 2) throw new Error("材料分析必须包含至少两个有字幕依据的难度片段");
    if (recommendedRange.end <= recommendedRange.start) {
      recommendedRange = { start: timelineSegments[0].start, end: timelineSegments[0].end };
    }
    const coverageMatches = Number(input.coverage?.cueCount) === normalizedCues.length;

    return {
      localFallback: Boolean(input.localFallback),
      materialLevel: sanitizeLevel(input.materialLevel, "B2"),
      learnerLevel: sanitizeLevel(learnerLevel, "B1"),
      vocabularyLevel: sanitizeLevel(input.vocabularyLevel, "B2"),
      speechLevel: sanitizeLevel(input.speechLevel, "B1+"),
      syntaxLevel: sanitizeLevel(input.syntaxLevel, "B2"),
      fitVerdict: String(input.fitVerdict || "有挑战，但适合精学").replace(/\s+/g, " ").trim().slice(0, 40),
      fitReasons: sanitizeTextList(input.fitReasons),
      learningOutcomes: sanitizeTextList(input.learningOutcomes, 2, { requireChinese: true }),
      studyMinutes: clamp(Math.round(Number(input.studyMinutes) || 12), 3, 45),
      recommendedRange,
      difficultRanges: timelineSegments.map(({ start, end }) => ({ start, end })),
      learningItems,
      expressions: learningItems,
      timelineSegments,
      coverage: {
        cueCount: normalizedCues.length,
        characterCount: normalizedCues.reduce((sum, cue) => sum + cue.text.length, 0),
        start: normalizedCues[0]?.start || 0,
        end: normalizedCues.at(-1)?.end || 0,
        complete: Boolean(input.coverage?.complete && coverageMatches),
      },
      discussionQuestions: sanitizeDiscussionQuestions(input.discussionQuestions, videoTitle, normalizedCues),
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
  );

  PST.LearningModeCore = Object.freeze({
    clamp,
    createDiscussionQuestions,
    createFallbackAnalysis,
    cueAt,
    extractYouTubeVideoId,
    formatTimestamp,
    isCacheableAnalysis,
    normalizeCues,
    sanitizeAnalysis,
    sanitizeLevel,
    transcriptHash,
  });
})();
