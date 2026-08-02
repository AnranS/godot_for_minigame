import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const templateRoot = path.join(projectRoot, "addons/godot_mini_game/templates");

function read(relativePath) {
  return fs.readFileSync(path.join(templateRoot, relativePath), "utf8");
}

function moduleUrl(source) {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}#${Date.now()}-${Math.random()}`;
}

function replaceSpecifier(source, specifier, replacement) {
  return source.replaceAll(JSON.stringify(specifier), JSON.stringify(replacement));
}

async function importEntrypoint(entryPlatform, availablePlatform) {
  delete globalThis.wx;
  delete globalThis.tt;
  delete globalThis.__godotMiniGamePlatformRuntime;
  delete globalThis.PlatformRuntime;
  globalThis.GameGlobal = {};
  globalThis[availablePlatform === "wechat" ? "wx" : "tt"] = {};
  globalThis.__entryLoaderCalls = 0;

  const runtimeUrl = moduleUrl(read("common/js/platform_runtime.js"));
  const emptyModuleUrl = moduleUrl("export {};");
  const loaderStubUrl = moduleUrl(`
    export default class Loader {
      constructor() { globalThis.__entryLoaderCalls += 1; }
      load() { return Promise.resolve(); }
    }
  `);
  let source = read(`${entryPlatform}/game.js`);
  source = replaceSpecifier(source, "./adapter", emptyModuleUrl);
  source = replaceSpecifier(source, "./fetch", emptyModuleUrl);
  source = replaceSpecifier(source, "./js/loader", loaderStubUrl);
  source = replaceSpecifier(source, "./js/platform_runtime", runtimeUrl);
  return import(moduleUrl(source));
}

for (const platform of ["wechat", "douyin"]) {
  await importEntrypoint(platform, platform);
  assert.equal(globalThis.__entryLoaderCalls, 1, `${platform} should boot on its own provider`);
}

await assert.rejects(
  importEntrypoint("wechat", "douyin"),
  /WeChat entrypoint requires wechat, but detected douyin/,
);
assert.equal(globalThis.__entryLoaderCalls, 0);

await assert.rejects(
  importEntrypoint("douyin", "wechat"),
  /Douyin entrypoint requires douyin, but detected wechat/,
);
assert.equal(globalThis.__entryLoaderCalls, 0);

console.log("entry_platform.test.mjs: ok");
