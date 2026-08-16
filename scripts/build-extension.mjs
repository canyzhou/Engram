import { cpSync, mkdirSync, rmSync } from "node:fs";
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
  "src/i18n.js",
  "src/learning-history-core.js",
  "src/learning-mode-core.js",
  "src/learning-workspace-page.css",
  "src/learning-workspace-shell.js",
  "src/namespace.js",
  "src/overlay.js",
  "src/page-bridge.js",
  "src/service-worker.js",
  "src/settings.js",
  "src/translator.js"
];

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

const isEntrypoint = process.argv[1] && modulePath === resolve(process.argv[1]);
if (isEntrypoint) {
  const outputDirectory = buildExtension();
  console.log(`Extension build created at ${outputDirectory}`);
}
