import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import {
  buildDevelopmentExtension,
  buildExtension,
  createDevelopmentReloadClient,
} from "../scripts/build-extension.mjs";

test("builds a publishable extension without backend or env files", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "engram-extension-build-"));
  const outputDirectory = join(directory, "extension");
  context.after(() => rmSync(directory, { recursive: true, force: true }));

  buildExtension({ outputDirectory });

  assert.equal(existsSync(join(outputDirectory, "manifest.json")), true);
  assert.equal(existsSync(join(outputDirectory, "src", "service-worker.js")), true);
  assert.equal(existsSync(join(outputDirectory, "dashboard.html")), true);
  assert.equal(existsSync(join(outputDirectory, "src", "learning-history-core.js")), true);
  assert.equal(existsSync(join(outputDirectory, "src", "learning-site-adapters.js")), true);
  assert.equal(existsSync(join(outputDirectory, "src", "player-settings.js")), true);
  assert.equal(existsSync(join(outputDirectory, "src", "dev-reload.js")), false);
  assert.equal(existsSync(join(outputDirectory, "server")), false);
  assert.equal(existsSync(join(outputDirectory, ".env.local")), false);
  assert.equal(existsSync(join(outputDirectory, "preview.html")), false);
  assert.equal(existsSync(join(outputDirectory, "assets", "icon-source.svg")), false);
});

test("builds an auto-reloading development extension without changing production sources", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "engram-extension-dev-build-"));
  const outputDirectory = join(directory, "extension");
  context.after(() => rmSync(directory, { recursive: true, force: true }));

  const result = buildDevelopmentExtension({
    outputDirectory,
    reloadOrigin: "http://127.0.0.1:9876",
    buildId: "test-build",
  });
  const manifest = JSON.parse(readFileSync(join(outputDirectory, "manifest.json"), "utf8"));
  const isolatedContentScript = manifest.content_scripts.find((entry) => entry.world !== "MAIN");
  const reloadClient = readFileSync(join(outputDirectory, "src", "dev-reload.js"), "utf8");
  const serviceWorker = readFileSync(join(outputDirectory, "src", "service-worker.js"), "utf8");
  const popup = readFileSync(join(outputDirectory, "popup.html"), "utf8");

  assert.equal(result.reloadUrl, "http://127.0.0.1:9876/__engram_extension_reload__");
  assert.equal(manifest.host_permissions.includes("http://127.0.0.1:9876/*"), true);
  assert.equal(isolatedContentScript.js[0], "src/dev-reload.js");
  assert.match(reloadClient, /test-build/);
  assert.match(reloadClient, /ENGRAM_DEV_GET_BUILD/);
  assert.match(reloadClient, /chrome\.runtime\.sendMessage/);
  assert.match(reloadClient, /chrome\.runtime\.reload\(\)/);
  assert.match(serviceWorker, /Engram development auto-reload client/);
  assert.match(popup, /<script src="\/src\/dev-reload\.js"><\/script>/);
});

test("development content script asks the service worker to reload before refreshing the page", async () => {
  const messages = [];
  let pageReloads = 0;
  const clientSource = createDevelopmentReloadClient({
    buildId: "old-build",
    reloadUrl: "http://127.0.0.1:9876/__engram_extension_reload__",
  });
  const context = vm.createContext({
    fetch: async () => assert.fail("content scripts should fetch through the service worker"),
    setInterval: () => 1,
    window: { location: { reload: () => { pageReloads += 1; } } },
    chrome: {
      runtime: {
        onMessage: { addListener: () => assert.fail("content scripts should not add the worker listener") },
        reload: () => assert.fail("content scripts cannot call runtime.reload directly"),
        sendMessage: async (message) => {
          messages.push(message);
          return message.type === "ENGRAM_DEV_GET_BUILD"
            ? { buildId: "new-build" }
            : undefined;
        },
      },
    },
  });

  vm.runInContext(clientSource, context);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(messages.map((message) => message.type), [
    "ENGRAM_DEV_GET_BUILD",
    "ENGRAM_DEV_RELOAD",
  ]);
  assert.equal(pageReloads, 1);
});
