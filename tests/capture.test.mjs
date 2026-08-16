import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/capture.js", import.meta.url), "utf8");
const bridgeWindow = {};

const context = vm.createContext({
  Array,
  CustomEvent: class {},
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
  window: bridgeWindow,
  globalThis: null,
  ParamountSubtitles: {
    BRIDGE_SOURCE: "paramount-subtitle-page-bridge",
    CONTENT_SOURCE: "paramount-subtitle-content",
    hash: (value) => String(value),
    normalizeSubtitle: (value) => String(value || "").replace(/\s+/g, " ").trim(),
    parseTime: (value) => Number(value) || 0,
  },
});
context.globalThis = context;
vm.runInContext(source, context);

test("configures capture only once when bridge readiness is repeated", () => {
  const capture = new context.ParamountSubtitles.CaptureCoordinator();
  let configureCount = 0;
  capture.configure = () => { configureCount += 1; };
  capture.dispatchEvent = () => true;
  const ready = {
    source: bridgeWindow,
    data: {
      source: "paramount-subtitle-page-bridge",
      type: "BRIDGE_READY",
      detail: { href: "https://www.youtube.com/watch?v=test" },
    },
  };

  capture.onBridgeMessage(ready);
  capture.onBridgeMessage(ready);

  assert.equal(configureCount, 1);
  assert.equal(capture.bridgeReady, true);
});

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

test("uses following words to distinguish abbreviations from sentence endings", () => {
  const split = context.ParamountSubtitles.splitCompleteSentences;

  assert.deepEqual([...split("We moved to Acme Inc. headquarters yesterday.").complete], [
    "We moved to Acme Inc. headquarters yesterday.",
  ]);
  assert.deepEqual([...split("Episode No. 5 starts now.").complete], [
    "Episode No. 5 starts now.",
  ]);
  assert.deepEqual([...split("Ask J. Then leave.").complete], [
    "Ask J.",
    "Then leave.",
  ]);
});

test("keeps a lowercase continuation after an ellipsis in the same sentence", () => {
  const result = context.ParamountSubtitles.splitCompleteSentences("Wait... what happened?");

  assert.deepEqual([...result.complete], ["Wait... what happened?"]);
});

test("keeps punctuation revisions without duplicating automatic captions", () => {
  const result = context.ParamountSubtitles.aggregateYouTubeAutoCues([
    { start: 0, end: 1, text: "hello world" },
    { start: 0.5, end: 1.5, text: "Hello, world." },
  ]);

  assert.deepEqual([...result].map(({ text }) => text), ["hello world."]);
});

test("resegments a complete authored YouTube track across cue boundaries", () => {
  const capture = new context.ParamountSubtitles.CaptureCoordinator();
  const result = capture.timeline.ingest({
    body: JSON.stringify({
      events: [
        { tStartMs: 0, dDurationMs: 1_000, segs: [{ utf8: "We moved to Acme Inc." }] },
        { tStartMs: 1_000, dDurationMs: 1_000, segs: [{ utf8: "headquarters yesterday." }] },
        { tStartMs: 3_000, dDurationMs: 1_000, segs: [{ utf8: "Then we left." }] },
      ],
    }),
    captionKind: "subtitles",
    contentType: "application/json",
    mediaKey: "youtube:test-video",
    url: "https://www.youtube.com/api/timedtext?v=test-video&fmt=json3",
  });

  assert.equal(result.format, "YouTube Captions");
  assert.equal(capture.timeline.preferredSource, "YouTube Captions");
  assert.deepEqual([...capture.timeline.cues.values()].map(({ text }) => text), [
    "We moved to Acme Inc. headquarters yesterday.",
    "Then we left.",
  ]);
});

test("ignores TextTrack fragments after the complete YouTube timeline is ready", () => {
  const capture = new context.ParamountSubtitles.CaptureCoordinator();
  let accepted = 0;
  capture.timeline.preferredSource = "YouTube Captions";
  capture.accept = () => { accepted += 1; };

  capture.onBridgeMessage({
    source: bridgeWindow,
    data: {
      source: "paramount-subtitle-page-bridge",
      type: "TEXT_TRACK_CUE",
      detail: { text: "an incomplete fragment" },
    },
  });

  assert.equal(accepted, 0);
});

test("exports a sorted, bounded learning context from the captured timeline", () => {
  const capture = new context.ParamountSubtitles.CaptureCoordinator();
  capture.dom.largestVideo = () => ({ video: { currentTime: 12, duration: 90, paused: false } });
  capture.timeline.cues.set("later", { start: 20, end: 23, text: "Later cue", source: "YouTube Captions" });
  capture.timeline.cues.set("first", { start: 5, end: 8, text: "First cue", source: "YouTube Captions" });

  const learning = capture.learningContext();
  assert.equal(learning.completeTimeline, true);
  assert.equal(learning.currentTime, 12);
  assert.equal(learning.duration, 90);
  assert.equal(learning.paused, false);
  assert.deepEqual([...learning.cues].map(({ start, text }) => ({ start, text })), [
    { start: 5, text: "First cue" },
    { start: 20, text: "Later cue" },
  ]);
});
