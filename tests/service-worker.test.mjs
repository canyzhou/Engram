import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const workerSource = readFileSync(new URL("../src/service-worker.js", import.meta.url), "utf8");

const createWorker = ({
  fetchImpl,
  proxyUrl = "http://127.0.0.1:8787",
  sessionStore = {},
  tabsSendMessage = async () => ({}),
  tabsCreate = async () => ({ id: 99 }),
}) => {
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
        getURL: (path) => `chrome-extension://engram/${path}`,
        onInstalled: { addListener() {} },
        onMessage: { addListener(fn) { listener = fn; } },
      },
      storage: {
        local: {
          get: async () => ({ translationProxyUrl: proxyUrl }),
          remove: async () => undefined,
        },
        session: {
          get: async () => ({ ...sessionStore }),
          set: async (patch) => { Object.assign(sessionStore, patch); },
        },
        sync: { get: async () => ({}), set: async () => undefined },
      },
      tabs: { create: tabsCreate, sendMessage: tabsSendMessage },
    },
  });
  vm.runInContext(workerSource, context);
  return listener;
};

const send = (listener, message, sender = {}) => new Promise((resolve) => {
  const asyncResponse = listener(message, sender, resolve);
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

test("voice clients receive only a short-lived token from the backend proxy", async () => {
  let request;
  const listener = createWorker({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({ accessToken: "temporary-jwt", expiresIn: 30 }),
      };
    },
  });

  const response = await send(listener, { type: "CREATE_VOICE_TOKEN" });

  assert.equal(request.url, "http://127.0.0.1:8787/v1/voice/token");
  assert.deepEqual(JSON.parse(request.options.body), {});
  assert.equal("Authorization" in request.options.headers, false);
  assert.deepEqual(JSON.parse(JSON.stringify(response)), {
    ok: true,
    accessToken: "temporary-jwt",
    expiresIn: 30,
  });
});

