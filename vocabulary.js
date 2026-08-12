(() => {
  const hasExtensionApi = Boolean(globalThis.chrome?.runtime?.id && chrome.storage?.local);
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const SAMPLE_WORDS = [
    {
      original: "idols",
      lemma: "idol",
      phonetic: "/ˈaɪdl/",
      partOfSpeech: "noun",
      gloss: "偶像；崇拜对象",
      definition: "a person or thing that is greatly admired",
      sentence: "I want to, like, run around, find idols.",
      addedAt: Date.now() - 1000 * 60 * 18,
    },
    {
      original: "fronds",
      lemma: "frond",
      phonetic: "/frɒnd/",
      partOfSpeech: "noun",
      gloss: "棕榈叶；蕨叶",
      definition: "a long leaf of a palm or fern",
      sentence: "We can't chop palm fronds down from the trees.",
      addedAt: Date.now() - 1000 * 60 * 60 * 25,
    },
    {
      original: "vulnerable",
      lemma: "vulnerable",
      phonetic: "/ˈvʌlnərəbl/",
      partOfSpeech: "adjective",
      gloss: "脆弱的；易受伤害的",
      definition: "exposed to the possibility of being harmed",
      sentence: "You make yourself vulnerable when you trust people.",
      addedAt: Date.now() - 1000 * 60 * 60 * 72,
    },
  ];

  const elements = {
    totalCount: document.querySelector("#total-count"),
    weekCount: document.querySelector("#week-count"),
    recentWord: document.querySelector("#recent-word"),
    resultSummary: document.querySelector("#result-summary"),
    search: document.querySelector("#search-input"),
    clearSearch: document.querySelector("#clear-search"),
    sort: document.querySelector("#sort-order"),
    list: document.querySelector("#word-list"),
    empty: document.querySelector("#empty-state"),
    emptyTitle: document.querySelector("#empty-title"),
    emptyCopy: document.querySelector("#empty-copy"),
    exportCsv: document.querySelector("#export-csv"),
    clearAll: document.querySelector("#clear-all"),
    dialog: document.querySelector("#clear-dialog"),
    confirmClear: document.querySelector("#confirm-clear"),
    toast: document.querySelector("#toast"),
    toastMessage: document.querySelector("#toast-message"),
    toastAction: document.querySelector("#toast-action"),
  };

  let words = [];
  let deletedEntry = null;
  let toastTimer = 0;

  const readWords = async () => {
    if (hasExtensionApi) {
      const result = await chrome.storage.local.get({ vocabulary: [] });
      return Array.isArray(result.vocabulary) ? result.vocabulary : [];
    }
    return [...SAMPLE_WORDS];
  };

  const writeWords = async (nextWords) => {
    words = nextWords;
    if (hasExtensionApi) await chrome.storage.local.set({ vocabulary: nextWords });
  };

  const normalize = (value) => String(value || "").toLocaleLowerCase("en").trim();

  const formatDate = (value) => {
    const date = new Date(Number(value) || Date.now());
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "今天";
    return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(date);
  };

  const icon = (path) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
    node.setAttribute("d", path);
    svg.append(node);
    return svg;
  };

  const createCard = (entry) => {
    const card = document.createElement("article");
    card.className = "word-card";
    card.dataset.word = entry.lemma || entry.original || "";

    const head = document.createElement("div");
    head.className = "word-card__head";
    const wordLine = document.createElement("div");
    wordLine.className = "word-card__word-line";
    const title = document.createElement("h3");
    title.textContent = entry.lemma || entry.original || "未知单词";
    const speak = document.createElement("button");
    speak.className = "speak-button";
    speak.type = "button";
    speak.setAttribute("aria-label", `朗读 ${title.textContent}`);
    speak.append(icon("M5 10v4h3l4 3V7l-4 3H5Zm10-1.5a5 5 0 0 1 0 7M17.5 6a8.5 8.5 0 0 1 0 12"));
    speak.addEventListener("click", () => speakWord(title.textContent));
    wordLine.append(title, speak);

    const phonetic = document.createElement("p");
    phonetic.className = "word-card__phonetic";
    phonetic.textContent = entry.phonetic || "暂无音标";
    const meta = document.createElement("div");
    meta.className = "word-card__meta";
    const pos = document.createElement("span");
    pos.className = "word-card__pos";
    pos.textContent = entry.partOfSpeech || "word";
    const date = document.createElement("time");
    date.className = "word-card__date";
    date.dateTime = new Date(Number(entry.addedAt) || Date.now()).toISOString();
    date.textContent = formatDate(entry.addedAt);
    meta.append(pos, date);
    head.append(wordLine, phonetic, meta);

    const meaning = document.createElement("div");
    meaning.className = "word-card__meaning";
    const gloss = document.createElement("p");
    gloss.className = "word-card__gloss";
    gloss.textContent = entry.gloss || "暂无中文释义";
    const definition = document.createElement("p");
    definition.className = "word-card__definition";
    definition.textContent = entry.definition || "暂无英文释义";
    const sentence = document.createElement("p");
    sentence.className = "word-card__sentence";
    sentence.textContent = entry.sentence ? `“${entry.sentence}”` : "暂无字幕原句";
    meaning.append(gloss, definition, sentence);

    const actions = document.createElement("div");
    actions.className = "word-card__actions";
    const remove = document.createElement("button");
    remove.className = "delete-button";
    remove.type = "button";
    remove.setAttribute("aria-label", `删除 ${title.textContent}`);
    remove.append(icon("M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"));
    remove.addEventListener("click", () => deleteWord(entry));
    actions.append(remove);

    card.append(head, meaning, actions);
    return card;
  };

  const filteredWords = () => {
    const query = normalize(elements.search.value);
    const filtered = !query ? [...words] : words.filter((entry) => normalize([
      entry.lemma,
      entry.original,
      entry.gloss,
      entry.definition,
      entry.sentence,
    ].join(" ")).includes(query));
    if (elements.sort.value === "alphabetical") {
      filtered.sort((left, right) => String(left.lemma || left.original).localeCompare(String(right.lemma || right.original), "en"));
    } else {
      filtered.sort((left, right) => (Number(right.addedAt) || 0) - (Number(left.addedAt) || 0));
      if (elements.sort.value === "oldest") filtered.reverse();
    }
    return filtered;
  };

  const render = () => {
    const now = Date.now();
    const ordered = [...words].sort((left, right) => (Number(right.addedAt) || 0) - (Number(left.addedAt) || 0));
    const visible = filteredWords();
    const hasQuery = Boolean(elements.search.value.trim());
    elements.totalCount.textContent = String(words.length);
    elements.weekCount.textContent = String(words.filter((entry) => now - (Number(entry.addedAt) || 0) <= WEEK_MS).length);
    elements.recentWord.textContent = ordered[0]?.lemma || ordered[0]?.original || "—";
    elements.resultSummary.textContent = hasQuery ? `找到 ${visible.length} 个结果` : `${visible.length} 个单词`;
    elements.clearSearch.hidden = !hasQuery;
    elements.exportCsv.disabled = words.length === 0;
    elements.clearAll.disabled = words.length === 0;
    elements.list.replaceChildren(...visible.map(createCard));
    elements.list.hidden = visible.length === 0;
    elements.empty.hidden = visible.length > 0;
    elements.emptyTitle.textContent = hasQuery ? "没有匹配的单词" : "还没有收藏单词";
    elements.emptyCopy.textContent = hasQuery
      ? "试试搜索英文原词、中文释义或字幕原句。"
      : "观看 Paramount+ 时，把鼠标悬停在英文字幕上，然后点击“加入生词”。";
  };

  const showToast = (message, action = null) => {
    clearTimeout(toastTimer);
    elements.toastMessage.textContent = message;
    elements.toastAction.hidden = !action;
    elements.toastAction.onclick = action;
    elements.toast.dataset.open = "true";
    toastTimer = setTimeout(() => {
      elements.toast.dataset.open = "false";
      deletedEntry = null;
    }, 4200);
  };

  const speakWord = (word) => {
    if (!("speechSynthesis" in globalThis)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    speechSynthesis.speak(utterance);
  };

  const deleteWord = async (entry) => {
    const index = words.indexOf(entry);
    if (index < 0) return;
    deletedEntry = { entry, index };
    await writeWords(words.filter((item) => item !== entry));
    render();
    showToast(`已删除 ${entry.lemma || entry.original}`, async () => {
      if (!deletedEntry) return;
      const restored = [...words];
      restored.splice(Math.min(deletedEntry.index, restored.length), 0, deletedEntry.entry);
      await writeWords(restored);
      deletedEntry = null;
      render();
      showToast("已撤销删除");
    });
  };

  const exportCsv = () => {
    const quote = (value) => `"${String(value || "").replaceAll('"', '""')}"`;
    const header = ["Word", "Original", "Phonetic", "Part of speech", "Chinese meaning", "English definition", "Subtitle sentence", "Added at"];
    const rows = words.map((entry) => [
      entry.lemma,
      entry.original,
      entry.phonetic,
      entry.partOfSpeech,
      entry.gloss,
      entry.definition,
      entry.sentence,
      new Date(Number(entry.addedAt) || Date.now()).toISOString(),
    ]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(quote).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `paramount-vocabulary-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`已导出 ${words.length} 个单词`);
  };

  elements.search.addEventListener("input", render);
  elements.clearSearch.addEventListener("click", () => {
    elements.search.value = "";
    elements.search.focus();
    render();
  });
  elements.sort.addEventListener("change", render);
  elements.exportCsv.addEventListener("click", exportCsv);
  elements.clearAll.addEventListener("click", () => elements.dialog.showModal());
  elements.dialog.addEventListener("close", async () => {
    if (elements.dialog.returnValue !== "confirm") return;
    await writeWords([]);
    render();
    showToast("单词本已清空");
  });

  if (hasExtensionApi) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.vocabulary) return;
      words = Array.isArray(changes.vocabulary.newValue) ? changes.vocabulary.newValue : [];
      render();
    });
  }

  readWords().then((storedWords) => {
    words = storedWords;
    render();
  });
})();
