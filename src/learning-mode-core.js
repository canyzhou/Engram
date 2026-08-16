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

  const createFallbackAnalysis = ({ cues = [], duration = 0, learnerLevel = "B1" } = {}) => {
    const normalizedCues = normalizeCues(cues, duration || Number.POSITIVE_INFINITY);
    if (normalizedCues.length < 3) throw new Error("字幕太少，暂时无法生成本地分析");
    const stopwords = new Set(["about", "after", "again", "because", "before", "could", "every", "first", "from", "have", "into", "just", "really", "some", "that", "their", "there", "these", "they", "this", "those", "very", "what", "when", "where", "which", "while", "with", "would", "your"]);
    const candidates = [];
    for (const cue of normalizedCues) {
      const words = [...cue.text.matchAll(/[A-Za-z][A-Za-z'-]*/g)];
      if (!words.length) continue;
      let anchor = words.findIndex((match) => match[0].length >= 7 && !stopwords.has(match[0].toLowerCase()));
      if (anchor < 0) anchor = words.findIndex((match) => match[0].length >= 5 && !stopwords.has(match[0].toLowerCase()));
      if (anchor < 0) continue;
      const startIndex = Math.max(0, anchor - 1);
      const endIndex = Math.min(words.length - 1, anchor + 1);
      const start = words[startIndex].index;
      const end = words[endIndex].index + words[endIndex][0].length;
      const expression = cue.text.slice(start, end).trim();
      if (!expression || candidates.some((item) => item.expression.toLowerCase() === expression.toLowerCase())) continue;
      candidates.push({
        expression,
        meaningZh: "建议结合字幕语境理解",
        why: "这是本地分析识别出的高信息量表达",
        timestamp: cue.start,
      });
      if (candidates.length === 3) break;
    }
    for (const cue of normalizedCues) {
      if (candidates.length === 3) break;
      const expression = cue.text.slice(0, 96).trim();
      if (!expression || candidates.some((item) => item.expression.toLowerCase() === expression.toLowerCase())) continue;
      candidates.push({ expression, meaningZh: "建议结合字幕语境理解", why: "可作为跟读和复述练习句", timestamp: cue.start });
    }
    if (candidates.length !== 3) throw new Error("字幕太少，暂时无法生成本地分析");

    const wordCounts = normalizedCues.map((cue) => (cue.text.match(/[A-Za-z][A-Za-z'-]*/g) || []).length);
    const averageWords = wordCounts.reduce((sum, count) => sum + count, 0) / Math.max(1, wordCounts.length);
    const materialLevel = averageWords >= 13 ? "B2" : averageWords >= 8 ? "B1+" : "B1";
    const startCue = normalizedCues[Math.floor(normalizedCues.length * 0.25)] || normalizedCues[0];
    const endCue = normalizedCues[Math.min(normalizedCues.length - 1, Math.floor(normalizedCues.length * 0.6))] || normalizedCues.at(-1);
    return {
      localFallback: true,
      materialLevel,
      vocabularyLevel: materialLevel,
      speechLevel: "B1+",
      syntaxLevel: materialLevel,
      fitVerdict: "AI 未连接，先按本地难度精学",
      studyMinutes: 10,
      recommendedRange: { start: startCue.start, end: endCue.end },
      difficultRanges: [{ start: startCue.start, end: endCue.end }],
      expressions: candidates,
      learnerLevel,
    };
  };

  const sanitizeAnalysis = (input, { cues = [], duration = 0, learnerLevel = "B1" } = {}) => {
    if (!input || typeof input !== "object") throw new Error("材料分析格式无效");
    const normalizedCues = normalizeCues(cues, duration || Number.POSITIVE_INFINITY);
    const expressions = (Array.isArray(input.expressions) ? input.expressions : []).slice(0, 3).map((item) => {
      const expression = String(item?.expression || "").replace(/\s+/g, " ").trim().slice(0, 100);
      const requestedTime = Number(item?.timestamp);
      const matches = normalizedCues.filter((cue) => cue.text.toLowerCase().includes(expression.toLowerCase()));
      const source = matches.sort((left, right) => (
        Math.abs(left.start - requestedTime) - Math.abs(right.start - requestedTime)
      ))[0];
      if (!expression || !source) return null;
      return {
        expression,
        occurrences: matches.length,
        meaningZh: String(item?.meaningZh || "").replace(/\s+/g, " ").trim().slice(0, 120),
        why: String(item?.why || "").replace(/\s+/g, " ").trim().slice(0, 160),
        timestamp: source.start,
        sourceText: source.text,
      };
    }).filter(Boolean);
    if (expressions.length !== 3) throw new Error("材料分析必须包含三个可定位表达");

    const maximum = Math.max(1, Number(duration) || normalizedCues.at(-1)?.end || 1);
    const normalizeRange = (range) => {
      const start = clamp(Number(range?.start) || 0, 0, maximum);
      const end = clamp(Number(range?.end) || start, start, maximum);
      return { start, end };
    };
    const recommendedRange = normalizeRange(input.recommendedRange);
    const difficultRanges = (Array.isArray(input.difficultRanges) ? input.difficultRanges : [])
      .slice(0, 4).map(normalizeRange).filter((range) => range.end > range.start);

    return {
      localFallback: Boolean(input.localFallback),
      materialLevel: sanitizeLevel(input.materialLevel, "B2"),
      learnerLevel: sanitizeLevel(learnerLevel, "B1"),
      vocabularyLevel: sanitizeLevel(input.vocabularyLevel, "B2"),
      speechLevel: sanitizeLevel(input.speechLevel, "B1+"),
      syntaxLevel: sanitizeLevel(input.syntaxLevel, "B2"),
      fitVerdict: String(input.fitVerdict || "有挑战，但适合精学").replace(/\s+/g, " ").trim().slice(0, 40),
      studyMinutes: clamp(Math.round(Number(input.studyMinutes) || 12), 3, 45),
      recommendedRange,
      difficultRanges,
      expressions,
    };
  };

  const transcriptHash = (cues) => {
    const value = (cues || []).map((cue) => `${cue.start}:${cue.text}`).join("|");
    return PST.hash ? PST.hash(value) : String(value.length);
  };

  PST.LearningModeCore = Object.freeze({
    clamp,
    createFallbackAnalysis,
    cueAt,
    extractYouTubeVideoId,
    formatTimestamp,
    normalizeCues,
    sanitizeAnalysis,
    sanitizeLevel,
    transcriptHash,
  });
})();
