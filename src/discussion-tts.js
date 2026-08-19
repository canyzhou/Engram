(() => {
  const root = globalThis.ParamountSubtitles || {};
  const MODEL = "aura-2-thalia-en";
  const MAX_CHUNK_CHARACTERS = 1800;
  const MAX_CACHE_BYTES = 20 * 1024 * 1024;

  const errorWithCode = (code, message, cause) => Object.assign(new Error(message), { code, cause });

  const splitText = (value, maximum = MAX_CHUNK_CHARACTERS) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return [];
    const chunks = [];
    let remaining = text;
    while (remaining.length > maximum) {
      const window = remaining.slice(0, maximum + 1);
      const sentenceMatches = [...window.matchAll(/[.!?]["')\]]?\s+/g)];
      let splitAt = sentenceMatches.at(-1)?.index;
      if (Number.isFinite(splitAt)) {
        splitAt += sentenceMatches.at(-1)[0].length;
      } else {
        splitAt = window.lastIndexOf(" ");
      }
      if (!Number.isFinite(splitAt) || splitAt < Math.floor(maximum * 0.45)) splitAt = maximum;
      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  };

  const create = ({
    getAccessToken,
    fetchImpl = globalThis.fetch,
    AudioImpl = globalThis.Audio,
    BlobImpl = globalThis.Blob,
    MediaSourceImpl = globalThis.MediaSource,
    URLImpl = globalThis.URL,
    onStateChange = () => undefined,
    onUsage = () => undefined,
    onPlaybackStart = () => undefined,
    onError = () => undefined,
    maxCacheBytes = MAX_CACHE_BYTES,
  } = {}) => {
    let state = "idle";
    let controller = null;
    let player = null;
    let playerResolve = null;
    let generation = 0;
    let cacheBytes = 0;
    const cache = new Map();

    const setState = (next, detail) => {
      state = next;
      onStateChange(next, detail);
    };

    const isSupported = () => Boolean(
      typeof getAccessToken === "function"
      && typeof fetchImpl === "function"
      && AudioImpl
      && BlobImpl
      && URLImpl?.createObjectURL,
    );

    const canStreamPlayback = () => Boolean(
      MediaSourceImpl
      && typeof MediaSourceImpl.isTypeSupported === "function"
      && MediaSourceImpl.isTypeSupported("audio/mpeg"),
    );

    const revokeEntries = (entries) => {
      for (const entry of entries || []) {
        URLImpl.revokeObjectURL?.(entry.url);
        cacheBytes = Math.max(0, cacheBytes - entry.size);
      }
    };

    const trimCache = () => {
      while (cacheBytes > maxCacheBytes && cache.size) {
        const [oldestKey, entries] = cache.entries().next().value;
        cache.delete(oldestKey);
        revokeEntries(entries);
      }
    };

    const remember = (key, entries) => {
      const previous = cache.get(key);
      if (previous) {
        cache.delete(key);
        revokeEntries(previous);
      }
      cache.set(key, entries);
      cacheBytes += entries.reduce((sum, entry) => sum + entry.size, 0);
      trimCache();
    };

    const touch = (key) => {
      const entries = cache.get(key);
      if (!entries) return null;
      cache.delete(key);
      cache.set(key, entries);
      return entries;
    };

    const stopPlayer = () => {
      if (!player) return;
      const resolve = playerResolve;
      playerResolve = null;
      player.onplaying = null;
      player.onended = null;
      player.onerror = null;
      try { player.pause?.(); } catch { /* ignore */ }
      try { player.currentTime = 0; } catch { /* ignore */ }
      player = null;
      resolve?.(false);
    };

    const cancel = () => {
      generation += 1;
      controller?.abort?.();
      controller = null;
      stopPlayer();
      if (state !== "disabled" && state !== "unavailable") setState("idle");
    };

    const fetchChunkResponse = async (text, activeGeneration) => {
      let response;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const tokenResponse = await getAccessToken();
        const accessToken = String(
          typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.accessToken || "",
        ).trim();
        if (!accessToken) throw errorWithCode("auth_error", "语音服务尚未配置");
        if (activeGeneration !== generation) throw errorWithCode("cancelled", "朗读已取消");
        controller = new AbortController();
        const url = new URLImpl("https://api.deepgram.com/v1/speak");
        url.searchParams.set("model", MODEL);
        url.searchParams.set("encoding", "mp3");
        url.searchParams.set("speed", "1.0");
        url.searchParams.set("mip_opt_out", "true");
        response = await fetchImpl(url.toString(), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal,
        });
        const authenticationFailed = response.status === 401 || response.status === 403;
        if (authenticationFailed && attempt === 0) continue;
        if (!response.ok) {
          const code = authenticationFailed
            ? "auth_error"
            : response.status === 429
              ? "rate_limited"
              : "upstream_error";
          throw errorWithCode(code, "朗读暂时不可用，可稍后重试");
        }
        break;
      }
      onUsage(text.length);
      return response;
    };

    const responseToEntry = async (response) => {
      const blob = typeof response.blob === "function"
        ? await response.blob()
        : new BlobImpl([await response.arrayBuffer()], { type: "audio/mpeg" });
      if (!blob?.size) throw errorWithCode("empty_audio", "语音服务没有返回音频");
      return {
        url: URLImpl.createObjectURL(blob),
        size: Number(blob.size) || 0,
      };
    };

    const playEntry = (entry, activeGeneration) => new Promise((resolve, reject) => {
      if (activeGeneration !== generation) {
        resolve(false);
        return;
      }
      player = new AudioImpl(entry.url);
      playerResolve = resolve;
      player.preload = "auto";
      player.onplaying = () => {
        setState("speaking");
        onPlaybackStart();
      };
      player.onended = () => {
        player = null;
        playerResolve = null;
        resolve(true);
      };
      player.onerror = () => {
        player = null;
        playerResolve = null;
        reject(errorWithCode("playback_error", "浏览器无法播放语音"));
      };
      Promise.resolve(player.play()).then(() => {
        if (state === "loading") setState("speaking");
      }).catch((error) => reject(errorWithCode("playback_blocked", "点击扬声器即可播放", error)));
    });

    const appendBuffer = (sourceBuffer, bytes) => new Promise((resolve, reject) => {
      const onUpdateEnd = () => {
        sourceBuffer.removeEventListener?.("error", onError);
        resolve();
      };
      const onError = (event) => {
        sourceBuffer.removeEventListener?.("updateend", onUpdateEnd);
        reject(errorWithCode("playback_error", "浏览器无法播放流式语音", event));
      };
      sourceBuffer.addEventListener?.("updateend", onUpdateEnd, { once: true });
      sourceBuffer.addEventListener?.("error", onError, { once: true });
      try {
        sourceBuffer.appendBuffer(bytes);
      } catch (error) {
        sourceBuffer.removeEventListener?.("updateend", onUpdateEnd);
        sourceBuffer.removeEventListener?.("error", onError);
        reject(errorWithCode("playback_error", "浏览器无法播放流式语音", error));
      }
    });

    const streamAndPlayResponse = async (response, activeGeneration) => {
      if (!response?.body?.getReader || !canStreamPlayback()) return null;
      const mediaSource = new MediaSourceImpl();
      const streamUrl = URLImpl.createObjectURL(mediaSource);
      const audio = new AudioImpl(streamUrl);
      const chunks = [];
      const reader = response.body.getReader();
      let playbackSettled = false;
      let settlePlayback;
      const playbackFinished = new Promise((resolve) => { settlePlayback = resolve; });
      const finishPlayback = (result) => {
        if (playbackSettled) return;
        playbackSettled = true;
        settlePlayback(result);
      };
      player = audio;
      playerResolve = () => finishPlayback({ played: false });
      audio.preload = "auto";
      audio.onplaying = () => {
        setState("speaking");
        onPlaybackStart();
      };
      audio.onended = () => finishPlayback({ played: true });
      audio.onerror = (event) => finishPlayback({
        played: false,
        error: errorWithCode("playback_error", "浏览器无法播放流式语音", event),
      });

      const sourceOpened = new Promise((resolve, reject) => {
        mediaSource.addEventListener?.("sourceopen", resolve, { once: true });
        mediaSource.addEventListener?.("error", () => reject(errorWithCode(
          "playback_error",
          "浏览器无法准备流式语音",
        )), { once: true });
      });

      try {
        await sourceOpened;
        if (activeGeneration !== generation) throw errorWithCode("cancelled", "朗读已取消");
        const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
        let playbackStarted = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (activeGeneration !== generation) throw errorWithCode("cancelled", "朗读已取消");
          if (!value?.byteLength) continue;
          const bytes = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
          chunks.push(bytes);
          await appendBuffer(sourceBuffer, bytes);
          if (!playbackStarted) {
            playbackStarted = true;
            Promise.resolve(audio.play()).then(() => {
              if (state === "loading") setState("speaking");
            }).catch((error) => finishPlayback({
              played: false,
              error: errorWithCode("playback_blocked", "点击扬声器即可播放", error),
            }));
          }
        }
        if (!chunks.length) throw errorWithCode("empty_audio", "语音服务没有返回音频");
        if (mediaSource.readyState === "open") mediaSource.endOfStream();
        const playback = await playbackFinished;
        if (playback.error) throw playback.error;
        if (!playback.played) return { played: false, entry: null };
        const blob = new BlobImpl(chunks, { type: "audio/mpeg" });
        return {
          played: true,
          entry: {
            url: URLImpl.createObjectURL(blob),
            size: Number(blob.size) || 0,
          },
        };
      } finally {
        try { await reader.cancel?.(); } catch { /* ignore completed or aborted streams */ }
        if (player === audio) {
          player = null;
          playerResolve = null;
        }
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        URLImpl.revokeObjectURL?.(streamUrl);
      }
    };

    const speak = async (value) => {
      const text = String(value || "").trim();
      if (!text) return false;
      if (!isSupported()) {
        const error = errorWithCode("unsupported", "当前设备暂不支持朗读");
        setState("unavailable", error);
        onError(error);
        return false;
      }
      cancel();
      const activeGeneration = generation;
      const key = `${MODEL}:1.0:${root.hash ? root.hash(text) : text}`;
      setState("loading", { key });
      let entries = touch(key);
      const generated = [];
      try {
        if (!entries) {
          entries = [];
          for (const chunk of splitText(text)) {
            const response = await fetchChunkResponse(chunk, activeGeneration);
            const streamed = await streamAndPlayResponse(response, activeGeneration);
            if (streamed && !streamed.played) return false;
            const entry = streamed?.entry || await responseToEntry(response);
            generated.push(entry);
            entries.push(entry);
            if (!streamed) {
              const played = await playEntry(entry, activeGeneration);
              if (!played) return false;
            }
          }
          if (activeGeneration !== generation) throw errorWithCode("cancelled", "朗读已取消");
          remember(key, entries);
          generated.length = 0;
        } else {
          for (const entry of entries) {
            const played = await playEntry(entry, activeGeneration);
            if (!played) return false;
          }
        }
        if (activeGeneration === generation) setState("idle");
        return true;
      } catch (error) {
        for (const entry of generated) URLImpl.revokeObjectURL?.(entry.url);
        if (error?.code === "cancelled" || error?.name === "AbortError") return false;
        const normalized = error?.code
          ? error
          : errorWithCode("service_unavailable", "朗读暂时不可用，可稍后重试", error);
        setState("error", normalized);
        onError(normalized);
        return false;
      } finally {
        controller = null;
      }
    };

    const clearCache = () => {
      for (const entries of cache.values()) revokeEntries(entries);
      cache.clear();
      cacheBytes = 0;
    };

    const dispose = () => {
      cancel();
      clearCache();
    };

    return {
      cancel,
      clearCache,
      dispose,
      getCacheSize: () => ({ bytes: cacheBytes, entries: cache.size }),
      getState: () => state,
      isSupported,
      speak,
    };
  };

  root.DiscussionTTS = Object.freeze({
    MAX_CACHE_BYTES,
    MAX_CHUNK_CHARACTERS,
    MODEL,
    create,
    splitText,
  });
  globalThis.ParamountSubtitles = root;
})();
