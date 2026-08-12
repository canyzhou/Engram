(() => {
  const PST = globalThis.ParamountSubtitles;
  const hasExtensionApi = Boolean(globalThis.chrome?.runtime?.id);
  const t = (key, substitutions) => PST.t(key, substitutions);
  const nodes = Object.fromEntries([
    "connection-rail", "connection-title", "connection-detail", "bridge-status",
    "capture-source", "timeline-count", "page-url", "translator-engine",
    "translator-state", "translator-progress", "version", "cue-source",
    "cue-english", "cue-chinese", "log-count", "log-list", "toast",
  ].map((id) => [id, document.getElementById(id)]));
  let lastPayload = null;

  const sample = {
    ok: true,
    version: "0.5.0",
    url: "https://www.paramountplus.com/shows/video/example/",
    capture: {
      bridgeReady: true,
      source: "WebVTT",
      lastText: "I want to, like, run around, find idols.",
      timelineCueCount: 148,
      logs: [
        { at: new Date().toISOString(), type: "cue", detail: { source: "WebVTT", text: "I want to, like, run around, find idols." } },
        { at: new Date(Date.now() - 800).toISOString(), type: "network-resource", detail: { format: "WebVTT", cueCount: 42, url: "https://example.invalid/stream_vtt.m3u8" } },
        { at: new Date(Date.now() - 1600).toISOString(), type: "bridge-ready", detail: {} },
      ],
    },
    translator: { engine: "local", state: "ready", progress: 1, message: "" },
    cue: { text: "I want to, like, run around, find idols.", translation: "我想四处走走，寻找偶像。", source: "WebVTT" },
  };

  const showToast = (message) => {
    nodes.toast.textContent = message;
    nodes.toast.dataset.open = "true";
    setTimeout(() => { nodes.toast.dataset.open = "false"; }, 1800);
  };

  const renderLogs = (logs = []) => {
    nodes["log-count"].textContent = t("countItems", logs.length);
    nodes["log-list"].replaceChildren();
    if (!logs.length) {
      const empty = document.createElement("li");
      empty.className = "empty-log";
      empty.textContent = t("noEvents");
      nodes["log-list"].append(empty);
      return;
    }
    for (const entry of logs) {
      const item = document.createElement("li");
      const time = document.createElement("time");
      time.textContent = new Date(entry.at).toLocaleTimeString(PST.getUiLanguage(), { hour12: false });
      const type = document.createElement("strong");
      type.textContent = entry.type;
      const detail = document.createElement("code");
      detail.textContent = JSON.stringify(entry.detail);
      item.append(time, type, detail);
      nodes["log-list"].append(item);
    }
  };

  const render = (payload) => {
    lastPayload = payload;
    const ok = Boolean(payload?.ok);
    nodes["connection-rail"].dataset.state = ok ? "connected" : "error";
    nodes["connection-title"].textContent = ok ? t("connectedToPlayer") : t("notConnectedToPlayer");
    nodes["connection-detail"].textContent = ok ? (payload.url || t("playerResponded")) : (payload?.error || t("retryAfterOpeningPlayer"));
    nodes["bridge-status"].textContent = payload?.capture?.bridgeReady ? t("connected") : t("waiting");
    nodes["capture-source"].textContent = payload?.capture?.source || "—";
    nodes["timeline-count"].textContent = String(payload?.capture?.timelineCueCount ?? "—");
    nodes["page-url"].textContent = payload?.url || "—";
    nodes["page-url"].title = payload?.url || "";
    nodes["translator-engine"].textContent = {
      deepseek: "DeepSeek V4 Flash",
      google: t("googleFallback"),
      local: t("chromeLocal"),
    }[payload?.translator?.engine] || t("chromeLocal");
    nodes["translator-state"].textContent = payload?.translator?.message || (payload?.translator?.state === "ready" ? t("chromeLocalReady") : payload?.translator?.state) || "—";
    nodes["translator-progress"].textContent = `${Math.round((payload?.translator?.progress || 0) * 100)}%`;
    nodes.version.textContent = payload?.version || "—";
    nodes["cue-source"].textContent = payload?.cue?.source || payload?.capture?.source || t("waitingForSubtitles");
    nodes["cue-english"].textContent = payload?.cue?.text || t("noEnglishSubtitle");
    nodes["cue-chinese"].textContent = payload?.cue?.translation || t("translationAppearsHere");
    renderLogs(payload?.capture?.logs || []);
  };

  const refresh = async () => {
    if (!hasExtensionApi) {
      render(sample);
      return;
    }
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_PARAMOUNT_STATUS" });
      render(response || { ok: false, error: t("noStatusReceived") });
    } catch (error) {
      render({ ok: false, error: error.message });
    }
  };

  document.getElementById("refresh").addEventListener("click", refresh);
  document.getElementById("simulate").addEventListener("click", async () => {
    if (hasExtensionApi) {
      const response = await chrome.runtime.sendMessage({
        type: "PREVIEW_PARAMOUNT_CUE",
        text: "I want to, like, run around, find idols.",
      });
      showToast(response?.ok ? t("subtitleSent") : response?.error || t("sendFailed"));
      setTimeout(refresh, 350);
    } else {
      render(sample);
      showToast(t("localSampleLoaded"));
    }
  });
  document.getElementById("copy").addEventListener("click", async () => {
    if (!lastPayload) return;
    await navigator.clipboard.writeText(JSON.stringify(lastPayload, null, 2));
    showToast(t("diagnosticsCopied"));
  });

  const initialize = async () => {
    let uiLanguage = "en";
    if (hasExtensionApi && chrome.storage?.sync) uiLanguage = (await chrome.storage.sync.get({ uiLanguage: "en" })).uiLanguage;
    else {
      try { uiLanguage = JSON.parse(localStorage.getItem("pst-preview-settings") || "{}").uiLanguage || "en"; } catch {}
    }
    PST.setUiLanguage(uiLanguage);
    PST.applyI18n();
    sample.translator.message = t("chromeLocalReady");
    refresh();
    if (hasExtensionApi) setInterval(refresh, 2000);
  };
  initialize();
})();
