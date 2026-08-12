const DICTIONARY_ENDPOINT = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const GOOGLE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";

const dictionaryCache = new Map();
let lastParamountTabId = null;

const rememberParamountTab = async (tabId) => {
  if (!tabId) return;
  lastParamountTabId = tabId;
  await chrome.storage.session.set({ lastParamountTabId: tabId });
};

const resolveParamountTabId = async () => {
  if (lastParamountTabId) return lastParamountTabId;
  const stored = await chrome.storage.session.get("lastParamountTabId");
  lastParamountTabId = stored.lastParamountTabId || null;
  return lastParamountTabId;
};

const translateWithGoogle = async ({ text, source = "en", target = "zh" }) => {
  const url = new URL(GOOGLE_ENDPOINT);
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", source);
  url.searchParams.set("tl", target === "zh" ? "zh-CN" : target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`Google 翻译请求失败 (${response.status})`);
  const payload = await response.json();
  const translation = Array.isArray(payload?.[0])
    ? payload[0].map((part) => part?.[0] || "").join("")
    : "";
  if (!translation) throw new Error("Google 翻译没有返回内容");
  return translation;
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
  if (message?.type === "REGISTER_PARAMOUNT_TAB" && sender.tab?.id) {
    rememberParamountTab(sender.tab.id)
      .then(() => sendResponse({ ok: true, tabId: lastParamountTabId }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_PARAMOUNT_STATUS") {
    resolveParamountTabId()
      .then((tabId) => {
        if (!tabId) throw new Error("尚未检测到 Paramount+ 标签页");
        return chrome.tabs.sendMessage(tabId, { type: "GET_STATUS" });
      })
      .then((response) => sendResponse(response || { ok: false, error: "播放器未响应" }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "PREVIEW_PARAMOUNT_CUE") {
    resolveParamountTabId()
      .then((tabId) => {
        if (!tabId) throw new Error("尚未检测到 Paramount+ 标签页");
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

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;
  const existing = await chrome.storage.sync.get("enabled");
  if (typeof existing.enabled !== "undefined") return;
  await chrome.storage.sync.set({
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
