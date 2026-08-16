(() => {
  const PST = globalThis.ParamountSubtitles;
  const Core = PST.LearningHistoryCore;
  const hasExtensionApi = Boolean(globalThis.chrome?.runtime?.id && chrome.storage?.local);
  const previewMode = !hasExtensionApi || new URLSearchParams(location.search).get("preview") === "1";
  const PREVIEW_KEY = "engram-learning-history-preview";

  const SAMPLE_HISTORY = [
    { id: "sample-film", title: "How to Film Cinematic Videos by Yourself", author: "Kyle Kotajarvi", url: "https://www.youtube.com/watch?v=sample-film", thumbnail: "assets/learning-mode-poster.png", duration: 702, currentTime: 295, progress: 42, learningItemCount: 8, materialLevel: "B2", archived: true, manualAdded: true, starred: false, lastStudiedAt: Date.now() - 32 * 60 * 1000, archivedAt: Date.now() - 5 * 86400000, activity: { [Core.activityDate()]: 1740 } },
    { id: "sample-story", title: "The Power of Vulnerability", author: "Brené Brown", url: "https://www.youtube.com/watch?v=sample-story", thumbnail: "assets/learning-mode-poster.png", duration: 1210, currentTime: 786, progress: 65, learningItemCount: 12, materialLevel: "B2", archived: true, manualAdded: true, starred: false, lastStudiedAt: Date.now() - 26 * 3600000, archivedAt: Date.now() - 9 * 86400000, activity: { [Core.activityDate()]: 1260 } },
    { id: "sample-pixar", title: "Inside Pixar: The Art of Storytelling", author: "Pixar", url: "https://www.youtube.com/watch?v=sample-pixar", thumbnail: "assets/learning-mode-poster.png", duration: 842, currentTime: 842, progress: 100, learningItemCount: 10, materialLevel: "B1+", archived: true, manualAdded: true, starred: true, lastStudiedAt: Date.now() - 3 * 86400000, archivedAt: Date.now() - 16 * 86400000, activity: { [Core.activityDate(Date.now() - 3 * 86400000)]: 2040 } },
    { id: "sample-notes", title: "How I Take Smart Notes", author: "Tiago Forte", url: "https://www.youtube.com/watch?v=sample-notes", thumbnail: "assets/learning-mode-poster.png", duration: 1100, currentTime: 308, progress: 28, learningItemCount: 7, materialLevel: "B2", archived: true, manualAdded: false, starred: false, lastStudiedAt: Date.now() - 4 * 86400000, archivedAt: Date.now() - 4 * 86400000, activity: {} },
    { id: "sample-space", title: "The Future of Space Exploration", author: "SpaceX", url: "https://www.youtube.com/watch?v=sample-space", thumbnail: "assets/learning-mode-poster.png", duration: 960, currentTime: 144, progress: 15, learningItemCount: 6, materialLevel: "B2+", archived: true, manualAdded: false, starred: false, lastStudiedAt: Date.now() - 5 * 86400000, archivedAt: Date.now() - 5 * 86400000, activity: {} },
  ];

  const elements = {
    statArchived: document.querySelector("#stat-archived"),
    statProgress: document.querySelector("#stat-progress"),
    statComplete: document.querySelector("#stat-complete"),
    statMinutes: document.querySelector("#stat-minutes"),
    continueSection: document.querySelector("#continue-section"),
    continueThumbnail: document.querySelector("#continue-thumbnail"),
    continueTitle: document.querySelector("#continue-video-title"),
    continueAuthor: document.querySelector("#continue-author"),
    continuePercent: document.querySelector("#continue-percent"),
    continueBar: document.querySelector("#continue-progress-bar"),
    continueLast: document.querySelector("#continue-last-studied"),
    continueButton: document.querySelector("#continue-button"),
    search: document.querySelector("#history-search"),
    filterTabs: [...document.querySelectorAll("[data-filter]")],
    list: document.querySelector("#history-list"),
    empty: document.querySelector("#history-empty-state"),
    emptyTitle: document.querySelector("#history-empty-title"),
    emptyCopy: document.querySelector("#history-empty-copy"),
    mobileNavButtons: [...document.querySelectorAll("[data-mobile-nav-button]")],
    viewButtons: [...document.querySelectorAll("[data-view-target]")],
    views: [...document.querySelectorAll("[data-page-view]")],
    toast: document.querySelector("#dashboard-toast"),
  };

  let learningHistory = [];
  let activeFilter = "all";
  let activeView = "history";
  let continueRecord = null;
  let toastTimer = 0;

  const readHistory = async () => {
    if (hasExtensionApi) {
      const stored = await chrome.storage.local.get({ [Core.STORAGE_KEY]: [] });
      return Core.normalizeHistory(stored[Core.STORAGE_KEY]);
    }
    try {
      const stored = JSON.parse(localStorage.getItem(PREVIEW_KEY) || "null");
      return Core.normalizeHistory(stored || SAMPLE_HISTORY);
    } catch {
      return Core.normalizeHistory(SAMPLE_HISTORY);
    }
  };

  const writeHistory = async (next) => {
    learningHistory = Core.normalizeHistory(next);
    if (hasExtensionApi) await chrome.storage.local.set({ [Core.STORAGE_KEY]: learningHistory });
    else localStorage.setItem(PREVIEW_KEY, JSON.stringify(learningHistory));
  };

  const closeMobileNav = () => {
    document.body.dataset.navOpen = "false";
    elements.mobileNavButtons.forEach((button) => button.setAttribute("aria-expanded", "false"));
  };

  const setView = (nextView, { updateUrl = true, replace = false } = {}) => {
    activeView = nextView === "vocabulary" ? "vocabulary" : "history";
    elements.views.forEach((view) => { view.hidden = view.dataset.pageView !== activeView; });
    elements.viewButtons.forEach((button) => {
      if (!button.classList.contains("nav-link")) return;
      if (button.dataset.viewTarget === activeView) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    document.title = activeView === "vocabulary" ? "生词本 · Engram" : "学习档案 · Engram";
    closeMobileNav();
    if (!updateUrl) return;
    const url = new URL(location.href);
    if (activeView === "vocabulary") url.searchParams.set("view", "vocabulary");
    else url.searchParams.delete("view");
    const method = replace ? "replaceState" : "pushState";
    globalThis.history[method]({ view: activeView }, "", url);
  };

  const formatProgress = (value) => `${Math.round(Number(value) || 0)}%`;
  const formatStudiedDate = (timestamp, { prefix = false } = {}) => {
    const value = Number(timestamp) || 0;
    if (!value) return prefix ? "还没有学习时间" : "—";
    const date = new Date(value);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const label = sameDay
      ? `今天 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`
      : date.toDateString() === yesterday.toDateString()
        ? `昨天 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`
        : date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
    return prefix ? `上次学习 · ${label}` : label;
  };

  const showToast = (message) => {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 2200);
  };

  const handleImageError = (image) => {
    image.hidden = true;
  };

  const openRecord = (record) => {
    if (!record?.url) return;
    let target = record.url;
    try {
      const url = new URL(record.url);
      url.searchParams.set("engram_learning", "1");
      if (record.currentTime > 0 && record.progress < Core.COMPLETE_PERCENT) url.searchParams.set("t", `${Math.floor(record.currentTime)}s`);
      target = url.toString();
    } catch {}
    if (hasExtensionApi && chrome.tabs?.create) chrome.tabs.create({ url: target });
    else showToast(`已准备继续学习：${record.title}`);
  };

  const createThumbnail = (record, className) => {
    const wrapper = document.createElement("span");
    wrapper.className = `${className} media-thumb`;
    const fallback = document.createElement("span");
    fallback.className = "thumbnail-fallback";
    fallback.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5Z"/></svg>';
    const image = document.createElement("img");
    image.src = record.thumbnail || "assets/learning-mode-poster.png";
    image.alt = "";
    image.addEventListener("error", () => handleImageError(image), { once: true });
    wrapper.append(fallback, image);
    return wrapper;
  };

  const createHistoryRow = (record) => {
    const row = document.createElement("article");
    row.className = "history-row";
    row.setAttribute("role", "row");

    const videoButton = document.createElement("button");
    videoButton.className = "video-cell";
    videoButton.type = "button";
    videoButton.setAttribute("role", "cell");
    videoButton.setAttribute("aria-label", `继续学习 ${record.title}`);
    const copy = document.createElement("span");
    copy.className = "video-copy";
    const title = document.createElement("strong");
    title.textContent = record.title;
    const author = document.createElement("small");
    author.textContent = `by ${record.author}`;
    copy.append(title, author);
    videoButton.append(createThumbnail(record, "row-thumb"), copy);
    videoButton.addEventListener("click", () => openRecord(record));

    const date = document.createElement("span");
    date.className = "history-date";
    date.setAttribute("role", "cell");
    date.textContent = formatStudiedDate(record.lastStudiedAt);
    const items = document.createElement("span");
    items.className = "history-items";
    items.setAttribute("role", "cell");
    items.textContent = record.learningItemCount ? String(record.learningItemCount) : "—";
    const progress = document.createElement("span");
    progress.className = "row-progress";
    progress.setAttribute("role", "cell");
    const percentage = document.createElement("strong");
    percentage.textContent = formatProgress(record.progress);
    const track = document.createElement("span");
    track.className = "progress-track";
    const bar = document.createElement("i");
    bar.style.width = `${record.progress}%`;
    track.append(bar);
    progress.append(percentage, track);

    const star = document.createElement("button");
    star.className = "star-button";
    star.type = "button";
    star.setAttribute("role", "cell");
    star.setAttribute("aria-pressed", String(record.starred));
    star.setAttribute("aria-label", record.starred ? `取消星标 ${record.title}` : `星标 ${record.title}`);
    star.title = record.starred ? "取消星标" : "加入星标复习";
    star.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>';
    star.addEventListener("click", async () => {
      const nextRecord = { ...record, starred: !record.starred };
      await writeHistory(Core.upsertHistory(learningHistory, nextRecord));
      render();
      showToast(nextRecord.starred ? "已加入星标复习" : "已取消星标");
    });

    row.append(videoButton, date, items, progress, star);
    return row;
  };

  const renderContinue = () => {
    continueRecord = learningHistory.find((record) => record.progress < Core.COMPLETE_PERCENT) || learningHistory[0] || null;
    elements.continueSection.hidden = !continueRecord;
    if (!continueRecord) return;
    elements.continueThumbnail.hidden = false;
    elements.continueThumbnail.src = continueRecord.thumbnail || "assets/learning-mode-poster.png";
    elements.continueThumbnail.onerror = () => handleImageError(elements.continueThumbnail);
    elements.continueTitle.textContent = continueRecord.title;
    elements.continueAuthor.textContent = `by ${continueRecord.author}`;
    elements.continuePercent.textContent = formatProgress(continueRecord.progress);
    elements.continueBar.style.width = `${continueRecord.progress}%`;
    elements.continueLast.textContent = formatStudiedDate(continueRecord.lastStudiedAt, { prefix: true });
  };

  const render = () => {
    learningHistory = Core.normalizeHistory(learningHistory);
    const stats = Core.statsFor(learningHistory);
    elements.statArchived.textContent = String(stats.archived);
    elements.statProgress.textContent = String(stats.inProgress);
    elements.statComplete.textContent = String(stats.completed);
    elements.statMinutes.textContent = String(stats.weekMinutes);
    renderContinue();

    const visible = Core.filterHistory(learningHistory, { query: elements.search.value, filter: activeFilter });
    elements.list.replaceChildren(...visible.map(createHistoryRow));
    elements.empty.hidden = visible.length > 0;
    if (!visible.length) {
      const searching = Boolean(elements.search.value.trim()) || activeFilter !== "all";
      elements.emptyTitle.textContent = searching ? "没有匹配的学习记录" : "还没有学习记录";
      elements.emptyCopy.textContent = searching
        ? "换一个关键词，或切换筛选条件再试试。"
        : "观看视频达到 10% 后，会自动出现在这里；也可以在学习页点击星标留档。";
    }
  };

  elements.continueButton.addEventListener("click", () => openRecord(continueRecord));
  elements.search.addEventListener("input", render);
  elements.filterTabs.forEach((tab) => tab.addEventListener("click", () => {
    activeFilter = tab.dataset.filter;
    elements.filterTabs.forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
    render();
  }));
  elements.viewButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewTarget)));
  elements.mobileNavButtons.forEach((button) => button.addEventListener("click", () => {
    const open = document.body.dataset.navOpen !== "true";
    document.body.dataset.navOpen = String(open);
    elements.mobileNavButtons.forEach((item) => item.setAttribute("aria-expanded", String(open)));
  }));
  document.addEventListener("click", (event) => {
    if (window.innerWidth > 820 || document.body.dataset.navOpen !== "true") return;
    if (event.target.closest(".sidebar, [data-mobile-nav-button]")) return;
    closeMobileNav();
  });
  globalThis.addEventListener("popstate", () => {
    setView(new URLSearchParams(location.search).get("view"), { updateUrl: false });
  });

  if (hasExtensionApi) chrome.storage.onChanged?.addListener?.((changes, area) => {
    if (area !== "local" || !changes[Core.STORAGE_KEY]) return;
    learningHistory = Core.normalizeHistory(changes[Core.STORAGE_KEY].newValue);
    render();
  });

  setView(new URLSearchParams(location.search).get("view"), { updateUrl: true, replace: true });
  readHistory().then((stored) => {
    learningHistory = stored;
    render();
  });
})();
