import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = [
  spawn(process.execPath, ["--watch", "--watch-preserve-output", "server/dev.mjs"], {
    cwd: repositoryRoot,
    stdio: "inherit",
  }),
  spawn(process.execPath, ["--watch", "--watch-preserve-output", "scripts/dev-extension.mjs"], {
    cwd: repositoryRoot,
    stdio: "inherit",
  }),
];

let shuttingDown = false;
const shutdown = (signal = "SIGTERM", exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
  process.exitCode = exitCode;
};

for (const child of children) {
  child.once("error", (error) => {
    console.error(`Development process failed: ${error.message}`);
    shutdown("SIGTERM", 1);
  });
  child.once("exit", (code, signal) => {
    if (shuttingDown) return;
    const exitCode = Number.isInteger(code) ? code : 1;
    console.error(`Development process exited${signal ? ` from ${signal}` : ` with code ${exitCode}`}.`);
    shutdown("SIGTERM", exitCode);
  });
}

process.once("SIGINT", () => shutdown("SIGINT", 0));
process.once("SIGTERM", () => shutdown("SIGTERM", 0));
