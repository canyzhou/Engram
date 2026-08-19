import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const serverDirectory = dirname(modulePath);
const configRoot = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");

export const DEFAULT_ENV_PATH = join(serverDirectory, ".env.local");
export const LEGACY_ENV_PATH = join(
  configRoot,
  "Engram",
  "server.env",
);

const ALLOWED_KEYS = new Set([
  "DEEPSEEK_API_KEY",
  "DEEPGRAM_API_KEY",
  "HOST",
  "PORT",
  "ALLOWED_ORIGINS",
  "RATE_LIMIT_PER_MINUTE",
  "VOICE_TOKEN_RATE_LIMIT_PER_MINUTE",
  "MAX_CONCURRENCY",
]);

const decodeValue = (rawValue, lineNumber) => {
  const value = rawValue.trim();
  if (!value) return "";
  const quote = value[0];
  if (quote !== "\"" && quote !== "'") return value;
  if (value.at(-1) !== quote) {
    throw new Error(`env 第 ${lineNumber} 行的引号没有闭合`);
  }
  const content = value.slice(1, -1);
  if (quote === "'") return content;
  return content.replace(/\\(n|r|t|\\|\")/g, (_match, escaped) => ({
    n: "\n",
    r: "\r",
    t: "\t",
    "\\": "\\",
    "\"": "\"",
  })[escaped]);
};

export const parseLocalEnv = (source) => {
  const parsed = {};
  String(source).split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) throw new Error(`env 第 ${index + 1} 行格式无效`);
    const [, key, rawValue] = match;
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(`env 第 ${index + 1} 行包含不支持的变量 ${key}`);
    }
    parsed[key] = decodeValue(rawValue, index + 1);
  });
  return parsed;
};

export const loadLocalEnvironment = (requestedPath) => {
  const configuredPath = resolve(
    requestedPath
      || process.env.ENGRAM_SERVER_ENV_FILE
      || process.env.PST_SERVER_ENV_FILE
      || (existsSync(DEFAULT_ENV_PATH) || !existsSync(LEGACY_ENV_PATH)
        ? DEFAULT_ENV_PATH
        : LEGACY_ENV_PATH),
  );
  let envPath;
  try {
    envPath = realpathSync(configuredPath);
  } catch {
    throw new Error(`找不到本地 env 文件：${configuredPath}`);
  }
  const file = statSync(envPath);
  if (!file.isFile()) throw new Error(`env 路径不是普通文件：${envPath}`);
  if (process.platform !== "win32" && (file.mode & 0o077) !== 0) {
    throw new Error(`env 文件权限过宽，请先执行：chmod 600 ${envPath}`);
  }

  const parsed = parseLocalEnv(readFileSync(envPath, "utf8"));
  if (!String(parsed.DEEPSEEK_API_KEY || "").trim()) {
    throw new Error("env 文件缺少 DEEPSEEK_API_KEY");
  }
  if (!String(parsed.DEEPGRAM_API_KEY || "").trim()) {
    throw new Error("env 文件缺少 DEEPGRAM_API_KEY");
  }
  return { envPath, env: { ...process.env, ...parsed } };
};

const isEntrypoint = process.argv[1] && modulePath === resolve(process.argv[1]);
if (isEntrypoint) {
  try {
    const { envPath, env } = loadLocalEnvironment(process.argv[2]);
    console.log(`Using local environment: ${envPath}`);
    const child = spawn(process.execPath, [join(serverDirectory, "server.mjs")], {
      env,
      stdio: "inherit",
    });
    child.once("error", (error) => {
      console.error(`无法启动翻译代理：${error.message}`);
      process.exitCode = 1;
    });
    child.once("exit", (code, signal) => {
      if (signal) process.kill(process.pid, signal);
      else process.exitCode = code ?? 1;
    });
  } catch (error) {
    console.error(error.message);
    console.error(`默认路径：${DEFAULT_ENV_PATH}`);
    process.exitCode = 1;
  }
}
