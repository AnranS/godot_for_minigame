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

function installTtOnlyGlobals() {
  delete globalThis.wx;
  delete globalThis.__godotMiniGamePlatformRuntime;
  delete globalThis.PlatformRuntime;
  delete globalThis.godotSdk;
  delete globalThis.godotMiniGameBridgeV1;
  delete globalThis.WXWebAssembly;
  delete globalThis.TTWebAssembly;

  const canvas = makeCanvas();
  const callbacks = {};
  globalThis.GameGlobal = { canvas, __platform: "douyin" };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.tt = {
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
    getStorageInfoSync() { return { keys: [] }; },
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
    onError() {},
    loadSubpackage(options) { options.success(); },
  };
}

async function testTtOnlyAdapterFetchLoaderAndSdkImports() {
  installTtOnlyGlobals();

  const runtimeUrl = moduleUrl(read("js/platform_runtime.js"));

  const adapterUrl = moduleUrl(
    replaceSpecifier(read("adapter.js"), "./js/platform_runtime", runtimeUrl),
  );
  await import(adapterUrl);

  assert.equal(globalThis.GameGlobal.PlatformRuntime.platform, "douyin");
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
  assert.equal(JSON.parse(standaloneSdk.getBridgeInfo()).platform, "douyin");

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
  assert.equal(JSON.parse(globalThis.godotSdk.getBridgeInfo()).platform, "douyin");
}

await testTtOnlyAdapterFetchLoaderAndSdkImports();

console.log("tt_platform_smoke.test.mjs: ok");
