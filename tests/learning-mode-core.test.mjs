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

test("analysis keeps exactly three expressions anchored to transcript cues", () => {
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
    studyMinutes: 12,
    recommendedRange: { start: 10, end: 30 },
    difficultRanges: [{ start: 20, end: 35 }],
    expressions: [
      { expression: "go on a hike", meaningZh: "去徒步", timestamp: 11 },
      { expression: "roughly", meaningZh: "大约", timestamp: 21 },
      { expression: "told to bring", meaningZh: "被告知带上", timestamp: 31 },
    ],
  }, { cues, duration: 40, learnerLevel: "B1" });

  assert.equal(result.expressions.length, 3);
  assert.deepEqual(result.expressions.map((item) => item.timestamp), [10, 20, 30]);
  assert.equal(result.learnerLevel, "B1");
});

test("rejects hallucinated expressions that do not exist in the transcript", () => {
  assert.throws(() => Core.sanitizeAnalysis({
    expressions: [
      { expression: "invented phrase" },
      { expression: "second phrase" },
      { expression: "third phrase" },
    ],
  }, {
    cues: [{ start: 0, end: 3, text: "A real subtitle." }],
    duration: 3,
  }), /三个可定位表达/);
});

test("formats short and hour-long timestamps", () => {
  assert.equal(Core.formatTimestamp(91), "1:31");
  assert.equal(Core.formatTimestamp(3671), "1:01:11");
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
  assert.equal(result.expressions.length, 3);
  assert.match(result.fitVerdict, /本地难度/);
  for (const item of result.expressions) {
    assert.ok(cues.some((cue) => cue.text.toLowerCase().includes(item.expression.toLowerCase())));
  }
});
