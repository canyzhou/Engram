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

const createBridge = (tracks, {
  href = "https://example.test/watch",
  playerResponse = null,
  fetchImpl = async () => ({ url: "", headers: { get: () => "" } }),
} = {}) => {
  const video = new FakeVideo(tracks);
  const messages = [];
  const requests = [];
  const windowTarget = new FakeEventTarget();
  const window = {
    fetch: async (...args) => {
      requests.push(args);
      return fetchImpl(...args);
    },
    addEventListener: (...args) => windowTarget.addEventListener(...args),
    postMessage(data) {
      messages.push(data);
      windowTarget.dispatch("message", { source: window, data });
    },
  };
  const pageUrl = new URL(href);
  const player = playerResponse ? { getPlayerResponse: () => playerResponse } : null;
  const document = {
    documentElement: { dataset: {} },
    querySelector: (selector) => {
      if (selector === "video") return video;
      if (selector === "#movie_player") return player;
      return null;
    },
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
    URL,
    WeakMap,
    WeakSet,
    XMLHttpRequest: FakeXhr,
    document,
    globalThis: null,
    location: { href: pageUrl.href, origin: pageUrl.origin, hostname: pageUrl.hostname },
    setInterval: () => 1,
    setTimeout: () => 1,
    window,
  });
  context.globalThis = context;
  vm.runInContext(bridgeSource, context);

  const configure = (detail) => window.postMessage({
    source: "paramount-subtitle-content",
    type: "SET_SUBTITLE_CAPTURE",
    detail,
  });
  const probe = () => window.postMessage({
    source: "paramount-subtitle-content",
    type: "BRIDGE_PROBE",
  });

  return {
    configure,
    messages,
    onMessage: (listener) => windowTarget.addEventListener("message", listener),
    probe,
    requests,
    video,
  };
};

test("keeps bridge readiness separate from capture configuration", () => {
  const bridge = createBridge([]);
  const initialReadyCount = bridge.messages.filter((message) => message.type === "BRIDGE_READY").length;

  bridge.configure({ enabled: true, hide: true, sourceLanguage: "en" });
  bridge.configure({ enabled: false, hide: false, sourceLanguage: "en" });
  assert.equal(
    bridge.messages.filter((message) => message.type === "BRIDGE_READY").length,
    initialReadyCount,
  );

  bridge.probe();
  assert.equal(
    bridge.messages.filter((message) => message.type === "BRIDGE_READY").length,
    initialReadyCount + 1,
  );
});

test("settles the ready and configure handshake without a message loop", () => {
  const bridge = createBridge([]);
  let bridgeReady = false;
  let configureCount = 0;
  bridge.onMessage((event) => {
    if (
      event.data?.source !== "paramount-subtitle-page-bridge"
      || event.data.type !== "BRIDGE_READY"
      || bridgeReady
    ) return;
    bridgeReady = true;
    configureCount += 1;
    bridge.configure({ enabled: true, hide: true, sourceLanguage: "en" });
  });

  bridge.probe();

  assert.equal(bridgeReady, true);
  assert.equal(configureCount, 1);
  assert.equal(
    bridge.messages.filter((message) => message.type === "SET_SUBTITLE_CAPTURE").length,
    1,
  );
});

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

test("loads an authored English YouTube caption timeline without requiring native CC", async () => {
  const json3 = JSON.stringify({
    events: [{ tStartMs: 1_000, dDurationMs: 2_000, segs: [{ utf8: "Hello from YouTube" }] }],
  });
  const playerResponse = {
    videoDetails: { videoId: "video-123" },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          { languageCode: "en", kind: "asr", baseUrl: "https://www.youtube.com/api/timedtext?v=video-123&lang=en&kind=asr" },
          { languageCode: "en-GB", baseUrl: "https://www.youtube.com/api/timedtext?v=video-123&lang=en-GB", name: { simpleText: "English (UK)" } },
        ],
      },
    },
  };
  const bridge = createBridge([], {
    href: "https://www.youtube.com/watch?v=video-123",
    playerResponse,
    fetchImpl: async (url) => ({
      ok: true,
      url,
      headers: { get: () => "application/json" },
      clone() { return this; },
      text: async () => json3,
    }),
  });

  bridge.configure({ enabled: true, hide: true, sourceLanguage: "en" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(bridge.requests.length, 1);
  const requestedUrl = new URL(bridge.requests[0][0]);
  assert.equal(requestedUrl.searchParams.get("lang"), "en-GB");
  assert.equal(requestedUrl.searchParams.get("fmt"), "json3");
  const resource = bridge.messages.findLast((message) => message.type === "NETWORK_RESOURCE");
  assert.equal(resource.detail.mediaKey, "youtube:video-123");
  assert.equal(resource.detail.body, json3);
  assert.equal(resource.detail.captionKind, "subtitles");
  assert.equal(resource.detail.captionLanguage, "en-GB");
  assert.equal(bridge.messages.some((message) => message.type === "YOUTUBE_TRACK_SELECTED"), true);
});
