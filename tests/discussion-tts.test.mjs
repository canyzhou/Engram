import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/discussion-tts.js", import.meta.url), "utf8");

const flush = () => new Promise((resolve) => setImmediate(resolve));
const waitFor = async (predicate) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await flush();
  }
  throw new Error("Timed out waiting for test condition");
};

const createHarness = ({ holdPlayback = false, progressivePlayback = false, responseStatuses = [] } = {}) => {
  const fetches = [];
  const audios = [];
  const revoked = [];
  const states = [];
  const streamEvents = [];
  let objectUrlIndex = 0;
  let tokenRequests = 0;

  class FakeURL extends URL {
    static createObjectURL() {
      objectUrlIndex += 1;
      return `blob:test-${objectUrlIndex}`;
    }

    static revokeObjectURL(url) {
      revoked.push(url);
    }
  }

  class FakeAudio {
    constructor(url) {
      this.url = url;
      this.paused = false;
      audios.push(this);
    }

    async play() {
      streamEvents.push("play");
      this.onplaying?.();
      if (!holdPlayback && !progressivePlayback) queueMicrotask(() => this.onended?.());
    }

    pause() {
      this.paused = true;
    }
  }

  class FakeEventTarget {
    constructor() {
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || new Set();
      listeners.add(listener);
      this.listeners.set(type, listeners);
    }

    removeEventListener(type, listener) {
      this.listeners.get(type)?.delete(listener);
    }

    dispatch(type, event = {}) {
      const listeners = [...(this.listeners.get(type) || [])];
      this.listeners.delete(type);
      for (const listener of listeners) listener(event);
    }
  }

  class FakeSourceBuffer extends FakeEventTarget {
    appendBuffer(bytes) {
      streamEvents.push(`append-${bytes.byteLength}`);
      queueMicrotask(() => this.dispatch("updateend"));
    }
  }

  class FakeMediaSource extends FakeEventTarget {
    static isTypeSupported(type) {
      return type === "audio/mpeg";
    }

    constructor() {
      super();
      this.readyState = "closed";
      queueMicrotask(() => {
        this.readyState = "open";
        this.dispatch("sourceopen");
      });
    }

    addSourceBuffer() {
      return new FakeSourceBuffer();
    }

    endOfStream() {
      this.readyState = "ended";
      streamEvents.push("stream-ended");
      queueMicrotask(() => audios.at(-1)?.onended?.());
    }
  }

  const context = {
    AbortController,
    Audio: FakeAudio,
    Blob,
    Map,
    Promise,
    URL: FakeURL,
    clearTimeout,
    console,
    fetch: async (url, options) => {
      fetches.push({ url: String(url), options });
      const status = responseStatuses.length ? responseStatuses.shift() : 200;
      if (progressivePlayback && status === 200) {
        let readIndex = 0;
        return {
          ok: true,
          status,
          body: {
            getReader: () => ({
              async read() {
                readIndex += 1;
                streamEvents.push(`read-${readIndex}`);
                if (readIndex === 1) return { done: false, value: new Uint8Array([1, 2]) };
                if (readIndex === 2) return { done: false, value: new Uint8Array([3, 4]) };
                return { done: true };
              },
              async cancel() {},
            }),
          },
        };
      }
      return new Response(new Blob(["audio"]), {
        status,
        headers: { "content-type": "audio/mpeg" },
      });
    },
    ParamountSubtitles: {},
    Response,
    ...(progressivePlayback ? { MediaSource: FakeMediaSource } : {}),
    setTimeout,
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: "discussion-tts.js" });

  const tts = context.ParamountSubtitles.DiscussionTTS.create({
    getAccessToken: async () => {
      tokenRequests += 1;
      return { accessToken: `short-lived-token-${tokenRequests}` };
    },
    onStateChange: (status, detail) => states.push({ status, detail }),
  });

  return { context, tts, fetches, audios, revoked, states, streamEvents, getTokenRequests: () => tokenRequests };
};

test("synthesizes Aura-2 speech with a short-lived bearer token", async () => {
  const harness = createHarness();

  await harness.tts.speak("What is your number one bucket list destination?");
  await flush();

  assert.equal(harness.fetches.length, 1);
  assert.match(harness.fetches[0].url, /api\.deepgram\.com\/v1\/speak/);
  assert.match(harness.fetches[0].url, /model=aura-2-thalia-en/);
  assert.match(harness.fetches[0].url, /encoding=mp3/);
  assert.match(harness.fetches[0].url, /mip_opt_out=true/);
  assert.equal(harness.fetches[0].options.headers.Authorization, "Bearer short-lived-token-1");
  assert.deepEqual(JSON.parse(harness.fetches[0].options.body), {
    text: "What is your number one bucket list destination?",
  });
  assert.deepEqual(harness.states.map(({ status }) => status), ["idle", "loading", "speaking", "idle"]);
});

test("reuses synthesized audio from the in-memory cache", async () => {
  const harness = createHarness();

  await harness.tts.speak("Welcome back.");
  await harness.tts.speak("Welcome back.");
  await flush();

  assert.equal(harness.fetches.length, 1);
  assert.equal(harness.audios.length, 2);
});

test("starts progressive MP3 playback before the complete response arrives", async () => {
  const harness = createHarness({ progressivePlayback: true });

  const played = await harness.tts.speak("Start speaking as soon as possible.");

  assert.equal(played, true);
  assert.ok(harness.streamEvents.indexOf("play") < harness.streamEvents.indexOf("read-3"));
  assert.deepEqual(harness.streamEvents.filter((event) => event.startsWith("append")), ["append-2", "append-2"]);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.tts.getCacheSize())), { bytes: 4, entries: 1 });
  assert.deepEqual(harness.states.map(({ status }) => status), ["idle", "loading", "speaking", "idle"]);
});

test("refreshes a rejected temporary token only once", async () => {
  const harness = createHarness({ responseStatuses: [401, 200] });

  const played = await harness.tts.speak("Try the sentence again.");

  assert.equal(played, true);
  assert.equal(harness.fetches.length, 2);
  assert.equal(harness.getTokenRequests(), 2);
  assert.equal(harness.fetches[1].options.headers.Authorization, "Bearer short-lived-token-2");
});

test("cancel aborts playback and restores the idle state", async () => {
  const harness = createHarness({ holdPlayback: true });
  const speaking = harness.tts.speak("This message keeps playing until cancelled.");
  await waitFor(() => harness.audios.length === 1);

  harness.tts.cancel();
  await speaking;

  assert.equal(harness.audios[0].paused, true);
  assert.equal(harness.states.at(-1).status, "idle");
});

test("splits long text without dropping content", () => {
  const text = `${"A sentence with several words. ".repeat(80)}The end.`;
  const chunks = harnessForSplit().splitText(text, 180);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 180));
  assert.equal(chunks.join(" ").replace(/\s+/g, " ").trim(), text.replace(/\s+/g, " ").trim());
});

function harnessForSplit() {
  return createHarness().context.ParamountSubtitles.DiscussionTTS;
}
