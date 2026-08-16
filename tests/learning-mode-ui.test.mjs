import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../learning-mode.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../learning-mode.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../learning-mode.css", import.meta.url), "utf8");

test("analysis prioritizes concise Chinese outcomes and grounded learning controls", () => {
  assert.match(html, /你能学到什么/);
  assert.match(html, /<h3>学习重点<\/h3>/);
  assert.match(html, /<h3>推荐片段<\/h3>/);
  assert.match(html, /id="timeline-segment-list"/);
  assert.match(html, /id="use-local-analysis"[^>]*>使用本地简版/);
  assert.match(html, /id="analysis-source"[^>]*>本地简版 · 未使用 AI/);
  assert.match(html, /id="refresh-analysis"[^>]*aria-label="重新获取 AI 分析"/);
  assert.match(script, /grammar: "语法"/);
  assert.match(script, /timeline-segment-row/);
  assert.match(script, /analysis\.timelineSegments\.slice\(0, 4\)/);
  assert.match(script, /expression-meaning/);
  assert.match(script, /expression-occurrences/);
  assert.ok(script.indexOf("expression-meaning") < script.indexOf("expression-occurrences"));
  assert.match(script, /transcriptComplete/);
  assert.match(script, /response\.completeTimeline && nextCues\.length >= 3/);
  assert.match(script, /allowPartial = false/);
  assert.match(script, /未能从 YouTube 取得足够的英文字幕/);
  assert.match(script, /elements\.analysisLoading\.hidden = true;[\s\S]*elements\.useLocalAnalysis\.hidden = true/);
  assert.doesNotMatch(html, /合适在哪|fit-verdict|fit-reasons|analysis-coverage|难度时间轴|最值得带走|id="start-learning"|开始 \d+ 分钟学习/);
  assert.doesNotMatch(script, /startLearning|startLabel/);
  assert.match(script, /elements\.useLocalAnalysis\.addEventListener\("click", renderLocalAnalysis\)/);
  assert.match(script, /elements\.refreshAnalysis\.addEventListener\("click", \(\) => loadAnalysis\(\{ force: true \}\)\)/);
  assert.match(script, /elements\.analysisSource\.hidden = !analysis\.localFallback/);
  assert.doesNotMatch(script, /catch \(error\) \{\s*try \{\s*state\.analysis = Core\.sanitizeAnalysis\(Core\.createFallbackAnalysis/);
});

test("discussion tab previews a lesson outline before the guided session", () => {
  assert.match(html, /id="source-question-list"/);
  assert.match(html, /id="advanced-question-list"/);
  assert.match(html, /id="start-discussion"[^>]*>开始讨论/);
  assert.match(html, /id="discussion-progress-bar"/);
  assert.match(html, /id="discussion-outline-toggle"/);
  assert.match(script, /discussionPhase = "casual"/);
  assert.match(script, /discussionPhase = "complete"/);
  assert.match(script, /evidence: Array\.isArray\(question\?\.evidence\)/);
  assert.match(script, /item\.text && item\.evidence\.length/);
  assert.doesNotMatch(html, /data-discussion-mode/);
});

test("discussion intro sits above the chat instead of inside the opening message", () => {
  assert.match(html, /id="discussion-intro"[^>]*hidden>你好，我是你的 AI 英语老师。我们会按提纲逐题讨论，我会适时纠正和追问。<\/p>/);
  assert.match(css, /\.discussion-intro \{[^}]*font-size: 10px/);
  assert.match(script, /elements\.discussionIntro\.hidden = false/);
  assert.match(script, /const openingQuestion = state\.discussionPlan\[0\]\.text/);
  assert.doesNotMatch(script, /AI 英语老师[^\n]*discussionPlan/);
});

test("current subtitle stays hidden when playback is between cues", () => {
  assert.match(html, /id="current-sentence" hidden>[\s\S]*?<p><\/p>/);
  assert.match(script, /elements\.currentSentenceContainer\.hidden = !nextText/);
  assert.doesNotMatch(`${html}\n${script}`, /当前时间点没有字幕|字幕准备好后，会在这里跟随播放/);
});

test("standalone learning mode omits sentence looping", () => {
  assert.doesNotMatch(`${html}\n${script}`, /loop-toggle|loopToggle|loopCue|单句循环/);
});

test("player commands wait for the YouTube frame and async startup errors are handled", () => {
  const loadHandler = script.indexOf('elements.player.addEventListener("load"');
  const playerNavigation = script.indexOf("elements.player.src = `${PLAYER_ORIGIN}/embed/");

  assert.match(script, /if \(!state\.playerReady \|\| state\.destroyed\) return false/);
  assert.ok(loadHandler >= 0 && loadHandler < playerNavigation);
  assert.match(script, /state\.playerReady = true;\s*if \(!postPlayerMessage/);
  assert.match(script, /if \(!state\.playerReady\) return;\s*state\.playbackTimer = setInterval/);
  assert.match(script, /initialize\(\)\.catch\(showRuntimeError\)/);
  assert.doesNotMatch(script, /else if \(!previewMode\) \{\s*state\.playbackTimer = setInterval/);
});
