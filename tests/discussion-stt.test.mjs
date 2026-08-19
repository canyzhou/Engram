import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/discussion-stt.js", import.meta.url), "utf8");

const flush = () => new Promise((resolve) => setImmediate(resolve));

const createHarness = ({ permissionError } = {}) => {
  const states = [];
  const interims = [];
  const finals = [];
  const sockets = [];
  const recorders = [];
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];

  class FakeWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;

    constructor(url, protocols) {
      this.url = url;
      this.protocols = protocols;
      this.readyState = FakeWebSocket.CONNECTING;
      this.sent = [];
      sockets.push(this);
      queueMicrotask(() => {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.();
      });
    }

    send(value) {
      this.sent.push(value);
    }

    close() {
      this.readyState = 3;
      queueMicrotask(() => this.onclose?.({ code: 1000 }));
    }

    emitMessage(payload) {
      this.onmessage?.({ data: JSON.stringify(payload) });
    }

    emitClose(code = 1000) {
      this.readyState = 3;
      this.onclose?.({ code });
    }
  }

  class FakeMediaRecorder {
    static isTypeSupported() {
      return true;
    }

    constructor(stream, options) {
      this.stream = stream;
      this.options = options;
      this.state = "inactive";
      recorders.push(this);
    }

    start(interval) {
      this.interval = interval;
      this.state = "recording";
    }

    stop() {
      if (this.state === "inactive") return;
      this.state = "inactive";
      queueMicrotask(() => this.onstop?.());
    }

    emitData(value = "audio") {
      this.ondataavailable?.({ data: new Blob([value]) });
    }
  }

  const context = {
    Blob,
    DOMException,
    JSON,
    Promise,
    URL,
    clearInterval,
    clearTimeout,
    console,
    navigator: {
      mediaDevices: {
        async getUserMedia() {
          if (permissionError) throw permissionError;
          return { getTracks: () => tracks };
        },
      },
    },
    MediaRecorder: FakeMediaRecorder,
    WebSocket: FakeWebSocket,
    ParamountSubtitles: {},
    setInterval,
    setTimeout,
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: "discussion-stt.js" });

  const stt = context.ParamountSubtitles.DiscussionSTT.create({
    getAccessToken: async () => ({ accessToken: "short-lived-token" }),
    onStateChange: (status, detail) => states.push({ status, detail }),
    onInterim: (text) => interims.push(text),
    onFinal: (text) => finals.push(text),
  });

  return { stt, states, interims, finals, sockets, recorders, tracks };
};

test("streams microphone audio and emits Flux transcript updates", async () => {
  const harness = createHarness();

  await harness.stt.start();
  await flush();

  assert.equal(harness.sockets.length, 1);
  assert.match(harness.sockets[0].url, /\/v2\/listen\?/);
  assert.match(harness.sockets[0].url, /model=flux-general-en/);
  assert.match(harness.sockets[0].url, /mip_opt_out=true/);
  assert.deepEqual(Array.from(harness.sockets[0].protocols), ["bearer", "short-lived-token"]);
  assert.equal(harness.recorders[0].interval, 80);
  assert.equal(harness.states.at(-1).status, "listening");

  harness.recorders[0].emitData();
  await flush();
  assert.equal(harness.sockets[0].sent.length, 1);
  assert.ok(harness.sockets[0].sent[0] instanceof ArrayBuffer);

  harness.sockets[0].emitMessage({
    type: "TurnInfo",
    event: "Update",
    transcript: "I would love to visit",
  });
  harness.sockets[0].emitMessage({
    type: "TurnInfo",
    event: "EndOfTurn",
    transcript: "I would love to visit Iceland.",
  });

  assert.equal(harness.interims[0], "I would love to visit");
  assert.equal(harness.interims[1], "");
  assert.equal(harness.finals[0], "I would love to visit Iceland.");

  const stopping = harness.stt.stop();
  await flush();
  assert.equal(harness.states.at(-1).status, "finalizing");
  assert.equal(harness.sockets[0].sent.at(-1), JSON.stringify({ type: "CloseStream" }));
  harness.sockets[0].emitClose();
  await stopping;

  assert.equal(harness.states.at(-1).status, "idle");
  assert.equal(harness.tracks[0].stopped, true);
});

test("reports microphone permission errors without opening a socket", async () => {
  const error = new DOMException("Permission denied", "NotAllowedError");
  const harness = createHarness({ permissionError: error });

  await assert.rejects(harness.stt.start(), /麦克风未授权/);

  assert.equal(harness.sockets.length, 0);
  assert.equal(harness.states.at(-1).status, "error");
  assert.equal(harness.states.at(-1).detail.code, "permission_denied");
});

test("abort closes the active connection and releases the microphone", async () => {
  const harness = createHarness();
  await harness.stt.start();
  await flush();

  harness.stt.abort();
  await flush();

  assert.equal(harness.tracks[0].stopped, true);
  assert.equal(harness.states.at(-1).status, "idle");
});
