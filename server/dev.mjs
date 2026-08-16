import { loadLocalEnvironment } from "./start-local.mjs";
import { createTranslationServer } from "./server.mjs";

try {
  const { envPath, env } = loadLocalEnvironment(process.argv[2]);
  const host = env.HOST || "127.0.0.1";
  const port = Math.max(1, Number(env.PORT) || 8787);
  const server = createTranslationServer({ env });

  console.log(`Using local environment: ${envPath}`);
  server.listen(port, host, () => {
    console.log(`Translation proxy listening on http://${host}:${port} (watch mode)`);
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
