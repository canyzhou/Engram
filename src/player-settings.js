(() => {
  const PST = globalThis.ParamountSubtitles;
  const t = (key, substitutions) => PST.t?.(key, substitutions) || key;

  const BUTTON_STYLES = `
    :host {
      all: initial;
      display: inline-flex;
      float: left;
      width: 48px;
      height: 100%;
      min-height: 48px;
      align-items: center;
      align-self: stretch;
      justify-content: center;
      margin: 0;
      padding: 0;
      vertical-align: top;
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; }
    .trigger {
      display: grid;
      width: 48px;
      height: 48px;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: #0e1114;
      cursor: pointer;
      place-items: center;
    }
    .mark {
      display: grid;
      width: 28px;
      height: 28px;
      border: 1px solid rgba(255, 255, 255, 0.48);
      border-radius: 999px;
      background: linear-gradient(145deg, #ffc45e, #ee8d20);
      box-shadow: 0 2px 9px rgba(0, 0, 0, 0.42);
      font: 800 16px/1 inherit;
      letter-spacing: -0.06em;
      place-items: center;
      transform: translateY(-4px);
      transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
    }
    .trigger:hover .mark,
    .trigger:focus-visible .mark,
    :host([data-open="true"]) .mark {
      background: linear-gradient(145deg, #ffd37f, #f09a2f);
      box-shadow: 0 3px 11px rgba(0, 0, 0, 0.46);
      transform: translateY(-4px);
    }
    .trigger:focus-visible { outline: none; }
    @media (prefers-reduced-motion: reduce) {
      .mark { transition: none; }
    }
  `;

  const PANEL_STYLES = `
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: block;
      width: 100vw;
      height: 100vh;
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      pointer-events: none;
    }
    *, *::before, *::after { box-sizing: border-box; }
    button, select, input { font: inherit; }
    .panel {
      position: fixed;
      right: var(--engram-panel-right, 12px);
      bottom: var(--engram-panel-bottom, 64px);
      width: min(338px, calc(100vw - 24px));
      max-height: min(500px, var(--engram-panel-max-height, calc(100vh - 88px)));
      overflow: auto;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 14px;
      background: rgba(22, 22, 22, 0.97);
      box-shadow: 0 20px 56px rgba(0, 0, 0, 0.62);
      color: #f7f7f7;
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px) scale(0.98);
      transform-origin: right bottom;
      visibility: hidden;
      transition: opacity 140ms ease, transform 140ms ease, visibility 140ms ease;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.24) transparent;
    }
    :host([data-open="true"]) .panel {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
      visibility: visible;
    }
    .header {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) auto auto;
      min-height: 66px;
      align-items: center;
      gap: 10px;
      padding: 12px 13px 11px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.11);
    }
    .brand {
      display: grid;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: linear-gradient(145deg, #ffc45e, #ee8d20);
      color: #151515;
      font-size: 19px;
      font-weight: 820;
      letter-spacing: -0.06em;
      place-items: center;
    }
    .heading { min-width: 0; }
    .heading strong {
      display: block;
      overflow: hidden;
      font-size: 14px;
      font-weight: 720;
      line-height: 1.25;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .heading small {
      display: block;
      margin-top: 3px;
      color: #a9a9a9;
      font-size: 11px;
      line-height: 1.2;
    }
    .close {
      display: grid;
      width: 30px;
      height: 30px;
      padding: 0;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: #a8a8a8;
      cursor: pointer;
      font-size: 21px;
      line-height: 1;
      place-items: center;
    }
    .close:hover, .close:focus-visible { background: rgba(255, 255, 255, 0.08); color: #fff; outline: none; }
    .settings {
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }
    .settings:disabled { opacity: 0.5; }
    .learning-launch {
      display: grid;
      width: calc(100% - 28px);
      min-height: 64px;
      grid-template-columns: 36px minmax(0, 1fr) 17px;
      align-items: center;
      gap: 11px;
      margin: 12px 14px;
      padding: 9px 11px;
      border: 1px solid rgba(240, 163, 58, 0.44);
      border-radius: 11px;
      background: linear-gradient(135deg, rgba(240, 163, 58, 0.12), rgba(255, 255, 255, 0.035));
      color: #f5f5f5;
      text-align: left;
      cursor: pointer;
    }
    .learning-launch:hover, .learning-launch:focus-visible {
      border-color: #f0a33a;
      background: linear-gradient(135deg, rgba(240, 163, 58, 0.19), rgba(255, 255, 255, 0.055));
      outline: none;
    }
    .learning-launch__icon {
      display: grid;
      width: 36px;
      height: 36px;
      border-radius: 9px;
      background: rgba(240, 163, 58, 0.16);
      color: #f0a33a;
      place-items: center;
    }
    .learning-launch__icon svg,
    .learning-launch__arrow {
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .learning-launch__icon svg { width: 22px; stroke-width: 1.65; }
    .learning-launch strong { display: block; font-size: 13px; font-weight: 720; line-height: 1.25; }
    .learning-launch small { display: block; margin-top: 3px; color: #9f9f9f; font-size: 9px; line-height: 1.35; }
    .learning-launch__arrow { width: 17px; color: #999; stroke-width: 1.7; }
    .row {
      display: flex;
      min-height: 50px;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.09);
    }
    .row--stacked { display: block; padding-top: 12px; padding-bottom: 12px; }
    .label { color: #dedede; font-size: 13px; font-weight: 560; line-height: 1.35; }
    .segmented {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 3px;
      margin-top: 9px;
      padding: 3px;
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.075);
    }
    .segmented button {
      min-width: 0;
      height: 31px;
      padding: 0 6px;
      overflow: hidden;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #aaa;
      cursor: pointer;
      font-size: 11px;
      font-weight: 620;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .segmented button[aria-pressed="true"] { background: #f4f4f4; color: #171717; }
    .segmented button:focus-visible { outline: 2px solid #f0a33a; outline-offset: 1px; }
    .select-wrap { position: relative; width: 154px; }
    select {
      width: 100%;
      height: 32px;
      padding: 0 30px 0 10px;
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.07);
      color: #f2f2f2;
      cursor: pointer;
      font-size: 11px;
      outline: none;
    }
    .select-wrap::after {
      content: "⌄";
      position: absolute;
      top: 5px;
      right: 10px;
      color: #aaa;
      font-size: 14px;
      pointer-events: none;
    }
    select:focus-visible { border-color: #f0a33a; box-shadow: 0 0 0 2px rgba(240, 163, 58, 0.18); }
    .stepper {
      display: grid;
      grid-template-columns: 30px 44px 30px;
      height: 30px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
    }
    .stepper button {
      padding: 0;
      border: 0;
      background: transparent;
      color: #ddd;
      cursor: pointer;
      font-size: 17px;
    }
    .stepper button:hover, .stepper button:focus-visible { background: rgba(255, 255, 255, 0.09); outline: none; }
    .stepper output {
      display: grid;
      border-right: 1px solid rgba(255, 255, 255, 0.11);
      border-left: 1px solid rgba(255, 255, 255, 0.11);
      color: #bbb;
      font-size: 11px;
      place-items: center;
    }
    .switch { display: inline-flex; position: relative; flex: 0 0 auto; cursor: pointer; }
    .switch input { position: absolute; width: 1px; height: 1px; opacity: 0; }
    .track {
      position: relative;
      display: block;
      width: 37px;
      height: 21px;
      border-radius: 999px;
      background: #4b4b4b;
      transition: background 130ms ease;
    }
    .track::after {
      content: "";
      position: absolute;
      top: 3px;
      left: 3px;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.42);
      transition: transform 130ms ease;
    }
    .switch input:checked + .track { background: #f0a33a; }
    .switch input:checked + .track::after { transform: translateX(16px); }
    .switch input:focus-visible + .track { outline: 2px solid #fff; outline-offset: 2px; }
    .footer {
      display: flex;
      min-height: 38px;
      align-items: center;
      gap: 7px;
      padding: 8px 14px;
      color: #858585;
      font-size: 10px;
      line-height: 1.25;
    }
    .footer::before { content: "✓"; color: #72c987; font-weight: 800; }
    :host([data-saving="true"]) .footer::before { content: "…"; color: #f0a33a; }
    @media (max-width: 520px) {
      .panel { width: min(318px, calc(100vw - 16px)); }
      .header { padding-inline: 10px; }
      .row { padding-inline: 11px; }
      .learning-launch { width: calc(100% - 22px); margin-inline: 11px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel, .track, .track::after { transition: none; }
    }
  `;

  class YouTubePlayerSettings {
    constructor(settingsStore, { onOpenLearningMode } = {}) {
      this.settingsStore = settingsStore;
      this.onOpenLearningMode = onOpenLearningMode;
      this.settings = { ...PST.DEFAULT_SETTINGS };
      this.open = false;
      this.attachFrame = 0;
      this.unsubscribe = null;
      this.observer = null;

      this.buttonHost = document.createElement("engram-youtube-settings-button");
      this.buttonHost.dataset.pstYoutubeSettings = "button";
      this.buttonShadow = this.buttonHost.attachShadow({ mode: "open" });
      this.buttonShadow.innerHTML = `
        <style>${BUTTON_STYLES}</style>
        <button class="trigger" type="button" aria-haspopup="dialog" aria-expanded="false">
          <span class="mark" aria-hidden="true">E</span>
        </button>
      `;

      this.panelHost = document.createElement("engram-youtube-settings-panel");
      this.panelHost.dataset.pstYoutubeSettings = "panel";
      this.panelShadow = this.panelHost.attachShadow({ mode: "open" });
      this.panelShadow.innerHTML = `
        <style>${PANEL_STYLES}</style>
        <section class="panel" role="dialog" aria-labelledby="engram-player-settings-title">
          <header class="header">
            <span class="brand" aria-hidden="true">E</span>
            <span class="heading">
              <strong id="engram-player-settings-title" data-i18n="playerSettingsTitle"></strong>
              <small class="enabled-state"></small>
            </span>
            <label class="switch" data-i18n-aria-label="enableImmersiveLearning">
              <input type="checkbox" data-setting="enabled">
              <span class="track"></span>
            </label>
            <button class="close" type="button" data-action="close" data-i18n-aria-label="closeSettings">×</button>
          </header>
          <fieldset class="settings">
            <div class="row row--stacked">
              <span class="label" data-i18n="subtitleDisplayMode"></span>
              <div class="segmented" role="group" data-i18n-aria-label="subtitleDisplayMode">
                <button type="button" data-mode="bilingual" data-i18n="bilingual"></button>
                <button type="button" data-mode="chinese" data-i18n="chineseOnly"></button>
                <button type="button" data-mode="english" data-i18n="englishOnly"></button>
              </div>
            </div>
            <label class="row">
              <span class="label" data-i18n="translationEngine"></span>
              <span class="select-wrap">
                <select data-setting="engine">
                  <option value="local" data-i18n="chromeLocal"></option>
                  <option value="deepseek" data-i18n="deepseekQuality"></option>
                  <option value="google" data-i18n="googleFallback"></option>
                </select>
              </span>
            </label>
            <div class="row">
              <span class="label" data-i18n="fontSize"></span>
              <div class="stepper" role="group" data-i18n-aria-label="fontSize">
                <button type="button" data-action="font-decrease" data-i18n-aria-label="decreaseFontSize">−</button>
                <output data-output="font-size"></output>
                <button type="button" data-action="font-increase" data-i18n-aria-label="increaseFontSize">＋</button>
              </div>
            </div>
            <label class="row">
              <span class="label" data-i18n="difficultWordHints"></span>
              <span class="switch">
                <input type="checkbox" data-setting="learningHints">
                <span class="track"></span>
              </span>
            </label>
            <label class="row">
              <span class="label" data-i18n="youtubeNativeSubtitles"></span>
              <span class="switch">
                <input type="checkbox" data-setting="hideNative">
                <span class="track"></span>
              </span>
            </label>
          </fieldset>
          <button class="learning-launch" type="button" data-action="open-learning">
            <span class="learning-launch__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 6.5 12 3l8 3.5-8 3.5-8-3.5Z"></path><path d="M7 9v5.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V9M20 7v6"></path></svg>
            </span>
            <span>
              <strong data-i18n="openLearningMode"></strong>
              <small data-i18n="openLearningModeHelp"></small>
            </span>
            <svg class="learning-launch__arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6"></path></svg>
          </button>
          <footer class="footer" data-i18n="autoSave"></footer>
        </section>
      `;

      this.trigger = this.buttonShadow.querySelector(".trigger");
      this.panel = this.panelShadow.querySelector(".panel");
      this.fieldset = this.panelShadow.querySelector(".settings");
      this.enabledInput = this.panelShadow.querySelector('[data-setting="enabled"]');
      this.engineSelect = this.panelShadow.querySelector('[data-setting="engine"]');
      this.learningHintsInput = this.panelShadow.querySelector('[data-setting="learningHints"]');
      this.hideNativeInput = this.panelShadow.querySelector('[data-setting="hideNative"]');
      this.fontOutput = this.panelShadow.querySelector('[data-output="font-size"]');
      this.enabledState = this.panelShadow.querySelector(".enabled-state");

      this.trigger.addEventListener("click", () => this.setOpen(!this.open));
      this.panelShadow.querySelector('[data-action="close"]').addEventListener("click", () => this.setOpen(false, true));
      this.panelShadow.querySelector('[data-action="open-learning"]').addEventListener("click", () => {
        this.setOpen(false);
        this.onOpenLearningMode?.();
      });
      this.enabledInput.addEventListener("change", () => this.update({ enabled: this.enabledInput.checked }));
      this.engineSelect.addEventListener("change", () => this.update({ engine: this.engineSelect.value }));
      this.learningHintsInput.addEventListener("change", () => this.update({ learningHints: this.learningHintsInput.checked }));
      this.hideNativeInput.addEventListener("change", () => this.update({ hideNative: this.hideNativeInput.checked }));
      for (const button of this.panelShadow.querySelectorAll("[data-mode]")) {
        button.addEventListener("click", () => this.update({ mode: button.dataset.mode }));
      }
      this.panelShadow.querySelector('[data-action="font-decrease"]').addEventListener("click", () => {
        this.update({ fontSize: Math.max(20, Number(this.settings.fontSize) - 2) });
      });
      this.panelShadow.querySelector('[data-action="font-increase"]').addEventListener("click", () => {
        this.update({ fontSize: Math.min(40, Number(this.settings.fontSize) + 2) });
      });

      for (const shadow of [this.buttonShadow, this.panelShadow]) {
        for (const type of ["pointerdown", "pointerup", "click", "dblclick", "keydown"]) {
          shadow.addEventListener(type, (event) => event.stopPropagation());
        }
      }

      this.handleDocumentPointer = (event) => {
        if (!this.open) return;
        const path = event.composedPath();
        if (!path.includes(this.buttonHost) && !path.includes(this.panelHost)) this.setOpen(false);
      };
      this.handleDocumentKey = (event) => {
        if (!this.open || event.key !== "Escape") return;
        event.preventDefault();
        this.setOpen(false, true);
      };
      this.handleViewportChange = () => {
        this.mountPanelHost();
        this.ensureButtonAttached();
        if (this.open) this.positionPanel();
      };
    }

    mount() {
      this.mountPanelHost();
      this.ensureButtonAttached();
      if (!this.observer && document.documentElement) {
        this.observer = new MutationObserver(() => this.scheduleAttach());
        this.observer.observe(document.documentElement, { childList: true, subtree: true });
      }
      document.addEventListener("pointerdown", this.handleDocumentPointer, true);
      document.addEventListener("keydown", this.handleDocumentKey, true);
      document.addEventListener("yt-navigate-finish", this.handleViewportChange);
      document.addEventListener("fullscreenchange", this.handleViewportChange, true);
      window.addEventListener("resize", this.handleViewportChange, { passive: true });
      window.addEventListener("scroll", this.handleViewportChange, { passive: true });
      if (!this.unsubscribe) this.unsubscribe = this.settingsStore.subscribe((settings) => this.render(settings));
    }

    mountPanelHost() {
      const target = document.fullscreenElement || document.body || document.documentElement;
      if (target && this.panelHost.parentElement !== target) target.append(this.panelHost);
    }

    scheduleAttach() {
      if (this.attachFrame) return;
      this.attachFrame = requestAnimationFrame(() => {
        this.attachFrame = 0;
        this.ensureButtonAttached();
      });
    }

    ensureButtonAttached() {
      const controls = document.querySelector("#movie_player .ytp-right-controls, .html5-video-player .ytp-right-controls, [data-pst-youtube-controls]");
      if (!controls) {
        if (this.open) this.setOpen(false);
        return;
      }
      if (this.buttonHost.parentElement !== controls || controls.lastElementChild !== this.buttonHost) {
        controls.append(this.buttonHost);
      }
      if (this.open) this.positionPanel();
    }

    positionPanel() {
      const rect = this.buttonHost.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const right = Math.max(8, Math.min(window.innerWidth - 8, window.innerWidth - rect.right));
      const bottom = Math.max(58, Math.min(window.innerHeight - 8, window.innerHeight - rect.top + 8));
      const maxHeight = Math.max(180, rect.top - 16);
      this.panelHost.style.setProperty("--engram-panel-right", `${right}px`);
      this.panelHost.style.setProperty("--engram-panel-bottom", `${bottom}px`);
      this.panelHost.style.setProperty("--engram-panel-max-height", `${maxHeight}px`);
    }

    setOpen(open, restoreFocus = false) {
      this.open = Boolean(open);
      this.buttonHost.dataset.open = String(this.open);
      this.panelHost.dataset.open = String(this.open);
      this.trigger.setAttribute("aria-expanded", String(this.open));
      if (this.open) {
        this.mountPanelHost();
        this.positionPanel();
        this.panel.scrollTop = 0;
        requestAnimationFrame(() => this.enabledInput.focus({ preventScroll: true }));
      } else if (restoreFocus) {
        this.trigger.focus({ preventScroll: true });
      }
    }

    render(settings) {
      this.settings = { ...this.settings, ...settings };
      PST.setUiLanguage(this.settings.uiLanguage);
      PST.applyI18n(this.panelShadow);
      const buttonLabel = t("playerSettingsButton");
      this.trigger.setAttribute("aria-label", buttonLabel);
      this.trigger.setAttribute("title", buttonLabel);
      this.panel.setAttribute("aria-label", t("playerSettingsTitle"));
      this.enabledInput.checked = Boolean(this.settings.enabled);
      this.enabledState.textContent = t(this.settings.enabled ? "enabled" : "disabled");
      this.fieldset.disabled = !this.settings.enabled;
      for (const button of this.panelShadow.querySelectorAll("[data-mode]")) {
        button.setAttribute("aria-pressed", String(button.dataset.mode === this.settings.mode));
      }
      this.engineSelect.value = this.settings.engine;
      this.learningHintsInput.checked = Boolean(this.settings.learningHints);
      this.hideNativeInput.checked = Boolean(this.settings.hideNative);
      this.fontOutput.textContent = String(this.settings.fontSize);
      this.panelHost.lang = PST.getUiLanguage();
    }

    async update(patch) {
      this.panelHost.dataset.saving = "true";
      try {
        await this.settingsStore.update(patch);
      } catch {
        this.render(this.settingsStore.value);
      } finally {
        delete this.panelHost.dataset.saving;
      }
    }

    destroy() {
      if (this.attachFrame) cancelAnimationFrame(this.attachFrame);
      this.observer?.disconnect();
      this.observer = null;
      this.unsubscribe?.();
      this.unsubscribe = null;
      document.removeEventListener("pointerdown", this.handleDocumentPointer, true);
      document.removeEventListener("keydown", this.handleDocumentKey, true);
      document.removeEventListener("yt-navigate-finish", this.handleViewportChange);
      document.removeEventListener("fullscreenchange", this.handleViewportChange, true);
      window.removeEventListener("resize", this.handleViewportChange);
      window.removeEventListener("scroll", this.handleViewportChange);
      this.buttonHost.remove();
      this.panelHost.remove();
    }
  }

  PST.YouTubePlayerSettings = YouTubePlayerSettings;
})();
