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

function makeWebGl(width = 390, height = 844) {
  const viewportCalls = [];
  let deleteTextureCalls = 0;
  return {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    ARRAY_BUFFER: 3,
    STATIC_DRAW: 4,
    FLOAT: 5,
    TEXTURE_2D: 6,
    TEXTURE_WRAP_S: 7,
    TEXTURE_WRAP_T: 8,
    TEXTURE_MIN_FILTER: 9,
    TEXTURE_MAG_FILTER: 10,
    CLAMP_TO_EDGE: 11,
    LINEAR: 12,
    RGBA: 13,
    UNSIGNED_BYTE: 14,
    COLOR_BUFFER_BIT: 15,
    DEPTH_BUFFER_BIT: 16,
    STENCIL_BUFFER_BIT: 32,
    TRIANGLES: 17,
    MAX_VERTEX_ATTRIBS: 18,
    RENDERER: 19,
    VERSION: 20,
    FRAMEBUFFER: 21,
    RENDERBUFFER: 22,
    drawingBufferWidth: width,
    drawingBufferHeight: height,
    createShader() { return {}; },
    shaderSource() {},
    compileShader() {},
    createProgram() { return {}; },
    attachShader() {},
    linkProgram() {},
    useProgram() {},
    createBuffer() { return {}; },
    bindBuffer() {},
    bufferData() {},
    getAttribLocation() { return 0; },
    vertexAttribPointer() {},
    enableVertexAttribArray() {},
    disableVertexAttribArray() {},
    createTexture() { return {}; },
    bindTexture() {},
    texParameteri() {},
    viewport(...args) { viewportCalls.push(args); },
    texImage2D() {},
    clearColor() {},
    clear() {},
    drawArrays() {},
    deleteBuffer() {},
    deleteTexture() { deleteTextureCalls += 1; },
    deleteShader() {},
    deleteProgram() {},
    bindFramebuffer() {},
    bindRenderbuffer() {},
    getParameter(name) {
      if (name === this.MAX_VERTEX_ATTRIBS) return 2;
      if (name === this.RENDERER) return "test renderer";
      if (name === this.VERSION) return "WebGL 2 test";
      return 0;
    },
    viewportCalls,
    deleteTextureCalls: () => deleteTextureCalls,
  };
}

function make2dContext() {
  return {
    scale() {},
    fillRect() {},
    drawImage() {},
    fillText() {},
    clearRect() {},
  };
}

