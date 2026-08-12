import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const translatorSource = readFileSync(new URL("../src/translator.js", import.meta.url), "utf8");

class TestEventTarget {
  addEventListener() {}
  dispatchEvent() {}
}

const createTranslator = ({ sendMessage, cache }) => {
  const context = vm.createContext({
    CustomEvent: class {},
    EventTarget: TestEventTarget,
    Promise,
    String,
    globalThis: null,
    navigator: {},
    ParamountSubtitles: {
      normalizeSubtitle: (value) => String(value || "").replace(/\s+/g, " ").trim(),
      safeSendMessage: sendMessage,
    },
  });
  context.globalThis = context;
  vm.runInContext(translatorSource, context);
  return new context.ParamountSubtitles.SubtitleTranslator(cache);
};

test("DeepSeek sends at most four normalized context cues", async () => {
  let message;
  const cache = { get: async () => null, set: async () => undefined };
  const translator = createTranslator({
    cache,
    sendMessage: async (payload) => {
      message = payload;
      return { ok: true, translation: "知道了。" };
    },
  });

  const result = await translator.translate("You got it.", { engine: "deepseek" }, {
    context: ["one", "two", "  three  ", "four", "five"],
  });

  assert.equal(result, "知道了。");
  assert.equal(message.type, "DEEPSEEK_TRANSLATE");
  assert.deepEqual([...message.context], ["two", "three", "four", "five"]);
});

test("DeepSeek cache keys include dialogue context", async () => {
  const keys = [];
  const cache = {
    get: async (key) => { keys.push(key); return null; },
    set: async () => undefined,
  };
  const translator = createTranslator({
    cache,
    sendMessage: async () => ({ ok: true, translation: "好了。" }),
  });

  await translator.translate("Fine.", { engine: "deepseek" }, { context: ["Are you hurt?"] });
  await translator.translate("Fine.", { engine: "deepseek" }, { context: ["How was dinner?"] });

  assert.notEqual(keys[0], keys[1]);
  assert.match(keys[0], /Are you hurt/);
  assert.match(keys[1], /How was dinner/);
});

test("DeepSeek requests are not serialized behind an older cue", async () => {
  let releaseFirst;
  const firstPending = new Promise((resolve) => { releaseFirst = resolve; });
  let callCount = 0;
  const translator = createTranslator({
    cache: { get: async () => null, set: async () => undefined },
    sendMessage: async () => {
      callCount += 1;
      if (callCount === 1) await firstPending;
      return { ok: true, translation: `译文${callCount}` };
    },
  });

  const first = translator.translate("First", { engine: "deepseek" });
  const second = translator.translate("Second", { engine: "deepseek" });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(callCount, 2);
  releaseFirst();
  await Promise.all([first, second]);
});
