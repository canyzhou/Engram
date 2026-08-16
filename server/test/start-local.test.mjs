import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  DEFAULT_ENV_PATH,
  loadLocalEnvironment,
  parseLocalEnv,
} from "../start-local.mjs";

test("uses the repository-local server config by default", () => {
  assert.equal(DEFAULT_ENV_PATH.endsWith(join("server", ".env.local")), true);
});

test("parses only supported local environment values without executing shell syntax", () => {
  assert.deepEqual(parseLocalEnv([
    "# local server settings",
    "DEEPSEEK_API_KEY='sk-test value'",
    "PORT=8787",
    "ALLOWED_ORIGINS=chrome-extension://example",
  ].join("\n")), {
    DEEPSEEK_API_KEY: "sk-test value",
    PORT: "8787",
    ALLOWED_ORIGINS: "chrome-extension://example",
  });

  assert.throws(
    () => parseLocalEnv("DEEPSEEK_API_KEY=sk-test\nRUN_ME=$(touch /tmp/never)"),
    /不支持的变量 RUN_ME/,
  );
});

test("loads a private env file", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "engram-server-env-"));
  const envPath = join(directory, "server.env");
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(envPath, "DEEPSEEK_API_KEY=sk-local-test\nPORT=9876\n", { mode: 0o600 });
  chmodSync(envPath, 0o600);

  const result = loadLocalEnvironment(envPath);
  assert.equal(result.envPath, realpathSync(envPath));
  assert.equal(result.env.DEEPSEEK_API_KEY, "sk-local-test");
  assert.equal(result.env.PORT, "9876");
});

test("rejects an env file readable by other local users", (context) => {
  if (process.platform === "win32") return;
  const directory = mkdtempSync(join(tmpdir(), "engram-server-env-"));
  const envPath = join(directory, "server.env");
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(envPath, "DEEPSEEK_API_KEY=sk-local-test\n", { mode: 0o644 });
  chmodSync(envPath, 0o644);

  assert.throws(() => loadLocalEnvironment(envPath), /chmod 600/);
});
