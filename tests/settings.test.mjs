import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const settingsSource = readFileSync(new URL("../src/settings.js", import.meta.url), "utf8");

const createSettingsStore = (chrome) => {
  const context = vm.createContext({
    Object,
    Promise,
    RegExp,
    Set,
    String,
    chrome,
    globalThis: null,
    ParamountSubtitles: {},
  });
  context.globalThis = context;
  vm.runInContext(settingsSource, context);
  return new context.ParamountSubtitles.SettingsStore();
};

test("hides the running status overlay by default", async () => {
  const store = createSettingsStore({ runtime: {} });

  await store.ready;

  assert.equal(store.value.debugToast, false);
  assert.equal(store.value.uiLanguage, "en");
  assert.deepEqual([...store.value.learningLevels], ["c1", "c2"]);
});

test("skips stale storage APIs when the extension context has no runtime id", async () => {
  let storageCalls = 0;
  const store = createSettingsStore({
    runtime: {},
    storage: {
      sync: {
        get: async () => { storageCalls += 1; },
        set: async () => { storageCalls += 1; },
      },
    },
  });

  await store.ready;
  const value = await store.update({ mode: "english" });

  assert.equal(storageCalls, 0);
  assert.equal(value.mode, "english");
});

test("handles context invalidation while a storage operation is in flight", async () => {
  const invalidated = () => Promise.reject(new Error("Extension context invalidated."));
  const store = createSettingsStore({
    runtime: { id: "test-extension" },
    storage: { sync: { get: invalidated, set: invalidated } },
  });

  await assert.doesNotReject(store.ready);
  await assert.doesNotReject(store.update({ fontSize: 32 }));
  assert.equal(store.value.fontSize, 32);
});

test("does not hide unrelated storage failures", async () => {
  const store = createSettingsStore({
    runtime: { id: "test-extension" },
    storage: {
      sync: {
        get: async () => ({}),
        set: async () => { throw new Error("storage quota exceeded"); },
      },
    },
  });

  await store.ready;
  await assert.rejects(store.update({ fontSize: 32 }), /storage quota exceeded/);
});
