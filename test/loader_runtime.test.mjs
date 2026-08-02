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

function makeWebGl() {
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
    drawingBufferWidth: 390,
    drawingBufferHeight: 844,
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
    viewport() {},
    texImage2D() {},
    clearColor() {},
    clear() {},
    drawArrays() {},
    deleteTexture() {},
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

async function loadLoaderFixture() {
  delete globalThis.wx;
  delete globalThis.tt;
  delete globalThis.__godotMiniGamePlatformRuntime;
  delete globalThis.PlatformRuntime;
  delete globalThis.godotSdk;
  delete globalThis.godotMiniGameBridgeV1;

  const gl = makeWebGl();
  const mainCanvas = {
    width: 390,
    height: 844,
    getContext(type) { return type === "webgl2" ? gl : null; },
  };
  const loadingCanvas = {
    width: 0,
    height: 0,
    getContext(type) { return type === "2d" ? make2dContext() : null; },
  };
  const clearedTimers = [];
  let timerCount = 0;
  const adapterWindow = {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 1,
    setInterval() { timerCount += 1; return 101; },
    clearInterval(id) { clearedTimers.push(id); },
  };
  const hostCrypto = { getRandomValues(view) { return view; } };
  const engineCalls = { start: 0, quit: 0 };

  class FakeEngine {
    constructor() { this.config = { persistentPaths: [] }; }
    async startGame(options) { this.options = options; engineCalls.start += 1; }
    requestQuit() { engineCalls.quit += 1; }
  }

  globalThis.GameGlobal = {
    __platform: "wechat",
    __adapter: { canvas: mainCanvas, window: adapterWindow },
    canvas: mainCanvas,
    crypto: hostCrypto,
    Engine: FakeEngine,
  };
  globalThis.wx = {
    env: { USER_DATA_PATH: "/tmp" },
    createCanvas() { return loadingCanvas; },
    createImage() { return { complete: true, src: "" }; },
    getWindowInfo() {
      return { windowWidth: 390, windowHeight: 844, pixelRatio: 3 };
    },
    getFileSystemManager() { return {}; },
    loadSubpackage(options) { options.success(); },
    onShow() {},
    onHide() {},
    onError() {},
  };

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
    timerCount: () => timerCount,
  };
}

async function testLogicalCanvasSingleLoadAndDispose() {
  const fixture = await loadLoaderFixture();
  const loader = new fixture.Loader();

  assert.equal(fixture.mainCanvas.width, 390, "engine canvas must remain in logical pixels");
  assert.equal(fixture.mainCanvas.height, 844, "engine canvas must remain in logical pixels");
  assert.equal(fixture.loadingCanvas.width, 1170, "loading canvas may use physical DPR");
  assert.equal(fixture.loadingCanvas.height, 2532, "loading canvas may use physical DPR");
  assert.equal(globalThis.GameGlobal.crypto, fixture.hostCrypto, "host crypto must not be replaced");

  const first = loader.load();
  const second = loader.load();
  assert.equal(first, second, "load() must return one stable promise");
  const engine = await first;

  assert.equal(fixture.engineCalls.start, 1);
  assert.equal(fixture.timerCount(), 1);
  assert.equal(loader.state, "running");
  assert.equal(engine.options.canvas, fixture.mainCanvas);
  assert.equal(globalThis.GameGlobal.godotMiniGameBridgeV1, globalThis.godotSdk);

  loader.dispose();
  loader.dispose();
  assert.equal(loader.state, "disposed");
  assert.deepEqual(fixture.clearedTimers, [101]);
  assert.equal(fixture.engineCalls.quit, 1);
  await assert.rejects(loader.load(), /Cannot load after dispose/);
}

async function testLoadFailureIsObservableAndStable() {
  const fixture = await loadLoaderFixture();
  const failure = new Error("engine start failed");
  globalThis.GameGlobal.Engine = class FailingEngine {
    constructor() { this.config = { persistentPaths: [] }; }
    startGame() { return Promise.reject(failure); }
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

await testLogicalCanvasSingleLoadAndDispose();
await testLoadFailureIsObservableAndStable();

console.log("loader_runtime.test.mjs: ok");
