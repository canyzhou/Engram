import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const dictionarySource = readFileSync(new URL("../src/dictionary.js", import.meta.url), "utf8");

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
  ParamountSubtitles: {},
});
context.globalThis = context;
vm.runInContext(dictionarySource, context);

const { selectDifficultWords } = context.ParamountSubtitles;

test("learning hints skip basic dialogue and keep the useful content word", () => {
  assert.deepEqual(
    [...selectDifficultWords("I want to, like, run around, find idols.")],
    ["idols"],
  );
});

test("learning hints are unique, capped, and returned in sentence order", () => {
  const selected = [...selectDifficultWords(
    "Extraordinarily resilient institutions confronted bureaucratic obstacles and institutions.",
    3,
  )];

  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((word) => word.toLowerCase())).size, 3);
  assert.deepEqual(selected, ["Extraordinarily", "institutions", "bureaucratic"]);
});

test("learning hints ignore likely character names inside a cue", () => {
  assert.deepEqual(
    [...selectDifficultWords("Tell Eleanor about the mysterious artifact.")],
    ["mysterious", "artifact"],
  );
});
