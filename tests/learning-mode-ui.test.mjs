import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../learning-mode.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../learning-mode.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../learning-mode.css", import.meta.url), "utf8");

test("analysis presents one combined learning recommendation with grounded controls", () => {
  assert.match(html, /学习建议/);
  assert.match(html, /id="recommendation-title">推荐精学/);
  assert.match(html, /id="recommendation-summary"/);
  assert.match(html, /id="recommendation-summary"[\s\S]*id="analysis-summary"[\s\S]*<\/section>\s*<div class="analysis-details"/);
  assert.doesNotMatch(html, /recommendation-reasons|difficulty-strip/);
  assert.match(html, /id="material-level"[^>]*aria-describedby="material-level-popover"/);
  assert.match(html, /id="material-level-popover"[^>]*role="tooltip"[^>]*>[\s\S]*id="vocabulary-level"[\s\S]*id="speech-level"[\s\S]*id="syntax-level"/);
  assert.doesNotMatch(html, /id="recommendation-action"|class="recommendation-actions"/);
  assert.match(html, /主要收获/);
  assert.match(html, /<h3>学习重点<\/h3>/);
  assert.match(html, /<h3>推荐片段<\/h3>/);
  assert.match(html, /id="timeline-segment-list"/);
  assert.match(html, /id="refresh-analysis"[^>]*aria-label="重新获取 AI 分析"/);
  assert.doesNotMatch(html, /使用本地简版|本地简版 · 未使用 AI/);
  assert.match(script, /grammar: "语法"/);
  assert.match(script, /intensive_study: \{ title: "推荐精学" \}/);
  assert.match(script, /extensive_viewing: \{ title: "建议泛看" \}/);
  assert.match(script, /title: "不推荐"/);
  assert.doesNotMatch(script, /recommendationAction|handleRecommendationAction/);
  assert.doesNotMatch(script, /recommendationReasons|reasonLabels/);
  assert.match(script, /analysis\.learningOutcomes\.slice\(0, 2\)/);
  assert.match(css, /\.material-level-control:hover \.material-level-popover/);
  assert.doesNotMatch(css, /material-level-trigger:focus/);
  assert.doesNotMatch(script, /setMaterialLevelPopover|materialLevelPopover|materialLevel\.addEventListener\("click"|event\.key === "Escape"/);
  assert.match(script, /elements\.analysisSummary\.hidden = detailsHidden/);
  assert.match(script, /timeline-segment-row/);
  assert.match(script, /analysis\.timelineSegments\.slice\(0, 4\)/);
  assert.match(script, /expression-meaning/);
  assert.match(script, /expression-occurrences/);
  assert.ok(script.indexOf("expression-meaning") < script.indexOf("expression-occurrences"));
  assert.match(script, /transcriptComplete/);
  assert.match(script, /response\.completeTimeline && nextCues\.length >= 3/);
  assert.match(script, /allowPartial = false/);
  assert.match(html, /id="analysis-error-title"/);
  assert.match(script, /"此视频没有可用英文字幕"/);
  assert.match(script, /当前网站没有为这个视频返回可用的英文字幕/);
  assert.doesNotMatch(script, /字幕仍未收集完整，当前不推荐/);
  assert.doesNotMatch(html, /合适在哪|fit-verdict|fit-reasons|analysis-coverage|难度时间轴|最值得带走|id="start-learning"|开始 \d+ 分钟学习/);
  assert.doesNotMatch(script, /startLearning|startLabel/);
  assert.match(script, /elements\.refreshAnalysis\.addEventListener\("click", \(\) => loadAnalysis\(\{ force: true \}\)\)/);
  assert.doesNotMatch(script, /renderLocalAnalysis|useLocalAnalysis|analysisSource/);
  assert.match(script, /elements\.expressionSection\.hidden = analysis\.learningItems\.length === 0/);
  assert.match(script, /elements\.timelineSection\.hidden = timelineSegments\.length === 0/);
  assert.match(script, /renderUnavailableAnalysis/);
});

test("automatic subtitle completion reuses cached analysis while explicit refresh bypasses it", () => {
  assert.match(script, /response\.completeTimeline[\s\S]*?loadAnalysis\(\{ allowPartial: false \}\)/);
  assert.match(script, /state\.cues\.length >= 3[\s\S]*?loadAnalysis\(\{ allowPartial: true \}\)/);
  assert.match(script, /retryAnalysis\.addEventListener\("click"[\s\S]*?state\.context\?\.completeTimeline[\s\S]*?loadAnalysis\(\{ force: true \}\)/);
  assert.match(script, /waitForMoreLearningCues\(\)\.catch\(showRuntimeError\)/);
  assert.match(script, /refreshAnalysis\.addEventListener\("click", \(\) => loadAnalysis\(\{ force: true \}\)\)/);
});

test("missing subtitles render a dedicated status instead of a fake material recommendation", () => {
  assert.match(script, /subtitleAvailability\?\.state === "unavailable"/);
  assert.match(script, /renderSubtitleUnavailable/);
  assert.match(script, /renderSubtitlePending/);
  assert.match(script, /previewState === "no-subtitles"/);
  assert.doesNotMatch(script, /fallback\.suitability\.assessmentStatus/);
  assert.match(html, /id="discussion-unavailable-title"/);
  assert.match(script, /没有字幕证据，无法生成可靠的讨论问题/);
  assert.doesNotMatch(script, /const fallback = Core\.createDiscussionQuestions/);
});

test("discussion tab previews a lesson outline before the guided session", () => {
  assert.match(html, /id="discussion-unavailable"/);
  assert.match(html, /id="source-question-list"/);
  assert.match(html, /id="advanced-question-list"/);
  assert.match(html, /id="start-discussion"[^>]*>开始讨论/);
  assert.match(html, /id="discussion-progress-bar"/);
  assert.match(html, /id="discussion-outline-toggle"/);
  assert.match(script, /discussionPhase = "casual"/);
  assert.match(script, /discussionPhase = "complete"/);
  assert.match(script, /evidence: Array\.isArray\(question\?\.evidence\)/);
  assert.match(script, /item\.text && item\.evidence\.length/);
  assert.match(script, /recommendation === "intensive_study"/);
  assert.match(script, /state\.discussionPlan\.length > 0/);
  assert.match(script, /这份材料更适合泛看，不生成完整讨论课/);
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

test("learning mode prefers semantic cues and falls back while they are loading", () => {
  assert.match(script, /displayCues:\s*\[[\s\S]*I think it's going to be[\s\S]*roughly 8 hours/);
  assert.match(script, /const visible = state\.cues\.filter/);
  assert.match(script, /const semanticCue = Core\.cueAt\(state\.cues, state\.currentTime\)/);
  assert.match(script, /const displayCue = Core\.cueAt\(state\.displayCues, state\.currentTime\)/);
  assert.match(script, /const nextCue = semanticCue \|\| displayCue/);
  assert.match(script, /const nextText = String\(nextCue\?\.text \|\| ""\)\.trim\(\)/);
  assert.doesNotMatch(script, /const nextCue = displayCue \|\| semanticCue/);
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
