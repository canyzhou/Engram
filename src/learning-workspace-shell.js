(() => {
  const PST = globalThis.ParamountSubtitles || (globalThis.ParamountSubtitles = {});

  const STYLES = `
    :host { all: initial; display: contents; color-scheme: dark; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    *, *::before, *::after { box-sizing: border-box; }
    button { font: inherit; }
    .topbar { position: fixed; z-index: 2147483647; top: 0; right: 0; left: 0; display: grid; height: 72px; grid-template-columns: 42px minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 0 20px; border-bottom: 1px solid #242529; background: #0d0e10; color: #f2f0ec; pointer-events: auto; }
    .back { display: grid; width: 38px; height: 38px; padding: 8px; border: 1px solid #303136; border-radius: 50%; background: #141518; color: #bdbab4; cursor: pointer; place-items: center; }
    .back:hover { background: #222327; color: #fff; }
    .back svg { width: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .heading { min-width: 0; }
    .heading h1 { margin: 0; overflow: hidden; font-size: 16px; font-weight: 690; letter-spacing: -.012em; text-overflow: ellipsis; white-space: nowrap; }
    .heading p { margin: 3px 0 0; overflow: hidden; color: #9b9993; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .native-label { display: flex; align-items: center; gap: 7px; color: #9b9993; font-size: 12px; }
    .native-label i { width: 7px; height: 7px; border-radius: 50%; background: #64bd78; box-shadow: 0 0 0 3px rgba(100,189,120,.12); }
    .cue-area { position: fixed; z-index: 2147483647; right: 36vw; bottom: 0; left: 0; height: 158px; padding: 12px 18px 14px; border-top: 1px solid #242529; background: #0b0c0e; color: #f2f0ec; pointer-events: auto; }
    .current { display: flex; min-height: 35px; align-items: baseline; gap: 12px; }
    .current span { flex: 0 0 auto; color: #f0a33a; font-size: 11px; font-weight: 750; }
    .current p { margin: 0; overflow: hidden; color: #bdbab4; font-size: 13px; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
    .rail { display: grid; grid-auto-columns: minmax(132px, 1fr); grid-auto-flow: column; gap: 9px; overflow-x: auto; scrollbar-color: #3c3d41 transparent; }
    .cue { min-height: 88px; padding: 9px 11px; overflow: hidden; border: 1px solid #303136; border-radius: 8px; background: #141518; color: #bdbab4; text-align: left; cursor: pointer; }
    .cue:hover { border-color: #67502f; background: #1b1c1f; }
    .cue[aria-current="true"] { border-color: #f0a33a; box-shadow: inset 0 0 0 1px rgba(240,163,58,.18); }
    .cue time { display: block; margin-bottom: 7px; color: #9b9993; font-size: 10px; font-variant-numeric: tabular-nums; }
    .cue[aria-current="true"] time { color: #f0a33a; }
    .cue p { display: -webkit-box; margin: 0; overflow: hidden; font-size: 12px; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
    @media (max-width: 899px) {
      .topbar { height: 60px; padding: 0 12px; }
      .native-label { display: none; }
      .cue-area { display: none; }
    }
  `;

  class YouTubeLearningWorkspace {
    constructor({ getContext, overlay }) {
      this.getContext = getContext;
      this.overlay = overlay;
      this.host = null;
      this.shadow = null;
      this.video = null;
      this.cues = [];
      this.activeCue = null;
      this.observer = null;
      this.refreshTimer = 0;
      this.handleTimeUpdate = () => this.syncCue();
    }

    isActive() {
      return new URLSearchParams(location.search).get("engram_learning") === "1";
    }

    async mount(sourceTabId) {
      if (!this.isActive() || this.host) return;
      document.documentElement.classList.add("pst-learning-mode");
      if (this.overlay?.host) this.overlay.host.style.display = "none";
      this.host = document.createElement("div");
      this.host.id = "pst-learning-workspace";
      this.shadow = this.host.attachShadow({ mode: "open" });
      this.shadow.innerHTML = `
        <style>${STYLES}</style>
        <header class="topbar">
          <button class="back" type="button" aria-label="退出学习模式"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>
          <div class="heading"><h1>正在连接视频…</h1><p>Engram 学习模式</p></div>
          <span class="native-label"><i></i> YouTube 原生播放器</span>
        </header>
        <section class="cue-area" aria-label="字幕片段">
          <div class="current"><span>当前句</span><p>字幕准备好后，会在这里跟随播放。</p></div>
          <div class="rail"></div>
        </section>`;
      (document.body || document.documentElement).append(this.host);
      this.shadow.querySelector(".back").addEventListener("click", () => this.exit());
      this.frame = document.createElement("iframe");
      this.frame.id = "pst-learning-panel";
      this.frame.title = "Engram 学习区域";
      this.frame.setAttribute("allow", "clipboard-write");
      const frameUrl = new URL(chrome.runtime.getURL("learning-mode.html"));
      frameUrl.searchParams.set("embedded", "1");
      if (sourceTabId) frameUrl.searchParams.set("sourceTabId", String(sourceTabId));
      this.frame.src = frameUrl.toString();
      (document.body || document.documentElement).append(this.frame);
      this.observer = new MutationObserver(() => this.bindPlayer());
      this.observer.observe(document.documentElement, { childList: true, subtree: true });
      this.bindPlayer();
      await this.refresh();
      this.refreshTimer = window.setInterval(() => this.refresh(), 2000);
    }

    bindPlayer() {
      const nextVideo = document.querySelector("#movie_player video, video.html5-main-video");
      const moviePlayer = document.querySelector("#movie_player");
      const nextHost = moviePlayer?.closest("#player, #full-bleed-container") || moviePlayer?.parentElement;
      if (nextHost && !nextHost.hasAttribute("data-engram-player-host")) {
        document.querySelectorAll("[data-engram-player-host]").forEach((node) => node.removeAttribute("data-engram-player-host"));
        nextHost.setAttribute("data-engram-player-host", "");
      }
      if (!nextVideo || nextVideo === this.video) return;
      this.video?.removeEventListener("timeupdate", this.handleTimeUpdate);
      this.video = nextVideo;
      this.video.addEventListener("timeupdate", this.handleTimeUpdate);
      this.video.addEventListener("loadedmetadata", this.handleTimeUpdate);
      this.syncCue();
    }

    async refresh() {
      const context = await this.getContext();
      if (!context?.ok || !this.shadow) return;
      this.cues = context.cues || [];
      this.shadow.querySelector(".heading h1").textContent = context.video?.title || "YouTube 视频";
      this.shadow.querySelector(".heading p").textContent = context.video?.author || "YouTube";
      this.renderRail();
      this.syncCue();
    }

    renderRail() {
      const rail = this.shadow.querySelector(".rail");
      rail.replaceChildren(...this.cues.slice(0, 80).map((cue) => {
        const button = document.createElement("button");
        button.className = "cue";
        button.type = "button";
        button.dataset.start = String(cue.start);
        button.innerHTML = `<time>${PST.LearningModeCore.formatTimestamp(cue.start)}</time><p>${PST.escapeHtml(cue.text)}</p>`;
        button.addEventListener("click", () => {
          this.bindPlayer();
          if (!this.video) return;
          this.video.currentTime = Number(cue.start) || 0;
          this.video.play().catch(() => undefined);
          this.syncCue();
        });
        return button;
      }));
    }

    syncCue() {
      if (!this.shadow) return;
      const time = Number(this.video?.currentTime) || 0;
      const cue = PST.LearningModeCore.cueAt(this.cues, time);
      this.shadow.querySelector(".current p").textContent = cue?.text || "当前时间点没有字幕。";
      if (cue?.start === this.activeCue?.start) return;
      this.activeCue = cue;
      for (const button of this.shadow.querySelectorAll(".cue")) {
        const active = Number(button.dataset.start) === cue?.start;
        button.setAttribute("aria-current", String(active));
        if (active) button.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      }
    }

    exit() {
      const url = new URL(location.href);
      url.searchParams.delete("engram_learning");
      location.assign(url.toString());
    }

    destroy() {
      clearInterval(this.refreshTimer);
      this.observer?.disconnect();
      this.video?.removeEventListener("timeupdate", this.handleTimeUpdate);
      document.documentElement.classList.remove("pst-learning-mode");
      document.querySelectorAll("[data-engram-player-host]").forEach((node) => node.removeAttribute("data-engram-player-host"));
      if (this.overlay?.host) this.overlay.host.style.removeProperty("display");
      this.frame?.remove();
      this.host?.remove();
      this.host = null;
    }
  }

  PST.YouTubeLearningWorkspace = YouTubeLearningWorkspace;
})();
