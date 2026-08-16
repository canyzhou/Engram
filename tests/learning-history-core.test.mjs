import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/learning-history-core.js", import.meta.url), "utf8");
const context = vm.createContext({ Date, Math, Number, Object, String, URL, globalThis: null });
context.globalThis = context;
vm.runInContext(source, context);
const Core = context.ParamountSubtitles.LearningHistoryCore;

const video = {
  id: "video-1",
  title: "How to Film Cinematic Videos by Yourself",
  author: "Kyle Kotajarvi",
  url: "https://www.youtube.com/watch?v=video-1",
  duration: 1000,
};

test("automatically archives a video only after progress reaches ten percent", () => {
  const belowThreshold = Core.buildRecord({ video, currentTime: 99, duration: 1000, now: 1000 });
  const atThreshold = Core.buildRecord({ video, currentTime: 100, duration: 1000, now: 2000 });

  assert.equal(belowThreshold.progress, 9.9);
  assert.equal(belowThreshold.archived, false);
  assert.equal(Core.upsertHistory([], belowThreshold).length, 0);
  assert.equal(atThreshold.progress, 10);
  assert.equal(atThreshold.archived, true);
  assert.equal(Core.upsertHistory([], atThreshold).length, 1);
});

test("manual star archives immediately and keeps the highest observed progress", () => {
  const starred = Core.buildRecord({ video, currentTime: 20, duration: 1000, manual: true, starred: true, now: 1000 });
  const later = Core.buildRecord({ video, currentTime: 600, duration: 1000, existing: starred, now: 2000 });
  const replayed = Core.buildRecord({ video, currentTime: 50, duration: 1000, existing: later, now: 3000 });

  assert.equal(starred.archived, true);
  assert.equal(starred.starred, true);
  assert.equal(later.progress, 60);
  assert.equal(replayed.progress, 60);
  assert.equal(replayed.currentTime, 50);
});

test("filters archived videos and calculates dashboard overview", () => {
  const now = new Date("2026-08-16T12:00:00+08:00").getTime();
  const today = Core.activityDate(now);
  const records = Core.normalizeHistory([
    { ...video, progress: 42, currentTime: 420, archived: true, starred: true, lastStudiedAt: now, activity: { [today]: 1800 } },
    { ...video, id: "video-2", title: "Completed lesson", progress: 100, currentTime: 1000, archived: true, lastStudiedAt: now - 1, activity: { [today]: 600 } },
  ]);

  assert.equal(Core.filterHistory(records, { filter: "progress" }).length, 1);
  assert.equal(Core.filterHistory(records, { filter: "complete" }).length, 1);
  assert.equal(Core.filterHistory(records, { filter: "starred" })[0].id, "video-1");
  assert.equal(Core.filterHistory(records, { query: "completed" })[0].id, "video-2");
  assert.deepEqual(JSON.parse(JSON.stringify(Core.statsFor(records, now))), {
    archived: 2,
    inProgress: 1,
    completed: 1,
    weekMinutes: 40,
  });
});
