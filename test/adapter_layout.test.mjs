import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const adapterPath = path.join(projectRoot, "addons/godot_mini_game/templates/common/adapter.js");
const runtimePath = path.join(projectRoot, "addons/godot_mini_game/templates/common/js/platform_runtime.js");

function moduleUrl(source) {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}#${Date.now()}-${Math.random()}`;
}

function makeCanvas() {
  const listeners = new Map();
  return {
    width: 0,
    height: 0,
    style: {},
    getContext(type) {
      return {
        type,
        canvas: this,
      };
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) || [];
      const idx = list.indexOf(fn);
      if (idx !== -1) list.splice(idx, 1);
    },
  };
}

function installMiniGameGlobals(platform = "wechat", options = {}) {
  const callbacks = {};
  const mainCanvas = makeCanvas();
  const windowInfo = {
    platform: "devtools",
    language: "en",
    windowWidth: 390,
    windowHeight: 844,
    screenWidth: 390,
    screenHeight: 844,
    pixelRatio: 3,
  };
  const hostCrypto = { getRandomValues(view) { return view; } };

  globalThis.GameGlobal = { canvas: mainCanvas, crypto: hostCrypto, __platform: platform };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  const api = {
    env: { USER_DATA_PATH: "/tmp" },
    getWindowInfo() { return { ...windowInfo }; },
    getSystemInfoSync() { return { ...windowInfo }; },
    getFileSystemManager() { return { writeFileSync() {} }; },
    createCanvas: makeCanvas,
    createImage() { return {}; },
    getStorageSync() { return null; },
    setStorageSync() {},
    removeStorageSync() {},
    clearStorageSync() {},
    getStorageInfoSync() { return { keys: [] }; },
    onTouchStart(fn) { callbacks.touchStart = fn; },
    onTouchMove(fn) { callbacks.touchMove = fn; },
    onTouchEnd(fn) { callbacks.touchEnd = fn; },
    onTouchCancel(fn) { callbacks.touchCancel = fn; },
    onWindowResize(fn) { callbacks.resize = fn; },
  };
  if (options.modernWindowInfoOnly) delete api.getSystemInfoSync;
  if (options.withoutTouchCancel) delete api.onTouchCancel;
  delete globalThis.wx;
  delete globalThis.tt;
  delete globalThis.__godotMiniGamePlatformRuntime;
  delete globalThis.PlatformRuntime;
  globalThis[platform === "douyin" ? "tt" : "wx"] = api;
  delete globalThis.WXWebAssembly;
  delete globalThis.TTWebAssembly;

  return { callbacks, hostCrypto, mainCanvas };
}

async function loadAdapter() {
  const runtimeUrl = moduleUrl(fs.readFileSync(runtimePath, "utf8"));
  const source = fs.readFileSync(adapterPath, "utf8")
    .replace('"./js/platform_runtime"', JSON.stringify(runtimeUrl));
  await import(moduleUrl(source));
}

async function testCanvasUsesLogicalMetricsForGodotViewport(platform) {
  const { hostCrypto, mainCanvas } = installMiniGameGlobals(platform);
  await loadAdapter();

  const adapter = globalThis.GameGlobal.__adapter;
  const rect = adapter.canvas.getBoundingClientRect();

  assert.equal(mainCanvas.width, 390);
  assert.equal(mainCanvas.height, 844);
  assert.equal(adapter.window.innerWidth, 390);
  assert.equal(adapter.window.innerHeight, 844);
  assert.equal(adapter.window.devicePixelRatio, 1);
  assert.equal(adapter.document.documentElement.clientWidth, 390);
  assert.equal(adapter.document.documentElement.clientHeight, 844);
  assert.equal(adapter.document.body.clientWidth, 390);
  assert.equal(adapter.document.body.clientHeight, 844);
  assert.equal(adapter.canvas.clientWidth, 390);
  assert.equal(adapter.canvas.clientHeight, 844);
  assert.equal(adapter.canvas.style.width, "390px");
  assert.equal(adapter.canvas.style.height, "844px");
  assert.equal(globalThis.GameGlobal.PlatformRuntime.platform, platform);
  assert.equal(globalThis.GameGlobal.crypto, hostCrypto);
  assert.equal(adapter.window.crypto, hostCrypto);
  assert.deepEqual(
    { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
    { x: 0, y: 0, width: 390, height: 844, right: 390, bottom: 844 },
  );
}

async function testResizeKeepsMetricsInTheSameCoordinateSpace(platform) {
  const { callbacks, mainCanvas } = installMiniGameGlobals(platform);
  await loadAdapter();

  callbacks.resize({ size: { windowWidth: 430, windowHeight: 932 } });
  const adapter = globalThis.GameGlobal.__adapter;
  const rect = adapter.canvas.getBoundingClientRect();

  assert.equal(mainCanvas.width, 430);
  assert.equal(mainCanvas.height, 932);
  assert.equal(adapter.window.innerWidth, 430);
  assert.equal(adapter.window.innerHeight, 932);
  assert.equal(adapter.window.devicePixelRatio, 1);
  assert.equal(adapter.document.documentElement.clientWidth, 430);
  assert.equal(adapter.document.documentElement.clientHeight, 932);
  assert.equal(adapter.canvas.clientWidth, 430);
  assert.equal(adapter.canvas.clientHeight, 932);
  assert.equal(rect.width, 430);
  assert.equal(rect.height, 932);
}

async function testTouchCoordinatesStayInCssPixels(platform) {
  const { callbacks } = installMiniGameGlobals(platform);
  await loadAdapter();

  const events = [];
  globalThis.GameGlobal.__adapter.canvas.addEventListener("touchstart", (evt) => {
    events.push(evt.changedTouches[0]);
  });

  callbacks.touchStart({
    touches: [{ identifier: 7, clientX: 100, clientY: 200 }],
    changedTouches: [{ identifier: 7, clientX: 100, clientY: 200 }],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].clientX, 100);
  assert.equal(events[0].clientY, 200);
}

async function testModernWindowInfoAndOptionalTouchCancel(platform) {
  const { mainCanvas } = installMiniGameGlobals(platform, {
    modernWindowInfoOnly: true,
    withoutTouchCancel: true,
  });
  await loadAdapter();

  assert.equal(mainCanvas.width, 390);
  assert.equal(globalThis.GameGlobal.__adapter.window.navigator.platform, "devtools");
}

for (const platform of ["wechat", "douyin"]) {
  await testCanvasUsesLogicalMetricsForGodotViewport(platform);
  await testResizeKeepsMetricsInTheSameCoordinateSpace(platform);
  await testTouchCoordinatesStayInCssPixels(platform);
  await testModernWindowInfoAndOptionalTouchCancel(platform);
}

console.log("adapter_layout.test.mjs: ok");
