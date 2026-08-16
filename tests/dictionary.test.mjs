import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const dictionarySource = readFileSync(new URL("../src/dictionary.js", import.meta.url), "utf8");

const createDictionaryContext = (ParamountSubtitles = {}) => {
  const context = vm.createContext({
    Array,
    Map,
    Math,
    Number,
    Object,
    Promise,
    RegExp,
    Set,
    String,
    globalThis: null,
    ParamountSubtitles,
  });
  context.globalThis = context;
  vm.runInContext(dictionarySource, context);
  return context;
};

const context = createDictionaryContext();

const { lemmaCandidates, selectDifficultWords } = context.ParamountSubtitles;

test("tries likely base forms before an inflected dictionary entry", () => {
  assert.deepEqual([...lemmaCandidates("snuffed")].slice(0, 2), ["snuff", "snuffe"]);
  assert.ok(lemmaCandidates("snuffed").indexOf("snuff") < lemmaCandidates("snuffed").indexOf("snuffed"));
  assert.equal(lemmaCandidates("mysterious")[0], "mysterious");
});

test("recommended learning levels skip ordinary dialogue and intermediate words", () => {
  assert.deepEqual(
    [...selectDifficultWords("I want to, like, run around, find idols.")],
    [],
  );
});

test("recommended levels do not mistake common long words for advanced vocabulary", () => {
  assert.deepEqual(
    [...selectDifficultWords(
      "The interesting university student remembered an important conversation yesterday.",
      { levels: ["c1", "c2"], limit: 5 },
    )],
    [],
  );
});

test("learning hints can include a user-selected intermediate level", () => {
  assert.deepEqual(
    [...selectDifficultWords("I admire mysterious idols.", { levels: ["b1"], limit: 3 })],
    ["admire", "mysterious", "idols"],
  );
});

test("learning hints are unique, capped, and returned in sentence order", () => {
  const selected = [...selectDifficultWords(
    "Extraordinarily resilient institutions confronted bureaucratic obstacles and institutions.",
    { levels: ["b1", "b2", "c1", "c2"], limit: 3 },
  )];

  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((word) => word.toLowerCase())).size, 3);
  assert.deepEqual(selected, ["Extraordinarily", "institutions", "bureaucratic"]);
});

test("learning hints ignore likely character names inside a cue", () => {
  assert.deepEqual(
    [...selectDifficultWords("Tell Eleanor about the mysterious artifact.", { levels: ["b1", "b2"] })],
    ["mysterious", "artifact"],
  );
});

test("learning levels can be selected independently", () => {
  const sentence = "The ambiguous explanation seemed extraordinarily convoluted.";
  assert.deepEqual(
    [...selectDifficultWords(sentence, { levels: ["c1"], limit: 5 })],
    ["ambiguous", "convoluted"],
  );
  assert.deepEqual(
    [...selectDifficultWords(sentence, { levels: ["c2"], limit: 5 })],
    ["extraordinarily"],
  );
});

test("contextual lookup uses the subtitle result while keeping dictionary phonetics", async () => {
  const messages = [];
  const lookupContext = createDictionaryContext({
    normalizeSubtitle: (value) => String(value || "").replace(/\s+/g, " ").trim(),
    safeSendMessage: async (message) => {
      messages.push(message);
      if (message.type === "DICTIONARY_LOOKUP") {
        return {
          ok: true,
          entry: {
            word: "snuff",
            phonetic: "/snʌf/",
            definitions: [{ partOfSpeech: "verb", definition: "To inhale through the nose." }],
          },
        };
      }
      return {
        ok: true,
        entry: {
          lemma: "snuff",
          phrase: "get snuffed",
          partOfSpeech: "verb",
          meaningZh: "被淘汰",
          definitionEn: "To be eliminated from the game.",
        },
      };
    },
  });
  const translator = { translate: async () => assert.fail("fallback translator should not run") };
  const dictionary = new lookupContext.ParamountSubtitles.DictionaryService(translator);

  const entry = await dictionary.lookup("snuffed", { engine: "local" }, {
    sentence: "My friend get snuffed.",
    context: ["It was tribal council."],
  });

  assert.equal(entry.lemma, "snuff");
  assert.equal(entry.phrase, "get snuffed");
  assert.equal(entry.gloss, "被淘汰");
  assert.equal(entry.definition, "To be eliminated from the game.");
  assert.equal(entry.phonetic, "/snʌf/");
  assert.equal(entry.contextual, true);
  assert.equal(messages[1].sentence, "My friend get snuffed.");
  assert.deepEqual(messages[1].context, ["It was tribal council."]);
});

