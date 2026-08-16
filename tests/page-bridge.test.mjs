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
  const playerActions = [];
  const playerModules = [];
  let playerTrack = null;
  let playerSubtitlesOn = false;
  const player = playerResponse ? {
    getPlayerResponse: () => playerResponse,
    getOptions: () => [...playerModules],
    getOption(module, option) {
      if (option === "track") return playerTrack;
      if (option === "tracklist") {
        return (playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []).map((track) => ({
          languageCode: track.languageCode,
          kind: track.kind,
          vssId: track.vssId,
        }));
      }
      return null;
    },
    isSubtitlesOn: () => playerSubtitlesOn,
    loadModule(module) {
      if (!playerModules.includes(module)) playerModules.push(module);
      playerActions.push({ type: "loadModule", module });
    },
    setOption(module, option, value) {
      if (option === "track") playerTrack = value;
      playerActions.push({ type: "setOption", module, option, value });
    },
    toggleSubtitlesOn() {
      playerSubtitlesOn = !playerSubtitlesOn;
      playerActions.push({ type: "toggleSubtitlesOn", enabled: playerSubtitlesOn });
    },
    unloadModule(module) {
      const index = playerModules.indexOf(module);
      if (index >= 0) playerModules.splice(index, 1);
      playerActions.push({ type: "unloadModule", module });
    },
  } : null;
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

    send() {}
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
    URLSearchParams,
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
    fetch: (...args) => window.fetch(...args),
    messages,
    onMessage: (listener) => windowTarget.addEventListener("message", listener),
    player,
    playerActions,
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
  const json3 = `)]}'\n${JSON.stringify({
    events: [{ tStartMs: 1_000, dDurationMs: 2_000, segs: [{ utf8: "Hello from YouTube" }] }],
  })}`;
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
  const selected = bridge.messages.findLast((message) => message.type === "YOUTUBE_TRACK_SELECTED");
  assert.equal(selected.detail.cueCount, 1);
  assert.equal(selected.detail.authorized, false);
});

test("keeps YouTube caption metadata when the native player loads the authorized track", async () => {
  const json3 = JSON.stringify({
    events: [{ tStartMs: 500, dDurationMs: 1_000, segs: [{ utf8: "Native player cue" }] }],
  });
  const bridge = createBridge([], {
    href: "https://www.youtube.com/watch?v=native-video",
    playerResponse: { videoDetails: { videoId: "native-video" } },
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      url,
      headers: { get: () => "application/json" },
      clone() { return this; },
      text: async () => json3,
    }),
  });

  await bridge.fetch("https://www.youtube.com/api/timedtext?v=native-video&lang=en&kind=asr&fmt=json3");
  await new Promise((resolve) => setImmediate(resolve));

  const resource = bridge.messages.findLast((message) => message.type === "NETWORK_RESOURCE");
  assert.equal(resource.detail.captionKind, "asr");
  assert.equal(resource.detail.captionLanguage, "en");
  assert.equal(resource.detail.mediaKey, "youtube:native-video");
});

