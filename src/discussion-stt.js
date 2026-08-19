(() => {
  const root = globalThis.ParamountSubtitles || {};
  const FLUX_URL = "wss://api.deepgram.com/v2/listen?model=flux-general-en&mip_opt_out=true";
  const MIME_TYPE = "audio/webm;codecs=opus";
  const CHUNK_MILLISECONDS = 80;

  const errorWithCode = (code, message, cause) => Object.assign(new Error(message), { code, cause });

  const normalizeToken = (value) => String(
    typeof value === "string" ? value : value?.accessToken || "",
  ).trim();

  const create = ({
    mediaDevices = globalThis.navigator?.mediaDevices,
    MediaRecorderImpl = globalThis.MediaRecorder,
    WebSocketImpl = globalThis.WebSocket,
    getAccessToken,
    onStateChange = () => undefined,
    onInterim = () => undefined,
    onFinal = () => undefined,
    onDuration = () => undefined,
    onLimit = () => undefined,
    onError = () => undefined,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    setIntervalImpl = globalThis.setInterval,
    clearIntervalImpl = globalThis.clearInterval,
    now = () => Date.now(),
    maxDurationMilliseconds = 120_000,
  } = {}) => {
    let state = "idle";
    let stream = null;
    let recorder = null;
    let socket = null;
    let sessionId = 0;
    let durationTimer = 0;
    let limitTimer = 0;
    let finalizeTimer = 0;
    let startedAt = 0;
    let sendQueue = Promise.resolve();
    let finishResolve = null;

    const setState = (next, detail) => {
      state = next;
      onStateChange(next, detail);
    };

    const stopTracks = () => {
      for (const track of stream?.getTracks?.() || []) track.stop?.();
      stream = null;
    };

    const clearTimers = () => {
      if (durationTimer) clearIntervalImpl(durationTimer);
      if (limitTimer) clearTimeoutImpl(limitTimer);
      if (finalizeTimer) clearTimeoutImpl(finalizeTimer);
      durationTimer = 0;
      limitTimer = 0;
      finalizeTimer = 0;
    };

    const resolveFinish = () => {
      const resolve = finishResolve;
      finishResolve = null;
      resolve?.();
    };

    const finish = () => {
      clearTimers();
      stopTracks();
      recorder = null;
      socket = null;
      sendQueue = Promise.resolve();
      setState("idle");
      resolveFinish();
    };

    const fail = (error) => {
      clearTimers();
      try {
        if (recorder?.state && recorder.state !== "inactive") recorder.stop();
      } catch {
        // The recorder may already be closing after a device failure.
      }
      try { socket?.close?.(); } catch { /* ignore cleanup failures */ }
      stopTracks();
      recorder = null;
      socket = null;
      const normalized = error?.code
        ? error
        : errorWithCode("service_unavailable", error?.message || "语音识别暂时不可用", error);
      setState("error", normalized);
      onError(normalized);
      resolveFinish();
      return normalized;
    };

    const isSupported = () => Boolean(
      mediaDevices?.getUserMedia
      && MediaRecorderImpl
      && WebSocketImpl
      && typeof getAccessToken === "function"
      && (typeof MediaRecorderImpl.isTypeSupported !== "function" || MediaRecorderImpl.isTypeSupported(MIME_TYPE)),
    );

    const handleMessage = (event) => {
      let payload;
      try { payload = JSON.parse(String(event?.data || "")); }
      catch { return; }
      if (payload?.type === "FatalError") {
        fail(errorWithCode("upstream_error", "语音识别暂时不可用"));
        return;
      }
      if (payload?.type !== "TurnInfo") return;
      const transcript = String(payload.transcript || "").trim();
      if (payload.event === "Update") onInterim(transcript);
      if (payload.event === "EndOfTurn") {
        onInterim("");
        if (transcript) onFinal(transcript);
      }
    };

    const startDurationTimers = () => {
      startedAt = now();
      onDuration(0);
      durationTimer = setIntervalImpl(() => {
        onDuration(Math.max(0, Math.floor((now() - startedAt) / 1000)));
      }, 1000);
      limitTimer = setTimeoutImpl(() => {
        onLimit();
        stop().catch(() => undefined);
      }, maxDurationMilliseconds);
    };

    const sendCloseStream = async () => {
      await sendQueue.catch(() => undefined);
      stopTracks();
      if (socket?.readyState === (WebSocketImpl.OPEN ?? 1)) {
        socket.send(JSON.stringify({ type: "CloseStream" }));
      } else {
        finish();
      }
    };

    const startRecorder = () => {
      recorder = new MediaRecorderImpl(stream, { mimeType: MIME_TYPE });
      recorder.ondataavailable = (event) => {
        if (!event?.data || Number(event.data.size) === 0) return;
        sendQueue = sendQueue.then(async () => {
          const chunk = typeof event.data.arrayBuffer === "function"
            ? await event.data.arrayBuffer()
            : event.data;
          if (socket?.readyState === (WebSocketImpl.OPEN ?? 1)) socket.send(chunk);
        });
      };
      recorder.onerror = (event) => fail(errorWithCode(
        "recorder_error",
        "麦克风录音失败",
        event?.error,
      ));
      recorder.onstop = () => { sendCloseStream().catch(fail); };
      recorder.start(CHUNK_MILLISECONDS);
      startDurationTimers();
      setState("listening");
    };

    const start = async () => {
      if (!isSupported()) {
        const error = errorWithCode("unsupported", "当前设备不支持语音输入");
        setState("unavailable", error);
        throw error;
      }
      if (!["idle", "error", "unavailable"].includes(state)) {
        throw errorWithCode("busy", "语音输入正在进行中");
      }
      const currentSession = ++sessionId;
      setState("requesting_permission");
      try {
        stream = await mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (currentSession !== sessionId) {
          stopTracks();
          return false;
        }
        setState("connecting");
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const accessToken = normalizeToken(await getAccessToken());
          if (!accessToken) throw errorWithCode("auth_error", "语音服务尚未配置");
          if (currentSession !== sessionId) {
            stopTracks();
            return false;
          }
          try {
            await new Promise((resolve, reject) => {
              let settled = false;
              const candidate = new WebSocketImpl(FLUX_URL, ["bearer", accessToken]);
              socket = candidate;
              candidate.binaryType = "arraybuffer";
              candidate.onopen = () => {
                settled = true;
                try {
                  startRecorder();
                  resolve();
                } catch (error) {
                  reject(error);
                }
              };
              candidate.onmessage = handleMessage;
              candidate.onerror = () => {
                const error = errorWithCode("connection_error", "无法连接语音识别服务");
                if (!settled) reject(error);
                else fail(error);
              };
              candidate.onclose = () => {
                if (socket !== candidate) return;
                if (!settled) reject(errorWithCode("connection_error", "无法连接语音识别服务"));
                else if (state === "finalizing") finish();
                else if (state === "listening") fail(errorWithCode("connection_closed", "语音识别连接已中断"));
              };
            });
            break;
          } catch (error) {
            try { socket?.close?.(); } catch { /* ignore failed attempt cleanup */ }
            socket = null;
            if (error?.code !== "connection_error" || attempt === 1) throw error;
          }
        }
        return true;
      } catch (error) {
        const code = error?.code || (error?.name === "NotAllowedError" ? "permission_denied" : "service_unavailable");
        const message = code === "permission_denied"
          ? "麦克风未授权，请在浏览器设置中允许"
          : error?.message || "语音识别暂时不可用";
        throw fail(errorWithCode(code, message, error));
      }
    };

    const stop = () => {
      if (state === "finalizing") {
        return new Promise((resolve) => {
          const previous = finishResolve;
          finishResolve = () => { previous?.(); resolve(); };
        });
      }
      if (state !== "listening") return Promise.resolve();
      clearTimers();
      setState("finalizing");
      const finished = new Promise((resolve) => { finishResolve = resolve; });
      finalizeTimer = setTimeoutImpl(() => {
        try { socket?.close?.(); } catch { /* ignore */ }
        finish();
      }, 4000);
      try {
        recorder?.requestData?.();
        if (recorder?.state && recorder.state !== "inactive") recorder.stop();
        else sendCloseStream().catch(fail);
      } catch (error) {
        fail(errorWithCode("recorder_error", "无法完成语音识别", error));
      }
      return finished;
    };

    const abort = () => {
      sessionId += 1;
      clearTimers();
      try {
        if (recorder?.state && recorder.state !== "inactive") recorder.stop();
      } catch { /* ignore */ }
      recorder = null;
      try { socket?.close?.(1000, "client abort"); } catch { /* ignore */ }
      socket = null;
      stopTracks();
      sendQueue = Promise.resolve();
      setState("idle");
      resolveFinish();
    };

    return {
      abort,
      dispose: abort,
      getState: () => state,
      isSupported,
      start,
      stop,
    };
  };

  root.DiscussionSTT = Object.freeze({
    CHUNK_MILLISECONDS,
    FLUX_URL,
    MIME_TYPE,
    create,
  });
  globalThis.ParamountSubtitles = root;
})();
