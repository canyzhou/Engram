const RATE_LIMITED_PATHS = new Set(["/v1/translate", "/v1/word-lookup"]);

export const shouldApplyEdgeRateLimit = (request) => (
  request.method === "POST" && RATE_LIMITED_PATHS.has(new URL(request.url).pathname)
);

export const createEdgeRateLimitKey = (request) => {
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  return `${address}:${new URL(request.url).pathname}`;
};

export const createEdgeRateLimitResponse = (request) => new Response(JSON.stringify({
  ok: false,
  error: "翻译请求过于频繁，请稍后重试",
}), {
  status: 429,
  headers: {
    "Access-Control-Allow-Origin": request.headers.get("origin") || "*",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  },
});
