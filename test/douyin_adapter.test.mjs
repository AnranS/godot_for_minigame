import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const adapterPath = path.join(projectRoot, "addons/godot_mini_game/templates/common/adapter.js");
const manifestPath = path.join(projectRoot, "addons/godot_mini_game/templates/douyin/game.json.template");

function makeCanvas() {
  return {
    width: 0,
    height: 0,
    style: {},
    getContext(type) {
      return { type, canvas: this };
    },
  };
}

function installDouyinOnlyGlobals() {
  const callbacks = {};
  const mainCanvas = makeCanvas();
  const windowInfo = {
    platform: "devtools",
    language: "zh-CN",
    windowWidth: 390,
    windowHeight: 844,
    screenWidth: 390,
    screenHeight: 844,
  };

  delete globalThis.wx;
  delete globalThis.WXWebAssembly;
  delete globalThis.TTWebAssembly;
  globalThis.GameGlobal = { canvas: mainCanvas, __platform: "douyin" };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.tt = {
    env: { USER_DATA_PATH: "/tmp/douyin-user-data" },
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

  return { callbacks, mainCanvas };
}

async function loadAdapter() {
  const source = fs.readFileSync(adapterPath, "utf8");
  await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}#${Date.now()}-${Math.random()}`);
}

async function testAdapterImportsWithOnlyDouyinApi() {
  const { callbacks, mainCanvas } = installDouyinOnlyGlobals();

  assert.equal(typeof globalThis.wx, "undefined");
  await loadAdapter();

  assert.ok(globalThis.GameGlobal.__adapter);
  assert.equal(globalThis.GameGlobal.__adapter.canvas, mainCanvas);
  assert.equal(globalThis.GameGlobal.__adapter.window.innerWidth, 390);
  assert.equal(typeof callbacks.touchStart, "function");
  assert.equal(typeof callbacks.touchEnd, "function");
}

function testDouyinManifestUsesOfficialSubPackagesField() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.ok(Object.hasOwn(manifest, "subPackages"));
  assert.equal(Object.hasOwn(manifest, "subpackages"), false);
  assert.deepEqual(manifest.subPackages, [
    { root: "engine/", name: "engine" },
    { root: "subpacks/", name: "subpacks" },
  ]);
}

await testAdapterImportsWithOnlyDouyinApi();
testDouyinManifestUsesOfficialSubPackagesField();

console.log("douyin_adapter.test.mjs: ok");
