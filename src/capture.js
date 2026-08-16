(() => {
  const PST = globalThis.ParamountSubtitles;
  const t = (key, substitutions) => PST.t?.(key, substitutions) || key;

  class DebugLog {
    constructor(limit = 120) {
      this.limit = limit;
      this.entries = [];
    }

    add(type, detail = {}) {
      this.entries.unshift({
        at: new Date().toISOString(),
        type,
        detail,
      });
      this.entries.length = Math.min(this.entries.length, this.limit);
    }
  }

  const parseWebVtt = (body) => {
    const cues = [];
    const lines = String(body || "").replace(/\r/g, "").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line.includes("-->")) continue;
      const [rawStart, rawEnd] = line.split("-->");
      const start = PST.parseTime(rawStart.trim().split(/\s+/).at(-1));
      const end = PST.parseTime(rawEnd.trim().split(/\s+/)[0]);
      const textLines = [];
      index += 1;
      while (index < lines.length && lines[index].trim()) {
        textLines.push(lines[index]);
        index += 1;
      }
      const text = PST.normalizeSubtitle(textLines.join(" "));
      if (text && end >= start) cues.push({ start, end, text });
    }
    return cues;
  };

  const parseTtml = (body) => {
    const cues = [];
    try {
      const documentNode = new DOMParser().parseFromString(String(body || ""), "text/xml");
      for (const node of documentNode.querySelectorAll("p[begin], span[begin]")) {
        const start = PST.parseTime(node.getAttribute("begin"));
        const endValue = node.getAttribute("end");
        const duration = PST.parseTime(node.getAttribute("dur"));
        const end = endValue ? PST.parseTime(endValue) : start + duration;
        const text = PST.normalizeSubtitle(node.textContent);
        if (text && end >= start) cues.push({ start, end, text });
      }
    } catch {
      return [];
    }
    return cues;
  };

  const parseYouTubeJson3 = (body) => {
    let payload;
    try {
      const value = typeof body === "string"
        ? body.trimStart().replace(/^\)\]\}'\s*/, "")
        : body;
      payload = typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      return [];
    }
    const events = Array.isArray(payload?.events) ? payload.events : [];
    const cues = [];
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const text = PST.normalizeSubtitle(
        (event?.segs || []).map((segment) => segment?.utf8 || "").join(""),
      );
      const startMs = Number(event?.tStartMs);
      if (!text || !Number.isFinite(startMs)) continue;
      const durationMs = Number(event?.dDurationMs);
      const nextStartMs = Number(events[index + 1]?.tStartMs);
      const inferredDurationMs = Number.isFinite(nextStartMs) && nextStartMs > startMs
        ? nextStartMs - startMs
        : 2_000;
      const endMs = startMs + (Number.isFinite(durationMs) && durationMs > 0 ? durationMs : inferredDurationMs);
      cues.push({ start: startMs / 1000, end: endMs / 1000, text });
    }
    return cues;
  };

  const mergeIncrementalCaptionText = (currentText, nextText) => {
    const current = PST.normalizeSubtitle(currentText);
    const next = PST.normalizeSubtitle(nextText);
    if (!current) return next;
    if (!next) return current;
    const currentLower = current.toLowerCase();
    const nextLower = next.toLowerCase();
    if (nextLower.startsWith(currentLower)) return next;
    if (currentLower.startsWith(nextLower)) return current;

    const currentWords = current.split(/\s+/);
    const nextWords = next.split(/\s+/);
    const maxOverlap = Math.min(currentWords.length, nextWords.length);
    for (let size = maxOverlap; size > 0; size -= 1) {
      const left = currentWords.slice(-size).join(" ").toLowerCase();
      const right = nextWords.slice(0, size).join(" ").toLowerCase();
      if (left === right) return PST.normalizeSubtitle([...currentWords, ...nextWords.slice(size)].join(" "));
    }
    return PST.normalizeSubtitle(`${current} ${next}`);
  };

  const comparisonTokens = (text) => [...PST.normalizeSubtitle(text).matchAll(
    /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu,
  )].map((match) => ({
    index: match.index,
    value: match[0].toLowerCase(),
  }));

  const captionDelta = (previousText, nextText) => {
    const previous = PST.normalizeSubtitle(previousText);
    const next = PST.normalizeSubtitle(nextText);
    if (!previous) return next;
    if (!next) return "";
    const previousTokens = comparisonTokens(previous);
    const nextTokens = comparisonTokens(next);
    const previousWords = previousTokens.map((token) => token.value);
    const nextWords = nextTokens.map((token) => token.value);
    if (!previousWords.length || !nextWords.length) return next;

    const samePrefix = previousWords.every((word, index) => word === nextWords[index]);
    if (samePrefix && nextWords.length >= previousWords.length) {
      if (nextWords.length > previousWords.length) {
        return next.slice(nextTokens[previousWords.length].index).trim();
      }
      const previousEnding = previous.match(/[.!?…]+["'’”\])}]*$/)?.[0] || "";
      const nextEnding = next.match(/[.!?…]+["'’”\])}]*$/)?.[0] || "";
      return nextEnding && nextEnding !== previousEnding ? nextEnding : "";
    }
    if (nextWords.every((word, index) => word === previousWords[index])) return "";

    for (let size = Math.min(previousWords.length, nextWords.length); size > 0; size -= 1) {
      if (
        previousWords.slice(-size).join(" ")
        === nextWords.slice(0, size).join(" ")
      ) {
        if (size === nextWords.length) {
          const previousEnding = previous.match(/[.!?…]+["'’”\])}]*$/)?.[0] || "";
          const nextEnding = next.match(/[.!?…]+["'’”\])}]*$/)?.[0] || "";
          return nextEnding && nextEnding !== previousEnding ? nextEnding : "";
        }
        return next.slice(nextTokens[size].index).trim();
      }
    }
    return next;
  };

  const joinCaptionText = (currentText, nextText) => {
    const current = PST.normalizeSubtitle(currentText);
    const next = PST.normalizeSubtitle(nextText);
    if (!current) return next;
    if (!next) return current;
    if (/^[,.;:!?…%)\]}]/.test(next) || /[(\[{“‘$]$/.test(current)) return `${current}${next}`;
    return `${current} ${next}`;
  };

  const splitCompleteSentences = (text, lookahead = "") => {
    const value = PST.normalizeSubtitle(text);
    const following = PST.normalizeSubtitle(lookahead);
    const complete = [];
    const titleAbbreviations = new Set(["mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "eg", "ie"]);
    const contextualAbbreviations = new Set([
      "approx", "co", "corp", "dept", "etc", "fig", "ft", "inc", "ltd", "mt", "no",
    ]);
    const commonSentenceStarters = new Set([
      "a", "after", "and", "as", "at", "because", "before", "but", "finally", "first",
      "for", "he", "her", "here", "however", "i", "if", "in", "it", "meanwhile", "next",
      "now", "on", "or", "she", "so", "that", "the", "then", "there", "they", "this",
      "those", "to", "we", "what", "when", "where", "while", "who", "why", "you",
    ]);
    let sentenceStart = 0;
    for (let index = 0; index < value.length; index += 1) {
      if (!/[.!?…]/.test(value[index])) continue;
      const before = value.slice(sentenceStart, index).trim();
      if (value[index] === "." && /\d$/.test(before) && /^\d/.test(value.slice(index + 1))) continue;
      let end = index + 1;
      while (/[.!?…]/.test(value[end] || "")) end += 1;
      while (/["'’”\])}]/.test(value[end] || "")) end += 1;
      if (end < value.length && !/\s/.test(value[end])) continue;
      const after = `${value.slice(end)} ${following}`.trim();
      const nextWord = after.match(/^[\s\-–—"'“”‘’([{]*([\p{L}\p{N}]+)/u)?.[1] || "";
      const tail = before.match(/(?:[\p{L}]\.)+[\p{L}]?$|[\p{L}]+$/u)?.[0] || "";
      const abbreviation = tail.replace(/\./g, "").toLowerCase();
      const isInitial = /^(?:[A-Z]\.)*[A-Z]$/u.test(tail);
      const isInitialism = /^(?:[A-Z]\.)+[A-Z]?$/u.test(tail);
      const nextStartsLowercase = /^\p{Ll}/u.test(nextWord);
      const nextStartsNumber = /^\p{N}/u.test(nextWord);
      const nextIsSentenceStarter = commonSentenceStarters.has(nextWord.toLowerCase());

      if (value[index] === ".") {
        const abbreviationContinues = (titleAbbreviations.has(abbreviation) && nextWord && !nextIsSentenceStarter)
          || (contextualAbbreviations.has(abbreviation) && (nextStartsLowercase || nextStartsNumber))
          || ((isInitial || isInitialism) && nextWord && !nextIsSentenceStarter);
        if (abbreviationContinues) {
          index = end - 1;
          continue;
        }
      }
      if (value.slice(index, end).includes("…") || end - index >= 3) {
        if (nextStartsLowercase) {
          index = end - 1;
          continue;
        }
      }
      const sentence = value.slice(sentenceStart, end).trim();
      if (sentence) complete.push(sentence);
      sentenceStart = end;
      while (/\s/.test(value[sentenceStart] || "")) sentenceStart += 1;
      index = sentenceStart - 1;
    }
    return { complete, remainder: value.slice(sentenceStart).trim() };
  };

  const splitLongCaptionText = (text, {
    softMaxLength = 120,
    hardMaxLength = 170,
  } = {}) => {
    const complete = [];
    let remainder = PST.normalizeSubtitle(text);
    const softLimit = Math.max(48, Number(softMaxLength) || 120);
    const hardLimit = Math.max(softLimit, Number(hardMaxLength) || 170);
    const minimumBreak = Math.max(48, Math.floor(softLimit * 0.65));

    while (remainder.length > softLimit) {
      const maximumBreak = Math.min(remainder.length, hardLimit);
      const naturalBreaks = [];
      for (let index = minimumBreak; index < maximumBreak; index += 1) {
        const character = remainder[index];
        if (!/[,;:，；：、—–]/u.test(character)) continue;
        if (character === "," && /\d/.test(remainder[index - 1] || "") && /\d/.test(remainder[index + 1] || "")) continue;
        naturalBreaks.push(index + 1);
      }
      const naturalBreak = naturalBreaks.reduce((best, candidate) => (
        Math.abs(candidate - softLimit) < Math.abs(best - softLimit) ? candidate : best
      ), 0);

      let boundary = naturalBreak;
      if (!boundary && remainder.length > hardLimit) {
        const before = remainder.lastIndexOf(" ", softLimit);
        const after = remainder.indexOf(" ", softLimit);
        const candidates = [before, after]
          .filter((candidate) => candidate >= minimumBreak && candidate <= maximumBreak);
        boundary = candidates.reduce((best, candidate) => (
          Math.abs(candidate - softLimit) < Math.abs(best - softLimit) ? candidate : best
        ), 0) || maximumBreak;
      }
      if (!boundary) break;

      const head = remainder.slice(0, boundary).trim();
      if (!head) break;
      complete.push(head);
      remainder = remainder.slice(boundary).trim();
    }

    return { complete, remainder };
  };

  const aggregateYouTubeCues = (cues, {
    hardMaxDuration = 30,
    softMaxLength = 120,
    hardMaxLength = 170,
    incremental = false,
    pauseSeconds = 1.6,
  } = {}) => {
    const ordered = [...(cues || [])]
      .filter((cue) => cue?.text && Number.isFinite(cue.start))
      .sort((left, right) => left.start - right.start);
    let previousRawText = "";
    const prepared = ordered.map((cue) => {
      const rawText = PST.normalizeSubtitle(cue.text);
      const text = incremental ? captionDelta(previousRawText, rawText) : rawText;
      previousRawText = rawText;
      return { ...cue, text };
    });
    const lookaheads = Array(prepared.length).fill("");
    let nextText = "";
    for (let index = prepared.length - 1; index >= 0; index -= 1) {
      lookaheads[index] = nextText;
      if (prepared[index].text) nextText = prepared[index].text;
    }
    const sentences = [];
    const timedParts = (parts, start, end) => {
      const values = parts.filter(Boolean);
      const totalLength = values.reduce((sum, part) => sum + part.length, 0);
      const span = Math.max(0.2, end - start);
      let partStart = start;
      return values.map((text, index) => {
        const isLast = index === values.length - 1;
        const share = text.length / Math.max(totalLength, 1);
        const partEnd = isLast
          ? end
          : Math.min(end, partStart + Math.max(0.35, span * share));
        const part = { start: partStart, end: partEnd, text };
        partStart = partEnd;
        return part;
      });
    };
    let current = null;
    const flush = () => {
      if (!current?.text) return;
      const split = splitLongCaptionText(current.text, { softMaxLength, hardMaxLength });
      sentences.push(...timedParts(
        [...split.complete, split.remainder],
        current.start,
        current.end,
      ));
      current = null;
    };

    for (let cueIndex = 0; cueIndex < prepared.length; cueIndex += 1) {
      const cue = prepared[cueIndex];
      const delta = cue.text;
      if (!delta) {
        if (current) current.end = Math.max(current.end, cue.end);
        continue;
      }
      if (!current) {
        current = { start: cue.start, end: cue.end, text: delta, lastStart: cue.start };
      } else {
        const gap = cue.start - current.lastStart;
        const beginsNewThought = /^[A-Z]/.test(delta)
          && !/^(?:I|I'm|I've|I'll|I'd)\b/.test(delta)
          && !/[,:;—-]$/.test(current.text);
        const endsIncomplete = /\b(?:a|an|the|and|or|but|because|if|when|while|to|of|in|on|at|for|with|from|by|as|that|which|who|whose|is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|will|would|should|may|might|must|not)$/i.test(current.text);
        if (
          gap > pauseSeconds
          && beginsNewThought
          && !endsIncomplete
          && current.text.split(/\s+/).length >= 4
        ) {
          flush();
          current = { start: cue.start, end: cue.end, text: delta, lastStart: cue.start };
        } else {
          current.text = joinCaptionText(current.text, delta);
          current.end = Math.max(current.end, cue.end);
          current.lastStart = cue.start;
        }
      }

      const { complete, remainder } = splitCompleteSentences(
        current.text,
        lookaheads[cueIndex],
      );
      if (complete.length) {
        const span = Math.max(0.2, current.end - current.start);
        const completeParts = complete.flatMap((sentence) => {
          const split = splitLongCaptionText(sentence, { softMaxLength, hardMaxLength });
          return [...split.complete, split.remainder].filter(Boolean);
        });
        const totalLength = completeParts.reduce((sum, sentence) => sum + sentence.length, 0) + remainder.length;
        let sentenceStart = current.start;
        for (const sentence of completeParts) {
          const share = sentence.length / Math.max(totalLength, 1);
          const sentenceEnd = Math.min(current.end, sentenceStart + Math.max(0.35, span * share));
          sentences.push({ start: sentenceStart, end: sentenceEnd, text: sentence });
          sentenceStart = sentenceEnd;
        }
        current = remainder
          ? { start: sentenceStart, end: cue.end, text: remainder, lastStart: cue.start }
          : null;
      }

      if (current) {
        const split = splitLongCaptionText(current.text, { softMaxLength, hardMaxLength });
        if (split.complete.length) {
          const parts = timedParts(
            [...split.complete, split.remainder],
            current.start,
            current.end,
          );
          const emittedCount = split.complete.length;
          sentences.push(...parts.slice(0, emittedCount));
          current = split.remainder
            ? {
              start: parts[emittedCount]?.start ?? current.end,
              end: cue.end,
              text: split.remainder,
              lastStart: cue.start,
            }
            : null;
        }
      }

      if (
        current
        && (cue.start - current.start > hardMaxDuration || current.text.length > hardMaxLength)
      ) flush();
    }
    flush();
    return sentences;
  };

  const aggregateYouTubeAutoCues = (cues, options = {}) => aggregateYouTubeCues(cues, {
    ...options,
    incremental: true,
  });

  const parseYouTubeTimedText = (body) => {
    const cues = [];
    try {
      const documentNode = new DOMParser().parseFromString(String(body || ""), "text/xml");
      for (const node of documentNode.querySelectorAll("text[start], text[t], p[t]")) {
        const millisecondTiming = node.hasAttribute("t");
        const start = millisecondTiming
          ? Number(node.getAttribute("t")) / 1000
          : Number(node.getAttribute("start"));
        const duration = millisecondTiming
          ? Number(node.getAttribute("d")) / 1000
          : Number(node.getAttribute("dur"));
        const text = PST.normalizeSubtitle(node.textContent);
        if (text && Number.isFinite(start)) {
          cues.push({ start, end: start + (Number.isFinite(duration) && duration > 0 ? duration : 2), text });
        }
      }
    } catch {
      return [];
    }
    return cues;
  };

  const findPreviousCueTarget = ({ history, currentTime, currentText, fallbackSeconds = 5 }) => {
    const now = Number.isFinite(currentTime) ? currentTime : 0;
    const previous = [...(history || [])].reverse().find((entry) => (
      entry.text
      && entry.text !== currentText
      && Number.isFinite(entry.time)
      && entry.time < now - 0.35
    ));
    const fallback = Math.max(1, Math.min(30, Number(fallbackSeconds) || 5));
    const target = previous
      ? Math.max(0, previous.time - 0.22)
      : Math.max(0, now - fallback);
    return {
      target,
      usedCue: Boolean(previous),
      entry: previous || null,
      secondsBack: Math.max(0, now - target),
    };
  };

  class CueGapGuard {
    constructor(graceMs = 650) {
      this.graceMs = graceMs;
      this.missStartedAt = 0;
    }

    shouldHold(hasCue, now = Date.now()) {
      if (hasCue) {
        this.missStartedAt = 0;
        return false;
      }
      if (!this.missStartedAt) this.missStartedAt = now;
      return now - this.missStartedAt < this.graceMs;
    }
  }

  class NetworkTimeline {
    constructor(log) {
      this.log = log;
      this.cues = new Map();
      this.mediaKey = "";
      this.preferredSource = "";
    }

    ingest(resource) {
      const header = String(resource.body || "").slice(0, 500).toLowerCase();
      const value = `${resource.url} ${resource.contentType} ${header}`.toLowerCase();
      const nextMediaKey = String(resource.mediaKey || "");
      if (nextMediaKey && this.mediaKey && nextMediaKey !== this.mediaKey) {
        this.cues.clear();
        this.preferredSource = "";
        this.log.add("timeline-reset", { from: this.mediaKey, to: nextMediaKey });
      }
      if (nextMediaKey) this.mediaKey = nextMediaKey;
      let cues = [];
      let format = "manifest";
      if (value.includes("webvtt") || value.includes("text/vtt") || /\.vtt(?:\?|$)/i.test(resource.url)) {
        cues = parseWebVtt(resource.body);
        format = "WebVTT";
      } else if (/youtube\.com\/api\/timedtext|youtube-nocookie\.com\/api\/timedtext/i.test(resource.url) || header.includes('"events"')) {
        const isJson3 = header.startsWith("{") || header.startsWith(")]}'") || value.includes("application/json");
        cues = isJson3 ? parseYouTubeJson3(resource.body) : parseYouTubeTimedText(resource.body);
        const isAutomatic = resource.captionKind === "asr";
        cues = aggregateYouTubeCues(cues, { incremental: isAutomatic });
        format = isAutomatic ? "YouTube Auto" : "YouTube Captions";
        if (cues.length) this.preferredSource = format;
      } else if (value.includes("ttml") || value.includes("<tt") || /\.(ttml|dfxp)(?:\?|$)/i.test(resource.url)) {
        cues = parseTtml(resource.body);
        format = "TTML";
      }

      for (const cue of cues) {
        this.cues.set(`${cue.start}:${cue.end}:${PST.hash(cue.text)}`, { ...cue, source: format });
      }
      if (this.cues.size > 4000) {
        const ordered = [...this.cues.entries()].sort((left, right) => left[1].start - right[1].start);
        this.cues = new Map(ordered.slice(-3000));
      }
      this.log.add("network-resource", {
        format,
        cueCount: cues.length,
        url: String(resource.url || "").slice(0, 240),
      });
      return { format, cueCount: cues.length };
    }

    at(time) {
      let match = null;
      for (const cue of this.cues.values()) {
        if (time >= cue.start && time <= cue.end) {
          if (!match || cue.start >= match.start) match = cue;
        }
      }
      return match;
    }
  }

  class DomCaptionCapture {
    constructor(onCue, log) {
      this.onCue = onCue;
      this.log = log;
      this.lastText = "";
      this.lastNode = null;
      this.hideNative = true;
      this.scanTimer = 0;
      this.observer = null;
      this.originalOpacity = new WeakMap();
      this.timelineAvailable = false;
      this.pendingText = "";
      this.pendingTimer = 0;
    }

    start() {
      const begin = () => {
        if (this.observer || !document.documentElement) return;
        this.observer = new MutationObserver(() => this.scheduleScan());
        this.observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        this.scheduleScan();
      };
      if (document.documentElement) begin();
      else document.addEventListener("DOMContentLoaded", begin, { once: true });
    }

    stop() {
      this.observer?.disconnect();
      this.observer = null;
      clearTimeout(this.scanTimer);
      clearTimeout(this.pendingTimer);
      this.scanTimer = 0;
      this.pendingTimer = 0;
      this.pendingText = "";
      this.restoreLastNode();
      this.lastNode = null;
    }

    setHideNative(hide) {
      this.hideNative = hide;
      if (!hide && this.lastNode && this.originalOpacity.has(this.lastNode)) {
        this.lastNode.style.opacity = this.originalOpacity.get(this.lastNode);
        this.originalOpacity.delete(this.lastNode);
      } else if (hide && this.lastNode) {
        this.hideNode(this.lastNode);
      }
    }

    setTimelineAvailable(available) {
      this.timelineAvailable = Boolean(available);
      clearTimeout(this.pendingTimer);
      this.pendingTimer = 0;
      this.pendingText = "";
      this.scheduleScan();
    }

    scheduleScan() {
      if (this.scanTimer) return;
      this.scanTimer = setTimeout(() => {
        this.scanTimer = 0;
        this.scan();
      }, 90);
    }

    largestVideo() {
      if (
        PST.detectVideoSite?.().id === "youtube"
        && PST.isYouTubePlaybackPage?.() === false
      ) return undefined;
      return [...document.querySelectorAll("video")]
        .map((video) => ({ video, rect: video.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 300 && rect.height > 150)
        .sort((left, right) => (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height))[0];
    }

    scan() {
      const videoEntry = this.largestVideo();
      if (!videoEntry) return;
      const { rect: videoRect } = videoEntry;
      const youtubeCandidates = [...document.querySelectorAll(".ytp-caption-window-container")]
        .map((node) => {
          const segments = [...node.querySelectorAll(".ytp-caption-segment")];
          const text = PST.normalizeSubtitle(
            (segments.length ? segments : [node]).map((segment) => segment.textContent || "").join(" "),
          );
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          if (!text || text.length > 320 || style.display === "none" || style.visibility === "hidden") return null;
          const overlapX = Math.max(0, Math.min(rect.right, videoRect.right) - Math.max(rect.left, videoRect.left));
          const overlapY = Math.max(0, Math.min(rect.bottom, videoRect.bottom) - Math.max(rect.top, videoRect.top));
          if (overlapX < 20 || overlapY < 8) return null;
          return { node, text, score: rect.bottom + overlapX, source: "YouTube DOM" };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score);
      const selector = [
        "[class*='caption' i]",
        "[class*='subtitle' i]",
        "[data-testid*='caption' i]",
        "[data-testid*='subtitle' i]",
        "[aria-live='polite']",
      ].join(",");
      const genericCandidates = [...document.querySelectorAll(selector)].slice(-180)
        .filter((node) => !node.closest("paramount-subtitle-overlay") && !node.dataset.pstRoot)
        .map((node) => {
          const text = PST.normalizeSubtitle(node.textContent);
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          if (!text || text.length > 320 || rect.width < 20 || rect.height < 8) return null;
          if (style.display === "none" || style.visibility === "hidden") return null;
          const overlapX = Math.max(0, Math.min(rect.right, videoRect.right) - Math.max(rect.left, videoRect.left));
          const insideY = rect.top >= videoRect.top + (videoRect.height * 0.42) && rect.bottom <= videoRect.bottom + 12;
          if (!insideY || overlapX < Math.min(rect.width, videoRect.width) * 0.45) return null;
          const score = (rect.top - videoRect.top) / videoRect.height + (overlapX / videoRect.width);
          return { node, text, score, source: "DOM" };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score);

      const isYouTube = PST.detectVideoSite?.().id === "youtube";
      const candidate = youtubeCandidates[0] || (!isYouTube ? genericCandidates[0] : null);
      if (!candidate || candidate.text === this.lastText) return;
      if (candidate.node !== this.lastNode) {
        this.restoreLastNode();
        this.lastNode = candidate.node;
      }
      if (this.hideNative) this.hideNode(candidate.node);
      if (candidate.source === "YouTube DOM") {
        if (this.timelineAvailable) return;
        if (candidate.text === this.pendingText) return;
        this.pendingText = candidate.text;
        clearTimeout(this.pendingTimer);
        this.pendingTimer = setTimeout(() => {
          if (this.timelineAvailable || this.pendingText !== candidate.text) return;
          this.pendingText = "";
          this.emitCandidate(candidate, videoEntry.video.currentTime);
        }, 420);
        return;
      }
      this.emitCandidate(candidate, videoEntry.video.currentTime);
    }

    emitCandidate(candidate, videoTime) {
      if (!candidate || candidate.text === this.lastText) return;
      this.lastText = candidate.text;
      this.log.add("dom-cue", { text: candidate.text.slice(0, 160) });
      this.onCue({
        text: candidate.text,
        source: candidate.source,
        node: candidate.node,
        videoTime,
      });
    }

    hideNode(node) {
      if (!this.originalOpacity.has(node)) this.originalOpacity.set(node, node.style.opacity || "");
      node.style.setProperty("opacity", "0", "important");
    }

    restoreLastNode() {
      if (this.lastNode && this.originalOpacity.has(this.lastNode)) {
        this.lastNode.style.opacity = this.originalOpacity.get(this.lastNode);
        this.originalOpacity.delete(this.lastNode);
      }
    }
  }

  class CaptureCoordinator extends EventTarget {
    constructor() {
      super();
      this.log = new DebugLog();
      this.timeline = new NetworkTimeline(this.log);
      this.dom = new DomCaptionCapture((cue) => this.accept(cue), this.log);
      this.lastCue = { text: "", source: "", at: 0 };
      this.history = [];
      this.bridgeReady = false;
      this.enabled = true;
      this.hideNative = true;
      this.sourceLanguage = "en";
      this.pollTimer = 0;
      this.started = false;
      this.bridgeMessageListener = (event) => this.onBridgeMessage(event);
      this.hoverPausedVideo = null;
      this.networkGap = new CueGapGuard();
      this.priorities = {
        TextTrack: 3,
        "YouTube DOM": 2,
        DOM: 2,
        WebVTT: 1,
        TTML: 1,
        "YouTube Captions": 4,
        "YouTube Auto": 4,
        Preview: 5,
      };
    }

    start() {
      if (this.started) return;
      this.started = true;
      window.addEventListener("message", this.bridgeMessageListener);
      this.injectBridge();
      this.dom.start();
      this.pollTimer = setInterval(() => this.pollNetworkTimeline(), 180);
      window.postMessage({
        source: PST.CONTENT_SOURCE,
        type: "BRIDGE_PROBE",
      }, location.origin);
    }

    stop() {
      if (!this.started) return;
      this.started = false;
      this.bridgeReady = false;
      window.removeEventListener("message", this.bridgeMessageListener);
      clearInterval(this.pollTimer);
      this.pollTimer = 0;
      this.dom.stop();
      this.setSubtitleHover(false);
    }

    injectBridge() {
      if (document.documentElement?.dataset.engramSubtitleBridge === "true") return;
      if (document.querySelector("script[data-paramount-subtitle-bridge]")) return;
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("src/page-bridge.js");
      script.dataset.paramountSubtitleBridge = "true";
      script.addEventListener("load", () => script.remove(), { once: true });
      (document.documentElement || document.head).appendChild(script);
    }

    onBridgeMessage(event) {
      if (event.source !== window || event.data?.source !== PST.BRIDGE_SOURCE) return;
      const { type, detail = {} } = event.data;
      if (type === "BRIDGE_READY") {
        const becameReady = !this.bridgeReady;
        this.bridgeReady = true;
        this.log.add("bridge-ready", detail);
        if (becameReady) this.configure();
        this.dispatchEvent(new CustomEvent("status", { detail: this.status() }));
      } else if (type === "TEXT_TRACK_CUE") {
        if (PST.detectVideoSite?.().id === "youtube" && PST.isYouTubePlaybackPage?.() === false) return;
        if (this.timeline.preferredSource.startsWith("YouTube")) return;
        this.accept({
          text: detail.text,
          source: "TextTrack",
          startTime: detail.startTime,
          endTime: detail.endTime,
          videoTime: detail.currentTime,
        });
      } else if (type === "NETWORK_RESOURCE") {
        if (PST.detectVideoSite?.().id === "youtube" && PST.isYouTubePlaybackPage?.() === false) return;
        const result = this.timeline.ingest(detail);
        if (result.format.startsWith("YouTube")) {
          this.dom.setTimelineAvailable(result.cueCount > 0);
          if (result.cueCount > 0 && this.lastCue.source === "YouTube DOM") this.lastCue.at = 0;
        }
        this.dispatchEvent(new CustomEvent("network", { detail: result }));
      } else if (type === "YOUTUBE_TRACK_ERROR") {
        this.dom.setTimelineAvailable(false);
        this.log.add(type.toLowerCase(), detail);
      } else {
        this.log.add(type.toLowerCase(), detail);
      }
    }

    accept(cue) {
      const text = PST.normalizeSubtitle(cue.text);
      const now = Date.now();
      const currentPriority = this.priorities[this.lastCue.source] || 0;
      const nextPriority = this.priorities[cue.source] || 0;
      if (nextPriority < currentPriority && now - this.lastCue.at < 1600) return;
      if (text === this.lastCue.text && cue.source === this.lastCue.source) return;
      const cueTime = Number.isFinite(cue.startTime)
        ? cue.startTime
        : Number.isFinite(cue.start)
          ? cue.start
          : Number.isFinite(cue.videoTime)
            ? cue.videoTime
            : document.querySelector("video")?.currentTime;
      if (text && Number.isFinite(cueTime)) {
        const prior = this.history.at(-1);
        if (!prior || prior.text !== text) {
          this.history.push({ text, time: cueTime, source: cue.source, at: now });
          if (this.history.length > 80) this.history.splice(0, this.history.length - 80);
        }
      }
      this.lastCue = { text, source: cue.source, at: now };
      this.log.add("cue", { source: cue.source, text: text.slice(0, 180) });
      this.dispatchEvent(new CustomEvent("cue", {
        detail: { ...cue, text },
      }));
    }

    pollNetworkTimeline() {
      const video = this.dom.largestVideo()?.video;
      if (!video || !Number.isFinite(video.currentTime)) return;
      const cue = this.timeline.at(video.currentTime);
      if (cue) {
        this.networkGap.shouldHold(true);
        this.accept({ ...cue, source: cue.source || "WebVTT" });
      }
      else if ((this.priorities[this.lastCue.source] || 0) <= 1 && this.lastCue.text) {
        if (this.networkGap.shouldHold(false)) return;
        this.accept({ text: "", source: this.lastCue.source || "WebVTT" });
      } else {
        this.networkGap.shouldHold(true);
      }
    }

    configure({ enabled = this.enabled, hideNative = this.hideNative, sourceLanguage = this.sourceLanguage } = {}) {
      this.enabled = Boolean(enabled);
      this.hideNative = Boolean(hideNative);
      this.sourceLanguage = String(sourceLanguage || "en");
      this.dom.setHideNative(this.enabled && this.hideNative);
      window.postMessage({
        source: PST.CONTENT_SOURCE,
        type: "SET_SUBTITLE_CAPTURE",
        detail: {
          enabled: this.enabled,
          hide: this.enabled && this.hideNative,
          sourceLanguage: this.sourceLanguage,
        },
      }, location.origin);
    }

    setHideNative(hide) {
      this.configure({ hideNative: hide });
    }

    simulate(text = "I want to, like, run around, find idols.") {
      this.accept({ text, source: "Preview" });
    }

    setSubtitleHover(active) {
      if (active) {
        if (this.hoverPausedVideo) return { ok: true, changed: false, paused: true };
        const video = this.dom.largestVideo()?.video || document.querySelector("video");
        if (!video || video.paused || video.ended) {
          return { ok: Boolean(video), changed: false, paused: Boolean(video?.paused) };
        }
        try {
          video.pause();
          this.hoverPausedVideo = video;
          this.log.add("subtitle-hover-pause", { at: video.currentTime });
          return { ok: true, changed: true, paused: true };
        } catch (error) {
          return { ok: false, changed: false, error: error?.message || t("playerCannotPause") };
        }
      }

      const video = this.hoverPausedVideo;
      this.hoverPausedVideo = null;
      if (!video || video.ended) return { ok: Boolean(video), changed: false, paused: Boolean(video?.paused) };
      try {
        const playResult = video.play();
        playResult?.catch?.((error) => {
          this.log.add("subtitle-hover-resume-error", { message: error?.message || t("playerCannotResume") });
        });
        this.log.add("subtitle-hover-resume", { at: video.currentTime });
        return { ok: true, changed: true, paused: false };
      } catch (error) {
        return { ok: false, changed: false, error: error?.message || t("playerCannotResume") };
      }
    }

    rewindPrevious(fallbackSeconds = 5) {
      const video = this.dom.largestVideo()?.video || document.querySelector("video");
      if (!video || !Number.isFinite(video.currentTime)) {
        return { ok: false, error: t("playerNotFound") };
      }
      const fromTime = video.currentTime;
      const result = findPreviousCueTarget({
        history: this.history,
        currentTime: fromTime,
        currentText: this.lastCue.text,
        fallbackSeconds,
      });
      try {
        video.currentTime = result.target;
        this.log.add("rewind", {
          from: fromTime,
          to: result.target,
          usedCue: result.usedCue,
          text: result.entry?.text?.slice(0, 120) || "",
        });
        return { ok: true, ...result };
      } catch (error) {
        return { ok: false, error: error?.message || t("playerCannotSeek") };
      }
    }

    learningContext() {
      const video = this.dom.largestVideo()?.video || document.querySelector("video");
      const timeline = [...this.timeline.cues.values()]
        .map((cue) => ({
          start: cue.start,
          end: cue.end,
          text: cue.text,
          source: cue.source || this.timeline.preferredSource || "Timeline",
        }))
        .filter((cue) => cue.text && Number.isFinite(cue.start))
        .sort((left, right) => left.start - right.start);
      const history = this.history.map((cue, index) => ({
        start: cue.time,
        end: this.history[index + 1]?.time || cue.time + 3,
        text: cue.text,
        source: cue.source,
      }));
      return {
        completeTimeline: timeline.length > 0,
        cues: timeline.length ? timeline : history,
        currentTime: Number.isFinite(video?.currentTime) ? video.currentTime : 0,
        duration: Number.isFinite(video?.duration) ? video.duration : 0,
        paused: Boolean(video?.paused),
      };
    }

    status() {
      return {
        bridgeReady: this.bridgeReady,
        source: this.lastCue.source || t("waitingForSubtitles"),
        lastText: this.lastCue.text,
        timelineCueCount: this.timeline.cues.size,
        historyCueCount: this.history.length,
        logs: this.log.entries.slice(0, 80),
      };
    }
  }

  PST.DebugLog = DebugLog;
  PST.parseWebVtt = parseWebVtt;
  PST.parseTtml = parseTtml;
  PST.parseYouTubeJson3 = parseYouTubeJson3;
  PST.mergeIncrementalCaptionText = mergeIncrementalCaptionText;
  PST.captionDelta = captionDelta;
  PST.splitCompleteSentences = splitCompleteSentences;
  PST.splitLongCaptionText = splitLongCaptionText;
  PST.aggregateYouTubeCues = aggregateYouTubeCues;
  PST.aggregateYouTubeAutoCues = aggregateYouTubeAutoCues;
  PST.parseYouTubeTimedText = parseYouTubeTimedText;
  PST.findPreviousCueTarget = findPreviousCueTarget;
  PST.CueGapGuard = CueGapGuard;
  PST.CaptureCoordinator = CaptureCoordinator;
})();
