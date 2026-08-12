(() => {
  const hasExtensionApi = Boolean(globalThis.chrome?.runtime?.id);
  const nodes = Object.fromEntries([
    "connection-rail", "connection-title", "connection-detail", "bridge-status",
    "capture-source", "timeline-count", "page-url", "translator-engine",
    "translator-state", "translator-progress", "version", "cue-source",
    "cue-english", "cue-chinese", "log-count", "log-list", "toast",
  ].map((id) => [id, document.getElementById(id)]));
  let lastPayload = null;

  const sample = {
    ok: true,
    version: "0.3.0",
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
    translator: { engine: "local", state: "ready", progress: 1, message: "Chrome 本地翻译已就绪" },
    cue: { text: "I want to, like, run around, find idols.", translation: "我想四处走走，寻找偶像。", source: "WebVTT" },
  };

  const showToast = (message) => {
    nodes.toast.textContent = message;
    nodes.toast.dataset.open = "true";
    setTimeout(() => { nodes.toast.dataset.open = "false"; }, 1800);
  };

  const renderLogs = (logs = []) => {
    nodes["log-count"].textContent = `${logs.length} 条`;
    nodes["log-list"].replaceChildren();
    if (!logs.length) {
      const empty = document.createElement("li");
      empty.className = "empty-log";
      empty.textContent = "暂无事件，播放视频并开启英文字幕后再刷新。";
      nodes["log-list"].append(empty);
      return;
    }
    for (const entry of logs) {
      const item = document.createElement("li");
      const time = document.createElement("time");
      time.textContent = new Date(entry.at).toLocaleTimeString("zh-CN", { hour12: false });
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
    nodes["connection-title"].textContent = ok ? "已连接到 Paramount+ 播放器" : "未连接到 Paramount+ 播放器";
    nodes["connection-detail"].textContent = ok ? (payload.url || "播放器已响应") : (payload?.error || "请打开播放页后重试");
    nodes["bridge-status"].textContent = payload?.capture?.bridgeReady ? "已连接" : "等待中";
    nodes["capture-source"].textContent = payload?.capture?.source || "—";
    nodes["timeline-count"].textContent = String(payload?.capture?.timelineCueCount ?? "—");
    nodes["page-url"].textContent = payload?.url || "—";
    nodes["page-url"].title = payload?.url || "";
    nodes["translator-engine"].textContent = payload?.translator?.engine === "google" ? "Google 备用" : "Chrome 本地";
    nodes["translator-state"].textContent = payload?.translator?.message || payload?.translator?.state || "—";
    nodes["translator-progress"].textContent = `${Math.round((payload?.translator?.progress || 0) * 100)}%`;
    nodes.version.textContent = payload?.version || "—";
    nodes["cue-source"].textContent = payload?.cue?.source || payload?.capture?.source || "等待字幕";
    nodes["cue-english"].textContent = payload?.cue?.text || "尚未捕获英文字幕。";
    nodes["cue-chinese"].textContent = payload?.cue?.translation || "捕获成功后，翻译会显示在这里。";
    renderLogs(payload?.capture?.logs || []);
  };

  const refresh = async () => {
    if (!hasExtensionApi) {
      render(sample);
      return;
    }
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_PARAMOUNT_STATUS" });
      render(response || { ok: false, error: "没有收到状态" });
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
      showToast(response?.ok ? "模拟字幕已发送" : response?.error || "发送失败");
      setTimeout(refresh, 350);
    } else {
      render(sample);
      showToast("已加载本地模拟字幕");
    }
  });
  document.getElementById("copy").addEventListener("click", async () => {
    if (!lastPayload) return;
    await navigator.clipboard.writeText(JSON.stringify(lastPayload, null, 2));
    showToast("诊断信息已复制");
  });

  refresh();
  if (hasExtensionApi) setInterval(refresh, 2000);
})();
