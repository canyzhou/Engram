import { handleAsNodeRequest } from "cloudflare:node";
import { createTranslationServer } from "./server.mjs";
import {
  createEdgeRateLimitKey,
  createEdgeRateLimitResponse,
  shouldApplyEdgeRateLimit,
} from "./worker-helpers.mjs";

const PORT = 8787;
const server = createTranslationServer();
server.listen(PORT);

export default {
  async fetch(request, env) {
    if (shouldApplyEdgeRateLimit(request) && env.API_RATE_LIMITER) {
      const { success } = await env.API_RATE_LIMITER.limit({
        key: createEdgeRateLimitKey(request),
      });
      if (!success) return createEdgeRateLimitResponse(request);
    }
    return handleAsNodeRequest(PORT, request);
  },
};
