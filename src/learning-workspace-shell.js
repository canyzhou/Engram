(() => {
  const PST = globalThis.ParamountSubtitles || (globalThis.ParamountSubtitles = {});
  const t = (key, substitutions) => PST.t?.(key, substitutions) || key;
  const POS_LABELS = Object.freeze({
    noun: "n.", verb: "v.", adjective: "adj.", adverb: "adv.",
    pronoun: "pron.", preposition: "prep.", conjunction: "conj.",
    interjection: "int.", word: "word",
  });
  const DEFAULT_PANEL_MIN_WIDTH = 390;
  const PANEL_MIN_WIDTH = 300;
  const PANEL_COLLAPSE_THRESHOLD = 220;
  const VIDEO_MIN_WIDTH = 480;
  const HOVER_LOOKUP_DELAY_MS = 300;
  const isExtensionContextInvalidated = PST.isExtensionContextInvalidated || ((error) => (
    /extension context invalidated/i.test(String(error?.message || error))
  ));

  const STYLES = `
    :host { all: initial; display: contents; color-scheme: dark; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    *, *::before, *::after { box-sizing: border-box; }
    button { font: inherit; }
    .topbar { position: fixed; z-index: 2147483647; top: 0; right: 0; left: 0; display: grid; height: 72px; grid-template-columns: 42px minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 0 20px; border-bottom: 1px solid #242529; background: #0d0e10; color: #f2f0ec; pointer-events: auto; }
    .back { display: grid; width: 38px; height: 38px; padding: 8px; border: 1px solid #303136; border-radius: 50%; background: #141518; color: #bdbab4; cursor: pointer; place-items: center; }
    .back:hover { background: #222327; color: #fff; }
    .back svg { width: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .heading { min-width: 0; }
    .heading-title { display: flex; min-width: 0; align-items: center; gap: 7px; }
    .heading h1 { min-width: 0; margin: 0; overflow: hidden; font-size: 16px; font-weight: 690; letter-spacing: -.012em; text-overflow: ellipsis; white-space: nowrap; }
    .heading p { margin: 3px 0 0; overflow: hidden; color: #9b9993; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .archive-button { display: grid; width: 30px; height: 30px; flex: 0 0 30px; padding: 5px; border: 0; border-radius: 50%; background: transparent; color: #aaa7a1; cursor: pointer; place-items: center; }
    .archive-button:hover { background: #222327; color: #f2f0ec; }
    .archive-button:focus-visible, .dashboard-link:focus-visible { outline: 2px solid #f0a33a; outline-offset: 2px; }
    .archive-button svg { width: 20px; fill: transparent; stroke: currentColor; stroke-width: 1.65; stroke-linejoin: round; transition: fill 140ms ease, transform 140ms ease; }
    .archive-button[aria-pressed="true"] { color: #f0a33a; }
    .archive-button[aria-pressed="true"] svg { fill: currentColor; }
    .archive-button:active svg { transform: scale(.86); }
    .topbar-actions { display: flex; align-items: center; gap: 18px; }
    .dashboard-link { display: inline-flex; min-height: 34px; align-items: center; gap: 7px; padding: 0 10px; border: 1px solid #303136; border-radius: 7px; background: #141518; color: #bdbab4; font-size: 11px; font-weight: 620; cursor: pointer; }
    .dashboard-link:hover { border-color: #56524b; color: #f0a33a; }
    .dashboard-link svg { width: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .cue-area { position: fixed; z-index: 2147483647; right: var(--engram-learning-panel-width, max(36vw, 390px)); bottom: 0; left: 0; display: grid; height: 196px; grid-template-rows: minmax(78px, 1fr) 12px auto; padding: 12px 18px; border-top: 1px solid #242529; background: rgba(11,12,14,.98); color: #f2f0ec; pointer-events: auto; }
    .panel-resizer { position: fixed; z-index: 2147483647; top: 72px; right: var(--engram-learning-panel-width, max(36vw, 390px)); bottom: 0; width: 14px; border: 0; outline: 0; cursor: col-resize; touch-action: none; transform: translateX(50%); pointer-events: auto; }
    .panel-resizer::before { position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: #303136; content: ""; transform: translateX(-50%); transition: width 120ms ease, background 120ms ease, box-shadow 120ms ease; }
    .panel-resizer::after { position: absolute; top: 50%; left: 50%; width: 5px; height: 42px; border: 1px solid #4a4b50; border-radius: 999px; background: #1b1c20; box-shadow: 0 4px 14px rgba(0,0,0,.34); content: ""; transform: translate(-50%, -50%); transition: border-color 120ms ease, background 120ms ease, height 120ms ease; }
    .panel-resizer:hover::before, .panel-resizer:focus-visible::before, :host([data-panel-resizing="true"]) .panel-resizer::before { width: 3px; background: #f0a33a; box-shadow: 0 0 12px rgba(240,163,58,.3); }
    .panel-resizer:hover::after, .panel-resizer:focus-visible::after, :host([data-panel-resizing="true"]) .panel-resizer::after { height: 54px; border-color: #f0a33a; background: #2b2116; }
    .panel-restore { position: fixed; z-index: 2147483647; top: 50%; right: 0; display: none; min-height: 88px; align-items: center; gap: 7px; padding: 12px 8px 12px 7px; transform: translateY(-50%); border: 1px solid #3b3c41; border-right: 0; border-radius: 10px 0 0 10px; background: rgba(24,25,28,.97); box-shadow: 0 12px 34px rgba(0,0,0,.38); color: #d4d1ca; cursor: pointer; pointer-events: auto; writing-mode: vertical-rl; }
    .panel-restore:hover { border-color: #6d5534; background: #2a2117; color: #ffb44d; }
    .panel-restore:focus-visible { outline: 2px solid #f0a33a; outline-offset: 2px; }
    .panel-restore svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .panel-restore span { font-size: 11px; font-weight: 680; letter-spacing: .04em; }
    :host([data-panel-collapsed="true"]) .panel-resizer { display: none; }
    :host([data-panel-collapsed="true"]) .panel-restore { display: inline-flex; }
    .current { display: flex; min-width: 0; align-items: center; justify-content: center; padding: 0 clamp(24px, 5vw, 72px) 8px; text-align: center; }
    .current p { max-width: 1040px; margin: 0; color: #f2f0ec; font-size: clamp(18px, 1.35vw, 22px); font-weight: 560; line-height: 1.45; overflow-wrap: anywhere; text-wrap: balance; }
    .word { display: inline; padding: 0 .05em; border-radius: 3px; cursor: help; transition: color 120ms ease, background 120ms ease, box-shadow 120ms ease; }
    .word:hover, .word:focus-visible { background: rgba(240,163,58,.12); box-shadow: inset 0 -2px 0 #f0a33a; color: #ffbd61; outline: none; }
    .word-tooltip-bridge { position: fixed; z-index: 3; pointer-events: none; }
    .word-tooltip-bridge[data-open="true"] { pointer-events: auto; }
    .word-tooltip { position: fixed; z-index: 4; width: min(292px, calc(100vw - 24px)); padding: 15px 16px 13px; border: 1px solid #55504a; border-radius: 10px; background: rgba(28,29,32,.99); box-shadow: 0 18px 44px rgba(0,0,0,.5); color: #f2f0ec; opacity: 0; visibility: hidden; pointer-events: none; transform: translateY(6px); transition: opacity 120ms ease, transform 120ms ease, visibility 120ms ease; text-align: left; }
    .word-tooltip[data-open="true"] { opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(0); }
    .word-tooltip__word { margin: 0; font-size: 23px; font-weight: 720; line-height: 1.15; }
    .word-tooltip__phonetic { margin: 5px 0 0; color: #aaa7a1; font-size: 13px; line-height: 1.4; }
    .word-tooltip__phrase { margin: 8px 0 0; color: #ffb44d; font-size: 12px; line-height: 1.4; }
    .word-tooltip__meaning { margin: 12px 0 0; color: #f4f0e9; font-size: 15px; line-height: 1.48; }
    .word-tooltip__lemma { margin: 11px 0 0; padding-top: 10px; border-top: 1px dashed #4a4946; color: #ffb44d; font-size: 12px; line-height: 1.4; }
    .word-tooltip__definition { display: -webkit-box; margin: 7px 0 0; overflow: hidden; color: #aaa7a1; font-size: 12px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .word-tooltip__action { width: 100%; margin: 11px 0 -3px; padding: 9px 0 2px; border: 0; border-top: 1px solid #41403d; background: transparent; color: #ffb44d; font: 650 12px/1.4 inherit; text-align: left; cursor: pointer; }
    .word-tooltip__action:hover, .word-tooltip__action:focus-visible { color: #ffd18f; outline: none; }
    .word-tooltip__action:disabled { cursor: default; }
    .word-tooltip__action[data-state="pending"] { color: #aaa7a1; }
    .word-tooltip__action[data-state="success"] { color: #75d58d; }
    .word-tooltip__action[data-state="error"] { color: #ff8177; cursor: pointer; }
    .progress { display: block; width: 100%; height: 12px; margin: 0; appearance: none; background: transparent; cursor: pointer; }
    .progress::-webkit-slider-runnable-track { height: 3px; border-radius: 999px; background: linear-gradient(90deg, #f0a33a 0 var(--progress, 0%), #323338 var(--progress, 0%) 100%); }
    .progress::-webkit-slider-thumb { width: 10px; height: 10px; margin-top: -3.5px; appearance: none; border: 2px solid #f0a33a; border-radius: 50%; background: #f7f4ee; box-shadow: 0 1px 5px rgba(0,0,0,.4); opacity: 0; transition: opacity 120ms ease; }
    .progress:hover::-webkit-slider-thumb, .progress:focus-visible::-webkit-slider-thumb { opacity: 1; }
    .progress:focus-visible { outline: 2px solid #f0a33a; outline-offset: 2px; }
    .control-row { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 14px; margin-top: 3px; }
    .control-dock { display: flex; min-width: 0; align-items: center; gap: 4px; padding: 4px; border: 1px solid #2d2e32; border-radius: 999px; background: #18191c; box-shadow: 0 8px 22px rgba(0,0,0,.24); }
    .transport { flex: 0 1 auto; }
    .utility { flex: 0 0 auto; }
    .control { position: relative; display: grid; width: 34px; height: 34px; flex: 0 0 auto; padding: 7px; border: 0; border-radius: 50%; background: transparent; color: #bdbab4; cursor: pointer; place-items: center; }
    .control:hover { background: #292a2e; color: #fff; }
    .control:focus-visible { outline: 2px solid #f0a33a; outline-offset: 2px; }
    .control:disabled { opacity: .38; cursor: default; }
    .control:disabled:hover { background: transparent; color: #bdbab4; }
    .control svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .control svg.play-icon { fill: currentColor; stroke: none; }
    .control-primary { width: 38px; height: 38px; padding: 9px; background: #2c2d31; color: #f7f4ee; }
    .control-primary:hover { background: #3a3b40; }
    .pause-icon, .muted-icon { display: none; }
    .cue-area[data-playing="true"] .play-icon, .cue-area[data-muted="true"] .volume-icon { display: none; }
    .cue-area[data-playing="true"] .pause-icon, .cue-area[data-muted="true"] .muted-icon { display: block; }
    .control[aria-pressed="true"] { background: rgba(240,163,58,.14); color: #ffb44d; }
    .time { min-width: 95px; padding: 0 9px; color: #a7a49e; font-size: 11px; font-variant-numeric: tabular-nums; text-align: center; white-space: nowrap; }
    .time strong { color: #f2f0ec; font-weight: 620; }
    .rate-picker { position: relative; display: flex; align-items: center; }
    .rate { width: auto; min-width: 43px; padding: 0 9px; border-radius: 999px; color: #d5d2cc; font-size: 11px; font-weight: 680; font-variant-numeric: tabular-nums; }
    .rate span { line-height: 1; }
    .rate-menu { position: absolute; z-index: 2; bottom: calc(100% + 10px); left: 0; width: 136px; padding: 6px; border: 1px solid #383a40; border-radius: 12px; background: #1b1c20; box-shadow: 0 14px 36px rgba(0,0,0,.45); opacity: 0; visibility: hidden; transform: translateY(6px) scale(.98); transform-origin: bottom left; transition: opacity 120ms ease, transform 120ms ease, visibility 120ms ease; pointer-events: none; }
    .rate-menu::after { position: absolute; right: 0; bottom: -12px; left: 0; height: 12px; content: ""; }
    .rate-picker:not([data-dismissed="true"]):hover .rate-menu, .rate-picker[data-open="true"] .rate-menu { opacity: 1; visibility: visible; transform: translateY(0) scale(1); pointer-events: auto; }
    .rate-menu-label { display: block; padding: 5px 8px 6px; color: #8f8d88; font-size: 10px; font-weight: 680; letter-spacing: .04em; }
    .rate-option { display: flex; width: 100%; height: 32px; align-items: center; justify-content: space-between; padding: 0 9px; border: 0; border-radius: 7px; background: transparent; color: #d8d5cf; font-size: 12px; font-variant-numeric: tabular-nums; text-align: left; cursor: pointer; }
    .rate-option:hover, .rate-option:focus-visible { outline: none; background: #2a2b30; color: #fff; }
    .rate-option[aria-checked="true"] { color: #ffb44d; font-weight: 720; }
    .rate-option[aria-checked="true"]::after { content: "✓"; font-size: 12px; }
    .rate-option:disabled { opacity: .4; cursor: default; }
    .dock-divider { width: 1px; height: 18px; margin: 0 2px; background: #34353a; }
    @media (max-width: 1100px) {
      .cue-area { padding-right: 12px; padding-left: 12px; }
      .control-row { gap: 8px; }
      .time { min-width: 86px; padding: 0 5px; }
      .dock-divider { display: none; }
    }
    @media (max-width: 899px) {
      .topbar { height: 60px; padding: 0 12px; }
      .dashboard-link span { display: none; }
      .topbar-actions { gap: 7px; }
      .dashboard-link { width: 34px; padding: 0; justify-content: center; }
      .cue-area { display: none; }
      .panel-resizer { display: none; }
    }
  `;

  class VideoLearningWorkspace {
    constructor({ siteAdapter, getContext, overlay, dictionary, getSettings, onAddWord }) {
      this.siteAdapter = siteAdapter || PST.getLearningSiteAdapter?.(PST.detectVideoSite?.()) || null;
      this.getContext = getContext;
      this.overlay = overlay;
      this.dictionary = dictionary || overlay?.dictionary || null;
      this.getSettings = getSettings || (() => overlay?.settings || PST.DEFAULT_SETTINGS || {});
      this.onAddWord = onAddWord;
      this.host = null;
      this.shadow = null;
      this.video = null;
      this.cues = [];
      this.displayCues = [];
      this.activeCue = null;
      this.observer = null;
      this.refreshTimer = 0;
      this.renderedCueKey = "";
      this.lookupToken = 0;
      this.hideTooltipTimer = 0;
      this.lookupDelayTimer = 0;
      this.pendingLookupNode = null;
      this.subtitleHoverTimer = 0;
      this.subtitleHoverActive = false;
      this.resumeAfterSubtitleHover = false;
      this.currentWordEntry = null;
      this.context = null;
      this.historyTimer = 0;
      this.historyTickAt = Date.now();
      this.lastPersistedTime = -1;
      this.historyInitialized = false;
      this.panelWidth = 0;
      this.lastPanelWidth = 0;
      this.panelCollapsed = false;
      this.panelResizePointerId = null;
      this.panelResizeRawWidth = 0;
      this.extensionContextInvalidated = false;
      this.playerLayoutFrame = 0;
      this.handleTimeUpdate = () => {
        this.syncPlayerState();
        this.syncCue();
      };
      this.handleVideoMetadata = () => {
        this.syncVideoAspectRatio();
        this.handleTimeUpdate();
      };
      this.handlePlayerStateChange = () => this.syncPlayerState();
      this.handleViewportResize = () => {
        if (!this.panelCollapsed && window.innerWidth > 899) this.setPanelWidth(this.panelWidth);
      };
    }

    isActive() {
      return new URLSearchParams(location.search).get("engram_learning") === "1";
    }

    async mount(sourceTabId) {
      if (!this.isActive() || this.host || !this.siteAdapter?.supportsLearningMode) return;
      document.documentElement.classList.add("pst-learning-mode");
      document.documentElement.dataset.engramLearningSite = this.siteAdapter.id;
      if (this.overlay?.host) this.overlay.host.style.display = "none";
      this.host = document.createElement("div");
      this.host.id = "pst-learning-workspace";
      this.shadow = this.host.attachShadow({ mode: "open" });
      this.shadow.innerHTML = `
        <style>${STYLES}</style>
        <header class="topbar">
          <button class="back" type="button" aria-label="退出学习模式"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>
          <div class="heading">
            <div class="heading-title">
              <h1>正在连接视频…</h1>
              <button class="archive-button" type="button" aria-label="星标并加入学习档案" aria-pressed="false" title="星标并加入学习档案">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>
              </button>
            </div>
            <p>Engram 学习模式</p>
          </div>
          <div class="topbar-actions">
            <button class="dashboard-link" type="button" title="打开学习档案">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14v12H5zM8 4h8v5H8z"/><path d="M9 13h6M9 16h4"/></svg>
              <span>学习档案</span>
            </button>
          </div>
        </header>
        <div class="panel-resizer" role="separator" tabindex="0" aria-label="调整学习面板宽度" aria-orientation="vertical" aria-valuemin="${PANEL_MIN_WIDTH}" aria-valuenow="${DEFAULT_PANEL_MIN_WIDTH}" title="拖动调整学习面板宽度，双击收起"></div>
        <button class="panel-restore" type="button" aria-label="展开学习面板" title="展开学习面板">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          <span>学习面板</span>
        </button>
        <section class="cue-area" aria-label="播放与字幕控制">
          <div class="current" aria-live="polite" hidden><p></p></div>
          <div class="word-tooltip-bridge" aria-hidden="true"></div>
          <div class="word-tooltip" role="dialog" aria-label="${PST.escapeHtml(t("wordDefinition"))}"></div>
          <input class="progress" type="range" min="0" max="0" value="0" step="0.1" aria-label="视频进度" disabled>
          <div class="control-row">
            <div class="control-dock transport" aria-label="播放控制">
              <button class="control control-primary play-toggle" type="button" aria-label="播放" title="播放 / 暂停" disabled>
                <svg class="play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5Z"/></svg>
                <svg class="pause-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7v10M15 7v10"/></svg>
              </button>
              <button class="control previous-cue" type="button" aria-label="上一句" title="上一句" disabled>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6v12M18 7l-8 5 8 5Z"/></svg>
              </button>
              <button class="control next-cue" type="button" aria-label="下一句" title="下一句" disabled>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 6v12M6 7l8 5-8 5Z"/></svg>
              </button>
              <span class="dock-divider" aria-hidden="true"></span>
              <span class="time"><strong class="current-time">0:00</strong> / <span class="duration">0:00</span></span>
            </div>
            <div class="control-dock utility" aria-label="播放选项">
              <div class="rate-picker" data-open="false" data-dismissed="false">
                <button class="control rate" type="button" aria-label="播放速度，当前 1 倍" aria-haspopup="menu" aria-expanded="false" aria-controls="playback-rate-menu" disabled><span>1×</span></button>
                <div class="rate-menu" id="playback-rate-menu" role="menu" aria-label="选择播放速度">
                  <span class="rate-menu-label">播放速度</span>
                  <button class="rate-option" type="button" role="menuitemradio" aria-checked="false" data-rate="0.75" disabled>0.75×</button>
                  <button class="rate-option" type="button" role="menuitemradio" aria-checked="true" data-rate="1" disabled>1×</button>
                  <button class="rate-option" type="button" role="menuitemradio" aria-checked="false" data-rate="1.25" disabled>1.25×</button>
                  <button class="rate-option" type="button" role="menuitemradio" aria-checked="false" data-rate="1.5" disabled>1.5×</button>
                  <button class="rate-option" type="button" role="menuitemradio" aria-checked="false" data-rate="2" disabled>2×</button>
                </div>
              </div>
              <button class="control mute-toggle" type="button" aria-label="静音" aria-pressed="false" title="静音 / 取消静音" disabled>
                <svg class="volume-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6 7 10H4v4h3l4 4Z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a8 8 0 0 1 0 11"/></svg>
                <svg class="muted-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6 7 10H4v4h3l4 4Z"/><path d="m16 10 4 4M20 10l-4 4"/></svg>
              </button>
            </div>
          </div>
        </section>`;
      (document.body || document.documentElement).append(this.host);
      this.shadow.querySelector(".back").addEventListener("click", () => this.exit());
      this.shadow.querySelector(".archive-button").addEventListener("click", () => {
        this.persistProgress({ manual: true, toggleStar: true })
          .catch((error) => this.handleAsyncError(error, "保存学习记录失败"));
      });
      this.shadow.querySelector(".dashboard-link").addEventListener("click", () => {
        PST.safeSendMessage({ type: "OPEN_LEARNING_DASHBOARD" });
      });
      this.bindControls();
      this.bindDictionary();
      this.bindPanelResize();
      this.frame = document.createElement("iframe");
      this.frame.id = "pst-learning-panel";
      this.frame.title = "Engram 学习区域";
      this.frame.setAttribute("allow", "clipboard-write; microphone");
      const frameUrl = new URL(chrome.runtime.getURL("learning-mode.html"));
      frameUrl.searchParams.set("embedded", "1");
      if (sourceTabId) frameUrl.searchParams.set("sourceTabId", String(sourceTabId));
      this.frame.src = frameUrl.toString();
      (document.body || document.documentElement).append(this.frame);
      this.setPanelWidth(Math.max(DEFAULT_PANEL_MIN_WIDTH, window.innerWidth * .36));
      this.observer = new MutationObserver(() => this.bindPlayer());
      this.observer.observe(document.documentElement, { childList: true, subtree: true });
      this.bindPlayer();
      await this.refresh();
      this.refreshTimer = window.setInterval(() => {
        this.refresh().catch((error) => this.handleAsyncError(error, "刷新学习上下文失败"));
      }, 2000);
      this.historyTimer = window.setInterval(() => {
        this.persistProgress().catch((error) => this.handleAsyncError(error, "保存学习进度失败"));
      }, 5000);
    }

    handleAsyncError(error, label) {
      if (isExtensionContextInvalidated(error)) {
        this.extensionContextInvalidated = true;
        clearInterval(this.historyTimer);
        this.historyTimer = 0;
        return;
      }
      console.warn(`[Engram] ${label}`, error);
    }

    maximumPanelWidth() {
      return Math.max(PANEL_MIN_WIDTH, window.innerWidth - VIDEO_MIN_WIDTH);
    }

    requestPlayerLayout() {
      if (this.playerLayoutFrame) return;
      this.playerLayoutFrame = window.requestAnimationFrame(() => {
        this.playerLayoutFrame = 0;
        this.siteAdapter?.requestPlayerLayout?.(window, document, this.video);
      });
    }

    setPanelWidth(width, { preview = false } = {}) {
      const minimum = preview ? 0 : PANEL_MIN_WIDTH;
      const nextWidth = Math.min(this.maximumPanelWidth(), Math.max(minimum, Number(width) || minimum));
      const previousWidth = this.panelWidth;
      this.panelWidth = nextWidth;
      if (!preview) this.lastPanelWidth = nextWidth;
      document.documentElement.style.setProperty("--engram-learning-panel-width", `${nextWidth}px`);
      const resizer = this.shadow?.querySelector(".panel-resizer");
      if (resizer) {
        resizer.setAttribute("aria-valuemax", String(Math.round(this.maximumPanelWidth())));
        resizer.setAttribute("aria-valuenow", String(Math.round(nextWidth)));
      }
      if (Math.abs(nextWidth - previousWidth) > .5) this.requestPlayerLayout();
    }

    setPanelCollapsed(collapsed) {
      this.panelCollapsed = Boolean(collapsed);
      this.host.dataset.panelCollapsed = String(this.panelCollapsed);
      document.documentElement.classList.toggle("pst-learning-panel-collapsed", this.panelCollapsed);
      if (this.panelCollapsed) {
        if (this.panelWidth >= PANEL_MIN_WIDTH) this.lastPanelWidth = this.panelWidth;
        this.setPanelWidth(0, { preview: true });
      } else {
        this.setPanelWidth(this.lastPanelWidth || Math.max(DEFAULT_PANEL_MIN_WIDTH, window.innerWidth * .36));
      }
    }

    bindPanelResize() {
      const resizer = this.shadow.querySelector(".panel-resizer");
      const restore = this.shadow.querySelector(".panel-restore");
      const finishResize = (event) => {
        if (event.pointerId !== this.panelResizePointerId) return;
        if (resizer.hasPointerCapture(event.pointerId)) resizer.releasePointerCapture(event.pointerId);
        this.panelResizePointerId = null;
        this.host.dataset.panelResizing = "false";
        document.documentElement.classList.remove("pst-learning-panel-resizing");
        if (this.panelResizeRawWidth <= PANEL_COLLAPSE_THRESHOLD) this.setPanelCollapsed(true);
        else this.setPanelWidth(this.panelResizeRawWidth);
      };

      resizer.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || window.innerWidth <= 899) return;
        event.preventDefault();
        this.panelResizePointerId = event.pointerId;
        this.panelResizeRawWidth = window.innerWidth - event.clientX;
        resizer.setPointerCapture(event.pointerId);
        this.host.dataset.panelResizing = "true";
        document.documentElement.classList.add("pst-learning-panel-resizing");
      });
      resizer.addEventListener("pointermove", (event) => {
        if (event.pointerId !== this.panelResizePointerId) return;
        this.panelResizeRawWidth = Math.max(0, window.innerWidth - event.clientX);
        this.setPanelWidth(this.panelResizeRawWidth, { preview: true });
      });
      resizer.addEventListener("pointerup", finishResize);
      resizer.addEventListener("pointercancel", finishResize);
      resizer.addEventListener("dblclick", () => this.setPanelCollapsed(true));
      resizer.addEventListener("keydown", (event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const direction = event.key === "ArrowLeft" ? 1 : -1;
        const nextWidth = this.panelWidth + (direction * (event.shiftKey ? 64 : 24));
        if (direction < 0 && nextWidth < PANEL_MIN_WIDTH) this.setPanelCollapsed(true);
        else this.setPanelWidth(nextWidth);
      });
      restore.addEventListener("click", () => {
        this.setPanelCollapsed(false);
        resizer.focus();
      });
      window.addEventListener("resize", this.handleViewportResize);
    }

    bindPlayer() {
      const nextVideo = this.siteAdapter?.findVideo?.(document) || null;
      if (!nextVideo || nextVideo === this.video) return;
      this.unbindPlayerEvents();
      this.video = nextVideo;
      this.video.addEventListener("timeupdate", this.handleTimeUpdate);
      this.video.addEventListener("loadedmetadata", this.handleVideoMetadata);
      this.video.addEventListener("resize", this.handleVideoMetadata);
      for (const event of ["durationchange", "play", "pause", "ended", "ratechange", "volumechange"]) {
        this.video.addEventListener(event, this.handlePlayerStateChange);
      }
      this.syncVideoAspectRatio();
      this.syncPlayerState();
      this.syncCue();
    }

    syncVideoAspectRatio() {
      const ratio = Number(this.siteAdapter?.getVideoAspectRatio?.(this.video));
      if (!Number.isFinite(ratio) || ratio <= 0) return;
      document.documentElement.style.setProperty("--engram-learning-video-aspect", String(ratio));
      document.documentElement.style.setProperty("--engram-learning-video-height-ratio", String(1 / ratio));
      this.requestPlayerLayout();
    }

    unbindPlayerEvents() {
      if (!this.video) return;
      this.video.removeEventListener("timeupdate", this.handleTimeUpdate);
      this.video.removeEventListener("loadedmetadata", this.handleVideoMetadata);
      this.video.removeEventListener("resize", this.handleVideoMetadata);
      for (const event of ["durationchange", "play", "pause", "ended", "ratechange", "volumechange"]) {
        this.video.removeEventListener(event, this.handlePlayerStateChange);
      }
    }

    bindControls() {
      const progress = this.shadow.querySelector(".progress");
      this.shadow.querySelector(".play-toggle").addEventListener("click", () => {
        this.bindPlayer();
        if (!this.video) return;
        if (this.video.paused || this.video.ended) this.video.play().catch(() => undefined);
        else this.video.pause();
      });
      this.shadow.querySelector(".previous-cue").addEventListener("click", () => {
        const currentTime = Number(this.video?.currentTime) || 0;
        const cue = [...this.cues].reverse().find((item) => item.start < currentTime - 0.45);
        if (cue) this.seekTo(cue.start);
      });
      this.shadow.querySelector(".next-cue").addEventListener("click", () => {
        const currentTime = Number(this.video?.currentTime) || 0;
        const cue = this.cues.find((item) => item.start > currentTime + 0.35);
        if (cue) this.seekTo(cue.start);
      });
      progress.addEventListener("input", () => this.seekTo(Number(progress.value), { play: false }));
      const ratePicker = this.shadow.querySelector(".rate-picker");
      const rateToggle = this.shadow.querySelector(".rate");
      const setRateMenuOpen = (open) => {
        ratePicker.dataset.open = String(open);
        rateToggle.setAttribute("aria-expanded", String(open));
      };
      ratePicker.addEventListener("pointerenter", () => {
        ratePicker.dataset.dismissed = "false";
        if (!rateToggle.disabled) setRateMenuOpen(true);
      });
      ratePicker.addEventListener("pointerleave", () => {
        ratePicker.dataset.dismissed = "false";
        if (!ratePicker.matches(":focus-within")) setRateMenuOpen(false);
      });
      ratePicker.addEventListener("focusin", () => setRateMenuOpen(true));
      ratePicker.addEventListener("focusout", () => {
        window.setTimeout(() => {
          if (!ratePicker.contains(this.shadow.activeElement)) setRateMenuOpen(false);
        });
      });
      ratePicker.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        setRateMenuOpen(false);
        this.shadow.activeElement?.blur();
      });
      rateToggle.addEventListener("click", () => {
        this.bindPlayer();
        if (!this.video) return;
        setRateMenuOpen(true);
      });
      for (const option of this.shadow.querySelectorAll(".rate-option")) {
        option.addEventListener("click", () => {
          this.bindPlayer();
          if (!this.video) return;
          this.video.playbackRate = Number(option.dataset.rate);
          this.syncPlayerState();
          option.blur();
          ratePicker.dataset.dismissed = "true";
          setRateMenuOpen(false);
        });
      }
      this.shadow.querySelector(".mute-toggle").addEventListener("click", () => {
        this.bindPlayer();
        if (this.video) this.video.muted = !this.video.muted;
      });
    }

    bindDictionary() {
      const current = this.shadow.querySelector(".current p");
      const tooltip = this.shadow.querySelector(".word-tooltip");
      const bridge = this.shadow.querySelector(".word-tooltip-bridge");
      current.addEventListener("mouseenter", () => this.enterSubtitleInteraction());
      current.addEventListener("mouseleave", () => this.scheduleLeaveSubtitleInteraction());
      for (const surface of [tooltip, bridge]) {
        surface.addEventListener("mouseenter", () => {
          clearTimeout(this.hideTooltipTimer);
          this.enterSubtitleInteraction();
        });
        surface.addEventListener("mouseleave", () => {
          this.scheduleHideTooltip();
          this.scheduleLeaveSubtitleInteraction();
        });
      }
      tooltip.addEventListener("click", async (event) => {
        if (!event.target.closest("[data-add-word]") || !this.currentWordEntry || !this.onAddWord) return;
        const entry = this.currentWordEntry;
        const lemma = entry.lemma;
        this.showVocabularyResult({ state: "pending", lemma });
        try {
          await this.onAddWord(entry, this.activeCue?.text || "");
          this.showVocabularyResult({ state: "success", lemma });
        } catch (error) {
          this.showVocabularyResult({
            state: "error",
            lemma,
            error: error?.message || t("tryAgainLater"),
          });
        }
      });
    }

    hoverDictionaryEnabled() {
      const settings = this.getSettings?.() || {};
      return Boolean(this.dictionary && settings.enabled !== false && settings.hoverDictionary);
    }

    enterSubtitleInteraction() {
      clearTimeout(this.subtitleHoverTimer);
      if (!this.hoverDictionaryEnabled() || this.subtitleHoverActive) return;
      this.subtitleHoverActive = true;
      this.resumeAfterSubtitleHover = Boolean(this.video && !this.video.paused && !this.video.ended);
      if (this.resumeAfterSubtitleHover) this.video.pause();
    }

    scheduleLeaveSubtitleInteraction() {
      clearTimeout(this.subtitleHoverTimer);
      this.subtitleHoverTimer = window.setTimeout(() => {
        const nodes = [
          this.shadow?.querySelector(".current p"),
          this.shadow?.querySelector(".word-tooltip"),
          this.shadow?.querySelector(".word-tooltip-bridge"),
        ].filter(Boolean);
        if (nodes.some((node) => node.matches(":hover"))) return;
        this.leaveSubtitleInteraction();
      }, 100);
    }

    leaveSubtitleInteraction() {
      clearTimeout(this.subtitleHoverTimer);
      if (!this.subtitleHoverActive) return;
      this.subtitleHoverActive = false;
      const shouldResume = this.resumeAfterSubtitleHover;
      this.resumeAfterSubtitleHover = false;
      if (shouldResume && this.video?.paused && !this.video.ended) {
        this.video.play().catch(() => undefined);
      }
    }

    renderCurrentCue(cue) {
      const current = this.shadow.querySelector(".current p");
      const text = PST.normalizeSubtitle(cue?.text);
      this.cancelScheduledLookup();
      this.currentWordEntry = null;
      this.shadow.querySelector(".word-tooltip").dataset.open = "false";
      this.shadow.querySelector(".word-tooltip-bridge").dataset.open = "false";
      current.replaceChildren();
      current.closest(".current").hidden = !text;
      if (!text) return;
      if (!this.hoverDictionaryEnabled()) {
        current.textContent = text;
        return;
      }

      const matcher = /([A-Za-z]+(?:['’-][A-Za-z]+)*)/g;
      let lastIndex = 0;
      for (const match of text.matchAll(matcher)) {
        if (match.index > lastIndex) {
          current.append(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const word = document.createElement("span");
        word.className = "word";
        word.textContent = match[0];
        word.tabIndex = 0;
        word.dataset.word = match[0];
        word.addEventListener("mouseenter", () => this.scheduleLookupWord(word));
        word.addEventListener("focus", () => {
          this.cancelScheduledLookup();
          this.lookupWord(word);
        });
        word.addEventListener("mouseleave", () => {
          this.cancelScheduledLookup(word);
          this.scheduleHideTooltip();
        });
        word.addEventListener("blur", () => this.scheduleHideTooltip());
        current.append(word);
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) current.append(document.createTextNode(text.slice(lastIndex)));
    }

    lookupContext(cue) {
      const cueIndex = this.cues.findIndex((item) => (
        item === cue || (item.start === cue?.start && item.text === cue?.text)
      ));
      if (cueIndex <= 0) return [];
      return this.cues.slice(Math.max(0, cueIndex - 4), cueIndex)
        .map((item) => PST.normalizeSubtitle(item.text))
        .filter(Boolean);
    }

    scheduleLookupWord(wordNode) {
      clearTimeout(this.lookupDelayTimer);
      const token = ++this.lookupToken;
      this.pendingLookupNode = wordNode;
      this.lookupDelayTimer = window.setTimeout(() => {
        if (token !== this.lookupToken || this.pendingLookupNode !== wordNode) return;
        this.lookupDelayTimer = 0;
        this.pendingLookupNode = null;
        this.lookupWord(wordNode, token);
      }, HOVER_LOOKUP_DELAY_MS);
    }

    cancelScheduledLookup(wordNode = null) {
      if (wordNode && this.pendingLookupNode !== wordNode) return;
      clearTimeout(this.lookupDelayTimer);
      this.lookupDelayTimer = 0;
      this.pendingLookupNode = null;
      this.lookupToken += 1;
    }

    async lookupWord(wordNode, token = ++this.lookupToken) {
      if (!this.hoverDictionaryEnabled()) return;
      clearTimeout(this.hideTooltipTimer);
      const tooltip = this.shadow.querySelector(".word-tooltip");
      const original = wordNode.dataset.word || wordNode.textContent || "";
      this.currentWordEntry = null;
      tooltip.innerHTML = `
        <p class="word-tooltip__word">${PST.escapeHtml(original)}</p>
        <p class="word-tooltip__phonetic">${PST.escapeHtml(t("lookingUp"))}</p>
      `;
      tooltip.dataset.open = "true";
      this.positionTooltip(wordNode);

      let entry = null;
      try {
        entry = await this.dictionary.lookup(original, this.getSettings?.() || {}, {
          sentence: this.activeCue?.text || "",
          context: this.lookupContext(this.activeCue),
        });
      } catch (error) {
        if (token !== this.lookupToken) return;
        tooltip.innerHTML = `
          <p class="word-tooltip__word">${PST.escapeHtml(original)}</p>
          <p class="word-tooltip__phonetic">${PST.escapeHtml(error?.message || t("tryAgainLater"))}</p>
        `;
        this.positionTooltip(wordNode);
        return;
      }
      if (token !== this.lookupToken) return;
      if (!entry) {
        tooltip.innerHTML = `
          <p class="word-tooltip__word">${PST.escapeHtml(original)}</p>
          <p class="word-tooltip__phonetic">${PST.escapeHtml(t("tryAgainLater"))}</p>
        `;
        this.positionTooltip(wordNode);
        return;
      }

      this.currentWordEntry = entry;
      const pos = POS_LABELS[entry.partOfSpeech] || entry.partOfSpeech || "word";
      const addAction = this.onAddWord
        ? `<button class="word-tooltip__action" type="button" data-add-word data-state="idle" aria-live="polite">${PST.escapeHtml(t("addToWordBank"))}</button>`
        : "";
      const phrase = entry.phrase && entry.phrase.toLowerCase() !== original.toLowerCase()
        ? `<p class="word-tooltip__phrase">${PST.escapeHtml(t("contextPhrase", entry.phrase))}</p>`
        : "";
      tooltip.innerHTML = `
        <p class="word-tooltip__word">${PST.escapeHtml(original)}</p>
        <p class="word-tooltip__phonetic">${PST.escapeHtml(entry.phonetic || t("noPhonetic"))}</p>
        ${phrase}
        <p class="word-tooltip__meaning">${PST.escapeHtml(pos)} ${PST.escapeHtml(entry.gloss || entry.lemma)}</p>
        <p class="word-tooltip__lemma">${PST.escapeHtml(t("baseForm", entry.lemma))}${entry.original !== entry.lemma ? ` · ${PST.escapeHtml(t("currentForm", entry.original))}` : ""}</p>
        ${entry.definition ? `<p class="word-tooltip__definition">${PST.escapeHtml(entry.definition)}</p>` : ""}
        ${addAction}
      `;
      this.positionTooltip(wordNode);
    }

    positionTooltip(wordNode) {
      const tooltip = this.shadow.querySelector(".word-tooltip");
      const areaRect = this.shadow.querySelector(".cue-area").getBoundingClientRect();
      const rect = wordNode.getBoundingClientRect();
      const width = Math.min(292, window.innerWidth - 24);
      const height = Math.max(tooltip.offsetHeight, 154);
      const minimumLeft = Math.max(12, areaRect.left + 12);
      const maximumLeft = Math.max(minimumLeft, Math.min(window.innerWidth - width - 12, areaRect.right - width - 12));
      let left = rect.left + (rect.width / 2) - (width / 2);
      left = Math.max(minimumLeft, Math.min(maximumLeft, left));
      let top = rect.top - height - 14;
      if (top < 12) top = Math.min(window.innerHeight - height - 12, rect.bottom + 14);
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      this.positionTooltipBridge(wordNode, tooltip);
    }

    positionTooltipBridge(wordNode, tooltip) {
      const bridge = this.shadow.querySelector(".word-tooltip-bridge");
      const wordRect = wordNode.getBoundingClientRect();
      const tooltipLeft = Number.parseFloat(tooltip.style.left) || 0;
      const tooltipTop = Number.parseFloat(tooltip.style.top) || 0;
      const tooltipRect = {
        top: tooltipTop,
        right: tooltipLeft + tooltip.offsetWidth,
        bottom: tooltipTop + tooltip.offsetHeight,
        left: tooltipLeft,
      };
      let top;
      let bottom;
      let points;

      if (tooltipRect.bottom <= wordRect.top) {
        top = tooltipRect.bottom - 1;
        bottom = wordRect.bottom + 1;
        points = [
          [tooltipRect.left, top],
          [tooltipRect.right, top],
          [wordRect.right, bottom],
          [wordRect.left, bottom],
        ];
      } else if (wordRect.bottom <= tooltipRect.top) {
        top = wordRect.top - 1;
        bottom = tooltipRect.top + 1;
        points = [
          [wordRect.left, top],
          [wordRect.right, top],
          [tooltipRect.right, bottom],
          [tooltipRect.left, bottom],
        ];
      } else {
        bridge.dataset.open = "false";
        return;
      }

      const left = Math.min(...points.map(([x]) => x));
      const right = Math.max(...points.map(([x]) => x));
      bridge.style.left = `${left}px`;
      bridge.style.top = `${top}px`;
      bridge.style.width = `${Math.max(1, right - left)}px`;
      bridge.style.height = `${Math.max(1, bottom - top)}px`;
      bridge.style.clipPath = `polygon(${points.map(([x, y]) => `${x - left}px ${y - top}px`).join(", ")})`;
      bridge.dataset.open = "true";
    }

    scheduleHideTooltip() {
      clearTimeout(this.hideTooltipTimer);
      this.hideTooltipTimer = window.setTimeout(() => {
        this.shadow.querySelector(".word-tooltip").dataset.open = "false";
        this.shadow.querySelector(".word-tooltip-bridge").dataset.open = "false";
      }, 180);
    }

    showVocabularyResult({ state, lemma, error = "" }) {
      if (lemma && this.currentWordEntry?.lemma !== lemma) return;
      const action = this.shadow.querySelector(".word-tooltip [data-add-word]");
      if (!action) return;
      action.dataset.state = state;
      action.disabled = state === "pending" || state === "success";
      action.title = state === "error" ? error : "";
      if (state === "pending") action.textContent = t("addingWord");
      else if (state === "success") action.textContent = t("addedWord");
      else if (state === "error") action.textContent = t("retryAddWord");
      else action.textContent = t("addToWordBank");
    }

    seekTo(time, { play = true } = {}) {
      this.bindPlayer();
      if (!this.video) return;
      const duration = Number.isFinite(this.video.duration) ? this.video.duration : Number.POSITIVE_INFINITY;
      this.video.currentTime = Math.max(0, Math.min(Number(time) || 0, duration));
      this.activeCue = PST.LearningModeCore.cueAt(this.cues, this.video.currentTime);
      if (play) this.video.play().catch(() => undefined);
      this.handleTimeUpdate();
    }

    syncPlayerState() {
      if (!this.shadow) return;
      const area = this.shadow.querySelector(".cue-area");
      const progress = this.shadow.querySelector(".progress");
      const currentTime = Number(this.video?.currentTime) || 0;
      const duration = Number.isFinite(this.video?.duration) ? this.video.duration : 0;
      const connected = Boolean(this.video);
      const playing = connected && !this.video.paused && !this.video.ended;
      area.dataset.playing = String(playing);
      area.dataset.muted = String(Boolean(this.video?.muted));
      progress.max = String(duration);
      progress.value = String(Math.min(duration || 0, currentTime));
      progress.disabled = !duration;
      progress.style.setProperty("--progress", `${duration ? Math.min(100, (currentTime / duration) * 100) : 0}%`);
      this.shadow.querySelector(".current-time").textContent = PST.LearningModeCore.formatTimestamp(currentTime);
      this.shadow.querySelector(".duration").textContent = PST.LearningModeCore.formatTimestamp(duration);
      const playToggle = this.shadow.querySelector(".play-toggle");
      playToggle.disabled = !connected;
      playToggle.setAttribute("aria-label", playing ? "暂停" : "播放");
      const playbackRate = this.video?.playbackRate || 1;
      const rateToggle = this.shadow.querySelector(".rate");
      rateToggle.querySelector("span").textContent = `${playbackRate}×`;
      rateToggle.setAttribute("aria-label", `播放速度，当前 ${playbackRate} 倍`);
      rateToggle.disabled = !connected;
      for (const option of this.shadow.querySelectorAll(".rate-option")) {
        option.disabled = !connected;
        option.setAttribute("aria-checked", String(Math.abs(Number(option.dataset.rate) - playbackRate) < 0.01));
      }
      const muteToggle = this.shadow.querySelector(".mute-toggle");
      muteToggle.disabled = !connected;
      muteToggle.setAttribute("aria-pressed", String(Boolean(this.video?.muted)));
      muteToggle.setAttribute("aria-label", this.video?.muted ? "取消静音" : "静音");
      this.shadow.querySelector(".previous-cue").disabled = !connected || !this.cues.length;
      this.shadow.querySelector(".next-cue").disabled = !connected || !this.cues.length;
    }

    async persistProgress({ manual = false, toggleStar = false } = {}) {
      const History = PST.LearningHistoryCore;
      const video = this.context?.video;
      if (!History || !video?.url || this.extensionContextInvalidated) return;
      let storage;
      try {
        if (!PST.hasExtensionContext()) {
          this.extensionContextInvalidated = true;
          clearInterval(this.historyTimer);
          this.historyTimer = 0;
          return;
        }
        storage = chrome.storage?.local;
      } catch (error) {
        if (isExtensionContextInvalidated(error)) {
          this.handleAsyncError(error, "扩展上下文已失效");
          return;
        }
        throw error;
      }
      if (!storage) return;
      const now = Date.now();
      const currentTime = Number(this.video?.currentTime ?? video.currentTime) || 0;
      const duration = Number.isFinite(this.video?.duration) && this.video.duration > 0
        ? this.video.duration
        : Number(video.duration) || 0;
      const playing = Boolean(this.video && !this.video.paused && !this.video.ended);
      const elapsed = playing ? Math.min(30, Math.max(0, (now - this.historyTickAt) / 1000)) : 0;
      this.historyTickAt = now;
      let stored;
      try {
        stored = await storage.get({ [History.STORAGE_KEY]: [] });
      } catch (error) {
        if (isExtensionContextInvalidated(error)) {
          this.handleAsyncError(error, "扩展上下文已失效");
          return;
        }
        throw error;
      }
      const history = History.normalizeHistory(stored[History.STORAGE_KEY]);
      const existing = History.findRecord(history, video);
      if (!manual && existing && !playing && Math.abs(currentTime - this.lastPersistedTime) < .5) {
        this.syncArchiveButton(existing);
        return;
      }
      const record = History.buildRecord({
        video,
        currentTime,
        duration,
        existing,
        manual,
        starred: toggleStar ? !existing?.starred : existing?.starred,
        studySecondsDelta: elapsed,
        now,
      });
      if (!record.archived) {
        this.syncArchiveButton(record);
        return;
      }
      try {
        await storage.set({ [History.STORAGE_KEY]: History.upsertHistory(history, record) });
      } catch (error) {
        if (isExtensionContextInvalidated(error)) {
          this.handleAsyncError(error, "扩展上下文已失效");
          return;
        }
        throw error;
      }
      this.lastPersistedTime = currentTime;
      this.syncArchiveButton(record);
    }

    syncArchiveButton(record) {
      const button = this.shadow?.querySelector(".archive-button");
      if (!button) return;
      const starred = Boolean(record?.starred);
      button.setAttribute("aria-pressed", String(starred));
      button.setAttribute("aria-label", starred ? "取消星标，保留学习记录" : "星标并加入学习档案");
      button.title = starred ? "取消星标，学习记录仍会保留" : "星标并加入学习档案";
    }

    async refresh() {
      const context = await this.getContext();
      if (!context?.ok || !this.shadow) return;
      this.context = context;
      this.cues = context.cues || [];
      this.displayCues = context.displayCues || this.cues;
      this.shadow.querySelector(".heading h1").textContent = context.video?.title || `${this.siteAdapter?.name || "Video"} 视频`;
      this.shadow.querySelector(".heading p").textContent = context.video?.author || this.siteAdapter?.name || "Video";
      this.syncPlayerState();
      this.syncCue();
      if (!this.historyInitialized) {
        this.historyInitialized = true;
        this.persistProgress().catch((error) => this.handleAsyncError(error, "保存学习进度失败"));
      }
    }

    syncCue() {
      if (!this.shadow) return;
      const time = Number(this.video?.currentTime) || 0;
      const semanticCue = PST.LearningModeCore.cueAt(this.cues, time);
      const displayCue = PST.LearningModeCore.cueAt(this.displayCues, time);
      const cue = semanticCue || displayCue;
      const settings = this.getSettings?.() || {};
      const cueKey = [
        cue?.start ?? "",
        cue?.text || "",
        Boolean(this.dictionary && settings.enabled !== false && settings.hoverDictionary),
      ].join("\u0000");
      if (cueKey !== this.renderedCueKey) {
        this.renderedCueKey = cueKey;
        this.renderCurrentCue(cue);
      }
      this.activeCue = cue;
    }

    exit() {
      const url = new URL(location.href);
      url.searchParams.delete("engram_learning");
      location.assign(url.toString());
    }

    destroy() {
      clearInterval(this.refreshTimer);
      clearInterval(this.historyTimer);
      this.persistProgress().catch(() => undefined);
      clearTimeout(this.hideTooltipTimer);
      clearTimeout(this.lookupDelayTimer);
      clearTimeout(this.subtitleHoverTimer);
      this.lookupToken += 1;
      this.observer?.disconnect();
      this.unbindPlayerEvents();
      window.removeEventListener("resize", this.handleViewportResize);
      if (this.playerLayoutFrame) cancelAnimationFrame(this.playerLayoutFrame);
      this.playerLayoutFrame = 0;
      document.documentElement.classList.remove("pst-learning-mode", "pst-learning-panel-collapsed", "pst-learning-panel-resizing");
      delete document.documentElement.dataset.engramLearningSite;
      document.documentElement.style.removeProperty("--engram-learning-panel-width");
      if (this.overlay?.host) this.overlay.host.style.removeProperty("display");
      this.frame?.remove();
      this.host?.remove();
      this.host = null;
    }
  }

  PST.VideoLearningWorkspace = VideoLearningWorkspace;
  PST.YouTubeLearningWorkspace = VideoLearningWorkspace;
})();
