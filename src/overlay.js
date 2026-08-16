(() => {
  const PST = globalThis.ParamountSubtitles;
  const t = (key, substitutions) => PST.t?.(key, substitutions) || key;

  const POS_LABELS = Object.freeze({
    noun: "n.", verb: "v.", adjective: "adj.", adverb: "adv.",
    pronoun: "pron.", preposition: "prep.", conjunction: "conj.",
    interjection: "int.", word: "word",
  });
  const HOVER_LOOKUP_DELAY_MS = 300;

  const STYLES = `
    :host {
      --pst-accent: #ff685d;
      --pst-text: #f8fbff;
      --pst-muted: #9bb1ca;
      --pst-surface: rgba(4, 13, 23, 0.92);
      --pst-border: rgba(139, 164, 192, 0.38);
      --pst-font-size: 28px;
      --pst-bg-opacity: 0.45;
      --pst-bottom: 13%;
      all: initial;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483646;
      display: block;
      pointer-events: none;
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; }
    .stage {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }
    .subtitles {
      position: absolute;
      left: 50%;
      bottom: var(--pst-bottom);
      width: max-content;
      max-width: min(88%, 1180px);
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      color: var(--pst-text);
      text-align: center;
      text-wrap: balance;
      pointer-events: none;
      transition: bottom 160ms ease, opacity 160ms ease;
    }
    .caption-shell {
      position: relative;
      max-width: 100%;
      padding: 10px 24px 11px;
      border: 1px solid rgba(117, 144, 174, 0.13);
      border-radius: 11px;
      background: rgba(2, 8, 15, var(--pst-bg-opacity));
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
      backdrop-filter: blur(2px);
      cursor: grab;
      pointer-events: auto;
      touch-action: none;
      user-select: none;
    }
    .caption-shell::before, .status::after {
      content: "⋮⋮";
      position: absolute;
      color: rgba(179, 199, 220, 0.72);
      font: 700 9px/1 inherit;
      letter-spacing: -2px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 120ms ease;
    }
    .caption-shell::before { top: 4px; right: 7px; }
    .caption-shell:hover::before, .status:hover::after { opacity: 1; }
    .subtitles[data-dragging="true"] .caption-shell,
    .status[data-dragging="true"] { cursor: grabbing; }
    .caption-shell[hidden] {
      display: none;
    }
    .rewind-button {
      position: absolute;
      left: 3px;
      bottom: calc(100% + 4px);
      display: inline-flex;
      min-height: 27px;
      align-items: center;
      gap: 6px;
      padding: 0 8px;
      border: 1px solid rgba(126, 156, 190, 0.24);
      border-radius: 6px;
      background: rgba(5, 15, 27, 0.68);
      color: rgba(220, 232, 245, 0.82);
      font: 590 10px/1 inherit;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      cursor: pointer;
      transform: translateY(3px);
      transition: opacity 120ms ease, visibility 120ms ease, transform 120ms ease,
        background 120ms ease, border-color 120ms ease;
    }
    .subtitles[data-hovered="true"] .rewind-button {
      opacity: 0.68;
      visibility: visible;
      pointer-events: auto;
      transform: translateY(0);
    }
    .rewind-button:hover, .rewind-button:focus-visible {
      border-color: rgba(126, 156, 190, 0.52);
      background: rgba(7, 19, 32, 0.92);
      opacity: 1;
      outline: none;
    }
    .rewind-button[hidden] { display: none; }
    .rewind-button kbd {
      min-width: 16px;
      padding: 2px 4px;
      border: 1px solid rgba(126, 156, 190, 0.28);
      border-radius: 4px;
      color: var(--pst-muted);
      font: 600 9px/1 inherit;
      text-align: center;
    }
    .english, .chinese {
      margin: 0;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
      letter-spacing: 0.005em;
    }
    .english {
      color: var(--pst-text);
      font-size: var(--pst-font-size);
      font-weight: 650;
      line-height: 1.28;
    }
    .english[data-learning="true"] {
      margin-bottom: calc(var(--pst-font-size) * 0.42);
    }
    .chinese {
      margin-top: 4px;
      min-height: 1.34em;
      color: #ff8177;
      font-size: calc(var(--pst-font-size) * 0.82);
      font-weight: 560;
      line-height: 1.34;
    }
    .chinese:empty { visibility: hidden; }
    .word {
      position: relative;
      display: inline;
      border-radius: 3px;
      pointer-events: auto;
      cursor: help;
      transition: color 120ms ease, background 120ms ease;
    }
    .word:hover, .word:focus-visible {
      color: #ff8177;
      background: rgba(255, 104, 93, 0.08);
      outline: none;
    }
    .word:hover::after, .word:focus-visible::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: -4px;
      height: 2px;
      border-radius: 2px;
      background: var(--pst-accent);
    }
    .word--learning {
      display: inline;
      margin: 0;
      padding: 0 0.03em 0.02em;
      border-radius: 2px;
      background: rgba(143, 183, 235, 0.06);
      box-shadow: inset 0 -1px 0 rgba(143, 183, 235, 0.78);
      color: inherit;
      line-height: inherit;
      vertical-align: baseline;
    }
    .word--learning:hover, .word--learning:focus-visible {
      background: rgba(143, 183, 235, 0.1);
      color: #e8f2ff;
    }
    .word--learning:hover::after, .word--learning:focus-visible::after { display: none; }
    .word__text { line-height: inherit; }
    .word__gloss {
      display: block;
      position: absolute;
      top: calc(100% + 3px);
      left: 50%;
      max-width: 9em;
      overflow: hidden;
      color: rgba(190, 209, 229, 0.82);
      font-size: 0.33em;
      font-weight: 610;
      letter-spacing: 0.02em;
      line-height: 1;
      pointer-events: none;
      text-overflow: ellipsis;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
      transform: translateX(-50%);
      white-space: nowrap;
    }
    .tooltip {
      position: fixed;
      z-index: 3;
      width: min(270px, calc(100vw - 24px));
      padding: 15px 16px 13px;
      border: 1px solid rgba(126, 156, 190, 0.72);
      border-radius: 10px;
      background: rgba(7, 18, 31, 0.98);
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.46);
      color: var(--pst-text);
      pointer-events: none;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 120ms ease, transform 120ms ease;
    }
    .tooltip[data-open="true"] { opacity: 1; pointer-events: auto; transform: translateY(0); }
    .tooltip__word { margin: 0; font-size: 23px; font-weight: 720; line-height: 1.15; }
    .tooltip__phonetic { margin: 5px 0 0; color: var(--pst-muted); font-size: 14px; line-height: 1.4; }
    .tooltip__phrase { margin: 8px 0 0; color: #8fb7eb; font-size: 12px; line-height: 1.4; }
    .tooltip__meaning { margin: 12px 0 0; font-size: 15px; line-height: 1.48; }
    .tooltip__lemma {
      margin: 11px 0 0;
      padding-top: 10px;
      border-top: 1px dashed rgba(130, 157, 188, 0.34);
      color: #8fb7eb;
      font-size: 13px;
      line-height: 1.4;
    }
    .tooltip__definition {
      display: -webkit-box;
      margin: 7px 0 0;
      overflow: hidden;
      color: var(--pst-muted);
      font-size: 12px;
      line-height: 1.45;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .tooltip__action {
      width: 100%;
      margin: 11px 0 -3px;
      padding: 9px 0 2px;
      border: 0;
      border-top: 1px solid rgba(130, 157, 188, 0.24);
      background: transparent;
      color: #8fb7eb;
      font: 600 13px/1.4 inherit;
      text-align: left;
      cursor: pointer;
    }
    .tooltip__action:hover, .tooltip__action:focus-visible { color: #c7ddf7; outline: none; }
    .tooltip__action:disabled { cursor: default; opacity: 1; }
    .tooltip__action[data-state="pending"] { color: var(--pst-muted); }
    .tooltip__action[data-state="success"] { color: #75d58d; }
    .tooltip__action[data-state="error"] { color: #ff8177; cursor: pointer; }
    .status {
      position: absolute;
      top: 14px;
      right: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: min(310px, calc(100% - 28px));
      padding: 5px 8px;
      border: 1px solid rgba(126, 156, 190, 0.24);
      border-radius: 6px;
      background: rgba(5, 15, 27, 0.74);
      box-shadow: 0 5px 16px rgba(0, 0, 0, 0.2);
      color: rgba(220, 232, 245, 0.84);
      font: 540 10px/1.3 inherit;
      pointer-events: none;
      opacity: 0;
      cursor: grab;
      touch-action: none;
      user-select: none;
      transition: opacity 160ms ease, background 120ms ease;
    }
    .status[data-open="true"] { opacity: 0.82; pointer-events: auto; }
    .status[data-open="true"]:hover, .status[data-open="true"]:focus-visible {
      background: rgba(5, 15, 27, 0.9);
      opacity: 1;
      outline: none;
    }
    .status::after { top: 2px; right: 4px; transform: rotate(90deg); }
    .status__dot { width: 6px; height: 6px; flex: 0 0 6px; border-radius: 50%; background: #51b66d; }
    .status__text { white-space: nowrap; }
    .status[data-tone="warn"] .status__dot { background: #ffb54a; }
    .status[data-tone="error"] .status__dot { background: #ff685d; }
    .status__progress {
      position: absolute;
      left: 0;
      bottom: -1px;
      width: var(--pst-progress, 0%);
      height: 2px;
      border-radius: 0 0 8px 8px;
      background: var(--pst-accent);
    }
    :host([data-disabled="true"]) .subtitles { opacity: 0; }
    :host([data-player-visible="false"]) { display: none; }
    :host([data-disabled="true"]) .rewind-button { pointer-events: none; }
    :host([data-mode="chinese"]) .english { display: none; }
    :host([data-mode="english"]) .chinese { display: none; }
    @media (max-width: 760px) {
      .subtitles { max-width: 94%; }
      .caption-shell { padding: 8px 14px 9px; border-radius: 8px; }
      .english { font-size: min(var(--pst-font-size), 24px); }
      .chinese { font-size: min(calc(var(--pst-font-size) * 0.82), 20px); }
      .rewind-button kbd { display: none; }
      .status { top: 8px; right: 8px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { transition: none !important; }
    }
  `;

  class SubtitleOverlay extends EventTarget {
    constructor(dictionary) {
      super();
      this.dictionary = dictionary;
      this.settings = { ...PST.DEFAULT_SETTINGS };
      this.host = document.createElement("paramount-subtitle-overlay");
      this.host.dataset.pstRoot = "true";
      this.host.dataset.playerVisible = "false";
      this.shadow = this.host.attachShadow({ mode: "open" });
      this.shadow.innerHTML = `
        <style>${STYLES}</style>
        <div class="stage">
          <div class="status" role="status" aria-live="polite" tabindex="0">
            <span class="status__dot"></span>
            <span class="status__text"></span>
            <span class="status__progress"></span>
          </div>
          <div class="tooltip" role="dialog"></div>
          <div class="subtitles" aria-live="polite">
            <button class="rewind-button" type="button" hidden>
              <span class="rewind-button__label"></span>
              <kbd>←</kbd>
            </button>
            <div class="caption-shell" role="group" tabindex="0" hidden>
              <p class="english" lang="en"></p>
              <p class="chinese" lang="zh-CN"></p>
            </div>
          </div>
        </div>
      `;
      this.english = this.shadow.querySelector(".english");
      this.chinese = this.shadow.querySelector(".chinese");
      this.captionShell = this.shadow.querySelector(".caption-shell");
      this.subtitles = this.shadow.querySelector(".subtitles");
      this.rewindButton = this.shadow.querySelector(".rewind-button");
      this.rewindLabel = this.shadow.querySelector(".rewind-button__label");
      this.tooltip = this.shadow.querySelector(".tooltip");
      this.statusNode = this.shadow.querySelector(".status");
      this.statusText = this.shadow.querySelector(".status__text");
      this.hideTooltipTimer = 0;
      this.lookupDelayTimer = 0;
      this.pendingLookupNode = null;
      this.lookupToken = 0;
      this.englishRenderKey = "";
      this.currentWordEntry = null;
      this.currentCueText = "";
      this.lookupContext = [];
      this.suppressStatusClickUntil = 0;
      this.lastStatus = { message: "", open: false };
      this.rewindFeedbackTimer = 0;
      this.subtitleHoverTimer = 0;
      this.subtitleHoverActive = false;
      this.boundsSignature = "";
      this.boundsTimer = 0;
      this.localizeStaticUi();

      for (const node of [this.captionShell, this.rewindButton, this.tooltip]) {
        node.addEventListener("mouseenter", () => this.enterSubtitleInteraction());
        node.addEventListener("mouseleave", () => this.scheduleLeaveSubtitleInteraction());
      }

      this.rewindButton.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("cue:previous"));
      });

      this.statusNode.addEventListener("click", () => {
        if (performance.now() < this.suppressStatusClickUntil) return;
        if (this.statusNode.dataset.actionable === "true") {
          this.dispatchEvent(new CustomEvent("translator:activate"));
        }
        this.dispatchEvent(new CustomEvent("status:dismiss"));
      });
      this.statusNode.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        this.statusNode.click();
      });
      this.captionShell.addEventListener("dblclick", (event) => {
        if (event.target.closest(".word, button")) return;
        this.dispatchEvent(new CustomEvent("placement:change", {
          detail: { target: "caption", placement: null },
        }));
      });
      this.makeDraggable(this.captionShell, this.subtitles, "caption");
      this.makeDraggable(this.statusNode, this.statusNode, "status");
      this.tooltip.addEventListener("mouseenter", () => clearTimeout(this.hideTooltipTimer));
      this.tooltip.addEventListener("mouseleave", () => this.scheduleHideTooltip());
      this.tooltip.addEventListener("click", (event) => {
        if (event.target.closest("[data-add-word]") && this.currentWordEntry) {
          this.showVocabularyResult({ state: "pending", lemma: this.currentWordEntry.lemma });
          this.dispatchEvent(new CustomEvent("vocabulary:add", { detail: this.currentWordEntry }));
        }
      });
      for (const type of ["pointerdown", "pointerup", "click", "dblclick"]) {
        this.shadow.addEventListener(type, (event) => {
          if (event.target.closest("button")) event.stopPropagation();
        });
      }
      document.addEventListener("fullscreenchange", () => this.mount(), true);
      window.addEventListener("resize", () => {
        this.syncPlayerBounds();
        this.applyPlacements();
      }, { passive: true });
      window.addEventListener("scroll", () => this.syncPlayerBounds(), { passive: true });
    }

    mount() {
      const target = document.fullscreenElement || document.documentElement;
      if (target && this.host.parentElement !== target) target.appendChild(this.host);
      this.syncPlayerBounds();
      if (!this.boundsTimer) this.boundsTimer = setInterval(() => this.syncPlayerBounds(), 250);
      requestAnimationFrame(() => this.applyPlacements());
    }

    playbackRect() {
      const candidates = [...document.querySelectorAll("video")]
        .map((video) => ({ video, rect: video.getBoundingClientRect() }))
        .filter(({ video, rect }) => (
          !video.hidden
          && rect.width > 300
          && rect.height > 150
          && rect.bottom > 0
          && rect.right > 0
          && rect.top < window.innerHeight
          && rect.left < window.innerWidth
        ))
        .sort((left, right) => (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height));
      if (candidates[0]?.rect) return candidates[0].rect;
      const previewPlayer = document.querySelector("[data-pst-player]");
      if (!previewPlayer) return null;
      const previewRect = previewPlayer.getBoundingClientRect();
      if (
        previewRect.width <= 300
        || previewRect.height <= 150
        || previewRect.bottom <= 0
        || previewRect.right <= 0
        || previewRect.top >= window.innerHeight
        || previewRect.left >= window.innerWidth
      ) return null;
      return previewRect;
    }

    syncPlayerBounds() {
      const rect = this.playbackRect();
      if (!rect) {
        this.host.dataset.playerVisible = "false";
        this.boundsSignature = "";
        return;
      }
      this.host.dataset.playerVisible = "true";
      const bounds = {
        left: Math.max(0, rect.left),
        top: Math.max(0, rect.top),
        width: Math.max(1, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left)),
        height: Math.max(1, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top)),
      };
      const signature = [bounds.left, bounds.top, bounds.width, bounds.height]
        .map((value) => Math.round(value * 10) / 10)
        .join(":");
      if (signature === this.boundsSignature) return;
      this.boundsSignature = signature;
      this.host.style.left = `${bounds.left}px`;
      this.host.style.top = `${bounds.top}px`;
      this.host.style.width = `${bounds.width}px`;
      this.host.style.height = `${bounds.height}px`;
      this.applyPlacements();
    }

    updateSettings(settings) {
      this.settings = { ...this.settings, ...settings };
      PST.setUiLanguage(this.settings.uiLanguage);
      this.localizeStaticUi();
      this.host.dataset.disabled = String(!this.settings.enabled);
      this.host.dataset.mode = this.settings.mode;
      this.host.dataset.learningHints = String(Boolean(this.settings.learningHints));
      this.host.style.setProperty("--pst-font-size", `${this.settings.fontSize}px`);
      this.host.style.setProperty("--pst-bg-opacity", String(this.settings.backgroundOpacity));
      this.host.style.setProperty("--pst-bottom", `${this.settings.position}%`);
      this.applyPlacements();
      this.setStatus(this.lastStatus);
    }

    localizeStaticUi() {
      this.statusNode?.setAttribute("title", t("moveStatusTitle"));
      this.tooltip?.setAttribute("aria-label", t("wordDefinition"));
      this.rewindButton?.setAttribute("aria-label", t("previousSubtitleAria"));
      this.rewindButton?.setAttribute("title", t("previousSubtitleTitle"));
      this.captionShell?.setAttribute("aria-label", t("movableBilingualSubtitles"));
      this.captionShell?.setAttribute("title", t("movableSubtitleTitle"));
      if (this.rewindLabel && !this.rewindFeedbackTimer) this.rewindLabel.textContent = t("previousSubtitle");
    }

    applyPlacements() {
      this.applyPlacement(this.subtitles, this.settings.captionPlacement, "caption");
      this.applyPlacement(this.statusNode, this.settings.statusPlacement, "status");
    }

    applyPlacement(node, placement, target) {
      if (!node) return;
      const handle = target === "caption" ? this.captionShell : this.statusNode;
      if (!placement || !Number.isFinite(placement.x) || !Number.isFinite(placement.y)) {
        node.style.removeProperty("left");
        node.style.removeProperty("top");
        node.style.removeProperty("right");
        node.style.removeProperty("bottom");
        node.style.removeProperty("transform");
        delete handle.dataset.placement;
        return;
      }
      const rect = node.getBoundingClientRect();
      const hostRect = this.host.getBoundingClientRect();
      const viewportWidth = Math.max(hostRect.width, 1);
      const viewportHeight = Math.max(hostRect.height, 1);
      const minX = Math.min(0.5, ((rect.width / 2) + 8) / viewportWidth);
      const minY = Math.min(0.5, ((rect.height / 2) + 8) / viewportHeight);
      const x = Math.max(minX, Math.min(1 - minX, placement.x));
      const y = Math.max(minY, Math.min(1 - minY, placement.y));
      node.style.left = `${x * 100}%`;
      node.style.top = `${y * 100}%`;
      node.style.right = "auto";
      node.style.bottom = "auto";
      node.style.transform = "translate(-50%, -50%)";
      handle.dataset.placement = `${x.toFixed(4)},${y.toFixed(4)}`;
      if (target === "caption") this.host.dataset.captionMoved = "true";
    }

    makeDraggable(handle, node, target) {
      let drag = null;
      handle.addEventListener("keydown", (event) => {
        const movement = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        }[event.key];
        if (!movement) return;
        event.preventDefault();
        const rect = node.getBoundingClientRect();
        const step = event.shiftKey ? 32 : 12;
        const hostRect = this.host.getBoundingClientRect();
        const viewportWidth = Math.max(hostRect.width, 1);
        const viewportHeight = Math.max(hostRect.height, 1);
        const localLeft = rect.left - hostRect.left;
        const localTop = rect.top - hostRect.top;
        const centerX = Math.max(
          (rect.width / 2) + 8,
          Math.min(viewportWidth - (rect.width / 2) - 8, localLeft + (rect.width / 2) + (movement[0] * step)),
        );
        const centerY = Math.max(
          (rect.height / 2) + 8,
          Math.min(viewportHeight - (rect.height / 2) - 8, localTop + (rect.height / 2) + (movement[1] * step)),
        );
        const placement = { x: centerX / viewportWidth, y: centerY / viewportHeight };
        this.applyPlacement(node, placement, target);
        this.dispatchEvent(new CustomEvent("placement:change", {
          detail: { target, placement },
        }));
      });
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target.closest(".word, button")) return;
        const rect = node.getBoundingClientRect();
        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          offsetX: event.clientX - (rect.left + (rect.width / 2)),
          offsetY: event.clientY - (rect.top + (rect.height / 2)),
          width: rect.width,
          height: rect.height,
          moved: false,
          placement: null,
        };
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (!drag.moved && distance < 4) return;
        drag.moved = true;
        node.dataset.dragging = "true";
        event.preventDefault();
        const hostRect = this.host.getBoundingClientRect();
        const viewportWidth = Math.max(hostRect.width, 1);
        const viewportHeight = Math.max(hostRect.height, 1);
        const centerX = Math.max(
          (drag.width / 2) + 8,
          Math.min(viewportWidth - (drag.width / 2) - 8, event.clientX - hostRect.left - drag.offsetX),
        );
        const centerY = Math.max(
          (drag.height / 2) + 8,
          Math.min(viewportHeight - (drag.height / 2) - 8, event.clientY - hostRect.top - drag.offsetY),
        );
        drag.placement = { x: centerX / viewportWidth, y: centerY / viewportHeight };
        this.applyPlacement(node, drag.placement, target);
      });
      const finish = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        node.dataset.dragging = "false";
        if (drag.moved && drag.placement) {
          if (target === "status") this.suppressStatusClickUntil = performance.now() + 350;
          this.dispatchEvent(new CustomEvent("placement:change", {
            detail: { target, placement: drag.placement },
          }));
        }
        drag = null;
      };
      handle.addEventListener("pointerup", finish);
      handle.addEventListener("pointercancel", finish);
    }

    setCue(cue) {
      const english = PST.normalizeSubtitle(cue?.text);
      const chinese = PST.normalizeSubtitle(cue?.translation);
      this.currentCueText = english;
      this.lookupContext = (Array.isArray(cue?.context) ? cue.context : [])
        .map((line) => PST.normalizeSubtitle(line))
        .filter(Boolean)
        .slice(-4);
      const hasCue = Boolean(english || chinese);
      const renderKey = `${english}\u0000${Boolean(this.settings.hoverDictionary)}`;
      if (renderKey !== this.englishRenderKey) {
        this.cancelScheduledLookup();
        this.englishRenderKey = renderKey;
        this.renderEnglish(english);
      }
      if (Array.isArray(cue?.wordHints)) this.setLearningHints(cue.wordHints);
      this.chinese.textContent = chinese;
      this.captionShell.hidden = !hasCue;
      this.rewindButton.hidden = !hasCue;
      if (!hasCue) {
        this.tooltip.dataset.open = "false";
        this.leaveSubtitleInteraction();
      }
      if (cue?.source) this.host.dataset.source = cue.source;
    }

    clearCue() {
      this.setCue({ text: "", translation: "" });
    }

    enterSubtitleInteraction() {
      clearTimeout(this.subtitleHoverTimer);
      this.subtitles.dataset.hovered = "true";
      if (!this.settings.enabled || !this.settings.hoverDictionary) return;
      if (this.subtitleHoverActive) return;
      this.subtitleHoverActive = true;
      this.dispatchEvent(new CustomEvent("playback:hover", {
        detail: { active: true },
      }));
    }

    scheduleLeaveSubtitleInteraction() {
      clearTimeout(this.subtitleHoverTimer);
      this.subtitleHoverTimer = setTimeout(() => {
        const nodes = [this.captionShell, this.rewindButton, this.tooltip];
        if (nodes.some((node) => node.matches(":hover"))) return;
        this.leaveSubtitleInteraction();
      }, 90);
    }

    leaveSubtitleInteraction() {
      clearTimeout(this.subtitleHoverTimer);
      delete this.subtitles.dataset.hovered;
      if (!this.subtitleHoverActive) return;
      this.subtitleHoverActive = false;
      this.dispatchEvent(new CustomEvent("playback:hover", {
        detail: { active: false },
      }));
    }

    showRewindResult(result) {
      clearTimeout(this.rewindFeedbackTimer);
      if (!result?.ok) {
        this.rewindLabel.textContent = result?.error || t("cannotRewind");
      } else if (result.usedCue) {
        this.rewindLabel.textContent = t("rewoundPrevious");
      } else {
        this.rewindLabel.textContent = t("rewoundSeconds", Math.max(1, Math.round(result.secondsBack || 0)));
      }
      this.rewindFeedbackTimer = setTimeout(() => {
        this.rewindLabel.textContent = t("previousSubtitle");
      }, 1400);
    }

    renderEnglish(text) {
      this.english.replaceChildren();
      const matcher = /([A-Za-z]+(?:['’-][A-Za-z]+)*)/g;
      let lastIndex = 0;
      for (const match of text.matchAll(matcher)) {
        if (match.index > lastIndex) {
          this.english.append(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const word = document.createElement("span");
        word.className = "word";
        word.textContent = match[0];
        word.tabIndex = this.settings.hoverDictionary ? 0 : -1;
        word.dataset.word = match[0];
        if (this.settings.hoverDictionary) {
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
        }
        this.english.append(word);
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) {
        this.english.append(document.createTextNode(text.slice(lastIndex)));
      }
    }

    setLearningHints(entries) {
      const words = [...this.english.querySelectorAll(".word")];
      delete this.english.dataset.learning;
      for (const word of words) {
        word.classList.remove("word--learning");
        word.replaceChildren(document.createTextNode(word.dataset.word || word.textContent || ""));
        word.removeAttribute("aria-label");
      }
      if (!this.settings.learningHints || this.settings.mode === "chinese") return;

      const byOriginal = new Map((entries || []).map((entry) => [
        String(entry?.original || "").toLowerCase().replace(/[^a-z'-]/g, ""),
        entry,
      ]));
      for (const word of words) {
        const original = word.dataset.word || "";
        const normalized = original.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z'-]/g, "");
        const entry = byOriginal.get(normalized);
        const gloss = this.compactGloss(entry?.gloss);
        if (!entry || !gloss) continue;

        const text = document.createElement("span");
        text.className = "word__text";
        text.textContent = original;
        const hint = document.createElement("small");
        hint.className = "word__gloss";
        hint.lang = "zh-CN";
        hint.textContent = gloss;
        word.replaceChildren(text, hint);
        word.classList.add("word--learning");
        word.setAttribute("aria-label", `${original}，${gloss}`);
        this.english.dataset.learning = "true";
      }
    }

    compactGloss(value) {
      const clean = PST.normalizeSubtitle(value);
      if (!clean) return "";
      const firstMeaning = clean.split(/[；;。]/, 1)[0].trim();
      const characters = [...firstMeaning];
      return characters.length > 10 ? `${characters.slice(0, 10).join("")}…` : firstMeaning;
    }

    scheduleLookupWord(wordNode) {
      clearTimeout(this.lookupDelayTimer);
      const token = ++this.lookupToken;
      this.pendingLookupNode = wordNode;
      this.lookupDelayTimer = setTimeout(() => {
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
      if (!this.settings.hoverDictionary) return;
      clearTimeout(this.hideTooltipTimer);
      const original = wordNode.dataset.word;
      this.currentWordEntry = null;
      this.tooltip.innerHTML = `
        <p class="tooltip__word">${PST.escapeHtml(original)}</p>
        <p class="tooltip__phonetic">${PST.escapeHtml(t("lookingUp"))}</p>
      `;
      this.positionTooltip(wordNode);
      this.tooltip.dataset.open = "true";

      const entry = await this.dictionary.lookup(original, this.settings, {
        sentence: this.currentCueText,
        context: this.lookupContext,
      });
      if (token !== this.lookupToken || !entry) return;
      this.currentWordEntry = entry;
      const pos = POS_LABELS[entry.partOfSpeech] || entry.partOfSpeech || "word";
      const phrase = entry.phrase && entry.phrase.toLowerCase() !== original.toLowerCase()
        ? `<p class="tooltip__phrase">${PST.escapeHtml(t("contextPhrase", entry.phrase))}</p>`
        : "";
      this.tooltip.innerHTML = `
        <p class="tooltip__word">${PST.escapeHtml(original)}</p>
        <p class="tooltip__phonetic">${PST.escapeHtml(entry.phonetic || t("noPhonetic"))}</p>
        ${phrase}
        <p class="tooltip__meaning">${PST.escapeHtml(pos)} ${PST.escapeHtml(entry.gloss || entry.lemma)}</p>
        <p class="tooltip__lemma">${PST.escapeHtml(t("baseForm", entry.lemma))}${entry.original !== entry.lemma ? ` · ${PST.escapeHtml(t("currentForm", entry.original))}` : ""}</p>
        ${entry.definition ? `<p class="tooltip__definition">${PST.escapeHtml(entry.definition)}</p>` : ""}
        <button class="tooltip__action" type="button" data-add-word data-state="idle" aria-live="polite">${PST.escapeHtml(t("addToWordBank"))}</button>
      `;
      this.positionTooltip(wordNode);
    }

    showVocabularyResult({ state, lemma, error = "" }) {
      if (lemma && this.currentWordEntry?.lemma !== lemma) return;
      const action = this.tooltip.querySelector("[data-add-word]");
      if (!action) return;
      action.dataset.state = state;
      action.disabled = state === "pending" || state === "success";
      action.title = state === "error" ? error : "";
      if (state === "pending") action.textContent = t("addingWord");
      else if (state === "success") action.textContent = t("addedWord");
      else if (state === "error") action.textContent = t("retryAddWord");
      else action.textContent = t("addToWordBank");
    }

    positionTooltip(wordNode) {
      const rect = wordNode.getBoundingClientRect();
      const width = 270;
      const height = Math.max(this.tooltip.offsetHeight, 154);
      let left = rect.left + (rect.width / 2) - (width / 2);
      left = Math.max(12, Math.min(window.innerWidth - width - 12, left));
      let top = rect.top - height - 16;
      if (top < 10) top = rect.bottom + 16;
      this.tooltip.style.left = `${left}px`;
      this.tooltip.style.top = `${top}px`;
    }

    scheduleHideTooltip() {
      clearTimeout(this.hideTooltipTimer);
      this.hideTooltipTimer = setTimeout(() => {
        this.tooltip.dataset.open = "false";
      }, 180);
    }

    setStatus({ message, tone = "ok", actionable = false, progress = null, open = true }) {
      this.lastStatus = { message, tone, actionable, progress, open };
      this.statusText.textContent = message || "";
      this.statusNode.dataset.open = String(Boolean(open && message && this.settings.debugToast));
      this.statusNode.dataset.tone = tone;
      this.statusNode.dataset.actionable = String(Boolean(actionable));
      this.statusNode.style.setProperty("--pst-progress", `${Math.round((progress || 0) * 100)}%`);
    }
  }

  PST.SubtitleOverlay = SubtitleOverlay;
})();