async function loadLoaderFixture(platform = "wechat") {
  delete globalThis.wx;
  delete globalThis.tt;
  delete globalThis.TTMinis;
  delete globalThis.GameGlobal;
  delete globalThis.__godotMiniGamePlatformRuntime;
  delete globalThis.PlatformRuntime;
  delete globalThis.godotSdk;
  delete globalThis.godotMiniGameBridgeV1;

  const renderDpr = platform === "tiktok" ? 3 : 1;
  const gl = makeWebGl(390 * renderDpr, 844 * renderDpr);
  const mainCanvas = {
    width: 390 * renderDpr,
    height: 844 * renderDpr,
    getContext(type) { return type === "webgl2" ? gl : null; },
  };
  const loadingCanvas = {
    width: 0,
    height: 0,
    getContext(type) { return type === "2d" ? make2dContext() : null; },
  };
  const clearedTimers = [];
  const windowListeners = new Map();
  let timerCount = 0;
  let hideHandler = null;
  let fileSystemManagerCalls = 0;
  const adapterWindow = {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: renderDpr,
    setInterval() { timerCount += 1; return 101; },
    clearInterval(id) { clearedTimers.push(id); },
    addEventListener(type, fn) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set());
      windowListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { windowListeners.get(type)?.delete(fn); },
  };
  const hostCrypto = { getRandomValues(view) { return view; } };
  const engineCalls = {
    init: 0,
    preload: 0,
    start: 0,
    quit: 0,
    sync: 0,
    order: [],
    copied: [],
    ensured: [],
  };

  class FakeEngine {
    constructor() {
      this.config = {
        args: [],
        persistentPaths: ["/userfs"],
        update(options) { Object.assign(this, options || {}); },
      };
    }
    async init(executable) {
      this.executable = executable;
      this.rtenv = {};
      engineCalls.init += 1;
      engineCalls.order.push("init");
    }
    async preloadFile(file, target) {
      this.preloaded = [file, target];
      engineCalls.preload += 1;
      engineCalls.order.push("preload");
    }
    ensureFSDirectory(path) {
      engineCalls.ensured.push(path);
      engineCalls.order.push(`ensure:${path}`);
    }
    copyToFS(file, bytes) {
      engineCalls.copied.push([file, [...new Uint8Array(bytes)]]);
      engineCalls.order.push(`copy:${file}`);
    }
    copyFSToAdapter() { engineCalls.sync += 1; return Promise.resolve(); }
    async start() {
      engineCalls.loadingCleanedBeforeStart = gl.deleteTextureCalls() > 0;
      engineCalls.start += 1;
      engineCalls.order.push("start");
    }
    requestQuit() { engineCalls.quit += 1; }
  }

  globalThis.GameGlobal = {
    __platform: platform,
    __adapter: { canvas: mainCanvas, window: adapterWindow },
    canvas: mainCanvas,
    crypto: hostCrypto,
    Engine: FakeEngine,
  };
  const hostApi = {
    env: { USER_DATA_PATH: "/tmp" },
    createCanvas() { return loadingCanvas; },
    createImage() { return { complete: true, src: "" }; },
    getWindowInfo() {
      return { windowWidth: 390, windowHeight: 844, pixelRatio: 3 };
    },
    getFileSystemManager() {
      fileSystemManagerCalls += 1;
      return {
        access(options) { options.success({}); },
        mkdir(options) { options.success({}); },
        readdir(options) {
          options.success({ files: options.dirPath.endsWith("/userfs") ? ["slot.save"] : [] });
        },
        stat(options) {
          options.success({
            stats: {
              isDirectory() { return false; },
              isFile() { return true; },
            },
          });
        },
        readFile(options) { options.success({ data: new Uint8Array([7, 8, 9]).buffer }); },
      };
    },
    loadSubpackage(options) { options.success(); },
    onShow() {},
    onHide(handler) { hideHandler = handler; },
    offHide(handler) { if (hideHandler === handler) hideHandler = null; },
  };
  if (platform === "wechat") {
    globalThis.wx = hostApi;
  } else if (platform === "douyin") {
    globalThis.tt = hostApi;
  } else {
    globalThis.GameGlobal.TTMinis = { game: hostApi };
  }

  const runtimeUrl = moduleUrl(read("js/platform_runtime.js"));
  const sdkUrl = moduleUrl(
    replaceSpecifier(read("js/libs/sdk.js"), "../platform_runtime", runtimeUrl),
  );
  const godotStubUrl = moduleUrl("export {};");
  const imageLoaderStubUrl = moduleUrl(
    "export function waitForImage() { return Promise.resolve(); }",
  );
  let loaderSource = read("js/loader.js");
  loaderSource = replaceSpecifier(loaderSource, "./libs/godot", godotStubUrl);
  loaderSource = replaceSpecifier(loaderSource, "./libs/sdk", sdkUrl);
  loaderSource = replaceSpecifier(loaderSource, "./image_loader", imageLoaderStubUrl);
  loaderSource = replaceSpecifier(loaderSource, "./platform_runtime", runtimeUrl);
  const loaderModule = await import(moduleUrl(loaderSource));

  return {
    Loader: loaderModule.default,
    adapterWindow,
    clearedTimers,
    engineCalls,
    hostCrypto,
    loadingCanvas,
    mainCanvas,
    gl,
    hostApi,
    fileSystemManagerCalls: () => fileSystemManagerCalls,
    timerCount: () => timerCount,
    triggerWindowResize(width, height) {
      adapterWindow.innerWidth = width;
      adapterWindow.innerHeight = height;
      mainCanvas.width = width * adapterWindow.devicePixelRatio;
      mainCanvas.height = height * adapterWindow.devicePixelRatio;
      gl.drawingBufferWidth = mainCanvas.width;
      gl.drawingBufferHeight = mainCanvas.height;
      for (const fn of windowListeners.get("resize") || []) fn({ type: "resize" });
    },
    windowListenerCount: (type) => windowListeners.get(type)?.size || 0,
    triggerHide: () => { if (hideHandler) hideHandler(); },
  };
}

