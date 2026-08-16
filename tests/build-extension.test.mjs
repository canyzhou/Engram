import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildExtension } from "../scripts/build-extension.mjs";

test("builds a publishable extension without backend or env files", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "engram-extension-build-"));
  const outputDirectory = join(directory, "extension");
  context.after(() => rmSync(directory, { recursive: true, force: true }));

  buildExtension({ outputDirectory });

  assert.equal(existsSync(join(outputDirectory, "manifest.json")), true);
  assert.equal(existsSync(join(outputDirectory, "src", "service-worker.js")), true);
  assert.equal(existsSync(join(outputDirectory, "server")), false);
  assert.equal(existsSync(join(outputDirectory, ".env.local")), false);
  assert.equal(existsSync(join(outputDirectory, "preview.html")), false);
  assert.equal(existsSync(join(outputDirectory, "assets", "icon-source.svg")), false);
});
