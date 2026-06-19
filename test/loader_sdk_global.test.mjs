import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const loaderPath = path.join(projectRoot, "addons/godot_mini_game/templates/common/js/loader.js");

function loadRegistrationBlock() {
  const source = fs.readFileSync(loaderPath, "utf8");
  const start = source.indexOf("const _api =");
  const end = source.indexOf("// Use __adapter.canvas");
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

async function testSdkIsRegisteredWhereGodotCanFindIt() {
  const registrationBlock = loadRegistrationBlock();

  delete globalThis.godotSdk;
  delete globalThis.__loaderSdkResult;
  globalThis.wx = {};
  globalThis.GameGlobal = { __adapter: { window: {} } };

  const moduleSource = `
    class GodotSDK {}
    ${registrationBlock}
    globalThis.__loaderSdkResult = {
      instance: godotSdk,
      gameGlobal: GameGlobal.godotSdk,
      globalThisValue: globalThis.godotSdk,
      adapterWindow: GameGlobal.__adapter.window.godotSdk,
    };
  `;

  await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource)}#${Date.now()}-${Math.random()}`);

  const result = globalThis.__loaderSdkResult;
  assert.ok(result.instance instanceof Object);
  assert.equal(result.gameGlobal, result.instance);
  assert.equal(result.globalThisValue, result.instance);
  assert.equal(result.adapterWindow, result.instance);

  delete globalThis.wx;
  delete globalThis.GameGlobal;
  delete globalThis.godotSdk;
  delete globalThis.__loaderSdkResult;
}

await testSdkIsRegisteredWhereGodotCanFindIt();

console.log("loader_sdk_global.test.mjs: ok");
