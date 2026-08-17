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
      const segments = Array.isArray(event?.segs) ? event.segs : [];
      const rawText = segments.map((segment) => segment?.utf8 || "").join("");
      const speakerBreak = /(?:>{2,}|＞{2,})/.test(rawText);
      const text = PST.normalizeSubtitle(rawText);
      const startMs = Number(event?.tStartMs);
      if (!text || !Number.isFinite(startMs)) continue;
      const durationMs = Number(event?.dDurationMs);
      const nextStartMs = Number(events[index + 1]?.tStartMs);
      const inferredDurationMs = Number.isFinite(nextStartMs) && nextStartMs > startMs
        ? nextStartMs - startMs
        : 2_000;
      const explicitEndMs = startMs + (Number.isFinite(durationMs) && durationMs > 0 ? durationMs : inferredDurationMs);
      const endMs = Number.isFinite(nextStartMs) && nextStartMs > startMs
        ? Math.min(explicitEndMs, nextStartMs)
        : explicitEndMs;
      const hasWordOffsets = segments.some((segment) => Number.isFinite(Number(segment?.tOffsetMs)));
      const atoms = hasWordOffsets
        ? segments.flatMap((segment, segmentIndex) => {
          const segmentText = PST.normalizeSubtitle(segment?.utf8 || "");
          if (!segmentText) return [];
          const offsetMs = Number(segment?.tOffsetMs);
          const segmentStartMs = Number.isFinite(offsetMs) ? startMs + Math.max(0, offsetMs) : startMs;
          const followingOffsetMs = segments
            .slice(segmentIndex + 1)
            .map((nextSegment) => Number(nextSegment?.tOffsetMs))
            .find((nextOffset) => Number.isFinite(nextOffset));
          const segmentEndMs = Number.isFinite(followingOffsetMs)
            ? Math.min(endMs, startMs + Math.max(0, followingOffsetMs))
            : endMs;
          const boundedStartMs = Math.min(segmentStartMs, Math.max(startMs, endMs - 20));
          const boundedEndMs = Math.max(boundedStartMs + 20, Math.min(endMs, segmentEndMs));
          return splitAutomaticAtom({
            start: boundedStartMs / 1000,
            end: boundedEndMs / 1000,
            text: segmentText,
            speakerBreak: segmentIndex === 0 && speakerBreak,
          });
        })
        : [];
      cues.push({ start: startMs / 1000, end: endMs / 1000, text, speakerBreak, atoms });
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

  const AUTO_TURN_STARTERS = new Set([
    "actually", "alright", "and", "anyway", "are", "but", "can", "could", "did", "do",
    "does", "finally", "first", "how", "i", "if", "meanwhile", "next", "no", "now", "okay",
    "right", "she", "so", "then", "they", "we", "well", "what", "when", "where", "who",
    "why", "would", "yeah", "yes", "you",
  ]);
  const INCOMPLETE_CAPTION_ENDING = /\b(?:a|an|the|and|or|but|because|if|when|while|to|of|in|on|at|for|with|from|by|as|that|which|who|whose|my|your|his|her|its|our|their|he|she|it|we|you|they|is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|will|would|should|may|might|must|not|i|i'm|i've|i'll|i'd)$/i;
  const CONTINUATION_CAPTION_STARTERS = new Set([
    "a", "an", "as", "at", "by", "enough", "for", "from", "in", "of", "on", "than", "the", "to", "with",
  ]);
  const CLAUSE_CAPTION_STARTERS = new Set([
    "although", "and", "based", "because", "but", "however", "if", "including", "instead", "making",
    "join", "meanwhile", "or", "seeking", "so", "then", "though", "twice", "when", "where",
    "which", "while", "who", "yet",
  ]);
  const SUBJECT_CAPTION_STARTERS = new Set([
    "he", "i", "it", "she", "that", "these", "they", "this", "those", "we", "you",
  ]);
  const INCOMPLETE_QUANTITY_ENDINGS = new Set([
    "eight", "eleven", "fewer", "five", "four", "less", "more", "nine", "one", "seven", "six",
    "ten", "than", "three", "twelve", "two",
  ]);
  const COMMON_MODIFIER_ENDINGS = new Set([
    "breathtaking", "different", "entire", "few", "first", "great", "inspiring", "last", "largest",
    "little", "modern", "most", "new", "next", "nice", "perfect", "personal", "remote", "same", "several",
    "road", "small", "special", "untouched", "vast", "wild",
  ]);
  const INCOMPLETE_VERB_ENDINGS = new Set([
    "build", "call", "explore", "find", "get", "give", "know", "learn", "like", "love", "make",
    "need", "return", "see", "show", "take", "tell", "use", "visit", "want", "watch",
  ]);

  const splitAutomaticAtom = (atom) => {
    const matches = [...atom.text.matchAll(/\S+/g)];
    if (matches.length < 2) return [atom];
    const span = Math.max(0.2, atom.end - atom.start);
    const textLength = Math.max(1, atom.text.length);
    return matches.map((match, index) => {
      const nextIndex = matches[index + 1]?.index ?? textLength;
      return {
        start: atom.start + (span * (match.index / textLength)),
        end: index === matches.length - 1
          ? atom.end
          : atom.start + (span * (nextIndex / textLength)),
        text: match[0],
        speakerBreak: index === 0 && atom.speakerBreak,
      };
    });
  };

  const prepareAutomaticCueAtoms = (cues) => {
    const ordered = [...(cues || [])]
      .filter((cue) => cue?.text && Number.isFinite(cue.start))
      .sort((left, right) => left.start - right.start);
    const atoms = [];
    let previousRawText = "";
    let pendingSpeakerBreak = false;
    for (const cue of ordered) {
      const rawText = PST.normalizeSubtitle(cue.text);
      pendingSpeakerBreak = pendingSpeakerBreak || Boolean(cue.speakerBreak);
      const text = captionDelta(previousRawText, rawText);
      previousRawText = rawText;
      if (!text) continue;
      const deltaWords = comparisonTokens(text).map((token) => token.value);
      const sourceAtoms = Array.isArray(cue.atoms) ? cue.atoms : [];
      const sourceWords = sourceAtoms.map((atom) => comparisonTokens(atom.text)[0]?.value || "");
      const offsetAtoms = deltaWords.length && sourceWords.length >= deltaWords.length
        && sourceWords.slice(-deltaWords.length).every((word, index) => word === deltaWords[index])
        ? sourceAtoms.slice(-deltaWords.length).map((atom, index) => ({
          ...atom,
          speakerBreak: index === 0 && pendingSpeakerBreak,
        }))
        : [];
      atoms.push(...(offsetAtoms.length ? offsetAtoms : splitAutomaticAtom({
        start: cue.start,
        end: Number.isFinite(cue.end) && cue.end > cue.start ? cue.end : cue.start + 2,
        text,
        speakerBreak: pendingSpeakerBreak,
      })));
      pendingSpeakerBreak = false;
    }
    return atoms;
  };

  const captionWordCount = (text) => comparisonTokens(text).length;
  const captionStartsTurn = (text) => {
    const first = comparisonTokens(text)[0]?.value || "";
    return AUTO_TURN_STARTERS.has(first);
  };
  const captionEndsSentence = (text) => /[.!?…]+["'’”\])}]*$/.test(PST.normalizeSubtitle(text));
  const captionEndsClause = (text) => /[,;:，；：、—–]["'’”\])}]*$/.test(PST.normalizeSubtitle(text));
  const captionPause = (current, next) => (
    next ? Math.max(0, Number(next.start) - Number(current.end)) : Number.POSITIVE_INFINITY
  );

  const captionBoundaryStrength = (text, next) => {
    if (!next?.text) return 0;
    const currentTokens = comparisonTokens(text);
    const nextTokens = comparisonTokens(next.text);
    const lastWord = currentTokens.at(-1)?.value || "";
    const nextWord = nextTokens[0]?.value || "";
    if (!nextWord) return 0;
    if (CONTINUATION_CAPTION_STARTERS.has(nextWord)) return -34;
    if (
      INCOMPLETE_QUANTITY_ENDINGS.has(lastWord)
      || COMMON_MODIFIER_ENDINGS.has(lastWord)
      || INCOMPLETE_VERB_ENDINGS.has(lastWord)
      || /\d/u.test(lastWord)
      || /(?:able|ible|al|ary|ent|est|ful|ic|ing|ive|less|ory|ous)$/u.test(lastWord)
    ) return -30;

    let strength = 0;
    if (CLAUSE_CAPTION_STARTERS.has(nextWord)) strength += 18;
    else if (SUBJECT_CAPTION_STARTERS.has(nextWord)) strength += 14;
    const visibleNextWord = PST.normalizeSubtitle(next.text).match(/^[\s\-–—"'“”‘’([{]*([\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*)/u)?.[1] || "";
    if (/^\p{Lu}/u.test(visibleNextWord) && nextWord !== "i") strength += 4;
    return strength;
  };

  const displayBoundaryEvidence = (current, next, text) => {
    const pause = captionPause(current, next);
    return {
      pause,
      speaker: Boolean(next?.speakerBreak),
      sentence: captionEndsSentence(text),
      clause: captionEndsClause(text),
      turn: Boolean(next && captionStartsTurn(next.text)),
      semantic: captionBoundaryStrength(text, next),
    };
  };

  const displaySegmentCost = ({ text, start, end, current, next }) => {
    const length = text.length;
    const words = captionWordCount(text);
    const duration = Math.max(0.2, end - start);
    const evidence = displayBoundaryEvidence(current, next, text);
    let cost = 14;

    if (words < 3 && next && !evidence.speaker) cost += (3 - words) * 18;
    if (duration < 1 && next && !evidence.speaker) cost += (1 - duration) * 18;
    if (length < 30 && next && !evidence.speaker && !evidence.sentence) cost += (30 - length) * 0.7;
    if (length < 24 && !next) cost += (24 - length) * 1.5;
    if (length > 72) cost += (length - 72) * 0.35;
    if (length > 84) cost += (length - 84) * 1.4;
    if (duration > 6) cost += (duration - 6) * 5;
    if (duration > 7) cost += (duration - 7) * 9;
    if (INCOMPLETE_CAPTION_ENDING.test(text) && next) cost += 22;

    if (evidence.speaker) cost -= 36;
    if (evidence.sentence) cost -= 28;
    else if (evidence.pause >= 1.4) cost -= 24;
    else if (evidence.pause >= 0.8) cost -= 18;
    else if (evidence.pause >= 0.35 && evidence.turn) cost -= 11;
    if (evidence.clause && length >= 36) cost -= 7;
    if (evidence.semantic > 0 && length >= 24) cost -= evidence.semantic;
    if (evidence.semantic < 0) cost += Math.abs(evidence.semantic);
    if (next && length < 36 && duration < 2.5 && !evidence.speaker && !evidence.sentence && evidence.pause < 0.8) {
      cost += 12;
    }
    return cost;
  };

  const displayBoundaryKind = (current, next, text) => {
    if (!next) return "end";
    if (next.speakerBreak) return "speaker";
    if (captionEndsSentence(text)) return "sentence";
    if (captionPause(current, next) >= 0.8) return "pause";
    return "forced";
  };

  const segmentAutomaticDisplayCues = (atoms, {
    hardMaxDuration = 10,
    hardMaxLength = 120,
    maxAtomsPerCue = 80,
  } = {}) => {
    const ordered = [...(atoms || [])]
      .filter((atom) => atom?.text && Number.isFinite(atom.start))
      .sort((left, right) => left.start - right.start);
    if (!ordered.length) return [];

    const best = Array(ordered.length + 1).fill(Number.POSITIVE_INFINITY);
    const previous = Array(ordered.length + 1).fill(null);
    best[0] = 0;

    for (let startIndex = 0; startIndex < ordered.length; startIndex += 1) {
      if (!Number.isFinite(best[startIndex])) continue;
      let text = "";
      let end = ordered[startIndex].end;
      const maximumIndex = Math.min(ordered.length, startIndex + maxAtomsPerCue);
      for (let endIndex = startIndex; endIndex < maximumIndex; endIndex += 1) {
        const atom = ordered[endIndex];
        text = joinCaptionText(text, atom.text);
        end = Math.max(end, atom.end);
        const duration = end - ordered[startIndex].start;
        const indivisible = endIndex === startIndex;
        if (!indivisible && (duration > hardMaxDuration || text.length > hardMaxLength)) break;
        const next = ordered[endIndex + 1] || null;
        const cost = best[startIndex] + displaySegmentCost({
          text,
          start: ordered[startIndex].start,
          end,
          current: atom,
          next,
        });
        if (cost < best[endIndex + 1]) {
          best[endIndex + 1] = cost;
          previous[endIndex + 1] = {
            startIndex,
            endIndex,
            start: ordered[startIndex].start,
            end,
            text,
            boundary: displayBoundaryKind(atom, next, text),
          };
        }
      }
    }

    if (!previous[ordered.length]) {
      return ordered.map((atom, index) => ({
        start: atom.start,
        end: atom.end,
        text: atom.text,
        boundary: displayBoundaryKind(atom, ordered[index + 1] || null, atom.text),
      }));
    }

    const cues = [];
    let cursor = ordered.length;
    while (cursor > 0) {
      const segment = previous[cursor];
      if (!segment) break;
      cues.unshift({ start: segment.start, end: segment.end, text: segment.text, boundary: segment.boundary });
      cursor = segment.startIndex;
    }
    return cues;
  };

  const groupSemanticCues = (displayCues, {
    semanticHardMaxDuration = 22,
    semanticHardMaxLength = 180,
  } = {}) => {
    const cues = [];
    let current = null;
    const flush = () => {
      if (!current?.text) return;
      cues.push({
        start: current.start,
        end: current.end,
        text: current.text,
        parts: current.parts,
      });
      current = null;
    };

    for (const cue of displayCues || []) {
      if (!current) {
        current = { start: cue.start, end: cue.end, text: cue.text, parts: [cue.text] };
      } else {
        const nextText = joinCaptionText(current.text, cue.text);
        const nextEnd = Math.max(current.end, cue.end);
        if (
          nextEnd - current.start > semanticHardMaxDuration
          || nextText.length > semanticHardMaxLength
        ) {
          flush();
          current = { start: cue.start, end: cue.end, text: cue.text, parts: [cue.text] };
        } else {
          current.text = nextText;
          current.end = nextEnd;
          current.parts.push(cue.text);
        }
      }
      if (["speaker", "sentence", "pause", "end"].includes(cue.boundary)) flush();
    }
    flush();
    return cues;
  };

  const segmentYouTubeAutoCues = (cues, options = {}) => {
    const atoms = prepareAutomaticCueAtoms(cues);
    const displayCues = segmentAutomaticDisplayCues(atoms, options);
    const semanticCues = groupSemanticCues(displayCues, options);
    return { displayCues, semanticCues };
  };

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
      this.semanticCues = new Map();
      this.mediaKey = "";
      this.preferredSource = "";
    }

    ingest(resource) {
      const header = String(resource.body || "").slice(0, 500).toLowerCase();
      const value = `${resource.url} ${resource.contentType} ${header}`.toLowerCase();
      const nextMediaKey = String(resource.mediaKey || "");
      if (nextMediaKey && this.mediaKey && nextMediaKey !== this.mediaKey) {
        this.cues.clear();
        this.semanticCues.clear();
        this.preferredSource = "";
        this.log.add("timeline-reset", { from: this.mediaKey, to: nextMediaKey });
      }
      if (nextMediaKey) this.mediaKey = nextMediaKey;
      let cues = [];
      let semanticCues = [];
      let format = "manifest";
      if (value.includes("webvtt") || value.includes("text/vtt") || /\.vtt(?:\?|$)/i.test(resource.url)) {
        cues = parseWebVtt(resource.body);
        semanticCues = cues;
        format = "WebVTT";
      } else if (/youtube\.com\/api\/timedtext|youtube-nocookie\.com\/api\/timedtext/i.test(resource.url) || header.includes('"events"')) {
        const isJson3 = header.startsWith("{") || header.startsWith(")]}'") || value.includes("application/json");
        const sourceCues = isJson3 ? parseYouTubeJson3(resource.body) : parseYouTubeTimedText(resource.body);
        const isAutomatic = resource.captionKind === "asr";
        if (isAutomatic) {
          const segmented = segmentYouTubeAutoCues(sourceCues);
          cues = segmented.displayCues;
          semanticCues = segmented.semanticCues;
        } else {
          cues = sourceCues;
          semanticCues = aggregateYouTubeCues(sourceCues).map((cue) => ({
            ...cue,
            parts: sourceCues
              .filter((part) => part.start < cue.end && part.end > cue.start)
              .map((part) => part.text),
          }));
        }
        format = isAutomatic ? "YouTube Auto" : "YouTube Captions";
      } else if (value.includes("ttml") || value.includes("<tt") || /\.(ttml|dfxp)(?:\?|$)/i.test(resource.url)) {
        cues = parseTtml(resource.body);
        semanticCues = cues;
        format = "TTML";
      }

      const youtubeRank = (source) => source === "YouTube Captions" ? 2 : source === "YouTube Auto" ? 1 : 0;
      const incomingYouTubeRank = youtubeRank(format);
      const currentYouTubeRank = youtubeRank(this.preferredSource);
      if (incomingYouTubeRank && !cues.length && currentYouTubeRank) {
        return {
          format: this.preferredSource,
          cueCount: this.cues.size,
          semanticCueCount: this.semanticCues.size,
          ignored: true,
        };
      }
      if (incomingYouTubeRank && currentYouTubeRank > incomingYouTubeRank) {
        this.log.add("network-resource-ignored", {
          format,
          reason: "lower-priority-youtube-track",
          url: String(resource.url || "").slice(0, 240),
        });
        return {
          format: this.preferredSource,
          cueCount: this.cues.size,
          semanticCueCount: this.semanticCues.size,
          ignored: true,
        };
      }
      if (incomingYouTubeRank && cues.length) {
        this.cues.clear();
        this.semanticCues.clear();
        this.preferredSource = format;
      }

      for (const cue of cues) {
        this.cues.set(`${cue.start}:${cue.end}:${PST.hash(cue.text)}`, { ...cue, source: format });
      }
      for (const cue of semanticCues) {
        this.semanticCues.set(`${cue.start}:${cue.end}:${PST.hash(cue.text)}`, { ...cue, source: format });
      }
      if (this.cues.size > 4000) {
        const ordered = [...this.cues.entries()].sort((left, right) => left[1].start - right[1].start);
        this.cues = new Map(ordered.slice(-3000));
      }
      if (this.semanticCues.size > 4000) {
        const ordered = [...this.semanticCues.entries()].sort((left, right) => left[1].start - right[1].start);
        this.semanticCues = new Map(ordered.slice(-3000));
      }
      this.log.add("network-resource", {
        format,
        cueCount: cues.length,
        semanticCueCount: semanticCues.length,
        url: String(resource.url || "").slice(0, 240),
      });
      return { format, cueCount: cues.length, semanticCueCount: semanticCues.length };
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
      const displayTimeline = [...this.timeline.cues.values()]
        .map((cue) => ({
          start: cue.start,
          end: cue.end,
          text: cue.text,
          source: cue.source || this.timeline.preferredSource || "Timeline",
        }))
        .filter((cue) => cue.text && Number.isFinite(cue.start))
        .sort((left, right) => left.start - right.start);
      const semanticTimeline = [...this.timeline.semanticCues.values()]
        .map((cue) => ({
          start: cue.start,
          end: cue.end,
          text: cue.text,
          parts: Array.isArray(cue.parts) ? cue.parts : [cue.text],
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
      const cues = semanticTimeline.length ? semanticTimeline : displayTimeline.length ? displayTimeline : history;
      const displayCues = displayTimeline.length ? displayTimeline : history;
      return {
        completeTimeline: displayTimeline.length > 0,
        cues,
        displayCues,
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
  PST.segmentYouTubeAutoCues = segmentYouTubeAutoCues;
  PST.parseYouTubeTimedText = parseYouTubeTimedText;
  PST.findPreviousCueTarget = findPreviousCueTarget;
  PST.CueGapGuard = CueGapGuard;
  PST.CaptureCoordinator = CaptureCoordinator;
})();
