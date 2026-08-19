(() => {
  const PST = globalThis.ParamountSubtitles || (globalThis.ParamountSubtitles = {});
  const adapters = new Map();

  const text = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const content = (documentLike, selectors, attribute = "textContent") => {
    for (const selector of selectors) {
      const node = documentLike?.querySelector?.(selector);
      const value = attribute === "textContent" ? node?.textContent : node?.getAttribute?.(attribute) ?? node?.[attribute];
      if (text(value)) return text(value);
    }
    return "";
  };
  const urlFrom = (locationLike, fallback = "https://www.youtube.com/") => {
    try {
      return locationLike instanceof URL
        ? new URL(locationLike.toString())
        : new URL(String(locationLike?.href || locationLike || ""), fallback);
    } catch {
      return new URL(fallback);
    }
  };
  const largestVideo = (documentLike, selectors) => {
    const candidates = [];
    for (const selector of selectors) {
      for (const video of documentLike?.querySelectorAll?.(selector) || []) {
        if (!candidates.includes(video)) candidates.push(video);
      }
    }
    return candidates.sort((left, right) => {
      const leftRect = left.getBoundingClientRect?.() || { width: left.clientWidth || 0, height: left.clientHeight || 0 };
      const rightRect = right.getBoundingClientRect?.() || { width: right.clientWidth || 0, height: right.clientHeight || 0 };
      return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
    })[0] || null;
  };
  const videoAspectRatio = (video, fallback = 16 / 9) => {
    const width = Number(video?.videoWidth);
    const height = Number(video?.videoHeight);
    const ratio = width > 0 && height > 0 ? width / height : Number(fallback);
    return Number.isFinite(ratio) && ratio >= 0.5 && ratio <= 4 ? ratio : 16 / 9;
  };
  const buildLearningUrl = (sourceUrl, currentTime, formatTime = (seconds) => `${seconds}s`) => {
    const url = urlFrom(sourceUrl);
    url.searchParams.set("engram_learning", "1");
    const seconds = Math.max(0, Math.floor(Number(currentTime) || 0));
    if (seconds > 0) url.searchParams.set("t", formatTime(seconds));
    return url.toString();
  };

  const youtubeHost = (locationLike) => {
    const hostname = urlFrom(locationLike).hostname.toLowerCase();
    return hostname === "youtu.be"
      || hostname === "youtube.com"
      || hostname.endsWith(".youtube.com")
      || hostname.endsWith(".youtube-nocookie.com");
  };

  const register = (adapter) => {
    const requiredMethods = ["matchesLocation", "isPlaybackPage", "buildLearningUrl", "readVideoMetadata", "findVideo"];
    if (!adapter?.id || requiredMethods.some((method) => typeof adapter[method] !== "function")) {
      throw new TypeError(`Learning site adapters require id and ${requiredMethods.join(", ")}`);
    }
    const normalized = Object.freeze({ supportsLearningMode: true, ...adapter });
    adapters.set(normalized.id, normalized);
    return normalized;
  };

  const youtubeId = (locationLike) => {
    const url = urlFrom(locationLike);
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
    return url.searchParams.get("v")
      || url.pathname.match(/^\/(?:embed|shorts|live|clip)\/([\w-]+)/)?.[1]
      || "";
  };

  register({
    id: "youtube",
    name: "YouTube",
    matchesLocation: youtubeHost,
    isPlaybackPage: (locationLike) => youtubeHost(locationLike) && PST.isYouTubePlaybackPage?.(locationLike) === true,
    buildLearningUrl: (sourceUrl, currentTime) => buildLearningUrl(sourceUrl, currentTime),
    readVideoMetadata: (documentLike = document, locationLike = location) => {
      const url = urlFrom(locationLike);
      return {
        id: youtubeId(url),
        title: content(documentLike, ["meta[name='title']"], "content")
          || content(documentLike, ["meta[property='og:title']"], "content")
          || text(documentLike?.title).replace(/\s*-\s*YouTube\s*$/i, "").trim()
          || "YouTube video",
        author: content(documentLike, ["link[itemprop='name']"], "content")
          || content(documentLike, ["#channel-name a", "ytd-channel-name a"])
          || "YouTube",
        thumbnail: content(documentLike, ["meta[property='og:image']"], "content"),
        url: url.toString(),
      };
    },
    findVideo: (documentLike = document) => largestVideo(documentLike, [
      "#movie_player video",
      "video.html5-main-video",
      "video",
    ]),
    getVideoAspectRatio: (video) => videoAspectRatio(video),
    requestPlayerLayout: (windowLike = window) => windowLike.dispatchEvent(new windowLike.Event("resize")),
  });

  PST.registerLearningSiteAdapter = register;
  PST.getLearningSiteAdapter = (siteLike = PST.detectVideoSite?.()) => {
    const id = typeof siteLike === "string" && adapters.has(siteLike)
      ? siteLike
      : siteLike?.id;
    if (id && adapters.has(String(id))) return adapters.get(String(id));
    return [...adapters.values()].find((adapter) => adapter.matchesLocation(siteLike)) || null;
  };
  PST.listLearningSiteAdapters = () => [...adapters.values()];
  PST.buildLearningModeUrl = (sourceUrl, currentTime, siteLike = null) => {
    const adapter = (siteLike ? PST.getLearningSiteAdapter(siteLike) : null)
      || PST.getLearningSiteAdapter(sourceUrl);
    return adapter?.buildLearningUrl?.(sourceUrl, currentTime) || "";
  };
})();
