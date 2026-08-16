import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../dashboard.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../dashboard.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../dashboard.js", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/learning-workspace-shell.js", import.meta.url), "utf8");
const learningModeHtml = readFileSync(new URL("../learning-mode.html", import.meta.url), "utf8");
const learningModeScript = readFileSync(new URL("../learning-mode.js", import.meta.url), "utf8");
const vocabularyScript = readFileSync(new URL("../vocabulary.js", import.meta.url), "utf8");
const popupScript = readFileSync(new URL("../popup.js", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));

test("dashboard exposes overview, continuation, archive filters, and a list layout", () => {
  assert.match(html, /<h1>学习档案<\/h1>/);
  assert.match(html, /id="stat-archived"/);
  assert.match(html, /id="continue-section"/);
  assert.match(html, /data-filter="progress"/);
  assert.match(html, /data-filter="starred"/);
  assert.match(html, /观看进度达到 10%/);
  assert.match(html, /role="table"/);
  assert.match(css, /\.history-row\s*\{[^}]*display:\s*grid/s);
  assert.doesNotMatch(css, /\.card-grid|grid-template-areas:\s*"card/);
  assert.match(script, /Core\.filterHistory/);
  assert.match(script, /chrome\.storage\.onChanged/);
});

test("word bank shares the dashboard shell and switches views without a reload", () => {
  assert.match(html, /data-view-target="vocabulary"/);
  assert.match(html, /data-page-view="vocabulary"/);
  assert.match(html, /id="search-input"/);
  assert.match(html, /id="sort-order"/);
  assert.match(html, /id="export-csv"/);
  assert.match(html, /src="vocabulary\.js(?:\?[^\"]*)?"/);
  assert.match(css, /\.word-card\s*\{[^}]*grid-template-columns/s);
  assert.match(script, /const setView =/);
  assert.match(script, /globalThis\.history\[method\]/);
  assert.match(script, /popstate/);
  assert.match(vocabularyScript, /deleteWord/);
  assert.match(vocabularyScript, /exportCsv/);
  assert.match(popupScript, /dashboard\.html\?view=vocabulary/);
  assert.doesNotMatch(popupScript, /getURL\("vocabulary\.html"\)/);
});

test("learning workspace offers a star action and persists the ten-percent archive", () => {
  assert.match(shell, /class="archive-button"/);
  assert.match(shell, /星标并加入学习档案/);
  assert.match(shell, /History\.buildRecord/);
  assert.match(shell, /window\.setInterval\(\(\) => this\.persistProgress\(\), 5000\)/);
  assert.match(learningModeHtml, /src\/learning-history-core\.js/);
  assert.match(learningModeScript, /saveAnalysisToHistory\(state\.analysis\)/);
  const contentScripts = manifest.content_scripts.flatMap((entry) => entry.js || []);
  assert.equal(contentScripts.includes("src/learning-history-core.js"), true);
});