test("retries an empty YouTube caption response with the page player PO token", async () => {
  const json3 = JSON.stringify({
    events: [
      { tStartMs: 1_000, dDurationMs: 1_000, segs: [{ utf8: "First cue" }] },
      { tStartMs: 2_000, dDurationMs: 1_000, segs: [{ utf8: "Second cue" }] },
    ],
  });
  const poToken = "page-bound-po-token";
  const playerResponse = {
    videoDetails: { videoId: "protected-video" },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            languageCode: "en",
            kind: "asr",
            baseUrl: "https://www.youtube.com/api/timedtext?v=protected-video&lang=en&kind=asr",
            name: { simpleText: "English (auto-generated)" },
          },
        ],
      },
    },
  };
  const bridge = createBridge([], {
    href: "https://www.youtube.com/watch?v=protected-video",
    playerResponse,
    fetchImpl: async (input) => {
      const url = String(input);
      const isCaption = url.includes("/api/timedtext");
      const authorized = isCaption && new URL(url).searchParams.get("pot") === poToken;
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => "application/json" },
        clone() { return this; },
        text: async () => authorized ? json3 : "",
      };
    },
  });

  bridge.configure({ enabled: true, hide: true, sourceLanguage: "en" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(bridge.messages.some((message) => message.type === "YOUTUBE_TRACK_SELECTED"), false);
  assert.equal(bridge.messages.some((message) => message.type === "NETWORK_RESOURCE"), false);
  assert.equal(bridge.messages.some((message) => message.type === "YOUTUBE_TRACK_WAITING_FOR_TOKEN"), true);
  const nativeRequest = bridge.messages.findLast((message) => message.type === "YOUTUBE_NATIVE_TRACK_REQUESTED");
  assert.equal(nativeRequest.detail.language, "en");
  assert.equal(nativeRequest.detail.kind, "asr");
  assert.equal(bridge.playerActions.some((action) => action.type === "loadModule" && action.module === "captions"), true);
  const selectedNativeTrack = bridge.playerActions.find((action) => action.type === "setOption" && action.option === "track");
  assert.equal(selectedNativeTrack.value.languageCode, "en");
  assert.equal(selectedNativeTrack.value.kind, "asr");
  assert.equal(bridge.player.isSubtitlesOn(), true);

  await bridge.fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    body: JSON.stringify({
      videoId: "protected-video",
      context: { client: { clientName: "WEB" } },
      serviceIntegrityDimensions: { poToken },
    }),
  });
  bridge.configure({ enabled: true, hide: true, sourceLanguage: "en" });
  await new Promise((resolve) => setImmediate(resolve));

  const captionRequests = bridge.requests
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/timedtext"));
  assert.equal(captionRequests.length, 2);
  const authorizedRequest = new URL(captionRequests[1]);
  assert.equal(authorizedRequest.searchParams.get("pot"), poToken);
  assert.equal(authorizedRequest.searchParams.get("potc"), "1");
  assert.equal(authorizedRequest.searchParams.get("c"), "WEB");
  const resource = bridge.messages.findLast((message) => message.type === "NETWORK_RESOURCE");
  assert.equal(new URL(resource.detail.url).searchParams.get("pot"), "redacted");
  assert.equal(resource.detail.body, json3);
  const selected = bridge.messages.findLast((message) => message.type === "YOUTUBE_TRACK_SELECTED");
  assert.equal(selected.detail.cueCount, 2);
  assert.equal(selected.detail.authorized, true);
  assert.equal(JSON.stringify(bridge.messages).includes(poToken), false);
});

test("does not report a YouTube track as selected when its response has no usable cues", async () => {
  const playerResponse = {
    videoDetails: { videoId: "empty-video" },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            languageCode: "en",
            baseUrl: "https://www.youtube.com/api/timedtext?v=empty-video&lang=en&pot=existing-token",
          },
        ],
      },
    },
  };
  const bridge = createBridge([], {
    href: "https://www.youtube.com/watch?v=empty-video",
    playerResponse,
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      url,
      headers: { get: () => "application/json" },
      clone() { return this; },
      text: async () => JSON.stringify({ events: [] }),
    }),
  });

  bridge.configure({ enabled: true, hide: true, sourceLanguage: "en" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(bridge.messages.some((message) => message.type === "NETWORK_RESOURCE"), false);
  assert.equal(bridge.messages.some((message) => message.type === "YOUTUBE_TRACK_SELECTED"), false);
  const error = bridge.messages.findLast((message) => message.type === "YOUTUBE_TRACK_ERROR");
  assert.match(error.detail.message, /no usable cues/i);
  assert.equal(bridge.player.isSubtitlesOn(), true);

  bridge.configure({ enabled: false, hide: false, sourceLanguage: "en" });
  assert.equal(bridge.player.isSubtitlesOn(), false);
  assert.equal(bridge.playerActions.some((action) => action.type === "unloadModule" && action.module === "captions"), true);
});
