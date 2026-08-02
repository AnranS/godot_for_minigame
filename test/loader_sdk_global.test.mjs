import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const loaderPath = path.join(projectRoot, "addons/godot_mini_game/templates/common/js/loader.js");

function loadRegistrationBlock() {
  const source = fs.readFileSync(loaderPath, "utf8");
  const start = source.indexOf("const godotSdk =");
  const end = source.indexOf("// Use __adapter.canvas");
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

async function testSdkIsRegisteredWhereGodotCanFindIt() {
  const registrationBlock = loadRegistrationBlock();

  delete globalThis.godotSdk;
  delete globalThis.godotMiniGameBridgeV1;
  delete globalThis.__loaderSdkResult;
  const hostCrypto = { getRandomValues(view) { return view; } };
  globalThis.GameGlobal = { crypto: hostCrypto, __adapter: { window: {} } };

  const moduleSource = `
    class GodotSDK {}
    class FakeBlob {}
    const fallbackCrypto = {};
    const BRIDGE_GLOBAL_NAME = "godotMiniGameBridgeV1";
    const _global = GameGlobal;
    ${registrationBlock}
    globalThis.__loaderSdkResult = {
      instance: godotSdk,
      gameGlobal: GameGlobal.godotSdk,
      globalThisValue: globalThis.godotSdk,
      adapterWindow: GameGlobal.__adapter.window.godotSdk,
      versionedGameGlobal: GameGlobal.godotMiniGameBridgeV1,
      versionedGlobalThis: globalThis.godotMiniGameBridgeV1,
      versionedAdapterWindow: GameGlobal.__adapter.window.godotMiniGameBridgeV1,
      crypto: GameGlobal.crypto,
    };
  `;

  await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource)}#${Date.now()}-${Math.random()}`);

  const result = globalThis.__loaderSdkResult;
  assert.ok(result.instance instanceof Object);
  assert.equal(result.gameGlobal, result.instance);
  assert.equal(result.globalThisValue, result.instance);
  assert.equal(result.adapterWindow, result.instance);
  assert.equal(result.versionedGameGlobal, result.instance);
  assert.equal(result.versionedGlobalThis, result.instance);
  assert.equal(result.versionedAdapterWindow, result.instance);
  assert.equal(result.crypto, hostCrypto);

  delete globalThis.GameGlobal;
  delete globalThis.godotSdk;
  delete globalThis.godotMiniGameBridgeV1;
  delete globalThis.__loaderSdkResult;
}

await testSdkIsRegisteredWhereGodotCanFindIt();

console.log("loader_sdk_global.test.mjs: ok");
