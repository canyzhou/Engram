import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const bridgeSource = readFileSync(new URL("../src/page-bridge.js", import.meta.url), "utf8");

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener.call(this, event);
  }
}

class FakeTrack extends FakeEventTarget {
  constructor({ language, label, kind = "subtitles", mode = "disabled" }) {
    super();
    this.language = language;
    this.label = label;
    this.kind = kind;
    this.mode = mode;
    this.activeCues = [];
    this.default = false;
  }
}

class FakeTrackList extends Array {
  constructor(...tracks) {
    super(...tracks);
    this.target = new FakeEventTarget();
  }

  addEventListener(...args) {
    this.target.addEventListener(...args);
  }
}

class FakeVideo extends FakeEventTarget {
  constructor(tracks) {
    super();
    this.textTracks = new FakeTrackList(...tracks);
    this.currentTime = 12;
    this.currentSrc = "https://example.test/video.m3u8";
    this.duration = 120;
  }
}

const createBridge = (tracks) => {
  const video = new FakeVideo(tracks);
  const messages = [];
  const windowTarget = new FakeEventTarget();
  const window = {
    fetch: async () => ({ url: "", headers: { get: () => "" } }),
    addEventListener: (...args) => windowTarget.addEventListener(...args),
    postMessage(data) {
      messages.push(data);
      windowTarget.dispatch("message", { source: window, data });
    },
  };
  const document = {
    documentElement: {},
    querySelector: (selector) => selector === "video" ? video : null,
    querySelectorAll: (selector) => selector === "video" ? [video] : [],
  };

  class FakeXhr extends FakeEventTarget {
    open() {}
  }

  const context = vm.createContext({
    Array,
    Boolean,
    Error,
    Map,
    MutationObserver: class { observe() {} },
    Number,
    Reflect,
    Request: class {},
    Set,
    String,
    WeakMap,
    WeakSet,
    XMLHttpRequest: FakeXhr,
    document,
    globalThis: null,
    location: { href: "https://example.test/watch", origin: "https://example.test" },
    setInterval: () => 1,
    window,
  });
  context.globalThis = context;
  vm.runInContext(bridgeSource, context);

  const configure = (detail) => window.postMessage({
    source: "paramount-subtitle-content",
    type: "SET_SUBTITLE_CAPTURE",
    detail,
  });

  return { configure, messages, video };
};

test("activates an Off English subtitle track in hidden mode and restores Off", () => {
  const english = new FakeTrack({ language: "en-US", label: "English (U.S.)" });
  const bridge = createBridge([english]);

  bridge.configure({ enabled: true, hide: true, sourceLanguage: "en" });
  assert.equal(english.mode, "hidden");

  english.activeCues = [{ text: "Hello there", startTime: 10, endTime: 14 }];
  english.dispatch("cuechange");
  const cue = bridge.messages.findLast((message) => message.type === "TEXT_TRACK_CUE");
  assert.equal(cue.detail.text, "Hello there");

  bridge.configure({ enabled: false, hide: false, sourceLanguage: "en" });
  assert.equal(english.mode, "disabled");
});

test("keeps the native track visible when hide-native is disabled", () => {
  const english = new FakeTrack({ language: "en", label: "English" });
  const bridge = createBridge([english]);

  bridge.configure({ enabled: true, hide: false, sourceLanguage: "en" });
  assert.equal(english.mode, "showing");

  bridge.configure({ enabled: false, hide: false, sourceLanguage: "en" });
  assert.equal(english.mode, "disabled");
});

test("selects only the requested language when several subtitle tracks are Off", () => {
  const spanish = new FakeTrack({ language: "es", label: "Español" });
  const english = new FakeTrack({ language: "en-US", label: "English (U.S.)" });
  const bridge = createBridge([spanish, english]);

  bridge.configure({ enabled: true, hide: true, sourceLanguage: "en" });
  assert.equal(english.mode, "hidden");
  assert.equal(spanish.mode, "disabled");
});
