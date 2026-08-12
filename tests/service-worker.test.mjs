import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const workerSource = readFileSync(new URL("../src/service-worker.js", import.meta.url), "utf8");

const createWorker = ({ fetchImpl, proxyUrl = "http://127.0.0.1:8787" }) => {
  let listener;
  const context = vm.createContext({
    AbortController,
    Map,
    URL,
    clearTimeout,
    fetch: fetchImpl,
    setTimeout,
    String,
    chrome: {
      action: { setBadgeBackgroundColor() {}, setBadgeText() {} },
      runtime: {
        onInstalled: { addListener() {} },
        onMessage: { addListener(fn) { listener = fn; } },
      },
      storage: {
        local: {
          get: async () => ({ translationProxyUrl: proxyUrl }),
          remove: async () => undefined,
        },
        session: { get: async () => ({}), set: async () => undefined },
        sync: { get: async () => ({}), set: async () => undefined },
      },
      tabs: { sendMessage: async () => ({}) },
    },
  });
  vm.runInContext(workerSource, context);
  return listener;
};

const send = (listener, message) => new Promise((resolve) => {
  const asyncResponse = listener(message, {}, resolve);
  assert.equal(asyncResponse, true);
});

test("DeepSeek worker sends only subtitle data to the translation proxy", async () => {
  let request;
  const listener = createWorker({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({ ok: true, translation: "没问题。" }),
      };
    },
  });

  const response = await send(listener, {
    type: "DEEPSEEK_TRANSLATE",
    text: "No problem.",
    context: ["Can you help me?"],
  });
  const body = JSON.parse(request.options.body);

  assert.equal(response.ok, true);
  assert.equal(response.translation, "没问题。");
  assert.equal(request.url, "http://127.0.0.1:8787/v1/translate");
  assert.equal("Authorization" in request.options.headers, false);
  assert.deepEqual(Object.keys(body).sort(), ["context", "text"]);
  assert.match(body.context[0], /Can you help me/);
});

test("DeepSeek worker localizes a known proxy error to the default English UI", async () => {
  const listener = createWorker({
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      json: async () => ({ ok: false, error: "服务端尚未配置 DeepSeek API Key" }),
    }),
  });
  const response = await send(listener, { type: "DEEPSEEK_TRANSLATE", text: "Hello" });

  assert.equal(response.ok, false);
  assert.match(response.error, /has not been configured/);
});

test("contextual word lookup uses the same proxy origin and fixed request shape", async () => {
  let request;
  const listener = createWorker({
    proxyUrl: "https://translator.example.com/config-is-ignored",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({
          ok: true,
          entry: {
            lemma: "snuff",
            phrase: "got snuffed",
            partOfSpeech: "verb",
            meaningZh: "被淘汰",
            definitionEn: "To be eliminated from the game.",
          },
        }),
      };
    },
  });

  const response = await send(listener, {
    type: "CONTEXTUAL_WORD_LOOKUP",
    word: "snuffed",
    sentence: "My friend got snuffed.",
    context: ["one", "two", "three", "four", "It was tribal council."],
  });
  const body = JSON.parse(request.options.body);

  assert.equal(request.url, "https://translator.example.com/v1/word-lookup");
  assert.deepEqual(Object.keys(body).sort(), ["context", "sentence", "word"]);
  assert.deepEqual(body.context, ["two", "three", "four", "It was tribal council."]);
  assert.equal(response.ok, true);
  assert.equal(response.entry.phrase, "got snuffed");
  assert.equal(response.entry.meaningZh, "被淘汰");
});

test("proxy URL rejects insecure remote HTTP origins in the default English UI", async () => {
  const listener = createWorker({
    proxyUrl: "http://translator.example.com",
    fetchImpl: async () => assert.fail("fetch should not run"),
  });
  const response = await send(listener, { type: "DEEPSEEK_TRANSLATE", text: "Hello" });

  assert.equal(response.ok, false);
  assert.match(response.error, /must use HTTPS/);
});
