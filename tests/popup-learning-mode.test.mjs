import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../popup.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../popup.js", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));

test("popup enables learning mode from site capability rather than subtitle availability", () => {
  const enablement = script.match(/elements\.openLearningMode\.disabled = !\([\s\S]*?\n\s*\);/)?.[0] || "";

  assert.match(enablement, /learningAdapter\?\.supportsLearningMode/);
  assert.match(enablement, /learningAdapter\.isPlaybackPage\(activeTabUrl\)/);
  assert.doesNotMatch(enablement, /capture|cue|subtitle/i);
  assert.match(script, /PST\.buildLearningModeUrl\?\.\(/);
});

test("site adapters load before popup and content learning-mode entry points", () => {
  assert.ok(html.indexOf('src="src/learning-site-adapters.js"') < html.indexOf('src="popup.js"'));
  const contentScripts = manifest.content_scripts.find((entry) => entry.js?.includes("src/content.js"))?.js || [];
  assert.ok(contentScripts.indexOf("src/learning-site-adapters.js") < contentScripts.indexOf("src/content.js"));
});