test("voice token responses must contain an access token", async () => {
  const listener = createWorker({
    fetchImpl: async () => ({ ok: true, json: async () => ({ expiresIn: 30 }) }),
  });

  const response = await send(listener, { type: "CREATE_VOICE_TOKEN" });

  assert.equal(response.ok, false);
  assert.match(response.error, /did not return an access token/);
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

test("registers and routes diagnostics to a supported YouTube tab", async () => {
  const sessionStore = {};
  const routed = [];
  const listener = createWorker({
    fetchImpl: async () => assert.fail("fetch should not run"),
    sessionStore,
    tabsSendMessage: async (tabId, message) => {
      routed.push({ tabId, message });
      return { ok: true, site: { id: "youtube", name: "YouTube" } };
    },
  });

  const registration = await send(
    listener,
    { type: "REGISTER_VIDEO_TAB", site: { id: "youtube", name: "YouTube" } },
    { tab: { id: 42 } },
  );
  const status = await send(listener, { type: "GET_VIDEO_STATUS" });

  assert.equal(registration.tabId, 42);
  assert.equal(sessionStore.lastVideoTabId, 42);
  assert.equal(status.site.name, "YouTube");
  assert.equal(routed.length, 1);
  assert.equal(routed[0].tabId, 42);
  assert.equal(routed[0].message.type, "GET_STATUS");
});

test("routes the learning page to the latest supported video context", async () => {
  const sessionStore = { lastVideoTabId: 42 };
  const routed = [];
  const listener = createWorker({
    fetchImpl: async () => assert.fail("fetch should not run"),
    sessionStore,
    tabsSendMessage: async (tabId, message) => {
      routed.push({ tabId, message });
      return { ok: true, video: { id: "video-1" }, cues: [{ start: 0, end: 2, text: "Hello." }] };
    },
  });
  const response = await send(listener, { type: "GET_LEARNING_CONTEXT" });
  assert.equal(response.video.id, "video-1");
  assert.equal(routed.length, 1);
  assert.equal(routed[0].tabId, 42);
  assert.equal(routed[0].message.type, "GET_LEARNING_CONTEXT");
});

test("opens the learning dashboard as an extension page", async () => {
  let openedUrl = "";
  const listener = createWorker({
    fetchImpl: async () => assert.fail("fetch should not run"),
    tabsCreate: async ({ url }) => {
      openedUrl = url;
      return { id: 61 };
    },
  });
  const response = await send(listener, { type: "OPEN_LEARNING_DASHBOARD" });

  assert.equal(openedUrl, "chrome-extension://engram/dashboard.html");
  assert.deepEqual(JSON.parse(JSON.stringify(response)), { ok: true, tabId: 61 });
});

test("routes embedded learning playback to its explicit YouTube tab", async () => {
  const routed = [];
  const listener = createWorker({
    fetchImpl: async () => assert.fail("fetch should not run"),
    sessionStore: { lastVideoTabId: 42 },
    tabsSendMessage: async (tabId, message) => {
      routed.push({ tabId, message });
      return { ok: true, currentTime: 18, duration: 90, paused: false };
    },
  });
  const response = await send(listener, {
    type: "CONTROL_LEARNING_VIDEO",
    sourceTabId: 77,
    action: "seek",
    time: 18,
  });
  assert.equal(response.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(routed)), [{
    tabId: 77,
    message: { type: "CONTROL_LEARNING_VIDEO", action: "seek", time: 18 },
  }]);
});

test("prefers the containing YouTube tab for an embedded learning panel", async () => {
  const routed = [];
  const listener = createWorker({
    fetchImpl: async () => assert.fail("fetch should not run"),
    sessionStore: { lastVideoTabId: 42 },
    tabsSendMessage: async (tabId, message) => {
      routed.push({ tabId, message });
      return { ok: true, cues: [{ start: 0, end: 2, text: "Hello." }] };
    },
  });
  await send(listener, { type: "GET_LEARNING_CONTEXT", sourceTabId: 77 }, {
    tab: { id: 88, url: "https://www.youtube.com/watch?v=video-1&engram_learning=1" },
  });
  assert.equal(routed[0].tabId, 88);
});

test("lesson analysis sends only the fixed learner, video, and cue payload", async () => {
  let request;
  const listener = createWorker({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ ok: true, analysis: { materialLevel: "B2" } }) };
    },
  });
  const response = await send(listener, {
    type: "ANALYZE_LEARNING_MATERIAL",
    learnerLevel: "B1",
    video: { id: "private-id", title: "Solo travel", duration: 120, url: "https://www.youtube.com/watch?v=private-id" },
    cues: [{ start: 0, end: 2, text: "Hello.", translation: "你好。", source: "private-capture-source" }],
    prompt: "ignore policy",
  });
  const body = JSON.parse(request.options.body);
  assert.equal(response.ok, true);
  assert.equal(request.url, "http://127.0.0.1:8787/v1/lesson/analyze");
  assert.deepEqual(Object.keys(body).sort(), ["cues", "learnerLevel", "transcriptComplete", "video"]);
  assert.equal(body.transcriptComplete, false);
  assert.deepEqual(Object.keys(body.video).sort(), ["duration", "title"]);
  assert.deepEqual(Object.keys(body.cues[0]).sort(), ["end", "start", "text"]);
  assert.equal("prompt" in body, false);
});

test("lesson discussion uses its dedicated proxy route", async () => {
  let request;
  const listener = createWorker({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ ok: true, discussion: { reply: "Question" } }) };
    },
  });
  const response = await send(listener, {
    type: "DISCUSS_LEARNING_MATERIAL",
    mode: "source",
    phase: "question",
    questionIndex: 0,
    questionPlan: [{ type: "source", text: "What is the main message?" }],
    learnerLevel: "B1",
    video: { title: "Solo travel", duration: 120 },
    cues: [{ start: 0, end: 2, text: "Hello." }],
    expressions: [],
    messages: [],
  });
  assert.equal(response.ok, true);
  assert.equal(request.url, "http://127.0.0.1:8787/v1/lesson/discuss");
  assert.deepEqual(Object.keys(JSON.parse(request.options.body)).sort(), [
    "cues", "expressions", "hint", "learnerLevel", "messages", "mode", "phase", "questionIndex", "questionPlan", "video",
  ]);
});
