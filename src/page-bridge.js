(() => {
  if (globalThis.__PARAMOUNT_SUBTITLE_BRIDGE__) return;
  globalThis.__PARAMOUNT_SUBTITLE_BRIDGE__ = true;

  const BRIDGE_SOURCE = "paramount-subtitle-page-bridge";
  const CONTENT_SOURCE = "paramount-subtitle-content";
  const TRACKS = new WeakSet();
  const VIDEOS = new WeakSet();
  const TRACK_VIDEOS = new WeakMap();
  const SELECTED_TRACKS = new WeakMap();
  const ORIGINAL_TRACK_MODES = new WeakMap();
  let captureEnabled = false;
  let shouldHideNative = true;
  let sourceLanguage = "en";

  const post = (type, detail = {}) => {
    window.postMessage({ source: BRIDGE_SOURCE, type, detail }, location.origin);
  };

  const normalize = (value) => String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const emitTrackCue = (track) => {
    const cues = Array.from(track.activeCues || []);
    const text = normalize(cues.map((cue) => cue.text || "").join("\n"));
    const lastCue = cues.at(-1);
    post("TEXT_TRACK_CUE", {
      text,
      language: track.language || "",
      label: track.label || "",
      kind: track.kind || "",
      startTime: lastCue?.startTime || 0,
      endTime: lastCue?.endTime || 0,
      currentTime: document.querySelector("video")?.currentTime || 0,
    });
  };

  const isCaptionTrack = (track) => ["captions", "subtitles"].includes(String(track?.kind || "").toLowerCase());

  const matchesSourceLanguage = (track) => {
    const language = String(track?.language || "").toLowerCase().replace(/_/g, "-");
    const source = String(sourceLanguage || "en").toLowerCase().replace(/_/g, "-");
    if (language === source || language.startsWith(`${source}-`)) return true;
    if (source === "en") return /(^|\b)english(\b|$)/i.test(String(track?.label || ""));
    return false;
  };

  const trackScore = (track, index) => {
    let score = matchesSourceLanguage(track) ? 100 : 0;
    if (track.mode === "showing") score += 20;
    else if (track.mode === "hidden") score += 10;
    if (track.kind === "captions") score += 4;
    if (track.default) score += 2;
    if (/(description|commentary|forced|sdh|ad\b)/i.test(String(track.label || ""))) score -= 8;
    return score - (index / 1000);
  };

  const selectCaptionTrack = (video) => {
    const candidates = Array.from(video.textTracks || []).filter(isCaptionTrack);
    if (!candidates.length) return null;
    const sourceMatches = candidates.filter(matchesSourceLanguage);
    const pool = sourceMatches.length
      ? sourceMatches
      : candidates.filter((track) => track.mode !== "disabled");
    if (!pool.length && candidates.length !== 1) return null;
    return [...(pool.length ? pool : candidates)]
      .map((track) => ({ track, score: trackScore(track, candidates.indexOf(track)) }))
      .sort((left, right) => right.score - left.score)[0]?.track || null;
  };

  const setManagedMode = (track, mode) => {
    if (!track || track.mode === mode) return;
    if (!ORIGINAL_TRACK_MODES.has(track)) ORIGINAL_TRACK_MODES.set(track, track.mode);
    try {
      track.mode = mode;
    } catch (error) {
      post("TRACK_MODE_ERROR", {
        language: track.language || "",
        label: track.label || "",
        requestedMode: mode,
        message: error?.message || "Unable to change text track mode",
      });
    }
  };

  const restoreTrackMode = (track) => {
    if (!ORIGINAL_TRACK_MODES.has(track)) return;
    const mode = ORIGINAL_TRACK_MODES.get(track);
    ORIGINAL_TRACK_MODES.delete(track);
    try {
      track.mode = mode;
    } catch {
      // The player may have disposed the track during navigation.
    }
  };

  const syncVideoTracks = (video) => {
    const tracks = Array.from(video.textTracks || []);
    for (const track of tracks) attachTrack(track, video);

    if (!captureEnabled) {
      for (const track of tracks) restoreTrackMode(track);
      SELECTED_TRACKS.delete(video);
      return;
    }

    const selected = selectCaptionTrack(video);
    const previous = SELECTED_TRACKS.get(video);
    if (selected) SELECTED_TRACKS.set(video, selected);
    else SELECTED_TRACKS.delete(video);

    for (const track of tracks) {
      if (track === selected) setManagedMode(track, shouldHideNative ? "hidden" : "showing");
      else restoreTrackMode(track);
    }

    if (selected && selected !== previous) {
      post("TRACK_SELECTED", {
        language: selected.language || "",
        label: selected.label || "",
        kind: selected.kind || "",
        mode: selected.mode,
      });
      emitTrackCue(selected);
    }
  };

  const attachTrack = (track, video = TRACK_VIDEOS.get(track)) => {
    if (!track) return;
    if (video) TRACK_VIDEOS.set(track, video);
    if (TRACKS.has(track)) return;
    TRACKS.add(track);
    track.addEventListener("cuechange", () => {
      const owner = TRACK_VIDEOS.get(track);
      if (owner && SELECTED_TRACKS.get(owner) === track) emitTrackCue(track);
    });
    post("TRACK_DETECTED", {
      language: track.language || "",
      label: track.label || "",
      kind: track.kind || "",
      mode: track.mode,
    });
  };

  const scanVideo = (video) => {
    if (!VIDEOS.has(video)) {
      VIDEOS.add(video);
      video.textTracks?.addEventListener("addtrack", (event) => {
        attachTrack(event.track, video);
        syncVideoTracks(video);
      });
      let lastSignature = "";
      video.addEventListener("timeupdate", () => {
        syncVideoTracks(video);
        const selected = SELECTED_TRACKS.get(video);
        const active = Array.from(selected?.activeCues || [])
          .map((cue) => cue.text || "")
          .join("|");
        if (active !== lastSignature) {
          lastSignature = active;
          if (selected) emitTrackCue(selected);
        }
      });
      post("VIDEO_DETECTED", {
        currentSrc: video.currentSrc || "",
        duration: Number.isFinite(video.duration) ? video.duration : 0,
      });
    }
    syncVideoTracks(video);
  };

  const scanVideos = () => {
    for (const video of document.querySelectorAll("video")) scanVideo(video);
  };

  const isCandidateResource = (url, contentType = "") => {
    const value = `${url} ${contentType}`.toLowerCase();
    return /(caption|subtitle|timedtext|webvtt|\.vtt(?:\?|$)|\.ttml(?:\?|$)|\.dfxp(?:\?|$)|\.smi(?:\?|$)|\.smil(?:\?|$)|\.m3u8(?:\?|$)|text\/vtt|ttml\+xml)/i.test(value);
  };

  const inspectResponse = async (response, requestUrl) => {
    const url = response?.url || String(requestUrl || "");
    const contentType = response?.headers?.get?.("content-type") || "";
    if (!isCandidateResource(url, contentType)) return;
    try {
      const body = await response.clone().text();
      if (!body || body.length > 2_000_000) return;
      post("NETWORK_RESOURCE", { url, contentType, body });
    } catch {
      // Opaque or streaming responses cannot be cloned as text.
    }
  };

  const nativeFetch = window.fetch;
  window.fetch = async function paramountSubtitleFetch(...args) {
    const response = await Reflect.apply(nativeFetch, this, args);
    inspectResponse(response, args[0] instanceof Request ? args[0].url : args[0]);
    return response;
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function paramountSubtitleOpen(method, url, ...rest) {
    this.__pstUrl = String(url || "");
    this.addEventListener("load", function inspectSubtitleXhr() {
      const responseUrl = this.responseURL || this.__pstUrl;
      const contentType = this.getResponseHeader?.("content-type") || "";
      if (!isCandidateResource(responseUrl, contentType)) return;
      try {
        if (typeof this.responseText === "string" && this.responseText.length <= 2_000_000) {
          post("NETWORK_RESOURCE", {
            url: responseUrl,
            contentType,
            body: this.responseText,
          });
        }
      } catch {
        // Some responseType values do not expose responseText.
      }
    }, { once: true });
    return Reflect.apply(nativeOpen, this, [method, url, ...rest]);
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== CONTENT_SOURCE) return;
    if (["SET_SUBTITLE_CAPTURE", "SET_NATIVE_VISIBILITY"].includes(event.data.type)) {
      const detail = event.data.detail || {};
      captureEnabled = event.data.type === "SET_NATIVE_VISIBILITY"
        ? true
        : Boolean(detail.enabled);
      shouldHideNative = Boolean(detail.hide);
      sourceLanguage = String(detail.sourceLanguage || sourceLanguage || "en");
      scanVideos();
    }
  });

  const observer = new MutationObserver(scanVideos);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scanVideos();
  setInterval(scanVideos, 1200);
  post("BRIDGE_READY", { href: location.href });
})();
