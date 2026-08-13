import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/i18n.js", import.meta.url), "utf8");

const createI18n = () => {
  const document = { documentElement: { lang: "" }, querySelectorAll: () => [], querySelector: () => null };
  const context = vm.createContext({
    Object,
    String,
    document,
    globalThis: null,
    ParamountSubtitles: {},
  });
  context.globalThis = context;
  vm.runInContext(source, context);
  return { PST: context.ParamountSubtitles, document };
};

test("English is the application UI default", () => {
  const { PST, document } = createI18n();

  assert.equal(PST.getUiLanguage(), "en");
  assert.equal(PST.t("brandName"), "Engram");
  assert.equal(PST.t("secondsShort", 5), "5s");
  PST.setUiLanguage("unsupported");
  assert.equal(PST.getUiLanguage(), "en");
  assert.equal(document.documentElement.lang, "en");
  assert.deepEqual(
    Object.keys(PST.I18N_MESSAGES.en).sort(),
    Object.keys(PST.I18N_MESSAGES["zh-CN"]).sort(),
  );
});

test("Simplified Chinese can be selected and formats substitutions", () => {
  const { PST, document } = createI18n();

  PST.setUiLanguage("zh-CN");

  assert.equal(PST.t("brandName"), "语痕");
  assert.equal(PST.t("connectedParamount", "WebVTT"), "已连接到 Paramount+ · WebVTT");
  assert.equal(document.documentElement.lang, "zh-CN");
});