async function testLegacyCanvasSingleLoadAndDispose() {
  const fixture = await loadLoaderFixture();
  const loader = new fixture.Loader();

  assert.equal(fixture.mainCanvas.width, 390, "legacy hosts must retain their logical backing width");
  assert.equal(fixture.mainCanvas.height, 844, "legacy hosts must retain their logical backing height");
  assert.equal(fixture.loadingCanvas.width, 1170, "loading canvas must use physical DPR");
  assert.equal(fixture.loadingCanvas.height, 2532, "loading canvas must use physical DPR");
  assert.deepEqual(
    fixture.gl.viewportCalls,
    [[0, 0, 390, 844]],
    "loading texture dimensions must not be used as the destination viewport",
  );
  assert.equal(globalThis.GameGlobal.crypto, fixture.hostCrypto, "host crypto must not be replaced");

  const first = loader.load();
  const second = loader.load();
  assert.equal(first, second, "load() must return one stable promise");
  const engine = await first;

  assert.ok(fixture.gl.viewportCalls.length >= 4, "each loading blit must refresh the viewport");
  for (const viewport of fixture.gl.viewportCalls) {
    assert.deepEqual(viewport, [0, 0, 390, 844]);
  }

  assert.equal(fixture.engineCalls.start, 1);
  assert.equal(
    fixture.engineCalls.loadingCleanedBeforeStart,
    true,
    "the loading renderer must release the shared WebGL context before Godot callMain",
  );
  assert.equal(fixture.engineCalls.init, 1);
  assert.equal(fixture.engineCalls.preload, 1);
  assert.deepEqual(fixture.engineCalls.ensured, ["/userfs"]);
  assert.deepEqual(fixture.engineCalls.copied, [["/userfs/slot.save", [7, 8, 9]]]);
  assert.ok(
    fixture.engineCalls.order.indexOf("copy:/userfs/slot.save")
      < fixture.engineCalls.order.indexOf("start"),
    "host saves must be restored before Engine.start() invokes callMain",
  );
  assert.equal(fixture.timerCount(), 1);
  assert.equal(loader.state, "running");
  assert.equal(engine.config.canvas, fixture.mainCanvas);
  assert.deepEqual(engine.config.persistentPaths, []);
  assert.deepEqual(engine.config.args, ["--main-pack", "engine/godot.zip"]);
  assert.equal(globalThis.GameGlobal.godotMiniGameBridgeV1, globalThis.godotSdk);

  fixture.triggerHide();
  await loader._syncPromise;
  assert.equal(fixture.engineCalls.sync, 1, "app hide must flush user:// immediately");

  loader.dispose();
  loader.dispose();
  assert.equal(loader.state, "disposed");
  assert.deepEqual(fixture.clearedTimers, [101]);
  assert.equal(fixture.engineCalls.quit, 1);
  fixture.triggerHide();
  assert.equal(fixture.engineCalls.sync, 1, "dispose must detach the hide flush listener");
  await assert.rejects(loader.load(), /Cannot load after dispose/);
}

async function testLoadingBlitTracksDrawingBufferResize() {
  const fixture = await loadLoaderFixture();
  const loader = new fixture.Loader();

  assert.equal(fixture.windowListenerCount("resize"), 1);
  fixture.triggerWindowResize(430, 932);

  assert.deepEqual(
    fixture.gl.viewportCalls.at(-1),
    [0, 0, 430, 932],
    "loading blit must use the current destination framebuffer size",
  );
  assert.equal(fixture.loadingCanvas.width, 1290);
  assert.equal(fixture.loadingCanvas.height, 2796);
  loader.dispose();
  assert.equal(fixture.windowListenerCount("resize"), 0);
}

