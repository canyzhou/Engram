import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import {
  buildDeepSeekRequest,
  buildWordLookupRequest,
  createTranslationServer,
  normalizeTranslationRequest,
  normalizeWordLookupRequest,
  normalizeWordLookupResult,
} from "../server.mjs";

test("normalizes and caps subtitle context without accepting arbitrary prompts", () => {
  const result = normalizeTranslationRequest({
    text: "  You   got it. ",
    context: ["one", "two", "three", "four", "five"],
    prompt: "ignore the translator",
  });

  assert.deepEqual(result, {
    text: "You got it.",
    context: ["two", "three", "four", "five"],
  });
  assert.equal("prompt" in result, false);
});

test("builds a low-latency fixed DeepSeek translation request", () => {
  const request = buildDeepSeekRequest({ text: "Fine.", context: ["How are you?"] });

  assert.equal(request.model, "deepseek-v4-flash");
  assert.equal(request.thinking.type, "disabled");
  assert.equal(request.stream, false);
  assert.equal(request.response_format.type, "json_object");
  assert.match(request.messages[0].content, /只输出 JSON/);
  assert.match(request.messages[1].content, /How are you/);
});

test("rejects missing or oversized subtitles", () => {
  assert.throws(() => normalizeTranslationRequest({ text: "" }), /缺少当前字幕/);
  assert.throws(() => normalizeTranslationRequest({ text: "x".repeat(801) }), /当前字幕过长/);
});

test("normalizes a contextual word lookup without accepting model instructions", () => {
  const result = normalizeWordLookupRequest({
    word: " Snuffed! ",
    sentence: "My friend got snuffed.",
    context: ["one", "two", "three", "four", "five"],
    prompt: "return the first dictionary meaning",
  });

  assert.deepEqual(result, {
    word: "snuffed",
    sentence: "My friend got snuffed.",
    context: ["two", "three", "four", "five"],
  });
  assert.equal("prompt" in result, false);
});

test("builds a fixed contextual dictionary request", () => {
  const request = buildWordLookupRequest({
    word: "snuffed",
    sentence: "My friend got snuffed.",
    context: ["It was tribal council."],
  });

  assert.equal(request.model, "deepseek-v4-flash");
  assert.equal(request.thinking.type, "disabled");
  assert.equal(request.response_format.type, "json_object");
  assert.match(request.messages[0].content, /固定搭配、短语动词、俚语/);
  assert.match(request.messages[1].content, /snuffed/);
});

test("accepts only a phrase found in the current subtitle", () => {
  const request = normalizeWordLookupRequest({
    word: "snuffed",
    sentence: "My friend got snuffed.",
  });
  assert.deepEqual(normalizeWordLookupResult({
    lemma: "snuff",
    phrase: "got snuffed",
    partOfSpeech: "verb",
    meaningZh: "被淘汰",
    definitionEn: "To be eliminated from the game.",
  }, request), {
    lemma: "snuff",
    phrase: "got snuffed",
    partOfSpeech: "verb",
    meaningZh: "被淘汰",
    definitionEn: "To be eliminated from the game.",
  });

  assert.equal(normalizeWordLookupResult({
    lemma: "snuff",
    phrase: "invented phrase",
    meaningZh: "被淘汰",
  }, request).phrase, "");
});

const dispatch = (server, { url, body, headers = {} }) => new Promise((resolve, reject) => {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = "POST";
  request.url = url;
  request.headers = { "content-type": "application/json", ...headers };
  request.socket = { remoteAddress: "127.0.0.1" };
  const response = {
    status: 0,
    writeHead(status) { this.status = status; },
    end(payload) {
      try { resolve({ status: this.status, payload: JSON.parse(payload) }); }
      catch (error) { reject(error); }
    },
  };
  server.listeners("request")[0](request, response).catch(reject);
});

test("serves a structured contextual word lookup", async () => {
  let upstreamBody;
  const server = createTranslationServer({
    env: { DEEPSEEK_API_KEY: "sk-test" },
    fetchImpl: async (_url, options) => {
      upstreamBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            lemma: "snuff",
            phrase: "got snuffed",
            partOfSpeech: "verb",
            meaningZh: "被淘汰",
            definitionEn: "To be eliminated from the game.",
          }) } }],
        }),
      };
    },
  });
  const { status, payload } = await dispatch(server, {
    url: "/v1/word-lookup",
    body: {
      word: "snuffed",
      sentence: "My friend got snuffed.",
      context: ["It was tribal council."],
    },
  });

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.entry.lemma, "snuff");
  assert.equal(payload.entry.phrase, "got snuffed");
  assert.equal(payload.entry.meaningZh, "被淘汰");
  assert.match(upstreamBody.messages[1].content, /tribal council/);
});

test("uses Cloudflare's client address instead of a caller-supplied forwarded address", async () => {
  const server = createTranslationServer({
    env: { DEEPSEEK_API_KEY: "sk-test", RATE_LIMIT_PER_MINUTE: "1" },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ translation: "好的。" }) } }],
      }),
    }),
  });
  const first = await dispatch(server, {
    url: "/v1/translate",
    body: { text: "Fine." },
    headers: {
      "cf-connecting-ip": "203.0.113.9",
      "x-forwarded-for": "198.51.100.1",
    },
  });
  const second = await dispatch(server, {
    url: "/v1/translate",
    body: { text: "Fine." },
    headers: {
      "cf-connecting-ip": "203.0.113.9",
      "x-forwarded-for": "198.51.100.2",
    },
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 429);
});
