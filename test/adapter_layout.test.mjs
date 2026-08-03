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
    getStorageInfoSync() {
      return options.getStorageInfoSync ? options.getStorageInfoSync() : { keys: [] };
    },
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
  delete globalThis.TTMinis;
  delete globalThis.__godotMiniGamePlatformRuntime;
  delete globalThis.PlatformRuntime;
  if (platform === "douyin") {
    globalThis.tt = api;
  } else if (platform === "tiktok") {
    if (options.gameGlobalProvider) globalThis.GameGlobal.TTMinis = { game: api };
    else globalThis.TTMinis = { game: api };
  } else {
    globalThis.wx = api;
  }
  if (options.wxAlias) globalThis.wx = options.wxAlias;
  if (options.ttAlias) globalThis.tt = options.ttAlias;
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
  assert.equal(adapter.window.navigator.maxTouchPoints, 10);
  assert.equal("ontouchstart" in adapter.window, true);
  assert.equal(Object.prototype.propertyIsEnumerable.call(adapter.window, "ontouchstart"), false);
  assert.equal("ontouchmove" in adapter.window, true);
  assert.equal("ontouchend" in adapter.window, true);
  assert.equal("ontouchcancel" in adapter.window, true);
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

async function testCanonicalTapDoesNotDoubleDispatch(platform) {
  const { callbacks } = installMiniGameGlobals(platform);
  await loadAdapter();

  const eventTypes = [];
  const canvas = globalThis.GameGlobal.__adapter.canvas;
  for (const type of [
    "pointerdown", "mousedown", "touchstart",
    "pointerup", "mouseup", "touchend",
  ]) {
    canvas.addEventListener(type, () => eventTypes.push(type));
  }

  callbacks.touchStart({
    touches: [{ identifier: 0, screenX: 100, screenY: 200 }],
    changedTouches: [{ identifier: 0, screenX: 100, screenY: 200 }],
  });
  callbacks.touchEnd({
    touches: [],
    changedTouches: [{ identifier: 0, screenX: 100, screenY: 200 }],
  });

  assert.deepEqual(eventTypes, ["touchstart", "touchend"]);
}

async function testTouchStreamUsesCanonicalTouchPath(platform) {
  const { callbacks } = installMiniGameGlobals(platform);
  await loadAdapter();

  const eventTypes = [];
  const touchMoves = [];
  const canvas = globalThis.GameGlobal.__adapter.canvas;
  for (const type of [
    "pointerdown", "mousedown", "touchstart",
    "pointermove", "mousemove", "touchmove",
    "pointerup", "mouseup", "touchend",
  ]) {
    canvas.addEventListener(type, (evt) => {
      eventTypes.push(type);
      if (type === "touchmove") touchMoves.push(evt);
    });
  }

  callbacks.touchStart({
    touches: [{ identifier: 0, screenX: 100, screenY: 200 }],
    changedTouches: [{ identifier: 0, screenX: 100, screenY: 200 }],
  });
  callbacks.touchMove({
    touches: [{ identifier: 0, screenX: 115, screenY: 170 }],
    changedTouches: [{ identifier: 0, screenX: 115, screenY: 170 }],
  });
  callbacks.touchEnd({
    touches: [],
    changedTouches: [{ identifier: 0, screenX: 115, screenY: 170 }],
  });

  assert.deepEqual(eventTypes, [
    "touchstart", "touchmove", "touchend",
  ]);
  assert.equal(touchMoves[0].changedTouches[0].clientX, 115);
  assert.equal(touchMoves[0].changedTouches[0].clientY, 170);
}

