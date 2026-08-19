const DICTIONARY_ENDPOINT = "https://api.dictionaryapi.dev/api/v2/entries/en/";
// This URL is public configuration, not a secret. DeepSeek credentials live only
// in the proxy server's DEEPSEEK_API_KEY environment variable.
const DEFAULT_TRANSLATION_PROXY_URL = "http://127.0.0.1:8787";
const GOOGLE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";

const dictionaryCache = new Map();
let lastVideoTabId = null;
let uiLanguage = "en";

const UI_MESSAGES = Object.freeze({
  en: Object.freeze({
    invalidProxyUrl: "The translation proxy URL is invalid",
    secureProxyRequired: "The translation proxy must use HTTPS; loopback addresses may use HTTP",
    proxyCredentialsForbidden: "The translation proxy URL cannot contain credentials",
    proxyTimeout: "The translation proxy timed out. Please try again later",
    proxyConnectionFailed: "Could not connect to the translation proxy. Make sure the backend is running",
    proxyRequestFailed: "Translation proxy request failed ($1)",
    googleRequestFailed: "Google translation request failed ($1)",
    googleEmptyResponse: "Google translation returned no content",
    proxyEmptyTranslation: "The translation proxy returned no translation",
    proxyEmptyWord: "The translation proxy returned no word entry",
    videoTabMissing: "No supported video tab has been detected",
    playerNoResponse: "The player did not respond",
  }),
  "zh-CN": Object.freeze({
    invalidProxyUrl: "翻译代理地址无效", secureProxyRequired: "翻译代理必须使用 HTTPS；本机回环地址可使用 HTTP", proxyCredentialsForbidden: "翻译代理地址不能包含凭据",
    proxyTimeout: "翻译代理响应超时，请稍后重试", proxyConnectionFailed: "无法连接翻译代理，请确认后端服务已启动", proxyRequestFailed: "翻译代理请求失败 ($1)",
    googleRequestFailed: "Google 翻译请求失败 ($1)", googleEmptyResponse: "Google 翻译没有返回内容", proxyEmptyTranslation: "翻译代理没有返回译文",
    proxyEmptyWord: "翻译代理没有返回查词结果", videoTabMissing: "尚未检测到支持的视频标签页", playerNoResponse: "播放器未响应",
  }),
});
const t = (key, substitution = "") => (UI_MESSAGES[uiLanguage]?.[key] || UI_MESSAGES.en[key] || key).replaceAll("$1", String(substitution));
chrome.storage.sync.get({ uiLanguage: "en" }).then((stored) => { uiLanguage = stored.uiLanguage === "zh-CN" ? "zh-CN" : "en"; });
const ENGLISH_PROXY_ERRORS = Object.freeze({
  "翻译请求过于频繁，请稍后重试": "Translation requests are too frequent. Please try again later",
  "翻译服务繁忙，请稍后重试": "The translation service is busy. Please try again later",
  "服务端尚未配置 DeepSeek API Key": "The translation server has not been configured with a DeepSeek API key",
  "翻译服务配置错误": "The translation service is misconfigured",
  "翻译服务额度不足": "The translation service has insufficient credit",
  "翻译服务暂时限流": "The translation service is temporarily rate-limited",
  "上游翻译服务异常": "The upstream translation service failed",
  "上游返回了无法解析的译文": "The upstream service returned an unreadable translation",
  "上游没有返回译文": "The upstream service returned no translation",
  "翻译服务响应超时": "The translation service timed out",
  "翻译服务异常": "The translation service failed",
  "不允许的客户端来源": "This client origin is not allowed",
});
const localizeProxyError = (message, status) => {
  const value = String(message || "").trim();
  if (uiLanguage === "zh-CN" || !value) return value || t("proxyRequestFailed", status);
  return ENGLISH_PROXY_ERRORS[value] || (/^[\x00-\x7F]*$/.test(value) ? value : t("proxyRequestFailed", status));
};

const rememberVideoTab = async (tabId) => {
  if (!tabId) return;
  lastVideoTabId = tabId;
  await chrome.storage.session.set({ lastVideoTabId: tabId });
};

const resolveVideoTabId = async () => {
  if (lastVideoTabId) return lastVideoTabId;
  const stored = await chrome.storage.session.get(["lastVideoTabId", "lastParamountTabId"]);
  lastVideoTabId = stored.lastVideoTabId || stored.lastParamountTabId || null;
  return lastVideoTabId;
};

