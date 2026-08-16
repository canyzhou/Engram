import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../learning-settings.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../learning-settings.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../learning-settings.js", import.meta.url), "utf8");

test("vocabulary settings shares the dashboard shell and keeps its controls", () => {
  assert.match(html, /class="settings-shell"/);
  assert.match(html, /class="sidebar"/);
  assert.match(html, /dashboard\.html\?view=vocabulary/);
  assert.match(html, /class="nav-link settings-link"[^>]*aria-current="page"/);
  assert.match(html, /id="learning-hints"/);
  assert.match(html, /name="learning-level"/);
  assert.match(html, /id="preview-sentence"/);
  assert.match(css, /--accent:\s*#f2a733/);
  assert.match(css, /\.settings-shell\s*\{[^}]*grid-template-columns:\s*220px/s);
});

test("vocabulary settings mobile navigation is interactive and dismissible", () => {
  assert.match(html, /id="mobile-nav-button"[^>]*aria-expanded="false"/);
  assert.match(css, /body\[data-nav-open="true"\] \.sidebar/);
  assert.match(script, /const setMobileNav =/);
  assert.match(script, /event\.key === "Escape"/);
  assert.match(script, /event\.target\.closest\("\.sidebar, #mobile-nav-button"\)/);
});