async function testPointerFallbackCarriesRelativeMovement(platform) {
  const { callbacks } = installMiniGameGlobals(platform);
  await loadAdapter();

  const events = [];
  const canvas = globalThis.GameGlobal.__adapter.canvas;
  for (const type of [
    "pointerdown", "mousedown", "pointermove",
    "mousemove", "pointerup", "mouseup",
  ]) {
    canvas.addEventListener(type, (evt) => events.push(evt));
  }

  callbacks.touchStart({
    touches: [{ identifier: 0, screenX: 100, screenY: 200 }],
    changedTouches: [{ identifier: 0, screenX: 100, screenY: 200 }],
  });
  callbacks.touchMove({
    touches: [{ identifier: 0, screenX: 115, screenY: 170 }],
    changedTouches: [{ identifier: 0, screenX: 115, screenY: 170 }],
  });
  callbacks.touchEnd({
    touches: [],
    changedTouches: [{ identifier: 0, screenX: 115, screenY: 170 }],
  });

  assert.deepEqual(events.map((evt) => evt.type), [
    "pointerdown", "mousedown", "pointermove",
    "mousemove", "pointerup", "mouseup",
  ]);
  const pointerMove = events.find((evt) => evt.type === "pointermove");
  const mouseMove = events.find((evt) => evt.type === "mousemove");
  assert.equal(pointerMove.clientX, 115);
  assert.equal(pointerMove.clientY, 170);
  assert.equal(pointerMove.movementX, 15);
  assert.equal(pointerMove.movementY, -30);
  assert.equal(mouseMove.movementX, 15);
  assert.equal(mouseMove.movementY, -30);
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

async function testLocalStorageEnumerationQuarantinesTikTokNative() {
  const tiktokCases = [
    {},
    { gameGlobalProvider: true },
    { wxAlias: {}, ttAlias: {} },
    { gameGlobalProvider: true, wxAlias: {}, ttAlias: {} },
  ];
  for (const providerOptions of tiktokCases) {
    let hostCalls = 0;
    installMiniGameGlobals("tiktok", {
      ...providerOptions,
      getStorageInfoSync() {
        hostCalls += 1;
        throw new Error("unsafe host method must not run");
      },
    });
    await loadAdapter();

    const storage = globalThis.GameGlobal.__adapter.window.localStorage;
    assert.equal(storage.length, 0);
    assert.equal(storage.key(0), null);
    assert.equal(hostCalls, 0, "TikTok localStorage enumeration must make zero host calls");
    assert.equal(globalThis.GameGlobal.PlatformRuntime.platform, "tiktok");
  }
}

async function testLocalStorageEnumerationStillWorksOnWeChatAndDouyin() {
  for (const platform of ["wechat", "douyin"]) {
    let hostCalls = 0;
    installMiniGameGlobals(platform, {
      getStorageInfoSync() {
        hostCalls += 1;
        return { keys: ["first", "second"] };
      },
    });
    await loadAdapter();

    const storage = globalThis.GameGlobal.__adapter.window.localStorage;
    assert.equal(storage.length, 2);
    assert.equal(storage.key(1), "second");
    assert.equal(hostCalls, 2, `${platform} localStorage enumeration must remain enabled`);
  }
}

async function testTiktokWebAssemblyShimCoversRuntimeRealms() {
  const standardWebAssembly = globalThis.WebAssembly;
  const instantiateCalls = [];
  installMiniGameGlobals("tiktok");
  globalThis.TTWebAssembly = {
    instantiate(source, imports) {
      instantiateCalls.push([source, imports]);
      return Promise.resolve({ instance: {}, module: {} });
    },
  };

  try {
    await loadAdapter();
    const shim = globalThis.WebAssembly;
    assert.notEqual(shim, standardWebAssembly);
    assert.equal(globalThis.GameGlobal.WebAssembly, shim);
    assert.equal(globalThis.GameGlobal.__adapter.window.WebAssembly, shim);

    const imports = { env: {} };
    await shim.instantiate(new Uint8Array([0]), imports);
    assert.deepEqual(instantiateCalls, [["engine/godot.wasm.br", imports]]);
  } finally {
    globalThis.WebAssembly = standardWebAssembly;
    delete globalThis.TTWebAssembly;
  }
}

for (const platform of ["wechat", "douyin", "tiktok"]) {
  await testCanvasUsesLogicalMetricsForGodotViewport(platform);
  await testResizeKeepsMetricsInTheSameCoordinateSpace(platform);
  await testTouchCoordinatesStayInCssPixels(platform);
  await testCanonicalTapDoesNotDoubleDispatch(platform);
  await testTouchStreamUsesCanonicalTouchPath(platform);
  await testPointerFallbackCarriesRelativeMovement(platform);
  await testModernWindowInfoAndOptionalTouchCancel(platform);
}

await testLocalStorageEnumerationQuarantinesTikTokNative();
await testLocalStorageEnumerationStillWorksOnWeChatAndDouyin();
await testTiktokWebAssemblyShimCoversRuntimeRealms();

console.log("adapter_layout.test.mjs: ok");