const resolveMessageVideoTabId = async (message, sender) => {
  const senderTabId = Number(sender?.tab?.id);
  const senderTabUrl = String(sender?.tab?.url || "");
  const senderIsLearningSite = /^(?:https:\/\/)?(?:(?:[\w-]+\.)?youtube(?:-nocookie)?\.com|youtu\.be)\//i.test(senderTabUrl);
  if (Number.isInteger(senderTabId) && senderTabId > 0 && senderIsLearningSite) {
    return senderTabId;
  }
  const requested = Number(message?.sourceTabId);
  if (Number.isInteger(requested) && requested > 0) return requested;
  return resolveVideoTabId();
};

const normalizeTranslationProxyUrl = (value) => {
  let url;
  try {
    url = new URL(String(value || DEFAULT_TRANSLATION_PROXY_URL));
  } catch {
    throw new Error(t("invalidProxyUrl"));
  }
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error(t("secureProxyRequired"));
  }
  if (url.username || url.password) throw new Error(t("proxyCredentialsForbidden"));
  return url.origin;
};

const resolveTranslationProxyUrl = async () => {
  const stored = await chrome.storage.local.get({
    translationProxyUrl: DEFAULT_TRANSLATION_PROXY_URL,
  });
  return normalizeTranslationProxyUrl(stored.translationProxyUrl);
};