test("contextual backend failure falls back to the selected translation engine", async () => {
  const lookupContext = createDictionaryContext({
    normalizeSubtitle: (value) => String(value || "").trim(),
    safeSendMessage: async (message) => message.type === "DICTIONARY_LOOKUP"
      ? { ok: true, entry: { word: "snuff", definitions: [{ partOfSpeech: "verb", definition: "fallback" }] } }
      : { ok: false, error: "proxy unavailable" },
  });
  let translatedText = "";
  const dictionary = new lookupContext.ParamountSubtitles.DictionaryService({
    translate: async (text) => { translatedText = text; return "熄灭"; },
  });

  const entry = await dictionary.lookup("snuffed", { engine: "google" }, {
    sentence: "My friend get snuffed.",
  });

  assert.equal(translatedText, "snuff");
  assert.equal(entry.gloss, "熄灭");
  assert.equal(entry.contextual, false);
});

test("coalesces concurrent lookups for the same word and subtitle", async () => {
  const messages = [];
  let releaseRequests;
  const requestGate = new Promise((resolve) => { releaseRequests = resolve; });
  const lookupContext = createDictionaryContext({
    normalizeSubtitle: (value) => String(value || "").trim(),
    safeSendMessage: async (message) => {
      messages.push(message);
      await requestGate;
      return message.type === "DICTIONARY_LOOKUP"
        ? { ok: true, entry: { word: "headache", phonetic: "/ˈhedeɪk/", definitions: [] } }
        : { ok: true, entry: { lemma: "headache", phrase: "", partOfSpeech: "noun", meaningZh: "麻烦", definitionEn: "A problem." } };
    },
  });
  const dictionary = new lookupContext.ParamountSubtitles.DictionaryService({
    translate: async () => assert.fail("fallback translator should not run"),
  });
  const options = { sentence: "It saved me many headaches." };

  const first = dictionary.lookup("headaches", { engine: "local" }, options);
  const second = dictionary.lookup("headaches", { engine: "local" }, options);
  assert.equal(messages.length, 2);
  releaseRequests();

  const [firstEntry, secondEntry] = await Promise.all([first, second]);
  assert.deepEqual(firstEntry, secondEntry);
  assert.equal(messages.length, 2);
});

test("returns contextual meaning without waiting for a slower phonetic service", async () => {
  let releaseDictionary;
  const dictionaryGate = new Promise((resolve) => { releaseDictionary = resolve; });
  const lookupContext = createDictionaryContext({
    normalizeSubtitle: (value) => String(value || "").trim(),
    safeSendMessage: async (message) => {
      if (message.type === "DICTIONARY_LOOKUP") {
        await dictionaryGate;
        return { ok: true, entry: { word: "headache", phonetic: "/ˈhedeɪk/", definitions: [] } };
      }
      return { ok: true, entry: { lemma: "headache", phrase: "", partOfSpeech: "noun", meaningZh: "麻烦", definitionEn: "A problem." } };
    },
  });
  const dictionary = new lookupContext.ParamountSubtitles.DictionaryService({
    translate: async () => assert.fail("fallback translator should not run"),
  });
  const settings = { engine: "local" };
  const options = { sentence: "It saved me many headaches." };

  const entry = await dictionary.lookup("headaches", settings, options);
  assert.equal(entry.gloss, "麻烦");
  assert.equal(entry.phonetic, "");

  releaseDictionary();
  await new Promise((resolve) => setImmediate(resolve));
  const cached = await dictionary.lookup("headaches", settings, options);
  assert.equal(cached.phonetic, "/ˈhedeɪk/");
});
