(() => {
  const root = globalThis.ParamountSubtitles || {};

  root.VERSION = "0.6.6";
  root.BRIDGE_SOURCE = "paramount-subtitle-page-bridge";
  root.CONTENT_SOURCE = "paramount-subtitle-content";

  root.detectVideoSite = (hostname = globalThis.location?.hostname) => {
    const value = String(hostname || "").toLowerCase();
    if (value === "youtu.be" || value === "youtube.com" || value.endsWith(".youtube.com") || value.endsWith(".youtube-nocookie.com")) {
      return { id: "youtube", name: "YouTube" };
    }
    if (value === "paramountplus.com" || value.endsWith(".paramountplus.com")) {
      return { id: "paramount", name: "Paramount+" };
    }
    return { id: "unknown", name: "Video" };
  };

  root.isYouTubePlaybackPage = (locationLike = globalThis.location) => {
    let url;
    try {
      url = locationLike instanceof URL
        ? locationLike
        : new URL(String(locationLike?.href || locationLike || ""), "https://www.youtube.com/");
    } catch {
      return false;
    }
    if (root.detectVideoSite(url.hostname).id !== "youtube") return false;
    if (url.hostname === "youtu.be") return /^\/[\w-]{6,}(?:\/|$)/.test(url.pathname);
    if (/^\/(?:shorts|embed|live|clip)\/[\w-]+(?:\/|$)/.test(url.pathname)) return true;
    return url.pathname === "/watch" && Boolean(url.searchParams.get("v"));
  };

  // Caption providers may expose accessibility sound cues and repeated
  // chevrons used to announce a speaker change. Keep this deliberately narrow:
  // arbitrary bracketed text and a single comparison chevron may be useful
  // language-learning content and must remain untouched.
  root.stripNonSpeechCaptionCues = (value) => String(value || "")
    .replace(/\[\s*music\s*\]/gi, "")
    .replace(/(?:>{2,}|＞{2,})/g, " ");

  root.normalizeSubtitle = (value) => root.stripNonSpeechCaptionCues(String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">"))
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  root.hash = (value) => {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };

  root.parseTime = (value) => {
    if (typeof value === "number") return value;
    const raw = String(value || "").trim();
    if (!raw) return 0;
    if (/^\d+(?:\.\d+)?ms$/i.test(raw)) return Number.parseFloat(raw) / 1000;
    if (/^\d+(?:\.\d+)?s$/i.test(raw)) return Number.parseFloat(raw);
    if (/^\d+(?:\.\d+)?m$/i.test(raw)) return Number.parseFloat(raw) * 60;
    if (/^\d+(?:\.\d+)?h$/i.test(raw)) return Number.parseFloat(raw) * 3600;

    const parts = raw.replace(",", ".").split(":").map(Number);
    if (parts.some(Number.isNaN)) return 0;
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    return parts[0] || 0;
  };

  root.escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  root.isExtensionContextInvalidated = (error) => (
    /extension context invalidated/i.test(String(error?.message || error))
  );

  root.hasExtensionContext = () => {
    try {
      return Boolean(globalThis.chrome?.runtime?.id);
    } catch (error) {
      if (root.isExtensionContextInvalidated(error)) return false;
      throw error;
    }
  };

  root.safeSendMessage = async (message) => {
    try {
      if (!root.hasExtensionContext() || !globalThis.chrome?.runtime?.sendMessage) return null;
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (!root.isExtensionContextInvalidated(error)) return null;
      return null;
    }
  };

  globalThis.ParamountSubtitles = root;
})();
