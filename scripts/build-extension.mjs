import {
  appendFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(modulePath), "..");

export const EXTENSION_FILES = [
  "manifest.json",
  "popup.html",
  "popup.css",
  "popup.js",
  "debug.html",
  "debug.css",
  "debug.js",
  "vocabulary.html",
  "vocabulary.css",
  "vocabulary.js",
  "learning-settings.html",
  "learning-settings.css",
  "learning-settings.js",
  "learning-mode.html",
  "learning-mode.css",
  "learning-mode.js",
  "dashboard.html",
  "dashboard.css",
  "dashboard.js",
  "_locales/en/messages.json",
  "_locales/zh_CN/messages.json",
  "assets/icons/icon-16.png",
  "assets/icons/icon-32.png",
  "assets/icons/icon-48.png",
  "assets/icons/icon-128.png",
  "assets/learning-mode-poster.png",
  "src/cache.js",
  "src/capture.js",
  "src/content.js",
  "src/dictionary.js",
  "src/discussion-stt.js",
  "src/discussion-tts.js",
  "src/i18n.js",
  "src/learning-history-core.js",
  "src/learning-site-adapters.js",
  "src/learning-mode-core.js",
  "src/learning-workspace-page.css",
  "src/learning-workspace-shell.js",
  "src/namespace.js",
  "src/overlay.js",
  "src/page-bridge.js",
  "src/player-settings.js",
  "src/service-worker.js",
  "src/settings.js",
  "src/translator.js"
];

export const DEVELOPMENT_RELOAD_PATH = "/__engram_extension_reload__";

export const createDevelopmentReloadClient = ({ buildId, reloadUrl }) => `
(() => {
  const currentBuildId = ${JSON.stringify(buildId)};
  const reloadUrl = ${JSON.stringify(reloadUrl)};
  const getBuildMessage = "ENGRAM_DEV_GET_BUILD";
  const reloadMessage = "ENGRAM_DEV_RELOAD";
  const runningInPage = typeof globalThis.window?.location?.reload === "function";
  let reloadStarted = false;

  const fetchBuild = async () => {
    if (runningInPage) {
      return chrome.runtime.sendMessage({ type: getBuildMessage });
    }
    const response = await fetch(reloadUrl, { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  };

  if (!runningInPage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === getBuildMessage) {
        fetchBuild().then(sendResponse).catch(() => sendResponse(null));
        return true;
      }
      if (message?.type === reloadMessage && message.buildId !== currentBuildId) {
        chrome.runtime.reload();
      }
      return false;
    });
  }

  const checkForUpdate = async () => {
    if (reloadStarted) return;
    try {
      const nextBuild = await fetchBuild();
      if (!nextBuild?.buildId || nextBuild.buildId === currentBuildId) return;

      reloadStarted = true;
      if (runningInPage) {
        chrome.runtime.sendMessage({
          type: reloadMessage,
          buildId: nextBuild.buildId,
        }).catch(() => {});
        globalThis.window.location.reload();
      } else {
        chrome.runtime.reload();
      }
    } catch {
      // The reload server is intentionally allowed to be offline.
    }
  };

  checkForUpdate();
  setInterval(checkForUpdate, 750);
})();
`;

export const buildExtension = ({
  sourceDirectory = repositoryRoot,
  outputDirectory = join(repositoryRoot, "dist", "extension"),
} = {}) => {
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });

  for (const relativePath of EXTENSION_FILES) {
    const destination = join(outputDirectory, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(sourceDirectory, relativePath), destination);
  }

  return outputDirectory;
};

export const buildDevelopmentExtension = ({
  sourceDirectory = repositoryRoot,
  outputDirectory = join(repositoryRoot, "dist", "extension"),
  reloadOrigin = "http://127.0.0.1:8790",
  buildId = `${Date.now()}`,
} = {}) => {
  buildExtension({ sourceDirectory, outputDirectory });

  const reloadUrl = new URL(DEVELOPMENT_RELOAD_PATH, reloadOrigin).toString();
  const reloadPermission = `${new URL(reloadUrl).origin}/*`;
  const manifestPath = join(outputDirectory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.host_permissions = [...new Set([
    ...(manifest.host_permissions || []),
    reloadPermission,
  ])];

  const isolatedContentScripts = (manifest.content_scripts || [])
    .filter((entry) => entry.world !== "MAIN");
  if (!isolatedContentScripts.length) {
    throw new Error("Development reload requires an isolated content script");
  }
  for (const entry of isolatedContentScripts) {
    entry.js = ["src/dev-reload.js", ...(entry.js || [])];
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const clientSource = createDevelopmentReloadClient({ buildId, reloadUrl });
  writeFileSync(join(outputDirectory, "src", "dev-reload.js"), clientSource);
  for (const relativePath of EXTENSION_FILES.filter((path) => path.endsWith(".html"))) {
    const pagePath = join(outputDirectory, relativePath);
    const pageSource = readFileSync(pagePath, "utf8");
    if (!/<\/body>/i.test(pageSource)) {
      throw new Error(`Development reload could not find </body> in ${relativePath}`);
    }
    writeFileSync(
      pagePath,
      pageSource.replace(/<\/body>/i, "  <script src=\"/src/dev-reload.js\"></script>\n</body>"),
    );
  }
  appendFileSync(
    join(outputDirectory, "src", "service-worker.js"),
    `\n// Engram development auto-reload client.\n${clientSource}`,
  );

  return { outputDirectory, buildId, reloadUrl };
};

const isEntrypoint = process.argv[1] && modulePath === resolve(process.argv[1]);
if (isEntrypoint) {
  const outputDirectory = buildExtension();
  console.log(`Extension build created at ${outputDirectory}`);
}
