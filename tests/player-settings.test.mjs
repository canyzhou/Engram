import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const source = readFileSync(new URL("../src/player-settings.js", import.meta.url), "utf8");
const contentSource = readFileSync(new URL("../src/content.js", import.meta.url), "utf8");
const adaptersSource = readFileSync(new URL("../src/learning-site-adapters.js", import.meta.url), "utf8");

test("loads the YouTube player settings control before content initialization", () => {
  const scripts = manifest.content_scripts.find((entry) => entry.js.includes("src/content.js"))?.js || [];

  assert.ok(scripts.includes("src/player-settings.js"));
  assert.ok(scripts.indexOf("src/player-settings.js") < scripts.indexOf("src/content.js"));
});

test("player settings menu updates the shared basic subtitle settings", () => {
  for (const key of ["enabled", "mode", "engine", "fontSize", "learningHints", "hideNative"]) {
    assert.match(source, new RegExp(`this\\.update\\(\\{ ${key}:`));
  }
  assert.match(source, /settingsStore\.subscribe/);
  assert.match(source, /#movie_player \.ytp-right-controls/);
});

test("player settings menu is keyboard dismissible and limits font size", () => {
  assert.match(source, /event\.key !== "Escape"/);
  assert.match(source, /Math\.max\(20,/);
  assert.match(source, /Math\.min\(40,/);
});

test("player button keeps a stable compact position while hovered or open", () => {
  assert.match(source, /width: 28px;\s+height: 28px;/);
  assert.equal(source.match(/transform: translateY\(-4px\);/g)?.length, 2);
  assert.doesNotMatch(source, /box-shadow: 0 0 0 3px/);
});

test("player settings exposes the popup learning-mode action", () => {
  assert.match(source, /data-action="open-learning"/);
  assert.ok(source.indexOf('data-setting="hideNative"') < source.indexOf('data-action="open-learning"'));
  assert.ok(source.indexOf('data-action="open-learning"') < source.indexOf('data-i18n="autoSave"'));
  assert.match(source, /this\.onOpenLearningMode\?\.\(\)/);
  assert.match(contentSource, /learningSiteAdapter\?\.buildLearningUrl/);
  assert.match(adaptersSource, /searchParams\.set\("engram_learning", "1"\)/);
  assert.match(adaptersSource, /formatTime\(seconds\)/);
});
