import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createEdgeRateLimitKey,
  createEdgeRateLimitResponse,
  shouldApplyEdgeRateLimit,
} from "../worker-helpers.mjs";

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(serverDirectory, "..");

test("applies the edge limiter only to translation API calls", () => {
  assert.equal(shouldApplyEdgeRateLimit(new Request("https://worker.example/v1/translate", {
    method: "POST",
  })), true);
  assert.equal(shouldApplyEdgeRateLimit(new Request("https://worker.example/v1/word-lookup", {
    method: "POST",
  })), true);
  assert.equal(shouldApplyEdgeRateLimit(new Request("https://worker.example/v1/lesson/analyze", {
    method: "POST",
  })), true);
  assert.equal(shouldApplyEdgeRateLimit(new Request("https://worker.example/v1/lesson/discuss", {
    method: "POST",
  })), true);
  assert.equal(shouldApplyEdgeRateLimit(new Request("https://worker.example/health")), false);
});

test("keys the edge limiter by Cloudflare client address and API route", async () => {
  const request = new Request("https://worker.example/v1/word-lookup", {
    method: "POST",
    headers: {
      "cf-connecting-ip": "203.0.113.4",
      origin: "chrome-extension://example",
    },
  });
  assert.equal(createEdgeRateLimitKey(request), "203.0.113.4:/v1/word-lookup");

  const response = createEdgeRateLimitResponse(request);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("access-control-allow-origin"), "chrome-extension://example");
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "翻译请求过于频繁，请稍后重试",
  });
});

test("Cloudflare config requires the production secret and a distributed limiter", () => {
  const config = JSON.parse(readFileSync(resolve(serverDirectory, "wrangler.jsonc"), "utf8"));
  assert.equal(config.main, "worker.mjs");
  assert.equal(config.compatibility_flags.includes("nodejs_compat"), true);
  assert.deepEqual(config.secrets.required, ["DEEPSEEK_API_KEY"]);
  assert.equal(config.ratelimits[0].name, "API_RATE_LIMITER");
  assert.equal(config.ratelimits[0].simple.limit, 120);
});

test("deployment workflow passes credentials only through GitHub secrets", () => {
  const workflow = readFileSync(resolve(
    repositoryRoot,
    ".github/workflows/deploy-cloudflare.yml",
  ), "utf8");
  assert.match(workflow, /cloudflare\/wrangler-action@v4/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /secrets\.DEEPSEEK_API_KEY/);
  assert.doesNotMatch(workflow, /sk-[A-Za-z0-9]/);
});
