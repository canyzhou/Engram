import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/namespace.js", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const context = vm.createContext({
  Math,
  String,
  URL,
  globalThis: null,
});
context.globalThis = context;
vm.runInContext(source, context);

test("recognizes YouTube and Paramount+ as supported video sites", () => {
  const detect = context.ParamountSubtitles.detectVideoSite;

  assert.equal(detect("www.youtube.com").name, "YouTube");
  assert.equal(detect("m.youtube.com").id, "youtube");
  assert.equal(detect("www.youtube-nocookie.com").id, "youtube");
  assert.equal(detect("www.paramountplus.com").name, "Paramount+");
  assert.equal(detect("example.com").id, "unknown");
});

test("distinguishes YouTube playback routes from feed thumbnail previews", () => {
  const isPlayback = context.ParamountSubtitles.isYouTubePlaybackPage;

  assert.equal(isPlayback("https://www.youtube.com/watch?v=video-123"), true);
  assert.equal(isPlayback("https://www.youtube.com/shorts/video-123"), true);
  assert.equal(isPlayback("https://www.youtube-nocookie.com/embed/video-123"), true);
  assert.equal(isPlayback("https://www.youtube.com/"), false);
  assert.equal(isPlayback("https://www.youtube.com/results?search_query=travel"), false);
  assert.equal(isPlayback("https://www.youtube.com/watch"), false);
});

test("removes only explicit bracketed music cues from learning subtitles", () => {
  const normalize = context.ParamountSubtitles.normalizeSubtitle;

  assert.equal(
    normalize("and I'm going to break down [music] how I film cinematic videos"),
    "and I'm going to break down how I film cinematic videos",
  );
  assert.equal(normalize("[ MUSIC ] Welcome back"), "Welcome back");
  assert.equal(normalize("Music is an important part of the film."), "Music is an important part of the film.");
  assert.equal(normalize("I am studying [music theory] this semester."), "I am studying [music theory] this semester.");
  assert.equal(normalize("[Jordan] I write music for films."), "[Jordan] I write music for films.");
});

test("removes repeated speaker-change chevrons from learning subtitles", () => {
  const normalize = context.ParamountSubtitles.normalizeSubtitle;

  assert.equal(
    normalize("I'm going to drive out into the mountains,>> >>arrive at a beautiful mountain lake."),
    "I'm going to drive out into the mountains, arrive at a beautiful mountain lake.",
  );
  assert.equal(normalize(">> Jordan: Welcome back."), "Jordan: Welcome back.");
  assert.equal(normalize("&gt;&gt; Jordan: Welcome back."), "Jordan: Welcome back.");
  assert.equal(normalize("This value is > the previous value."), "This value is > the previous value.");
});

test("recognizes an invalidated extension context without throwing on runtime access", () => {
  const invalidatedContext = vm.createContext({ Math, String, globalThis: null });
  invalidatedContext.globalThis = invalidatedContext;
  invalidatedContext.chrome = { runtime: {} };
  Object.defineProperty(invalidatedContext.chrome.runtime, "id", {
    get() { throw new Error("Extension context invalidated."); },
  });
  vm.runInContext(source, invalidatedContext);

  const namespace = invalidatedContext.ParamountSubtitles;
  assert.equal(namespace.isExtensionContextInvalidated(new Error("Extension context invalidated.")), true);
  assert.equal(namespace.isExtensionContextInvalidated(new Error("network unavailable")), false);
  assert.equal(namespace.hasExtensionContext(), false);
});

test("injects the page bridge into YouTube's main world at document start", () => {
  const bridgeEntry = manifest.content_scripts.find((entry) => entry.js.includes("src/page-bridge.js"));

  assert.equal(bridgeEntry.world, "MAIN");
  assert.equal(bridgeEntry.run_at, "document_start");
  assert.equal(bridgeEntry.matches.includes("https://*.youtube.com/*"), true);
});
