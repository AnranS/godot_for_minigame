import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const runtimePath = path.join(
  projectRoot,
  "addons/godot_mini_game/templates/common/js/platform_runtime.js",
);

function moduleUrl(source) {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}#${Date.now()}-${Math.random()}`;
}

async function loadRuntime({ wxApi, ttApi, explicitPlatform, cachedRuntime } = {}) {
  delete globalThis.wx;
  delete globalThis.tt;
  delete globalThis.__godotMiniGamePlatformRuntime;
  delete globalThis.PlatformRuntime;
  globalThis.GameGlobal = explicitPlatform ? { __platform: explicitPlatform } : {};
  if (cachedRuntime) {
    globalThis.__godotMiniGamePlatformRuntime = cachedRuntime;
    globalThis.GameGlobal.__godotMiniGamePlatformRuntime = cachedRuntime;
  }
  if (wxApi) globalThis.wx = wxApi;
  if (ttApi) globalThis.tt = ttApi;

  const source = fs.readFileSync(runtimePath, "utf8");
  return import(moduleUrl(source));
}

function makeApi() {
  return {
    createCanvas() { return {}; },
    request() {},
    getStorageSync() { return null; },
    setStorageSync() {},
  };
}

async function testWxOnlyDetection() {
  const wxApi = makeApi();
  const { PlatformRuntime } = await loadRuntime({ wxApi });

  assert.equal(PlatformRuntime.platform, "wechat");
  assert.equal(PlatformRuntime.apiPrefix, "wx");
  assert.equal(PlatformRuntime.requireApi("test"), wxApi);
  assert.equal(PlatformRuntime.capabilities.canvas, true);
  assert.equal(PlatformRuntime.capabilities.request, true);
  assert.equal(PlatformRuntime.brand, "godot-mini-game-platform-runtime");
  assert.equal(PlatformRuntime.schemaVersion, 1);
  assert.equal(PlatformRuntime.abiVersion, 1);
  assert.equal(PlatformRuntime.requirePlatform("wechat", "test"), wxApi);
  assert.equal(PlatformRuntime.requireCapabilities(["canvas", "request"], "test"), wxApi);
  assert.equal(globalThis.GameGlobal.PlatformRuntime, PlatformRuntime);
  assert.equal(globalThis.__godotMiniGamePlatformRuntime, PlatformRuntime);
}

async function testTtOnlyDetection() {
  const ttApi = makeApi();
  const { PlatformRuntime } = await loadRuntime({ ttApi });

  assert.equal(PlatformRuntime.platform, "douyin");
  assert.equal(PlatformRuntime.apiPrefix, "tt");
  assert.equal(PlatformRuntime.requireApi("test"), ttApi);
  assert.equal(PlatformRuntime.getBridgeInfo().abiVersion, 1);
  assert.equal(PlatformRuntime.getBridgeInfo().platform, "douyin");
  assert.throws(
    () => PlatformRuntime.requirePlatform("wechat", "WeChat entrypoint"),
    /requires wechat, but detected douyin/,
  );
}

async function testNeitherProviderHasADescriptiveFailure() {
  const { PlatformRuntime } = await loadRuntime();

  assert.equal(PlatformRuntime.available, false);
  assert.equal(PlatformRuntime.platform, "unknown");
  assert.equal(PlatformRuntime.apiPrefix, "platform");
  assert.equal(PlatformRuntime.capabilities.canvas, false);
  assert.throws(
    () => PlatformRuntime.requireApi("adapter"),
    (error) => error instanceof Error
      && !(error instanceof ReferenceError)
      && error.message.includes("requires a WeChat (wx) or Douyin (tt)"),
  );
}

async function testExplicitPlatformBreaksATwoProviderTie() {
  const wxApi = makeApi();
  const ttApi = makeApi();
  const { PlatformRuntime } = await loadRuntime({
    wxApi,
    ttApi,
    explicitPlatform: "douyin",
  });

  assert.equal(PlatformRuntime.platform, "douyin");
  assert.equal(PlatformRuntime.api, ttApi);
}

async function testExplicitPlatformDoesNotFallBackToTheWrongApi() {
  const { PlatformRuntime } = await loadRuntime({
    wxApi: makeApi(),
    explicitPlatform: "douyin",
  });

  assert.equal(PlatformRuntime.platform, "douyin");
  assert.equal(PlatformRuntime.available, false);
  assert.throws(() => PlatformRuntime.requireApi("test"), /requires a WeChat \(wx\) or Douyin \(tt\)/);
}

async function testCapabilityFailureListsEveryMissingRequirement() {
  const { PlatformRuntime } = await loadRuntime({ wxApi: {} });

  assert.throws(
    () => PlatformRuntime.requireCapabilities(["canvas", "fileSystem", "touch"], "adapter"),
    /adapter is missing required capabilities: canvas, fileSystem, touch/,
  );
}

async function testSystemInfoSupportsEitherPlatformApi() {
  const modern = await loadRuntime({
    wxApi: { getWindowInfo() { return { windowWidth: 320, pixelRatio: 2 }; } },
  });
  assert.equal(modern.PlatformRuntime.capabilities.windowInfo, true);
  assert.deepEqual(modern.PlatformRuntime.getSystemInfo(), { windowWidth: 320, pixelRatio: 2 });

  const legacy = await loadRuntime({
    ttApi: { getSystemInfoSync() { return { platform: "devtools", windowHeight: 700 }; } },
  });
  assert.equal(legacy.PlatformRuntime.capabilities.windowInfo, true);
  assert.deepEqual(legacy.PlatformRuntime.getSystemInfo(), {
    platform: "devtools",
    windowHeight: 700,
  });
}

async function testForeignCachedRuntimeIsRejected() {
  const staleRuntime = {
    getBridgeInfo() { return { abiVersion: 0 }; },
  };
  const { PlatformRuntime } = await loadRuntime({
    wxApi: makeApi(),
    cachedRuntime: staleRuntime,
  });

  assert.notEqual(PlatformRuntime, staleRuntime);
  assert.equal(PlatformRuntime.abiVersion, 1);
  assert.equal(globalThis.__godotMiniGamePlatformRuntime, PlatformRuntime);
}

await testWxOnlyDetection();
await testTtOnlyDetection();
await testNeitherProviderHasADescriptiveFailure();
await testExplicitPlatformBreaksATwoProviderTie();
await testExplicitPlatformDoesNotFallBackToTheWrongApi();
await testCapabilityFailureListsEveryMissingRequirement();
await testSystemInfoSupportsEitherPlatformApi();
await testForeignCachedRuntimeIsRejected();

console.log("platform_runtime.test.mjs: ok");
