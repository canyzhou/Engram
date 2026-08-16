import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/learning-workspace-page.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/learning-workspace-shell.js", import.meta.url), "utf8");
const content = readFileSync(new URL("../src/content.js", import.meta.url), "utf8");

test("learning layout reserves page space without repositioning YouTube player internals", () => {
  assert.match(css, /width:\s*calc\(100vw - var\(--engram-learning-panel-width\)\)/);
  assert.match(css, /ytd-watch-flexy #columns[\s\S]*min-width:\s*0\s*!important/);
  assert.match(css, /padding:\s*88px 18px 212px/);
  assert.match(css, /ytd-watch-flexy #player-container-outer[\s\S]*width:\s*100%\s*!important[\s\S]*min-width:\s*0\s*!important[\s\S]*max-width:\s*100%\s*!important/);
  assert.doesNotMatch(css, /data-engram-player-host|#movie_player|html5-main-video/);
  assert.doesNotMatch(shell, /data-engram-player-host/);
});

test("learning panel resizes with the video layout and collapses below a threshold", () => {
  assert.match(css, /--engram-learning-panel-width:\s*max\(36vw, 390px\)/);
  assert.match(css, /#pst-learning-panel[\s\S]*width:\s*var\(--engram-learning-panel-width\)/);
  assert.match(shell, /class="panel-resizer" role="separator"/);
  assert.match(shell, /PANEL_COLLAPSE_THRESHOLD = 220/);
  assert.match(shell, /this\.setPanelWidth\(this\.panelResizeRawWidth, \{ preview: true \}\)/);
  assert.match(shell, /requestPlayerLayout\(\)[\s\S]*requestAnimationFrame[\s\S]*window\.dispatchEvent\(new Event\("resize"\)\)/);
  assert.match(shell, /if \(Math\.abs\(nextWidth - previousWidth\) > \.5\) this\.requestPlayerLayout\(\)/);
  assert.match(shell, /if \(this\.panelResizeRawWidth <= PANEL_COLLAPSE_THRESHOLD\) this\.setPanelCollapsed\(true\)/);
  assert.match(shell, /class="panel-restore"[^>]*aria-label="展开学习面板"/);
  assert.match(shell, /restore\.addEventListener\("click", \(\) =>/);
});

test("learning workspace uses compact native playback controls instead of cue cards", () => {
  assert.match(shell, /class="control control-primary play-toggle"/);
  assert.match(shell, /class="control previous-cue"/);
  assert.match(shell, /class="control next-cue"/);
  assert.match(shell, /class="control rate"/);
  assert.match(shell, /class="control mute-toggle"/);
  assert.doesNotMatch(shell, /loop-toggle|loopCue|单句循环/);
  assert.doesNotMatch(shell, /class="rail"|className = "cue"/);
});

test("learning workspace omits the decorative native-player label", () => {
  assert.doesNotMatch(shell, /native-label|YouTube 原生播放器/);
});

test("learning workspace centers enlarged subtitles without a current-sentence label", () => {
  assert.match(shell, /height:\s*196px/);
  assert.match(shell, /font-size:\s*clamp\(18px, 1\.35vw, 22px\)/);
  assert.match(shell, /class="current" aria-live="polite" hidden><p><\/p>/);
  assert.doesNotMatch(shell, /<span>当前句<\/span>/);
});

test("learning workspace hides the subtitle line when the current time has no cue", () => {
  assert.match(shell, /class="current" aria-live="polite" hidden><p><\/p>/);
  assert.match(shell, /current\.closest\("\.current"\)\.hidden = !text/);
  assert.doesNotMatch(shell, /当前时间点没有字幕|字幕准备好后，会在这里跟随播放/);
});

test("learning workspace exposes a hover rate menu", () => {
  assert.match(shell, /class="rate-picker" data-open="false" data-dismissed="false"/);
  assert.match(shell, /role="menuitemradio"[^>]*data-rate="0\.75"/);
  assert.match(shell, /role="menuitemradio"[^>]*data-rate="2"/);
  assert.match(shell, /this\.video\.playbackRate = Number\(option\.dataset\.rate\)/);
  assert.match(shell, /option\.blur\(\);\s*ratePicker\.dataset\.dismissed = "true";\s*setRateMenuOpen\(false\)/);
});

test("learning workspace renders hoverable words with contextual lookup and shared word-bank storage", () => {
  assert.match(shell, /className = "word"/);
  assert.match(shell, /HOVER_LOOKUP_DELAY_MS = 300/);
  assert.match(shell, /mouseenter", \(\) => this\.scheduleLookupWord\(word\)/);
  assert.match(shell, /cancelScheduledLookup\(word\)/);
  assert.match(shell, /class="word-tooltip-bridge" aria-hidden="true"/);
  assert.match(shell, /this\.positionTooltipBridge\(wordNode, tooltip\)/);
  assert.match(shell, /bridge\.style\.clipPath = `polygon/);
  assert.match(shell, /this\.dictionary\.lookup\(original, this\.getSettings/);
  assert.match(shell, /sentence: this\.activeCue\?\.text/);
  assert.match(shell, /context: this\.lookupContext\(this\.activeCue\)/);
  assert.match(shell, /current\.addEventListener\("mouseenter", \(\) => this\.enterSubtitleInteraction\(\)\)/);
  assert.match(shell, /if \(this\.resumeAfterSubtitleHover\) this\.video\.pause\(\)/);
  assert.match(shell, /this\.video\.play\(\)\.catch/);
  assert.match(shell, /data-add-word/);
  assert.match(shell, /word-tooltip__word">\$\{PST\.escapeHtml\(original\)\}/);
  assert.match(shell, /word-tooltip__phrase/);
  assert.match(content, /onAddWord: storeVocabularyEntry/);
  assert.match(content, /await storeVocabularyEntry\(event\.detail\)/);
});

test("learning workspace stops background storage work after extension invalidation", () => {
  assert.match(shell, /this\.persistProgress\(\)\.catch\(\(error\) => this\.handleAsyncError/);
  assert.match(shell, /if \(isExtensionContextInvalidated\(error\)\) \{\s*this\.extensionContextInvalidated = true;\s*clearInterval\(this\.historyTimer\)/);
  assert.match(shell, /if \(!PST\.hasExtensionContext\(\)\) \{\s*this\.extensionContextInvalidated = true/);
});
