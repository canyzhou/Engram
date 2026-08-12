(() => {
  const PST = globalThis.ParamountSubtitles;

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

  class NetworkTimeline {
    constructor(log) {
      this.log = log;
      this.cues = new Map();
    }

    ingest(resource) {
      const header = String(resource.body || "").slice(0, 500).toLowerCase();
      const value = `${resource.url} ${resource.contentType} ${header}`.toLowerCase();
      let cues = [];
      let format = "manifest";
      if (value.includes("webvtt") || value.includes("text/vtt") || /\.vtt(?:\?|$)/i.test(resource.url)) {
        cues = parseWebVtt(resource.body);
        format = "WebVTT";
      } else if (value.includes("ttml") || value.includes("<tt") || /\.(ttml|dfxp)(?:\?|$)/i.test(resource.url)) {
        cues = parseTtml(resource.body);
        format = "TTML";
      }

      for (const cue of cues) {
        this.cues.set(`${cue.start}:${cue.end}:${PST.hash(cue.text)}`, cue);
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

    setHideNative(hide) {
      this.hideNative = hide;
      if (!hide && this.lastNode && this.originalOpacity.has(this.lastNode)) {
        this.lastNode.style.opacity = this.originalOpacity.get(this.lastNode);
        this.originalOpacity.delete(this.lastNode);
      } else if (hide && this.lastNode) {
        this.hideNode(this.lastNode);
      }
    }

    scheduleScan() {
      if (this.scanTimer) return;
      this.scanTimer = setTimeout(() => {
        this.scanTimer = 0;
        this.scan();
      }, 90);
    }

    largestVideo() {
      return [...document.querySelectorAll("video")]
        .map((video) => ({ video, rect: video.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 300 && rect.height > 150)
        .sort((left, right) => (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height))[0];
    }

    scan() {
      const videoEntry = this.largestVideo();
      if (!videoEntry) return;
      const { rect: videoRect } = videoEntry;
      const selector = [
        "[class*='caption' i]",
        "[class*='subtitle' i]",
        "[data-testid*='caption' i]",
        "[data-testid*='subtitle' i]",
        "[aria-live='polite']",
      ].join(",");
      const candidates = [...document.querySelectorAll(selector)].slice(-180)
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
          return { node, text, score };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score);

      const candidate = candidates[0];
      if (!candidate || candidate.text === this.lastText) return;
      this.restoreLastNode();
      this.lastText = candidate.text;
      this.lastNode = candidate.node;
      if (this.hideNative) this.hideNode(candidate.node);
      this.log.add("dom-cue", { text: candidate.text.slice(0, 160) });
      this.onCue({
        text: candidate.text,
        source: "DOM",
        node: candidate.node,
        videoTime: videoEntry.video.currentTime,
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
      this.hoverPausedVideo = null;
      this.priorities = { TextTrack: 3, DOM: 2, WebVTT: 1, TTML: 1, Preview: 4 };
    }

    start() {
      this.injectBridge();
      window.addEventListener("message", (event) => this.onBridgeMessage(event));
      this.dom.start();
      this.pollTimer = setInterval(() => this.pollNetworkTimeline(), 180);
    }

    injectBridge() {
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
        this.bridgeReady = true;
        this.log.add("bridge-ready", detail);
        this.configure();
        this.dispatchEvent(new CustomEvent("status", { detail: this.status() }));
      } else if (type === "TEXT_TRACK_CUE") {
        this.accept({
          text: detail.text,
          source: "TextTrack",
          startTime: detail.startTime,
          endTime: detail.endTime,
          videoTime: detail.currentTime,
        });
      } else if (type === "NETWORK_RESOURCE") {
        const result = this.timeline.ingest(detail);
        this.dispatchEvent(new CustomEvent("network", { detail: result }));
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
      const video = document.querySelector("video");
      if (!video || !Number.isFinite(video.currentTime)) return;
      const cue = this.timeline.at(video.currentTime);
      if (cue) this.accept({ ...cue, source: "WebVTT" });
      else if ((this.priorities[this.lastCue.source] || 0) <= 1 && this.lastCue.text) {
        this.accept({ text: "", source: this.lastCue.source || "WebVTT" });
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
          return { ok: false, changed: false, error: error?.message || "播放器无法暂停" };
        }
      }

      const video = this.hoverPausedVideo;
      this.hoverPausedVideo = null;
      if (!video || video.ended) return { ok: Boolean(video), changed: false, paused: Boolean(video?.paused) };
      try {
        const playResult = video.play();
        playResult?.catch?.((error) => {
          this.log.add("subtitle-hover-resume-error", { message: error?.message || "播放器无法继续播放" });
        });
        this.log.add("subtitle-hover-resume", { at: video.currentTime });
        return { ok: true, changed: true, paused: false };
      } catch (error) {
        return { ok: false, changed: false, error: error?.message || "播放器无法继续播放" };
      }
    }

    rewindPrevious(fallbackSeconds = 5) {
      const video = this.dom.largestVideo()?.video || document.querySelector("video");
      if (!video || !Number.isFinite(video.currentTime)) {
        return { ok: false, error: "没有找到播放器" };
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
        return { ok: false, error: error?.message || "播放器无法跳转" };
      }
    }

    status() {
      return {
        bridgeReady: this.bridgeReady,
        source: this.lastCue.source || "等待字幕",
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
  PST.findPreviousCueTarget = findPreviousCueTarget;
  PST.CaptureCoordinator = CaptureCoordinator;
})();
