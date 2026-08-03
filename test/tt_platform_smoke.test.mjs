import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const commonRoot = path.join(projectRoot, "addons/godot_mini_game/templates/common");

function read(relativePath) {
  return fs.readFileSync(path.join(commonRoot, relativePath), "utf8");
}

function moduleUrl(source) {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}#${Date.now()}-${Math.random()}`;
}

function replaceSpecifier(source, specifier, replacement) {
  return source.replaceAll(JSON.stringify(specifier), JSON.stringify(replacement));
}

function makeCanvas() {
  return {
    width: 0,
    height: 0,
    style: {},
    getContext(type) { return { type, canvas: this }; },
  };
}

function installByteDanceGlobals(platform) {
  delete globalThis.wx;
  delete globalThis.tt;
  delete globalThis.TTMinis;
  delete globalThis.__godotMiniGamePlatformRuntime;
  delete globalThis.PlatformRuntime;
  delete globalThis.godotSdk;
  delete globalThis.godotMiniGameBridgeV1;
  delete globalThis.WXWebAssembly;
  delete globalThis.TTWebAssembly;

  const canvas = makeCanvas();
  const callbacks = {};
  let storageInfoCalls = 0;
  let wxAliasStorageInfoCalls = 0;
  let ttAliasStorageInfoCalls = 0;
  let batteryInfoCalls = 0;
  let batteryInfoSyncCalls = 0;
  globalThis.GameGlobal = { canvas, __platform: platform };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  const api = {
    env: { USER_DATA_PATH: "/tmp" },
    createCanvas: makeCanvas,
    createImage() { return {}; },
    getWindowInfo() {
      return {
        platform: "devtools",
        language: "en",
        windowWidth: 360,
        windowHeight: 780,
        screenWidth: 360,
        screenHeight: 780,
        pixelRatio: 2,
      };
    },
    getSystemInfoSync() { return this.getWindowInfo(); },
    getFileSystemManager() { return { writeFileSync() {} }; },
    getStorageSync() { return null; },
    setStorageSync() {},
    removeStorageSync() {},
    clearStorageSync() {},
    getStorageInfoSync() {
      storageInfoCalls += 1;
      return { keys: ["save"], currentSize: 3, limitSize: 10 };
    },
    getBatteryInfo(options) {
      batteryInfoCalls += 1;
      if (platform === "douyin") {
        options.success({ level: 64, isCharging: true });
      }
    },
    getBatteryInfoSync() {
      batteryInfoSyncCalls += 1;
      return { level: 32, isCharging: false };
    },
    request(options) {
      options.success({ data: "ok", statusCode: 200, errMsg: "request:ok", header: {} });
    },
    onTouchStart(fn) { callbacks.touchStart = fn; },
    onTouchMove(fn) { callbacks.touchMove = fn; },
    onTouchEnd(fn) { callbacks.touchEnd = fn; },
    onTouchCancel(fn) { callbacks.touchCancel = fn; },
    onWindowResize(fn) { callbacks.resize = fn; },
    onShow() {},
    onHide() {},
    loadSubpackage(options) { options.success(); },
  };
  if (platform === "douyin") {
    api.onError = () => {};
    globalThis.tt = api;
  } else {
    globalThis.GameGlobal.TTMinis = { game: api };
    globalThis.wx = {
      getStorageInfoSync() { wxAliasStorageInfoCalls += 1; },
    };
    globalThis.tt = {
      getStorageInfoSync() { ttAliasStorageInfoCalls += 1; },
    };
  }
  return {
    storageInfoCalls: () => storageInfoCalls,
    wxAliasStorageInfoCalls: () => wxAliasStorageInfoCalls,
    ttAliasStorageInfoCalls: () => ttAliasStorageInfoCalls,
    batteryInfoCalls: () => batteryInfoCalls,
    batteryInfoSyncCalls: () => batteryInfoSyncCalls,
  };
}