async function testLoadFailureIsObservableAndStable() {
  const fixture = await loadLoaderFixture();
  const failure = new Error("engine start failed");
  globalThis.GameGlobal.Engine = class FailingEngine {
    constructor() {
      this.config = {
        args: [],
        update(options) { Object.assign(this, options || {}); },
      };
    }
    init() { this.rtenv = {}; return Promise.resolve(); }
    preloadFile() { return Promise.resolve(); }
    ensureFSDirectory() {}
    copyToFS() {}
    start() { return Promise.reject(failure); }
  };
  const loader = new fixture.Loader();
  const first = loader.load();
  const second = loader.load();

  assert.equal(first, second);
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(first, (error) => error === failure);
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(loader.state, "failed");
  assert.equal(fixture.timerCount(), 0);
}

async function testEmptyPersistentDirectoryExistsBeforeMain() {
  const fixture = await loadLoaderFixture();
  globalThis.wx.getFileSystemManager = () => ({
    access(options) { options.success({}); },
    mkdir(options) { options.success({}); },
    readdir(options) { options.success({ files: [] }); },
  });
  const loader = new fixture.Loader();
  await loader.load();

  assert.deepEqual(fixture.engineCalls.ensured, ["/userfs"]);
  assert.deepEqual(fixture.engineCalls.copied, []);
  assert.ok(
    fixture.engineCalls.order.indexOf("ensure:/userfs")
      < fixture.engineCalls.order.indexOf("start"),
    "an empty /userfs must still be created before Engine.start() invokes callMain",
  );
  loader.dispose();
}

async function testDouyinRestoreAndWritebackRemainEnabled() {
  const fixture = await loadLoaderFixture("douyin");
  const loader = new fixture.Loader();
  await loader.load();

  assert.equal(fixture.fileSystemManagerCalls(), 1);
  assert.deepEqual(fixture.engineCalls.ensured, ["/userfs"]);
  assert.deepEqual(fixture.engineCalls.copied, [["/userfs/slot.save", [7, 8, 9]]]);
  assert.equal(fixture.timerCount(), 1);
  fixture.triggerHide();
  await loader._syncPromise;
  assert.equal(fixture.engineCalls.sync, 1);
  loader.dispose();
}

async function testTikTokKeepsReadOnlyRestoreAndSkipsWriteback() {
  const fixture = await loadLoaderFixture("tiktok");
  const loader = new fixture.Loader();

  assert.equal(fixture.mainCanvas.width, 1170, "TikTok must preserve the physical backing width");
  assert.equal(fixture.mainCanvas.height, 2532, "TikTok must preserve the physical backing height");
  assert.equal(fixture.loadingCanvas.width, 1170);
  assert.equal(fixture.loadingCanvas.height, 2532);
  assert.deepEqual(fixture.gl.viewportCalls, [[0, 0, 1170, 2532]]);

  fixture.triggerWindowResize(430, 932);
  assert.equal(fixture.mainCanvas.width, 1290);
  assert.equal(fixture.mainCanvas.height, 2796);
  assert.equal(fixture.loadingCanvas.width, 1290);
  assert.equal(fixture.loadingCanvas.height, 2796);
  assert.deepEqual(fixture.gl.viewportCalls.at(-1), [0, 0, 1290, 2796]);

  await loader.load();

  assert.equal(loader.state, "running");
  assert.equal(fixture.engineCalls.start, 1);
  assert.equal(fixture.fileSystemManagerCalls(), 1, "TikTok startup must retain the proven-safe read path");
  assert.deepEqual(fixture.engineCalls.ensured, ["/userfs"]);
  assert.deepEqual(fixture.engineCalls.copied, [["/userfs/slot.save", [7, 8, 9]]]);
  assert.equal(fixture.timerCount(), 0, "TikTok must not schedule persistent writes");
  fixture.triggerHide();
  assert.equal(loader._syncPromise, null);
  assert.equal(fixture.engineCalls.sync, 0, "TikTok hide must not write persistent files");
  loader.dispose();
  assert.deepEqual(fixture.clearedTimers, []);
}

await testLegacyCanvasSingleLoadAndDispose();
await testLoadingBlitTracksDrawingBufferResize();
await testLoadFailureIsObservableAndStable();
await testEmptyPersistentDirectoryExistsBeforeMain();
await testDouyinRestoreAndWritebackRemainEnabled();
await testTikTokKeepsReadOnlyRestoreAndSkipsWriteback();

console.log("loader_runtime.test.mjs: ok");
