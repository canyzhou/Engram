(() => {
  const PST = globalThis.ParamountSubtitles || (globalThis.ParamountSubtitles = {});

  const STORAGE_KEY = "learningHistory";
  const AUTO_ARCHIVE_PERCENT = 10;
  const COMPLETE_PERCENT = 95;
  const MAX_RECORDS = 100;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const text = (value, maximum = 240) => String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);

  const videoIdFromUrl = (input) => {
    try {
      const url = new URL(String(input || ""));
      if (url.hostname === "youtu.be") return text(url.pathname.split("/").filter(Boolean)[0], 80);
      if (url.hostname.endsWith("youtube.com") || url.hostname.endsWith("youtube-nocookie.com")) {
        if (url.pathname === "/watch") return text(url.searchParams.get("v"), 80);
        return text(url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1], 80);
      }
    } catch {
      return "";
    }
    return "";
  };

  const recordId = (video = {}) => text(video.id, 80) || videoIdFromUrl(video.url) || text(video.url, 400);

  const thumbnailFor = (video = {}) => {
    const explicit = text(video.thumbnail, 800);
    if (/^https?:\/\//i.test(explicit) || /^[\w./-]+$/i.test(explicit)) return explicit;
    const id = recordId(video);
    return /^[\w-]{6,}$/.test(id) ? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg` : "";
  };

  const progressPercent = (currentTime, duration) => {
    const total = Number(duration);
    if (!Number.isFinite(total) || total <= 0) return 0;
    return Math.round(clamp((Number(currentTime) || 0) / total, 0, 1) * 1000) / 10;
  };

  const activityDate = (now = Date.now()) => {
    const date = new Date(Number(now) || Date.now());
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const normalizeRecord = (input = {}) => {
    const duration = Math.max(0, Number(input.duration) || 0);
    const currentTime = clamp(Number(input.currentTime) || 0, 0, duration || Number.MAX_SAFE_INTEGER);
    const calculatedProgress = progressPercent(currentTime, duration);
    const progress = clamp(Math.max(Number(input.progress) || 0, calculatedProgress), 0, 100);
    const rawActivity = input.activity && typeof input.activity === "object" ? input.activity : {};
    const activity = Object.fromEntries(Object.entries(rawActivity).map(([date, seconds]) => (
      [/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "", clamp(Number(seconds) || 0, 0, 86400)]
    )).filter(([date, seconds]) => date && seconds > 0).slice(-60));
    const id = recordId(input);
    return {
      id,
      title: text(input.title, 180) || "未命名视频",
      author: text(input.author, 120) || "Video",
      url: text(input.url, 800),
      thumbnail: thumbnailFor(input),
      duration,
      currentTime,
      progress,
      archived: Boolean(input.archived || input.manualAdded || input.starred || progress >= AUTO_ARCHIVE_PERCENT),
      manualAdded: Boolean(input.manualAdded),
      starred: Boolean(input.starred),
      materialLevel: text(input.materialLevel, 8),
      learningItemCount: clamp(Math.round(Number(input.learningItemCount) || 0), 0, 999),
      startedAt: Math.max(0, Number(input.startedAt) || 0),
      archivedAt: Math.max(0, Number(input.archivedAt) || 0),
      lastStudiedAt: Math.max(0, Number(input.lastStudiedAt) || 0),
      activity,
    };
  };

  const buildRecord = ({
    video = {}, currentTime = 0, duration = 0, analysis = null, existing = null,
    starred, manual = false, studySecondsDelta = 0, now = Date.now(),
  } = {}) => {
    const previous = existing ? normalizeRecord(existing) : null;
    const nextVideo = {
      id: recordId(video) || previous?.id,
      title: text(video.title, 180) || previous?.title,
      author: text(video.author, 120) || previous?.author,
      url: text(video.url, 800) || previous?.url,
      thumbnail: thumbnailFor(video) || previous?.thumbnail,
    };
    const nextDuration = Math.max(Number(duration) || 0, Number(video.duration) || 0, previous?.duration || 0);
    const nextProgress = Math.max(previous?.progress || 0, progressPercent(currentTime, nextDuration));
    const nextStarred = typeof starred === "boolean" ? starred : Boolean(previous?.starred);
    const manualAdded = Boolean(previous?.manualAdded || manual);
    const archived = Boolean(previous?.archived || manualAdded || nextStarred || nextProgress >= AUTO_ARCHIVE_PERCENT);
    const activity = { ...(previous?.activity || {}) };
    const secondsDelta = clamp(Number(studySecondsDelta) || 0, 0, 30);
    if (secondsDelta > 0) {
      const date = activityDate(now);
      activity[date] = clamp((Number(activity[date]) || 0) + secondsDelta, 0, 86400);
    }
    return normalizeRecord({
      ...previous,
      ...nextVideo,
      duration: nextDuration,
      currentTime,
      progress: nextProgress,
      archived,
      manualAdded,
      starred: nextStarred,
      materialLevel: analysis?.materialLevel || previous?.materialLevel,
      learningItemCount: Array.isArray(analysis?.learningItems)
        ? analysis.learningItems.length
        : previous?.learningItemCount,
      startedAt: previous?.startedAt || now,
      archivedAt: previous?.archivedAt || (archived ? now : 0),
      lastStudiedAt: now,
      activity,
    });
  };

  const normalizeHistory = (history) => (Array.isArray(history) ? history : [])
    .map(normalizeRecord)
    .filter((record) => record.id && record.archived)
    .filter((record, index, records) => records.findIndex((candidate) => candidate.id === record.id) === index)
    .sort((left, right) => right.lastStudiedAt - left.lastStudiedAt)
    .slice(0, MAX_RECORDS);

  const findRecord = (history, videoOrId) => {
    const id = typeof videoOrId === "string" ? videoOrId : recordId(videoOrId);
    return normalizeHistory(history).find((record) => record.id === id) || null;
  };

  const upsertHistory = (history, record) => {
    const normalized = normalizeRecord(record);
    if (!normalized.id || !normalized.archived) return normalizeHistory(history);
    return normalizeHistory([normalized, ...(Array.isArray(history) ? history : []).filter((item) => recordId(item) !== normalized.id)]);
  };

  const filterHistory = (history, { query = "", filter = "all" } = {}) => {
    const search = text(query, 180).toLocaleLowerCase();
    return normalizeHistory(history).filter((record) => {
      if (filter === "progress" && record.progress >= COMPLETE_PERCENT) return false;
      if (filter === "complete" && record.progress < COMPLETE_PERCENT) return false;
      if (filter === "starred" && !record.starred) return false;
      return !search || `${record.title} ${record.author}`.toLocaleLowerCase().includes(search);
    });
  };

  const weekStart = (now = Date.now()) => {
    const date = new Date(Number(now) || Date.now());
    date.setHours(0, 0, 0, 0);
    const weekday = date.getDay() || 7;
    date.setDate(date.getDate() - weekday + 1);
    return date;
  };

  const statsFor = (history, now = Date.now()) => {
    const records = normalizeHistory(history);
    const start = weekStart(now);
    const weekSeconds = records.reduce((sum, record) => sum + Object.entries(record.activity).reduce((total, [date, seconds]) => {
      const value = new Date(`${date}T00:00:00`);
      return total + (value >= start ? Number(seconds) || 0 : 0);
    }, 0), 0);
    return {
      archived: records.length,
      inProgress: records.filter((record) => record.progress < COMPLETE_PERCENT).length,
      completed: records.filter((record) => record.progress >= COMPLETE_PERCENT).length,
      weekMinutes: Math.round(weekSeconds / 60),
    };
  };

  PST.LearningHistoryCore = Object.freeze({
    STORAGE_KEY,
    AUTO_ARCHIVE_PERCENT,
    COMPLETE_PERCENT,
    MAX_RECORDS,
    activityDate,
    buildRecord,
    filterHistory,
    findRecord,
    normalizeHistory,
    normalizeRecord,
    progressPercent,
    recordId,
    statsFor,
    thumbnailFor,
    upsertHistory,
  });
})();
