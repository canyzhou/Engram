import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const namespaceSource = readFileSync(new URL("../src/namespace.js", import.meta.url), "utf8");
const learningSource = readFileSync(new URL("../src/learning-mode-core.js", import.meta.url), "utf8");

const context = vm.createContext({ URL, globalThis: {} });
context.globalThis = context;
vm.runInContext(namespaceSource, context);
vm.runInContext(learningSource, context);
const Core = context.ParamountSubtitles.LearningModeCore;

test("extracts supported YouTube video ids", () => {
  assert.equal(Core.extractYouTubeVideoId("https://www.youtube.com/watch?v=abc-123_xyz"), "abc-123_xyz");
  assert.equal(Core.extractYouTubeVideoId("https://youtu.be/abc123?t=5"), "abc123");
  assert.equal(Core.extractYouTubeVideoId("https://www.youtube.com/shorts/abc123"), "abc123");
  assert.equal(Core.extractYouTubeVideoId("https://example.com/watch?v=abc123"), "");
});

test("normalizes, sorts, and de-duplicates learning cues", () => {
  const cues = Core.normalizeCues([
    { start: 8, end: 10, text: " Later   cue " },
    { start: 2, end: 4, text: "First cue" },
    { start: 2.1, end: 4, text: "First cue" },
    { start: -1, text: "invalid" },
  ], 9);
  assert.deepEqual(JSON.parse(JSON.stringify(cues)), [
    { start: 2, end: 4, text: "First cue", translation: "", source: "" },
    { start: 8, end: 9, text: "Later cue", translation: "", source: "" },
  ]);
});

test("analysis keeps 5–8 categorized learning items and concise timeline segments anchored to transcript cues", () => {
  const cues = [
    { start: 10, end: 13, text: "We are going to go on a hike." },
    { start: 20, end: 23, text: "It will take roughly eight hours." },
    { start: 30, end: 34, text: "I was told to bring water." },
  ];
  const result = Core.sanitizeAnalysis({
    materialLevel: "B2",
    vocabularyLevel: "B2",
    speechLevel: "B1+",
    syntaxLevel: "B2",
    fitVerdict: "有挑战，但适合精学",
    fitReasons: ["主题清楚且略高于学习者水平。", "字幕上下文连续，适合精听。"],
    learningOutcomes: ["掌握计划和徒步表达。", "练习时间估算和被动语态。"],
    studyMinutes: 12,
    recommendedRange: { start: 10, end: 30 },
    learningItems: [
      { category: "pattern", expression: "go on a hike", meaningZh: "去徒步", timestamp: 11 },
      { category: "grammar", expression: "going to", meaningZh: "将要", timestamp: 11 },
      { category: "word", expression: "roughly", meaningZh: "大约", timestamp: 21 },
      { category: "pattern", expression: "eight hours", meaningZh: "八小时", timestamp: 21 },
      { category: "grammar", expression: "told to bring", meaningZh: "被告知带上", timestamp: 31 },
    ],
    timelineSegments: [
      { start: 10, end: 20, level: "B1", title: "计划", analysis: "将来计划表达。", focus: "going to", timestamp: 10, sourceText: cues[0].text },
      { start: 20, end: 34, level: "B2", title: "时间与准备", analysis: "估算和被动语态。", focus: "roughly / told to", timestamp: 20, sourceText: cues[1].text },
    ],
    discussionQuestions: Core.createDiscussionQuestions("A hiking lesson", cues),
    coverage: { cueCount: 3, complete: true },
  }, { cues, duration: 40, learnerLevel: "B1" });

  assert.equal(result.learningItems.length, 5);
  assert.deepEqual(result.learningItems.map((item) => item.timestamp), [10, 10, 20, 20, 30]);
  assert.equal(result.timelineSegments.length, 2);
  assert.equal(result.coverage.complete, true);
  assert.equal(result.learnerLevel, "B1");
  assert.equal(result.discussionQuestions.source[0].evidence[0].sourceText, cues[0].text);
});

test("drops hallucinated optional items without rejecting the material analysis", () => {
  const result = Core.sanitizeAnalysis({
    expressions: [
      { expression: "invented phrase" },
      { expression: "second phrase" },
      { expression: "third phrase" },
    ],
  }, {
    cues: [{ start: 0, end: 3, text: "A real subtitle." }],
    duration: 3,
  });
  assert.equal(result.learningItems.length, 0);
  assert.equal(result.timelineSegments.length, 0);
  assert.equal(result.learningOutcomes.length, 2);
});

test("formats short and hour-long timestamps", () => {
  assert.equal(Core.formatTimestamp(91), "1:31");
  assert.equal(Core.formatTimestamp(3671), "1:01:11");
});

test("creates two Engoo-style sets of discussion questions", () => {
  const cues = [
    { start: 1, end: 4, text: "Filming cinematic videos by yourself can feel really challenging." },
    { start: 6, end: 9, text: "Camera movement changes the energy of a scene." },
    { start: 12, end: 16, text: "Composition helps the audience understand your intention." },
    { start: 20, end: 24, text: "Natural lighting can make a simple shot feel professional." },
    { start: 26, end: 30, text: "A hero shot gives the sequence one memorable visual moment." },
  ];
  const questions = Core.createDiscussionQuestions("How to Film Cinematic Videos by Yourself", cues);
  assert.equal(questions.source.length, 5);
  assert.equal(questions.advanced.length, 5);
  assert.match(questions.source[0].text, /Filming cinematic videos/);
  assert.match(questions.source[1].text, /Camera movement/);
  assert.match(questions.advanced[0].text, /How to Film Cinematic Videos/);
  assert.equal(questions.source[0].evidence[0].sourceText, cues[0].text);
  assert.doesNotMatch(questions.source.map((question) => question.text).join(" "), /main message|stands out|Do you agree/i);
});

test("creates a grounded local analysis when the AI proxy is unavailable", () => {
  const cues = [
    { start: 1, end: 4, text: "Filming cinematic videos by yourself can feel really challenging." },
    { start: 6, end: 9, text: "Camera movement changes the energy of a scene." },
    { start: 12, end: 16, text: "Composition helps the audience understand your intention." },
    { start: 20, end: 24, text: "Natural lighting can make a simple shot feel professional." },
  ];
  const fallback = Core.createFallbackAnalysis({ cues, duration: 30, learnerLevel: "B1" });
  const result = Core.sanitizeAnalysis(fallback, { cues, duration: 30, learnerLevel: "B1" });
  assert.equal(result.localFallback, true);
  assert.ok(result.learningItems.length >= 5 && result.learningItems.length <= 20);
  assert.equal(result.timelineSegments.length, 2);
  assert.equal(result.discussionQuestions.source.length, 5);
  assert.equal(result.discussionQuestions.advanced.length, 5);
  assert.match(result.discussionQuestions.source[0].text, /Filming cinematic videos/);
  assert.equal(result.discussionQuestions.source[0].evidence[0].sourceText, cues[0].text);
  assert.match(result.fitVerdict, /本地难度/);
  for (const item of result.expressions) {
    assert.ok(cues.some((cue) => cue.text.toLowerCase().includes(item.expression.toLowerCase())));
  }
});

test("only caches remote learning analyses", () => {
  assert.equal(Core.isCacheableAnalysis({ materialLevel: "B2" }), true);
  assert.equal(Core.isCacheableAnalysis({ localFallback: false }), true);
  assert.equal(Core.isCacheableAnalysis({ localFallback: true }), false);
  assert.equal(Core.isCacheableAnalysis(null), false);
});
