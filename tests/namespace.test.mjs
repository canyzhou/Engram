import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/namespace.js", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const context = vm.createContext({
  Math,
  String,
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

test("injects the page bridge into YouTube's main world at document start", () => {
  const bridgeEntry = manifest.content_scripts.find((entry) => entry.js.includes("src/page-bridge.js"));

  assert.equal(bridgeEntry.world, "MAIN");
  assert.equal(bridgeEntry.run_at, "document_start");
  assert.equal(bridgeEntry.matches.includes("https://*.youtube.com/*"), true);
});
