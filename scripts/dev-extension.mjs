import { createHash } from "node:crypto";
import { readFileSync, watch } from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDevelopmentExtension,
  DEVELOPMENT_RELOAD_PATH,
  EXTENSION_FILES,
} from "./build-extension.mjs";

const modulePath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(modulePath), "..");
const outputDirectory = join(repositoryRoot, "dist", "extension");
const host = "127.0.0.1";
const configuredPort = Number(process.env.ENGRAM_EXTENSION_RELOAD_PORT);
const port = Number.isInteger(configuredPort) && configuredPort > 0
  ? configuredPort
  : 8790;
const reloadOrigin = `http://${host}:${port}`;
const watchedFilesByDirectory = new Map();
for (const relativePath of EXTENSION_FILES) {
  const relativeDirectory = dirname(relativePath);
  const files = watchedFilesByDirectory.get(relativeDirectory) || new Set();
  files.add(basename(relativePath));
  watchedFilesByDirectory.set(relativeDirectory, files);
}

let buildSequence = 0;
let currentBuildId = "starting";
let lastSourceFingerprint = "";
let rebuildTimer;
const watchers = [];

const createSourceFingerprint = () => {
  const hash = createHash("sha256");
  for (const relativePath of EXTENSION_FILES) {
    hash.update(relativePath);
    hash.update(readFileSync(join(repositoryRoot, relativePath)));
  }
  return hash.digest("hex");
};

const rebuild = ({ force = false } = {}) => {
  try {
    const sourceFingerprint = createSourceFingerprint();
    if (!force && sourceFingerprint === lastSourceFingerprint) return;
    const buildId = `${Date.now()}-${++buildSequence}`;
    buildDevelopmentExtension({ outputDirectory, reloadOrigin, buildId });
    lastSourceFingerprint = sourceFingerprint;
    currentBuildId = buildId;
    console.log(`Extension rebuilt (${buildId}); Chrome reload requested.`);
  } catch (error) {
    console.error(`Extension rebuild failed: ${error.message}`);
  }
};

const scheduleRebuild = () => {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuild, 80);
};

const reloadServer = createServer((request, response) => {
  if (request.url !== DEVELOPMENT_RELOAD_PATH) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify({ buildId: currentBuildId }));
});

reloadServer.on("error", (error) => {
  console.error(`Extension reload server failed: ${error.message}`);
  process.exitCode = 1;
});

reloadServer.listen(port, host, () => {
  rebuild({ force: true });
  for (const [relativeDirectory, files] of watchedFilesByDirectory) {
    const watcher = watch(join(repositoryRoot, relativeDirectory), (_eventType, filename) => {
      if (files.has(String(filename || ""))) scheduleRebuild();
    });
    watcher.on("error", (error) => {
      console.error(`Extension file watcher failed: ${error.message}`);
    });
    watchers.push(watcher);
  }

  console.log(`Extension reload server listening on ${reloadOrigin}`);
  console.log(`Load the unpacked extension once from: ${outputDirectory}`);
});

const shutdown = () => {
  clearTimeout(rebuildTimer);
  for (const watcher of watchers) watcher.close();
  reloadServer.close();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
