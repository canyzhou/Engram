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
  const FETCHED_CAPTION_TRACKS = new Set();
  const PENDING_CAPTION_TRACKS = new Set();
  const CAPTION_TRACK_ATTEMPTS = new Map();
  const YOUTUBE_PO_TOKENS = new Map();
  const YOUTUBE_NATIVE_TRACK_ATTEMPTS = new Map();
  let managedYouTubeCaptions = null;
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

  const isYouTubePage = () => {
    const hostname = String(location.hostname || "").toLowerCase();
    return hostname === "youtube.com"
      || hostname.endsWith(".youtube.com")
      || hostname.endsWith(".youtube-nocookie.com");
  };

  const youtubePlayer = () => document.querySelector("#movie_player");

  const youtubePlayerResponse = () => {
    if (!isYouTubePage()) return null;
    try {
      const response = youtubePlayer()?.getPlayerResponse?.();
      if (response?.videoDetails?.videoId) return response;
    } catch {
      // YouTube can replace the player while navigating between videos.
    }
    return globalThis.ytInitialPlayerResponse || null;
  };

  const youtubeVideoId = (requestUrl = "") => {
    try {
      const url = new URL(String(requestUrl || location.href), location.href);
      const videoId = url.searchParams.get("v");
      if (videoId) return videoId;
    } catch {
      // Player request bodies and the current player response remain available below.
    }
    return youtubePlayerResponse()?.videoDetails?.videoId || "";
  };

  const currentMediaKey = (requestUrl = "") => {
    const videoId = isYouTubePage() ? youtubeVideoId(requestUrl) : "";
    if (videoId) return `youtube:${videoId}`;
    return location.href;
  };

  const parseYouTubePlayerBody = (body) => {
    if (!body) return null;
    if (typeof body === "object" && !(body instanceof URLSearchParams)) return body;
    try {
      return JSON.parse(body instanceof URLSearchParams ? body.toString() : String(body));
    } catch {
      return null;
    }
  };

  const rememberYouTubePoToken = (requestUrl, body) => {
    if (!isYouTubePage() || !/\/youtubei\/v1\/player(?:[/?]|$)/i.test(String(requestUrl || ""))) return false;
    const payload = parseYouTubePlayerBody(body);
    const token = String(
      payload?.serviceIntegrityDimensions?.poToken
      || payload?.context?.serviceIntegrityDimensions?.poToken
      || "",
    ).trim();
    const videoId = String(payload?.videoId || youtubeVideoId()).trim();
    if (!token || !videoId) return false;
    const clientName = String(payload?.context?.client?.clientName || "WEB").trim() || "WEB";
    const changed = YOUTUBE_PO_TOKENS.get(videoId)?.token !== token;
    YOUTUBE_PO_TOKENS.set(videoId, { token, clientName });
    if (YOUTUBE_PO_TOKENS.size > 20) YOUTUBE_PO_TOKENS.delete(YOUTUBE_PO_TOKENS.keys().next().value);
    if (changed) {
      post("YOUTUBE_PO_TOKEN_CAPTURED", { videoId, clientName, tokenLength: token.length });
      scheduleVideoScan();
    }
    return changed;
  };

  const inspectYouTubePlayerRequest = async (input, init = {}) => {
    const requestUrl = input instanceof Request ? input.url : String(input || "");
    if (!/\/youtubei\/v1\/player(?:[/?]|$)/i.test(requestUrl)) return;
    let body = init?.body;
    if (!body && input instanceof Request) {
      try {
        body = await input.clone().text();
      } catch {
        return;
      }
    }
    rememberYouTubePoToken(requestUrl, body);
  };

  const youtubeTrackScore = (track, index) => {
    const language = String(track?.languageCode || "").toLowerCase().replace(/_/g, "-");
    const source = String(sourceLanguage || "en").toLowerCase().replace(/_/g, "-");
    if (language !== source && !language.startsWith(`${source}-`)) return -Infinity;
    let score = language === source ? 100 : 90;
    if (track.kind !== "asr") score += 25;
    if (track.isTranslatable === false) score += 1;
    return score - (index / 1000);
  };

  const deferCaptionTrackRetry = (requestKey) => {
    const attempt = (CAPTION_TRACK_ATTEMPTS.get(requestKey)?.attempt || 0) + 1;
    const retryInMs = Math.min(30_000, 1_000 * (2 ** Math.min(attempt - 1, 5)));
    CAPTION_TRACK_ATTEMPTS.set(requestKey, { attempt, nextAttemptAt: Date.now() + retryInMs });
    setTimeout(scheduleVideoScan, retryInMs);
    return { attempt, retryInMs };
  };

  const youtubeCaptionModule = (player) => {
    try {
      const options = player?.getOptions?.() || [];
      if (options.includes("captions")) return "captions";
      if (options.includes("cc")) return "cc";
    } catch {
      // The captions module can still be loaded explicitly below.
    }
    return "";
  };

  const requestYouTubeNativeCaptionTrack = (track, mediaKey) => {
    const player = youtubePlayer();
    if (!player || typeof player.setOption !== "function") {
      return { requested: false, reason: "player-api-unavailable" };
    }
    const requestKey = `${mediaKey}:${track.languageCode || ""}:${track.kind || ""}`;
    const lastAttemptAt = YOUTUBE_NATIVE_TRACK_ATTEMPTS.get(requestKey) || 0;
    if (Date.now() - lastAttemptAt < 5_000) return { requested: false, reason: "cooldown" };

    try {
      const originalModule = youtubeCaptionModule(player);
      if (!managedYouTubeCaptions || managedYouTubeCaptions.player !== player) {
        let originalTrack = null;
        try {
          originalTrack = originalModule ? player.getOption?.(originalModule, "track") || null : null;
        } catch {
          originalTrack = null;
        }
        managedYouTubeCaptions = {
          player,
          originalModule,
          originalTrack,
          subtitlesOn: Boolean(player.isSubtitlesOn?.()),
        };
      }

      player.loadModule?.("captions");
      const module = youtubeCaptionModule(player) || "captions";
      let trackList = [];
      try {
        trackList = player.getOption?.(module, "tracklist") || [];
      } catch {
        trackList = [];
      }
      const requestedLanguage = String(track.languageCode || "").toLowerCase().replace(/_/g, "-");
      const playerTrack = trackList.find((candidate) => candidate?.vssId && candidate.vssId === track.vssId)
        || trackList.find((candidate) => {
          const language = String(candidate?.languageCode || "").toLowerCase().replace(/_/g, "-");
          return language === requestedLanguage && String(candidate?.kind || "") === String(track.kind || "");
        })
        || trackList.find((candidate) => {
          const language = String(candidate?.languageCode || "").toLowerCase().replace(/_/g, "-");
          return language === requestedLanguage || language.startsWith(`${requestedLanguage}-`);
        });
      const option = {
        languageCode: playerTrack?.languageCode || track.languageCode || sourceLanguage,
      };
      const vssId = playerTrack?.vssId || track.vssId;
      const kind = playerTrack?.kind || track.kind;
      if (vssId) option.vssId = vssId;
      if (kind) option.kind = kind;
      player.setOption(module, "track", option);
      if (player.isSubtitlesOn?.() === false) player.toggleSubtitlesOn?.();
      player.setOption(module, "reload", Date.now());
      YOUTUBE_NATIVE_TRACK_ATTEMPTS.set(requestKey, Date.now());
      post("YOUTUBE_NATIVE_TRACK_REQUESTED", {
        language: option.languageCode,
        kind: option.kind || "subtitles",
        module,
        mediaKey,
        trackCount: trackList.length,
      });
      return { requested: true, module, trackCount: trackList.length };
    } catch (error) {
      post("YOUTUBE_NATIVE_TRACK_ERROR", {
        language: track.languageCode || "",
        mediaKey,
        message: error?.message || "Unable to ask the YouTube player to load captions",
      });
      return { requested: false, reason: "player-api-error" };
    }
  };

  const restoreYouTubeNativeCaptions = () => {
    const state = managedYouTubeCaptions;
    managedYouTubeCaptions = null;
    if (!state?.player) return;
    try {
      const module = youtubeCaptionModule(state.player) || "captions";
      if (state.originalTrack) state.player.setOption?.(module, "track", state.originalTrack);
      if (Boolean(state.player.isSubtitlesOn?.()) !== state.subtitlesOn) state.player.toggleSubtitlesOn?.();
      if (!state.originalModule) state.player.unloadModule?.("captions");
    } catch {
      // YouTube may replace the player during SPA navigation.
    }
  };

  const loadYouTubeCaptionTrack = async () => {
    if (!captureEnabled || !isYouTubePage()) return;
    const response = youtubePlayerResponse();
    const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const selected = tracks
      .map((track, index) => ({ track, score: youtubeTrackScore(track, index) }))
      .filter((entry) => Number.isFinite(entry.score) && entry.track?.baseUrl)
      .sort((left, right) => right.score - left.score)[0]?.track;
    if (!selected) return;

    const mediaKey = currentMediaKey(selected.baseUrl);
    const videoId = mediaKey.startsWith("youtube:") ? mediaKey.slice("youtube:".length) : youtubeVideoId(selected.baseUrl);
    const url = new URL(selected.baseUrl, location.href);
    url.searchParams.set("fmt", "json3");
    const poToken = YOUTUBE_PO_TOKENS.get(videoId);
    if (poToken?.token && !url.searchParams.has("pot")) url.searchParams.set("pot", poToken.token);
    if (url.searchParams.has("pot")) {
      if (!url.searchParams.has("potc")) url.searchParams.set("potc", "1");
      if (!url.searchParams.has("c")) url.searchParams.set("c", poToken?.clientName || "WEB");
    }
    const hasPoToken = url.searchParams.has("pot");
    const requestKey = `${mediaKey}:${url.toString()}`;
    if (FETCHED_CAPTION_TRACKS.has(requestKey) || PENDING_CAPTION_TRACKS.has(requestKey)) return;
    if ((CAPTION_TRACK_ATTEMPTS.get(requestKey)?.nextAttemptAt || 0) > Date.now()) return;
    if (FETCHED_CAPTION_TRACKS.size > 20) FETCHED_CAPTION_TRACKS.clear();
    if (CAPTION_TRACK_ATTEMPTS.size > 40) CAPTION_TRACK_ATTEMPTS.clear();
    PENDING_CAPTION_TRACKS.add(requestKey);

    try {
      const captionResponse = await Reflect.apply(nativeFetch, window, [url.toString()]);
      if (!captionResponse?.ok) {
        if (!hasPoToken && [401, 403].includes(Number(captionResponse?.status))) {
          const retry = deferCaptionTrackRetry(requestKey);
          const nativeTrack = requestYouTubeNativeCaptionTrack(selected, mediaKey);
          post("YOUTUBE_TRACK_WAITING_FOR_TOKEN", {
            language: selected.languageCode || "",
            mediaKey,
            status: Number(captionResponse.status),
            nativeTrack,
            ...retry,
          });
          return;
        }
        throw new Error(`YouTube captions returned ${captionResponse?.status || "an error"}`);
      }
      const inspected = await inspectResponse(captionResponse, url.toString(), {
        captionKind: selected.kind || "subtitles",
        captionLanguage: selected.languageCode || "",
        expectYouTubeJson3: true,
        forceInspect: true,
      });
      if (!inspected.ok) {
        if (!hasPoToken && ["empty", "invalid"].includes(inspected.reason)) {
          const retry = deferCaptionTrackRetry(requestKey);
          const nativeTrack = requestYouTubeNativeCaptionTrack(selected, mediaKey);
          post("YOUTUBE_TRACK_WAITING_FOR_TOKEN", {
            language: selected.languageCode || "",
            mediaKey,
            reason: inspected.reason,
            nativeTrack,
            ...retry,
          });
          return;
        }
        throw new Error({
          empty: "YouTube captions returned an empty response",
          invalid: "YouTube captions returned no usable cues",
          too_large: "YouTube captions exceeded the capture limit",
          unreadable: "YouTube captions could not be read",
          unrecognized: "YouTube captions returned an unsupported response",
        }[inspected.reason] || "Unable to inspect YouTube captions");
      }
      CAPTION_TRACK_ATTEMPTS.delete(requestKey);
      FETCHED_CAPTION_TRACKS.add(requestKey);
      post("YOUTUBE_TRACK_SELECTED", {
        language: selected.languageCode || "",
        label: selected.name?.simpleText || selected.name?.runs?.map((run) => run.text).join("") || "",
        kind: selected.kind || "subtitles",
        mediaKey,
        cueCount: inspected.cueCount,
        authorized: hasPoToken,
      });
    } catch (error) {
      const retry = deferCaptionTrackRetry(requestKey);
      const nativeTrack = requestYouTubeNativeCaptionTrack(selected, mediaKey);
      post("YOUTUBE_TRACK_ERROR", {
        language: selected.languageCode || "",
        message: error?.message || "Unable to load YouTube captions",
        nativeTrack,
        ...retry,
      });
    } finally {
      PENDING_CAPTION_TRACKS.delete(requestKey);
    }
  };

  const scanVideos = () => {
    for (const video of document.querySelectorAll("video")) scanVideo(video);
    loadYouTubeCaptionTrack();
  };

  let scanTimer = 0;
  const scheduleVideoScan = () => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      scanVideos();
    }, 100);
  };

  const isCandidateResource = (url, contentType = "") => {
    const value = `${url} ${contentType}`.toLowerCase();
    return /(caption|subtitle|timedtext|webvtt|\.vtt(?:\?|$)|\.ttml(?:\?|$)|\.dfxp(?:\?|$)|\.smi(?:\?|$)|\.smil(?:\?|$)|\.m3u8(?:\?|$)|text\/vtt|ttml\+xml)/i.test(value);
  };

  const youtubeCaptionResourceDetail = (value) => {
    try {
      const url = new URL(String(value || ""), location.href);
      if (!/\/api\/timedtext(?:[/?]|$)/i.test(url.pathname)) return {};
      return {
        captionKind: url.searchParams.get("kind") || "subtitles",
        captionLanguage: url.searchParams.get("lang") || "",
      };
    } catch {
      return {};
    }
  };

  const diagnosticResourceUrl = (value) => {
    try {
      const url = new URL(String(value || ""), location.href);
      if (url.searchParams.has("pot")) url.searchParams.set("pot", "redacted");
      return url.toString();
    } catch {
      return String(value || "");
    }
  };

  const inspectYouTubeJson3 = (body) => {
    try {
      const payload = JSON.parse(String(body || "").trimStart().replace(/^\)\]\}'\s*/, ""));
      const cueCount = (Array.isArray(payload?.events) ? payload.events : []).filter((event) => (
        Number.isFinite(Number(event?.tStartMs))
        && Array.isArray(event?.segs)
        && normalize(event.segs.map((segment) => segment?.utf8 || "").join(""))
      )).length;
      return { valid: cueCount > 0, cueCount };
    } catch {
      return { valid: false, cueCount: 0 };
    }
  };

  const inspectResponse = async (response, requestUrl, resourceDetail = {}) => {
    const url = response?.url || String(requestUrl || "");
    const contentType = response?.headers?.get?.("content-type") || "";
    const {
      expectYouTubeJson3 = false,
      forceInspect = false,
      ...publicDetail
    } = resourceDetail;
    if (!forceInspect && !isCandidateResource(url, contentType)) return { ok: false, reason: "unrecognized" };
    try {
      const body = await response.clone().text();
      if (!body) return { ok: false, reason: "empty" };
      if (body.length > 2_000_000) return { ok: false, reason: "too_large" };
      const youtubeJson3 = expectYouTubeJson3 ? inspectYouTubeJson3(body) : null;
      if (youtubeJson3 && !youtubeJson3.valid) return { ok: false, reason: "invalid", cueCount: 0 };
      post("NETWORK_RESOURCE", {
        ...publicDetail,
        url: diagnosticResourceUrl(url),
        contentType,
        body,
        mediaKey: currentMediaKey(url),
        pageUrl: location.href,
      });
      return { ok: true, cueCount: youtubeJson3?.cueCount || 0 };
    } catch (error) {
      return { ok: false, reason: "unreadable", message: error?.message || "Response body could not be read" };
    }
  };

  const nativeFetch = window.fetch;
  window.fetch = async function paramountSubtitleFetch(...args) {
    inspectYouTubePlayerRequest(args[0], args[1]).catch(() => undefined);
    const response = await Reflect.apply(nativeFetch, this, args);
    const requestUrl = args[0] instanceof Request ? args[0].url : args[0];
    inspectResponse(response, requestUrl, youtubeCaptionResourceDetail(requestUrl));
    return response;
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function paramountSubtitleOpen(method, url, ...rest) {
    this.__pstUrl = String(url || "");
    this.addEventListener("load", function inspectSubtitleXhr() {
      const responseUrl = this.responseURL || this.__pstUrl;
      const contentType = this.getResponseHeader?.("content-type") || "";
      if (!isCandidateResource(responseUrl, contentType)) return;
      let body = "";
      try {
        if (typeof this.responseText === "string") body = this.responseText;
      } catch {
        // JSON response types throw when responseText is accessed.
      }
      if (!body) {
        try {
          if (this.response && typeof this.response === "object") body = JSON.stringify(this.response);
        } catch {
          // Non-serializable response bodies are not subtitle resources we can ingest.
        }
      }
      if (body && body.length <= 2_000_000) {
        post("NETWORK_RESOURCE", {
          ...youtubeCaptionResourceDetail(responseUrl),
          url: diagnosticResourceUrl(responseUrl),
          contentType,
          body,
          mediaKey: currentMediaKey(responseUrl),
          pageUrl: location.href,
        });
      }
    }, { once: true });
    return Reflect.apply(nativeOpen, this, [method, url, ...rest]);
  };

  const nativeSend = XMLHttpRequest.prototype.send;
  if (typeof nativeSend === "function") {
    XMLHttpRequest.prototype.send = function paramountSubtitleSend(body) {
      rememberYouTubePoToken(this.__pstUrl, body);
      return Reflect.apply(nativeSend, this, [body]);
    };
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== CONTENT_SOURCE) return;
    if (event.data.type === "BRIDGE_PROBE") {
      post("BRIDGE_READY", { href: location.href });
      return;
    }
    if (["SET_SUBTITLE_CAPTURE", "SET_NATIVE_VISIBILITY"].includes(event.data.type)) {
      const detail = event.data.detail || {};
      captureEnabled = event.data.type === "SET_NATIVE_VISIBILITY"
        ? true
        : Boolean(detail.enabled);
      if (!captureEnabled) restoreYouTubeNativeCaptions();
      shouldHideNative = Boolean(detail.hide);
      sourceLanguage = String(detail.sourceLanguage || sourceLanguage || "en");
      scanVideos();
    }
  });

  const observer = new MutationObserver(scheduleVideoScan);
  const startObserver = () => {
    if (!document.documentElement) return;
    document.documentElement.dataset.engramSubtitleBridge = "true";
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scanVideos();
  };
  if (document.documentElement) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  setInterval(scanVideos, 1200);
  post("BRIDGE_READY", { href: location.href });
})();
