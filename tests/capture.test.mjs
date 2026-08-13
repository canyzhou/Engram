import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/capture.js", import.meta.url), "utf8");

const context = vm.createContext({
  Array,
  Date,
  EventTarget,
  JSON,
  Map,
  Math,
  Number,
  Object,
  Set,
  String,
  WeakMap,
  globalThis: null,
  ParamountSubtitles: {
    hash: (value) => String(value),
    normalizeSubtitle: (value) => String(value || "").replace(/\s+/g, " ").trim(),
    parseTime: (value) => Number(value) || 0,
  },
});
context.globalThis = context;
vm.runInContext(source, context);

test("parses YouTube JSON3 captions into a video timeline", () => {
  const cues = context.ParamountSubtitles.parseYouTubeJson3(JSON.stringify({
    events: [
      { tStartMs: 1_250, dDurationMs: 2_500, segs: [{ utf8: "Hello " }, { utf8: "there" }] },
      { tStartMs: 4_000, segs: [{ utf8: "Next line" }] },
      { tStartMs: 7_000, wpWinPosId: 1 },
    ],
  }));

  assert.deepEqual(
    [...cues].map(({ start, end, text }) => ({ start, end, text })),
    [
      { start: 1.25, end: 3.75, text: "Hello there" },
      { start: 4, end: 7, text: "Next line" },
    ],
  );
});

test("ignores malformed YouTube JSON3 responses", () => {
  assert.deepEqual([...context.ParamountSubtitles.parseYouTubeJson3("not json")], []);
});

test("accepts a YouTube JSON3 response with an XSSI prefix", () => {
  const cues = context.ParamountSubtitles.parseYouTubeJson3(
    `)]}'\n${JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1_000, segs: [{ utf8: "Hi" }] }] })}`,
  );

  assert.equal(cues[0].text, "Hi");
  assert.equal(cues[0].end, 1);
});

test("keeps a network subtitle visible across a short timeline gap", () => {
  const guard = new context.ParamountSubtitles.CueGapGuard(650);

  assert.equal(guard.shouldHold(true, 1_000), false);
  assert.equal(guard.shouldHold(false, 1_100), true);
  assert.equal(guard.shouldHold(false, 1_700), true);
  assert.equal(guard.shouldHold(false, 1_751), false);
  assert.equal(guard.shouldHold(true, 1_800), false);
  assert.equal(guard.shouldHold(false, 2_000), true);
});

test("combines word-level YouTube auto captions into complete sentences", () => {
  const aggregate = context.ParamountSubtitles.aggregateYouTubeAutoCues;
  const cues = aggregate([
    { start: 0, end: 1.8, text: "Do" },
    { start: 0.3, end: 2.1, text: "you" },
    { start: 0.7, end: 2.5, text: "actually" },
    { start: 1.1, end: 2.9, text: "know" },
    { start: 1.5, end: 3.3, text: "your" },
    { start: 1.9, end: 3.8, text: "level?" },
    { start: 4.2, end: 5.8, text: "It" },
    { start: 4.5, end: 6.1, text: "is" },
    { start: 4.8, end: 6.5, text: "B2." },
  ]);

  assert.deepEqual([...cues].map(({ start, end, text }) => ({ start, end, text })), [
    { start: 0, end: 3.8, text: "Do you actually know your level?" },
    { start: 4.2, end: 6.5, text: "It is B2." },
  ]);
});

test("deduplicates cumulative YouTube auto-caption updates", () => {
  const aggregate = context.ParamountSubtitles.aggregateYouTubeAutoCues;
  const cues = aggregate([
    { start: 0, end: 1, text: "This" },
    { start: 0.3, end: 1.4, text: "This is" },
    { start: 0.6, end: 1.8, text: "This is a" },
    { start: 0.9, end: 2.2, text: "This is a complete sentence." },
  ]);

  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, "This is a complete sentence.");
});

test("reads ahead beyond the old fixed duration to preserve a full semantic sentence", () => {
  const aggregate = context.ParamountSubtitles.aggregateYouTubeAutoCues;
  const words = [
    "It's", "a", "bit", "embarrassing", "to", "admit,", "but", "in", "cybersecurity,",
    "the", "small", "gaps", "are", "often", "the", "most", "dangerous", "ones.",
  ];
  const cues = words.map((text, index) => ({
    start: index * 0.65,
    end: (index * 0.65) + 1.1,
    text,
  }));

  const result = aggregate(cues);

  assert.equal(result.length, 1);
  assert.equal(
    result[0].text,
    "It's a bit embarrassing to admit, but in cybersecurity, the small gaps are often the most dangerous ones.",
  );
  assert.ok(result[0].end > 10);
});

test("splits multiple complete sentences while retaining unfinished trailing context", () => {
  const aggregate = context.ParamountSubtitles.aggregateYouTubeAutoCues;
  const result = aggregate([
    { start: 0, end: 1.4, text: "Right. It's a bit" },
    { start: 1.2, end: 2.6, text: "embarrassing to admit," },
    { start: 2.4, end: 3.8, text: "but it is true." },
  ]);

  assert.deepEqual([...result].map(({ text }) => text), [
    "Right.",
    "It's a bit embarrassing to admit, but it is true.",
  ]);
});