const postToTranslationProxy = async (path, body) => {
  const baseUrl = await resolveTranslationProxyUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), path.startsWith("/v1/lesson/") ? 100000 : 15000);
  let response;
  try {
    response = await fetch(new URL(path, `${baseUrl}/`).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "omit",
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(t("proxyTimeout"));
    throw new Error(t("proxyConnectionFailed"));
  } finally {
    clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(localizeProxyError(payload?.error, response.status));
  return payload;
};

const translateWithGoogle = async ({ text, source = "en", target = "zh" }) => {
  const url = new URL(GOOGLE_ENDPOINT);
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", source);
  url.searchParams.set("tl", target === "zh" ? "zh-CN" : target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(t("googleRequestFailed", response.status));
  const payload = await response.json();
  const translation = Array.isArray(payload?.[0])
    ? payload[0].map((part) => part?.[0] || "").join("")
    : "";
  if (!translation) throw new Error(t("googleEmptyResponse"));
  return translation;
};

const translateWithDeepSeek = async ({ text, context = [] }) => {
  const payload = await postToTranslationProxy("/v1/translate", {
    text,
    context: context.slice(-4),
  });
  const translation = String(payload?.translation || "").trim();
  if (!translation) throw new Error(t("proxyEmptyTranslation"));
  return translation;
};

const lookupWordWithContext = async ({ word, sentence, context = [] }) => {
  const payload = await postToTranslationProxy("/v1/word-lookup", {
    word,
    sentence,
    context: context.slice(-4),
  });
  if (!payload?.entry) throw new Error(t("proxyEmptyWord"));
  return payload.entry;
};

const analyzeLearningMaterial = async ({ learnerLevel, video, cues, transcriptComplete }) => {
  const payload = await postToTranslationProxy("/v1/lesson/analyze", {
    learnerLevel,
    video: {
      title: video?.title,
      duration: video?.duration,
    },
    cues: (Array.isArray(cues) ? cues : []).map((cue) => ({
      start: cue?.start,
      end: cue?.end,
      text: cue?.text,
    })),
    transcriptComplete: Boolean(transcriptComplete),
  });
  if (!payload?.analysis) throw new Error(t("proxyRequestFailed", 502));
  return payload.analysis;
};

const discussLearningMaterial = async ({ mode, phase, questionIndex, questionPlan, hint, learnerLevel, video, cues, expressions, messages }) => {
  const payload = await postToTranslationProxy("/v1/lesson/discuss", {
    mode,
    phase,
    questionIndex,
    questionPlan,
    hint: Boolean(hint),
    learnerLevel,
    video: { title: video?.title, duration: video?.duration },
    cues,
    expressions,
    messages,
  });
  if (!payload?.discussion) throw new Error(t("proxyRequestFailed", 502));
  return payload.discussion;
};

const fetchDictionaryEntry = async (candidates) => {
  for (const candidate of candidates || []) {
    if (dictionaryCache.has(candidate)) return dictionaryCache.get(candidate);
    try {
      const response = await fetch(`${DICTIONARY_ENDPOINT}${encodeURIComponent(candidate)}`, {
        credentials: "omit",
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const item = payload?.[0];
      if (!item) continue;

      const phonetic = item.phonetic
        || item.phonetics?.find((entry) => entry?.text)?.text
        || "";
      const definitions = (item.meanings || []).flatMap((meaning) =>
        (meaning.definitions || []).slice(0, 2).map((definition) => ({
          partOfSpeech: meaning.partOfSpeech || "word",
          definition: definition.definition || "",
        })),
      ).filter((definition) => definition.definition);

      const entry = {
        word: item.word || candidate,
        phonetic,
        definitions,
      };
      dictionaryCache.set(candidate, entry);
      return entry;
    } catch {
      // Try the next lemma candidate.
    }
  }
  return null;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OPEN_LEARNING_DASHBOARD") {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") })
      .then((tab) => sendResponse({ ok: true, tabId: tab?.id || null }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (["REGISTER_VIDEO_TAB", "REGISTER_PARAMOUNT_TAB"].includes(message?.type) && sender.tab?.id) {
    rememberVideoTab(sender.tab.id)
      .then(() => sendResponse({ ok: true, tabId: lastVideoTabId }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (["GET_VIDEO_STATUS", "GET_PARAMOUNT_STATUS"].includes(message?.type)) {
    resolveVideoTabId()
      .then((tabId) => {
        if (!tabId) throw new Error(t("videoTabMissing"));
        return chrome.tabs.sendMessage(tabId, { type: "GET_STATUS" });
      })
      .then((response) => sendResponse(response || { ok: false, error: t("playerNoResponse") }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_LEARNING_CONTEXT") {
    resolveMessageVideoTabId(message, sender)
      .then((tabId) => {
        if (!tabId) throw new Error(t("videoTabMissing"));
        return chrome.tabs.sendMessage(tabId, { type: "GET_LEARNING_CONTEXT" });
      })
      .then((response) => sendResponse(response || { ok: false, error: t("playerNoResponse") }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (["GET_LEARNING_PLAYBACK", "CONTROL_LEARNING_VIDEO"].includes(message?.type)) {
    resolveMessageVideoTabId(message, sender)
      .then((tabId) => {
        if (!tabId) throw new Error(t("videoTabMissing"));
        return chrome.tabs.sendMessage(tabId, {
          type: message.type,
          action: message.action,
          time: message.time,
        });
      })
      .then((response) => sendResponse(response || { ok: false, error: t("playerNoResponse") }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (["PREVIEW_VIDEO_CUE", "PREVIEW_PARAMOUNT_CUE"].includes(message?.type)) {
    resolveVideoTabId()
      .then((tabId) => {
        if (!tabId) throw new Error(t("videoTabMissing"));
        return chrome.tabs.sendMessage(tabId, {
          type: "PREVIEW_CUE",
          text: message.text,
        });
      })
      .then((response) => sendResponse(response || { ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GOOGLE_TRANSLATE") {
    translateWithGoogle(message)
      .then((translation) => sendResponse({ ok: true, translation }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "DEEPSEEK_TRANSLATE") {
    translateWithDeepSeek(message)
      .then((translation) => sendResponse({ ok: true, translation }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "CONTEXTUAL_WORD_LOOKUP") {
    lookupWordWithContext(message)
      .then((entry) => sendResponse({ ok: true, entry }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "ANALYZE_LEARNING_MATERIAL") {
    analyzeLearningMaterial(message)
      .then((analysis) => sendResponse({ ok: true, analysis }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "DISCUSS_LEARNING_MATERIAL") {
    discussLearningMaterial(message)
      .then((discussion) => sendResponse({ ok: true, discussion }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "DICTIONARY_LOOKUP") {
    fetchDictionaryEntry(message.candidates)
      .then((entry) => sendResponse({ ok: true, entry }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "SET_BADGE") {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.action.setBadgeBackgroundColor({ color: message.color || "#51b66d", tabId });
      chrome.action.setBadgeText({ text: message.text || "", tabId });
    }
  }

  return false;
});

chrome.storage.onChanged?.addListener?.((changes, area) => {
  if (area === "sync" && changes.uiLanguage) uiLanguage = changes.uiLanguage.newValue === "zh-CN" ? "zh-CN" : "en";
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  // v0.5 briefly stored this secret in the extension. It is no longer used;
  // credentials now live exclusively in the translation proxy environment.
  await chrome.storage.local.remove("deepseekApiKey");
  if (reason !== "install") return;
  const existing = await chrome.storage.sync.get("enabled");
  if (typeof existing.enabled !== "undefined") return;
  await chrome.storage.sync.set({
    uiLanguage: "en",
    enabled: true,
    mode: "bilingual",
    engine: "local",
    fontSize: 28,
    backgroundOpacity: 0.45,
    position: 13,
    learningHints: false,
    hoverDictionary: true,
    hideNative: true,
    debugToast: false,
  });
});