async function testByteDanceAdapterFetchLoaderAndSdkImports(platform) {
  const counters = installByteDanceGlobals(platform);

  const runtimeUrl = moduleUrl(read("js/platform_runtime.js"));

  const adapterUrl = moduleUrl(
    replaceSpecifier(read("adapter.js"), "./js/platform_runtime", runtimeUrl),
  );
  await import(adapterUrl);

  assert.equal(globalThis.GameGlobal.PlatformRuntime.platform, platform);
  assert.equal(globalThis.GameGlobal.__adapter.window.innerWidth, 360);

  const fetchUrl = moduleUrl(
    replaceSpecifier(read("fetch.js"), "./js/platform_runtime", runtimeUrl),
  );
  await import(fetchUrl);
  assert.equal(typeof globalThis.GameGlobal.fetch, "function");

  const sdkUrl = moduleUrl(
    replaceSpecifier(read("js/libs/sdk.js"), "../platform_runtime", runtimeUrl),
  );
  const { GodotSDK } = await import(sdkUrl);
  const standaloneSdk = new GodotSDK();
  assert.equal(JSON.parse(standaloneSdk.getBridgeInfo()).platform, platform);

  const storage = globalThis.GameGlobal.__adapter.window.localStorage;
  const storageInfo = JSON.parse(standaloneSdk.storageGetAll());
  const batteryInfo = await new Promise((resolve) => {
    standaloneSdk.getBatteryInfo((...args) => resolve(args));
  });
  const batteryInfoSync = JSON.parse(standaloneSdk.getBatteryInfoSync());
  if (platform === "tiktok") {
    assert.equal(globalThis.TTMinis, undefined);
    assert.equal(storageInfo.supported, false);
    assert.deepEqual(storageInfo.keys, []);
    assert.match(storageInfo.error, /disabled on TikTok Native.*crash the host process/);
    assert.equal(storage.length, 0);
    assert.equal(storage.key(0), null);
    assert.equal(counters.storageInfoCalls(), 0);
    assert.equal(counters.wxAliasStorageInfoCalls(), 0);
    assert.equal(counters.ttAliasStorageInfoCalls(), 0);
    assert.deepEqual(batteryInfo, [
      0,
      false,
      "",
      "TTMinis.game.getBatteryInfo is not supported on TikTok Native",
    ]);
    assert.deepEqual(batteryInfoSync, {
      supported: false,
      error: "TTMinis.game.getBatteryInfoSync is not supported on TikTok Native",
    });
    assert.equal(counters.batteryInfoCalls(), 0);
    assert.equal(counters.batteryInfoSyncCalls(), 0);
  } else {
    assert.deepEqual(storageInfo, { keys: ["save"], size: 3, limit: 10 });
    assert.equal(storage.length, 1);
    assert.equal(storage.key(0), "save");
    assert.equal(counters.storageInfoCalls(), 3);
    assert.deepEqual(batteryInfo, [64, true, JSON.stringify({ level: 64, isCharging: true }), ""]);
    assert.deepEqual(batteryInfoSync, { level: 32, isCharging: false });
    assert.equal(counters.batteryInfoCalls(), 1);
    assert.equal(counters.batteryInfoSyncCalls(), 1);
  }

  const godotStubUrl = moduleUrl("export {};");
  const imageLoaderStubUrl = moduleUrl(
    "export function waitForImage() { return Promise.resolve(); }",
  );
  let loaderSource = read("js/loader.js");
  loaderSource = replaceSpecifier(loaderSource, "./libs/godot", godotStubUrl);
  loaderSource = replaceSpecifier(loaderSource, "./libs/sdk", sdkUrl);
  loaderSource = replaceSpecifier(loaderSource, "./image_loader", imageLoaderStubUrl);
  loaderSource = replaceSpecifier(loaderSource, "./platform_runtime", runtimeUrl);
  const { default: Loader } = await import(moduleUrl(loaderSource));

  assert.equal(typeof Loader, "function");
  assert.equal(globalThis.GameGlobal.godotSdk, globalThis.godotSdk);
  assert.equal(globalThis.GameGlobal.__adapter.window.godotSdk, globalThis.godotSdk);
  assert.equal(globalThis.GameGlobal.godotMiniGameBridgeV1, globalThis.godotSdk);
  assert.equal(globalThis.GameGlobal.__adapter.window.godotMiniGameBridgeV1, globalThis.godotSdk);
  assert.equal(JSON.parse(globalThis.godotSdk.getBridgeInfo()).platform, platform);
}

for (const platform of ["douyin", "tiktok"]) {
  await testByteDanceAdapterFetchLoaderAndSdkImports(platform);
}

console.log("tt_platform_smoke.test.mjs: ok");
