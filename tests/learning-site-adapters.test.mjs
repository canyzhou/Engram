import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const namespaceSource = readFileSync(new URL("../src/namespace.js", import.meta.url), "utf8");
const adaptersSource = readFileSync(new URL("../src/learning-site-adapters.js", import.meta.url), "utf8");
const context = vm.createContext({ Math, Number, Object, String, TypeError, URL, globalThis: null });
context.globalThis = context;
vm.runInContext(namespaceSource, context);
vm.runInContext(adaptersSource, context);
const PST = context.ParamountSubtitles;

test("registers the reusable YouTube learning adapter", () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(PST.listLearningSiteAdapters().map(({ id }) => id))),
    ["youtube"],
  );
  assert.equal(PST.getLearningSiteAdapter("youtube")?.name, "YouTube");
  assert.equal(PST.getLearningSiteAdapter("https://example.com/video/1"), null);
  assert.throws(
    () => PST.registerLearningSiteAdapter({ id: "incomplete" }),
    /matchesLocation, isPlaybackPage, buildLearningUrl, readVideoMetadata, findVideo/,
  );
});

test("builds a native YouTube learning URL", () => {
  const youtube = PST.buildLearningModeUrl("https://www.youtube.com/watch?v=video-123", 42.9);

  assert.equal(new URL(youtube).searchParams.get("engram_learning"), "1");
  assert.equal(new URL(youtube).searchParams.get("t"), "42s");
});

test("reads YouTube metadata", () => {
  const values = new Map([
    ["meta[name='title']", { content: "A useful English lesson" }],
    ["meta[property='og:image']", { content: "https://i.example.test/cover.jpg" }],
  ]);
  const documentLike = {
    title: "fallback title",
    querySelector(selector) {
      const attributes = values.get(selector);
      return attributes ? { getAttribute: (name) => attributes[name] || "", textContent: "" } : null;
    },
  };
  const metadata = PST.getLearningSiteAdapter("youtube").readVideoMetadata(
    documentLike,
    "https://www.youtube.com/watch?v=video-123",
  );

  assert.deepEqual(JSON.parse(JSON.stringify(metadata)), {
    id: "video-123",
    title: "A useful English lesson",
    author: "YouTube",
    thumbnail: "https://i.example.test/cover.jpg",
    url: "https://www.youtube.com/watch?v=video-123",
  });
});

test("selects the largest native video without coupling the shared shell to site DOM", () => {
  const small = { getBoundingClientRect: () => ({ width: 160, height: 90 }) };
  const large = { getBoundingClientRect: () => ({ width: 960, height: 540 }) };
  const documentLike = {
    querySelectorAll(selector) {
      return selector === "video" ? [small, large] : [];
    },
  };

  assert.equal(PST.getLearningSiteAdapter("youtube").findVideo(documentLike), large);
});

test("derives a reusable player aspect ratio from video metadata with a 16:9 fallback", () => {
  const youtube = PST.getLearningSiteAdapter("youtube");
  assert.equal(youtube.getVideoAspectRatio({ videoWidth: 1920, videoHeight: 1080 }), 16 / 9);
  assert.equal(youtube.getVideoAspectRatio({ videoWidth: 0, videoHeight: 0 }), 16 / 9);
  assert.equal(youtube.getVideoAspectRatio({ videoWidth: 10000, videoHeight: 1 }), 16 / 9);
});

test("keeps native chrome measurements out of the reusable media sizing contract", () => {
  assert.equal(PST.getLearningSiteAdapter("youtube").getPlayerChromeHeight, undefined);
});
