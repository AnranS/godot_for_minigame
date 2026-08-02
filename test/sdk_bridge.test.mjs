import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sdkSourcePath = path.join(projectRoot, "addons/godot_mini_game/templates/common/js/libs/sdk.js");
const runtimeSourcePath = path.join(projectRoot, "addons/godot_mini_game/templates/common/js/platform_runtime.js");

function moduleUrl(source) {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}#${Date.now()}-${Math.random()}`;
}

async function loadSdkWithApi(api, platform = "wechat") {
  delete globalThis.wx;
  delete globalThis.tt;
  delete globalThis.__godotMiniGamePlatformRuntime;
  delete globalThis.PlatformRuntime;
  globalThis[platform === "douyin" ? "tt" : "wx"] = api;

  const runtimeUrl = moduleUrl(fs.readFileSync(runtimeSourcePath, "utf8"));
  const source = fs.readFileSync(sdkSourcePath, "utf8")
    .replace('"../platform_runtime"', JSON.stringify(runtimeUrl));
  return import(moduleUrl(source));
}

async function testBridgeInfoUsesTheSelectedDouyinProvider() {
  const ttApi = {
    createCanvas() { return {}; },
    request() {},
    getSystemInfoSync() { return { platform: "devtools" }; },
    getStorageSync() { return null; },
    setStorageSync() {},
  };
  const {
    BRIDGE_ABI_VERSION,
    BRIDGE_BRAND,
    BRIDGE_GLOBAL_NAME,
    GodotSDK,
  } = await loadSdkWithApi(ttApi, "douyin");
  const sdk = new GodotSDK();
  const info = JSON.parse(sdk.getBridgeInfo());

  assert.equal(BRIDGE_ABI_VERSION, 1);
  assert.equal(sdk.abiVersion, 1);
  assert.equal(sdk.platform, "douyin");
  assert.equal(info.abiVersion, 1);
  assert.equal(BRIDGE_BRAND, "godot-mini-game-bridge");
  assert.equal(BRIDGE_GLOBAL_NAME, "godotMiniGameBridgeV1");
  assert.equal(info.brand, BRIDGE_BRAND);
  assert.equal(info.globalName, BRIDGE_GLOBAL_NAME);
  assert.equal(info.runtimeBrand, "godot-mini-game-platform-runtime");
  assert.equal(info.runtimeSchemaVersion, 1);
  assert.equal(info.platform, "douyin");
  assert.equal(info.capabilities.canvas, true);
  assert.equal(info.capabilities.request, true);
  assert.equal(info.capabilities.fileSystem, false);

  const validHandshake = JSON.parse(sdk.validateBridge(1, JSON.stringify([
    "getBridgeInfo",
    "validateBridge",
    "onAppShow",
  ])));
  assert.equal(validHandshake.ok, true);
  assert.equal(validHandshake.bridgeInfo.globalName, BRIDGE_GLOBAL_NAME);

  const wrongAbi = JSON.parse(sdk.validateBridge(2, "[]"));
  assert.equal(wrongAbi.ok, false);
  assert.match(wrongAbi.error, /does not match expected ABI 2/);

  const missingMethod = JSON.parse(sdk.validateBridge(1, '["removedBridgeMethod"]'));
  assert.equal(missingMethod.ok, false);
  assert.deepEqual(missingMethod.missingMethods, ["removedBridgeMethod"]);

  const unsupported = await new Promise((resolve) => {
    sdk.callApi("notARealApi", "{}", (...args) => resolve(args));
  });
  assert.deepEqual(unsupported, [
    "notARealApi",
    false,
    "",
    "tt.notARealApi is not supported",
  ]);
}

async function testCallApiUsesSuccessCallback() {
  const calls = [];
  const { GodotSDK } = await loadSdkWithApi({
    setClipboardData(options) {
      calls.push(options);
      options.success({ errMsg: "setClipboardData:ok", data: options.data });
    },
  });

  const sdk = new GodotSDK();
  const result = await new Promise((resolve) => {
    sdk.callApi("setClipboardData", JSON.stringify({ data: "hello" }), (...args) => resolve(args));
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].data, "hello");
  assert.deepEqual(result, [
    "setClipboardData",
    true,
    JSON.stringify({ errMsg: "setClipboardData:ok", data: "hello" }),
    "",
  ]);
}

async function testCallApiReportsUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();

  const result = await new Promise((resolve) => {
    sdk.callApi("notARealApi", "{}", (...args) => resolve(args));
  });

  assert.deepEqual(result, [
    "notARealApi",
    false,
    "",
    "wx.notARealApi is not supported",
  ]);
}

async function testGetPrivacySettingWrapper() {
  const calls = [];
  const response = {
    needAuthorization: true,
    privacyContractName: "Privacy Policy",
  };
  const { GodotSDK } = await loadSdkWithApi({
    getPrivacySetting(options) {
      calls.push(options);
      options.success(response);
    },
  });

  const sdk = new GodotSDK();
  const result = await new Promise((resolve) => {
    sdk.getPrivacySetting((...args) => resolve(args));
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(result, [
    true,
    "Privacy Policy",
    JSON.stringify(response),
    "",
  ]);
}

async function testRequirePrivacyAuthorizeWrapper() {
  const calls = [];
  const { GodotSDK } = await loadSdkWithApi({
    requirePrivacyAuthorize(options) {
      calls.push(options);
      options.success({ errMsg: "requirePrivacyAuthorize:ok" });
    },
  });

  const sdk = new GodotSDK();
  const result = await new Promise((resolve) => {
    sdk.requirePrivacyAuthorize((...args) => resolve(args));
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(result, [true, ""]);
}

async function testOpenPrivacyContractWrapper() {
  const calls = [];
  const { GodotSDK } = await loadSdkWithApi({
    openPrivacyContract(options) {
      calls.push(options);
      options.success({ errMsg: "openPrivacyContract:ok" });
    },
  });

  const sdk = new GodotSDK();
  const result = await new Promise((resolve) => {
    sdk.openPrivacyContract((...args) => resolve(args));
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(result, [true, ""]);
}

async function testNeedPrivacyAuthorizationListener() {
  let registeredListener = null;
  const resolveCalls = [];
  const { GodotSDK } = await loadSdkWithApi({
    onNeedPrivacyAuthorization(listener) {
      registeredListener = listener;
    },
  });

  const sdk = new GodotSDK();
  const events = [];
  sdk.onNeedPrivacyAuthorization((...args) => events.push(args));

  assert.equal(typeof registeredListener, "function");
  registeredListener((payload) => resolveCalls.push(payload), { referrer: "getClipboardData" });

  assert.deepEqual(events, [
    [JSON.stringify({ referrer: "getClipboardData" }), ""],
  ]);
  assert.equal(sdk.resolvePrivacyAuthorization("exposureAuthorization", ""), true);
  assert.equal(sdk.resolvePrivacyAuthorization("agree", "agree-btn"), true);
  assert.equal(sdk.resolvePrivacyAuthorization("disagree", ""), false);
  assert.deepEqual(resolveCalls, [
    { event: "exposureAuthorization" },
    { event: "agree", buttonId: "agree-btn" },
  ]);
}

async function testPrivacyWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();

  const settingResult = await new Promise((resolve) => {
    sdk.getPrivacySetting((...args) => resolve(args));
  });
  const authorizeResult = await new Promise((resolve) => {
    sdk.requirePrivacyAuthorize((...args) => resolve(args));
  });
  const contractResult = await new Promise((resolve) => {
    sdk.openPrivacyContract((...args) => resolve(args));
  });
  const listenerResult = await new Promise((resolve) => {
    sdk.onNeedPrivacyAuthorization((...args) => resolve(args));
  });

  assert.deepEqual(settingResult, [
    false,
    "",
    "",
    "wx.getPrivacySetting is not supported",
  ]);
  assert.deepEqual(authorizeResult, [
    false,
    "wx.requirePrivacyAuthorize is not supported",
  ]);
  assert.deepEqual(contractResult, [
    false,
    "wx.openPrivacyContract is not supported",
  ]);
  assert.deepEqual(listenerResult, [
    "{}",
    "wx.onNeedPrivacyAuthorization is not supported",
  ]);
}

async function testSettingAndAuthorizeWrappers() {
  const calls = [];
  const settingResponse = {
    authSetting: { "scope.userInfo": true },
    subscriptionsSetting: { mainSwitch: true },
  };
  const openResponse = {
    authSetting: { "scope.record": false },
  };
  const { GodotSDK } = await loadSdkWithApi({
    getSetting(options) {
      calls.push(["getSetting", options.withSubscriptions]);
      options.success(settingResponse);
    },
    openSetting(options) {
      calls.push(["openSetting", options.withSubscriptions]);
      options.success(openResponse);
    },
    authorize(options) {
      calls.push(["authorize", options.scope]);
      options.success({ errMsg: "authorize:ok" });
    },
  });

  const sdk = new GodotSDK();
  const settingResult = await new Promise((resolve) => {
    sdk.getSetting(true, (...args) => resolve(args));
  });
  const openResult = await new Promise((resolve) => {
    sdk.openSetting(false, (...args) => resolve(args));
  });
  const authorizeResult = await new Promise((resolve) => {
    sdk.authorize("scope.record", (...args) => resolve(args));
  });

  assert.deepEqual(calls, [
    ["getSetting", true],
    ["openSetting", false],
    ["authorize", "scope.record"],
  ]);
  assert.deepEqual(settingResult, [JSON.stringify(settingResponse), ""]);
  assert.deepEqual(openResult, [JSON.stringify(openResponse), ""]);
  assert.deepEqual(authorizeResult, ["scope.record", true, ""]);
}

function createNativeButtonMock(name, calls, tapListeners) {
  return {
    show() { calls.push([`${name}.show`]); },
    hide() { calls.push([`${name}.hide`]); },
    destroy() { calls.push([`${name}.destroy`]); },
    onTap(listener) {
      calls.push([`${name}.onTap`]);
      tapListeners[name] = listener;
    },
    offTap(listener) {
      calls.push([`${name}.offTap`, listener === tapListeners[name]]);
    },
  };
}

async function testNativeButtonWrappers() {
  const calls = [];
  const tapListeners = {};
  const userInfoOptions = {
    type: "text",
    text: "Profile",
    style: { left: 10, top: 20, width: 160, height: 44, backgroundColor: "#07c160" },
    withCredentials: false,
    lang: "zh_CN",
  };
  const openSettingOptions = {
    type: "image",
    image: "images/settings.png",
    style: { left: 0, top: 0, width: 44, height: 44 },
  };
  const gameClubOptions = {
    type: "image",
    icon: "green",
    style: { left: 320, top: 16, width: 40, height: 40 },
    openlink: "Lv-XO1OgAuqztP4pRyKfZnY2aJKe9aE1",
    hasRedDot: false,
  };
  const { GodotSDK } = await loadSdkWithApi({
    createUserInfoButton(options) {
      calls.push(["createUserInfoButton", options]);
      return createNativeButtonMock("userInfo", calls, tapListeners);
    },
    createOpenSettingButton(options) {
      calls.push(["createOpenSettingButton", options]);
      return createNativeButtonMock("openSetting", calls, tapListeners);
    },
    createGameClubButton(options) {
      calls.push(["createGameClubButton", options]);
      return createNativeButtonMock("gameClub", calls, tapListeners);
    },
  });

  const sdk = new GodotSDK();
  const operations = [];
  const events = [];
  sdk.createUserInfoButton(JSON.stringify(userInfoOptions), (...args) => operations.push(args), (...args) => events.push(args));
  sdk.createOpenSettingButton(JSON.stringify(openSettingOptions), (...args) => operations.push(args), (...args) => events.push(args));
  sdk.createGameClubButton(JSON.stringify(gameClubOptions), (...args) => operations.push(args), (...args) => events.push(args));
  tapListeners.userInfo({ errMsg: "getUserInfo:ok", userInfo: { nickName: "Ada" } });
  tapListeners.openSetting({ authSetting: { "scope.record": true } });
  tapListeners.gameClub({ errMsg: "GameClubButton:fail unavailable" });
  sdk.nativeButtonAction("userInfo", "show", (...args) => operations.push(args));
  sdk.nativeButtonAction("openSetting", "hide", (...args) => operations.push(args));
  sdk.nativeButtonAction("gameClub", "show", (...args) => operations.push(args));
  sdk.stopNativeButtonTap("userInfo", (...args) => operations.push(args));
  sdk.nativeButtonAction("userInfo", "destroy", (...args) => operations.push(args));

  assert.deepEqual(calls, [
    ["createUserInfoButton", userInfoOptions],
    ["userInfo.onTap"],
    ["createOpenSettingButton", openSettingOptions],
    ["openSetting.onTap"],
    ["createGameClubButton", gameClubOptions],
    ["gameClub.onTap"],
    ["userInfo.show"],
    ["openSetting.hide"],
    ["gameClub.show"],
    ["userInfo.offTap", true],
    ["userInfo.destroy"],
  ]);
  assert.deepEqual(operations, [
    ["userInfo", "createUserInfoButton", true, JSON.stringify(userInfoOptions), ""],
    ["openSetting", "createOpenSettingButton", true, JSON.stringify(openSettingOptions), ""],
    ["gameClub", "createGameClubButton", true, JSON.stringify(gameClubOptions), ""],
    ["userInfo", "UserInfoButton.show", true, "{}", ""],
    ["openSetting", "OpenSettingButton.hide", true, "{}", ""],
    ["gameClub", "GameClubButton.show", true, "{}", ""],
    ["userInfo", "UserInfoButton.offTap", true, "{}", ""],
    ["userInfo", "UserInfoButton.destroy", true, "{}", ""],
  ]);
  assert.deepEqual(events, [
    ["userInfo", JSON.stringify({ errMsg: "getUserInfo:ok", userInfo: { nickName: "Ada" } }), ""],
    ["openSetting", JSON.stringify({ authSetting: { "scope.record": true } }), ""],
    ["gameClub", JSON.stringify({ errMsg: "GameClubButton:fail unavailable" }), "GameClubButton:fail unavailable"],
  ]);
}

async function testNativeButtonWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const operations = [];

  sdk.createUserInfoButton("{}", (...args) => operations.push(args), () => {});
  sdk.createOpenSettingButton("{}", (...args) => operations.push(args), () => {});
  sdk.createGameClubButton("{}", (...args) => operations.push(args), () => {});
  sdk.nativeButtonAction("userInfo", "show", (...args) => operations.push(args));
  sdk.stopNativeButtonTap("gameClub", (...args) => operations.push(args));
  sdk.nativeButtonAction("badType", "show", (...args) => operations.push(args));
  sdk.nativeButtonAction("userInfo", "focus", (...args) => operations.push(args));

  assert.deepEqual(operations, [
    ["userInfo", "createUserInfoButton", false, "", "wx.createUserInfoButton is not supported"],
    ["openSetting", "createOpenSettingButton", false, "", "wx.createOpenSettingButton is not supported"],
    ["gameClub", "createGameClubButton", false, "", "wx.createGameClubButton is not supported"],
    ["userInfo", "UserInfoButton.show", false, "", "No active UserInfoButton"],
    ["gameClub", "GameClubButton.offTap", false, "", "No active GameClubButton"],
    ["badType", "show", false, "", "Unsupported native button type: badType"],
    ["userInfo", "focus", false, "", "Invalid native button action: focus"],
  ]);
}

async function testDebugLoggingWrappers() {
  const calls = [];
  const logManager = {
    debug(...args) { calls.push(["log.debug", args]); },
    info(...args) { calls.push(["log.info", args]); },
    log(...args) { calls.push(["log.log", args]); },
    warn(...args) { calls.push(["log.warn", args]); },
  };
  const realtimeLogManager = {
    info(...args) { calls.push(["realtime.info", args]); },
    warn(...args) { calls.push(["realtime.warn", args]); },
    error(...args) { calls.push(["realtime.error", args]); },
    setFilterMsg(msg) { calls.push(["realtime.setFilterMsg", msg]); },
    addFilterMsg(msg) { calls.push(["realtime.addFilterMsg", msg]); },
    tag(tagName) {
      calls.push(["realtime.tag", tagName]);
      return {
        info(...args) { calls.push(["realtime.tagged.info", args]); },
        warn(...args) { calls.push(["realtime.tagged.warn", args]); },
        error(...args) { calls.push(["realtime.tagged.error", args]); },
      };
    },
  };
  const { GodotSDK } = await loadSdkWithApi({
    setEnableDebug(options) {
      calls.push(["setEnableDebug", options.enableDebug]);
      options.success({ errMsg: "setEnableDebug:ok", enableDebug: options.enableDebug });
    },
    getLogManager(options) {
      calls.push(["getLogManager", options]);
      return logManager;
    },
    getRealtimeLogManager() {
      calls.push(["getRealtimeLogManager"]);
      return realtimeLogManager;
    },
  });

  const sdk = new GodotSDK();
  const operations = [];
  await sdk.setEnableDebug(true, (...args) => operations.push(args));
  sdk.getLogManager(1, (...args) => operations.push(args));
  sdk.logManagerWrite("debug", JSON.stringify(["boot", { fps: 60 }]), (...args) => operations.push(args));
  sdk.logManagerWrite("warn", JSON.stringify([{ warning: "low-memory" }]), (...args) => operations.push(args));
  sdk.getRealtimeLogManager((...args) => operations.push(args));
  sdk.realtimeLogManagerWrite("info", JSON.stringify(["scene", { name: "main" }]), (...args) => operations.push(args));
  sdk.realtimeLogManagerWrite("error", JSON.stringify(["crash", { code: 500 }]), (...args) => operations.push(args));
  sdk.realtimeLogManagerSetFilterMsg("session-123", (...args) => operations.push(args));
  sdk.realtimeLogManagerAddFilterMsg("player-42", (...args) => operations.push(args));
  sdk.realtimeLogManagerTag("plugin-log1", (...args) => operations.push(args));
  sdk.realtimeLogManagerWrite("warn", JSON.stringify(["tagged", { count: 1 }]), (...args) => operations.push(args));

  assert.deepEqual(calls, [
    ["setEnableDebug", true],
    ["getLogManager", { level: 1 }],
    ["log.debug", ["boot", { fps: 60 }]],
    ["log.warn", [{ warning: "low-memory" }]],
    ["getRealtimeLogManager"],
    ["realtime.info", ["scene", { name: "main" }]],
    ["realtime.error", ["crash", { code: 500 }]],
    ["realtime.setFilterMsg", "session-123"],
    ["realtime.addFilterMsg", "player-42"],
    ["realtime.tag", "plugin-log1"],
    ["realtime.tagged.warn", ["tagged", { count: 1 }]],
  ]);
  assert.deepEqual(operations, [
    ["setEnableDebug", true, JSON.stringify({ errMsg: "setEnableDebug:ok", enableDebug: true }), ""],
    ["getLogManager", true, JSON.stringify({ level: 1 }), ""],
    ["LogManager.debug", true, JSON.stringify({ args: ["boot", { fps: 60 }] }), ""],
    ["LogManager.warn", true, JSON.stringify({ args: [{ warning: "low-memory" }] }), ""],
    ["getRealtimeLogManager", true, "{}", ""],
    ["RealtimeLogManager.info", true, JSON.stringify({ args: ["scene", { name: "main" }] }), ""],
    ["RealtimeLogManager.error", true, JSON.stringify({ args: ["crash", { code: 500 }] }), ""],
    ["RealtimeLogManager.setFilterMsg", true, JSON.stringify({ msg: "session-123" }), ""],
    ["RealtimeLogManager.addFilterMsg", true, JSON.stringify({ msg: "player-42" }), ""],
    ["RealtimeLogManager.tag", true, JSON.stringify({ tag: "plugin-log1" }), ""],
    ["RealtimeLogManager.warn", true, JSON.stringify({ args: ["tagged", { count: 1 }] }), ""],
  ]);
}

async function testDebugLoggingWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const operations = [];

  await sdk.setEnableDebug(false, (...args) => operations.push(args));
  sdk.getLogManager(0, (...args) => operations.push(args));
  sdk.logManagerWrite("info", JSON.stringify(["boot"]), (...args) => operations.push(args));
  sdk.logManagerWrite("trace", JSON.stringify(["boot"]), (...args) => operations.push(args));
  sdk.getRealtimeLogManager((...args) => operations.push(args));
  sdk.realtimeLogManagerWrite("warn", JSON.stringify(["slow"]), (...args) => operations.push(args));
  sdk.realtimeLogManagerWrite("debug", JSON.stringify(["slow"]), (...args) => operations.push(args));
  sdk.realtimeLogManagerSetFilterMsg("session", (...args) => operations.push(args));
  sdk.realtimeLogManagerAddFilterMsg("player", (...args) => operations.push(args));
  sdk.realtimeLogManagerTag("plugin", (...args) => operations.push(args));

  assert.deepEqual(operations, [
    ["setEnableDebug", false, "", "wx.setEnableDebug is not supported"],
    ["getLogManager", false, "", "wx.getLogManager is not supported"],
    ["LogManager.info", false, "", "No active LogManager"],
    ["LogManager.trace", false, "", "Invalid LogManager level: trace"],
    ["getRealtimeLogManager", false, "", "wx.getRealtimeLogManager is not supported"],
    ["RealtimeLogManager.warn", false, "", "No active RealtimeLogManager"],
    ["RealtimeLogManager.debug", false, "", "Invalid RealtimeLogManager level: debug"],
    ["RealtimeLogManager.setFilterMsg", false, "", "No active RealtimeLogManager"],
    ["RealtimeLogManager.addFilterMsg", false, "", "No active RealtimeLogManager"],
    ["RealtimeLogManager.tag", false, "", "No active RealtimeLogManager"],
  ]);
}

async function testAccountInfoWrapper() {
  const accountInfo = {
    miniProgram: { appId: "wx123", envVersion: "develop", version: "1.2.3" },
    plugin: { appId: "plugin123", version: "0.1.0" },
  };
  const { GodotSDK } = await loadSdkWithApi({
    getAccountInfoSync() {
      return accountInfo;
    },
  });

  const sdk = new GodotSDK();
  assert.equal(sdk.getAccountInfo(), JSON.stringify(accountInfo));
}

async function testRuntimeCapabilityWrappers() {
  const deviceInfo = {
    brand: "Apple",
    model: "iPhone 15",
    platform: "ios",
    system: "iOS 17.0",
    memorySize: "8192",
  };
  const appBaseInfo = {
    SDKVersion: "3.6.0",
    enableDebug: true,
    language: "zh_CN",
    version: "8.0.50",
  };
  const systemSetting = {
    bluetoothEnabled: true,
    locationEnabled: false,
    wifiEnabled: true,
    deviceOrientation: "portrait",
  };
  const appAuthorizeSetting = {
    cameraAuthorized: "authorized",
    locationAuthorized: "denied",
    microphoneAuthorized: "not determined",
  };
  const canIUseCalls = [];
  const { GodotSDK } = await loadSdkWithApi({
    canIUse(schema) {
      canIUseCalls.push(schema);
      return schema === "getAppBaseInfo.return.SDKVersion";
    },
    getDeviceInfo() {
      return deviceInfo;
    },
    getAppBaseInfo() {
      return appBaseInfo;
    },
    getSystemSetting() {
      return systemSetting;
    },
    getAppAuthorizeSetting() {
      return appAuthorizeSetting;
    },
  });

  const sdk = new GodotSDK();
  assert.equal(sdk.canIUse("getAppBaseInfo.return.SDKVersion"), true);
  assert.equal(sdk.canIUse("getDeviceInfo.return.notReal"), false);
  assert.deepEqual(canIUseCalls, [
    "getAppBaseInfo.return.SDKVersion",
    "getDeviceInfo.return.notReal",
  ]);
  assert.equal(sdk.getDeviceInfo(), JSON.stringify(deviceInfo));
  assert.equal(sdk.getAppBaseInfo(), JSON.stringify(appBaseInfo));
  assert.equal(sdk.getSystemSetting(), JSON.stringify(systemSetting));
  assert.equal(sdk.getAppAuthorizeSetting(), JSON.stringify(appAuthorizeSetting));
}

async function testNetworkWrappers() {
  let networkListener = null;
  let offListener = null;
  const getNetworkResponse = {
    networkType: "wifi",
    signalStrength: -43,
    hasSystemProxy: false,
    weakNet: false,
  };
  const { GodotSDK } = await loadSdkWithApi({
    getNetworkType(options) {
      options.success(getNetworkResponse);
    },
    onNetworkStatusChange(listener) {
      networkListener = listener;
    },
    offNetworkStatusChange(listener) {
      offListener = listener;
    },
  });

  const sdk = new GodotSDK();
  const networkTypeResult = await new Promise((resolve) => {
    sdk.getNetworkType((...args) => resolve(args));
  });
  const networkEvents = [];
  const listenResult = sdk.onNetworkStatusChange((...args) => networkEvents.push(args));

  assert.equal(listenResult, true);
  assert.equal(typeof networkListener, "function");
  networkListener({ isConnected: true, networkType: "5g" });
  const stopResult = sdk.offNetworkStatusChange();

  assert.deepEqual(networkTypeResult, ["wifi", JSON.stringify(getNetworkResponse), ""]);
  assert.deepEqual(networkEvents, [
    [true, "5g", JSON.stringify({ isConnected: true, networkType: "5g" })],
  ]);
  assert.equal(stopResult, true);
  assert.equal(offListener, networkListener);
}

async function testFileTransferWrappers() {
  const calls = [];
  const downloadResponse = {
    statusCode: 200,
    tempFilePath: "wxfile://tmp/data.bin",
    profile: { rtt: 10 },
  };
  const uploadResponse = {
    statusCode: 201,
    data: "{\"ok\":true}",
    profile: { rtt: 12 },
  };
  const { GodotSDK } = await loadSdkWithApi({
    downloadFile(options) {
      calls.push(["downloadFile", options]);
      options.success(downloadResponse);
      return { abort() {} };
    },
    uploadFile(options) {
      calls.push(["uploadFile", options]);
      options.success(uploadResponse);
      return { abort() {} };
    },
  });

  const sdk = new GodotSDK();
  const results = [];
  sdk.downloadFile(
    "https://cdn.example.com/a.bin",
    "wxfile://usr/a.bin",
    JSON.stringify({ Authorization: "Bearer token" }),
    45000,
    true,
    true,
    false,
    (...args) => results.push(args));
  sdk.uploadFile(
    "https://api.example.com/upload",
    "wxfile://usr/a.bin",
    "asset",
    JSON.stringify({ level: "1" }),
    JSON.stringify({ "X-Trace": "abc" }),
    30000,
    true,
    false,
    true,
    (...args) => results.push(args));

  assert.equal(calls.length, 2);
  assert.equal(calls[0][1].url, "https://cdn.example.com/a.bin");
  assert.equal(calls[0][1].filePath, "wxfile://usr/a.bin");
  assert.deepEqual(calls[0][1].header, { Authorization: "Bearer token" });
  assert.equal(calls[0][1].timeout, 45000);
  assert.equal(calls[0][1].enableProfile, true);
  assert.equal(calls[0][1].enableHttp2, true);
  assert.equal(calls[0][1].enableQuic, undefined);
  assert.equal(calls[1][1].url, "https://api.example.com/upload");
  assert.equal(calls[1][1].filePath, "wxfile://usr/a.bin");
  assert.equal(calls[1][1].name, "asset");
  assert.deepEqual(calls[1][1].formData, { level: "1" });
  assert.deepEqual(calls[1][1].header, { "X-Trace": "abc" });
  assert.equal(calls[1][1].timeout, 30000);
  assert.equal(calls[1][1].enableProfile, true);
  assert.equal(calls[1][1].enableHttp2, undefined);
  assert.equal(calls[1][1].enableQuic, true);
  assert.deepEqual(results, [
    ["downloadFile", true, 200, JSON.stringify(downloadResponse), ""],
    ["uploadFile", true, 201, JSON.stringify(uploadResponse), ""],
  ]);
}

async function testSocketTaskWrappers() {
  const calls = [];
  const listeners = {};
  const socketTask = {
    onOpen(listener) { listeners.open = listener; },
    onMessage(listener) { listeners.message = listener; },
    onError(listener) { listeners.error = listener; },
    onClose(listener) { listeners.close = listener; },
    send(options) {
      calls.push(["send", options.data]);
      options.success({ errMsg: "sendSocketMessage:ok" });
    },
    close(options) {
      calls.push(["close", options.code, options.reason]);
      options.success({ errMsg: "closeSocket:ok" });
    },
  };
  const { GodotSDK } = await loadSdkWithApi({
    connectSocket(options) {
      calls.push(["connectSocket", options]);
      options.success({ errMsg: "connectSocket:ok" });
      return socketTask;
    },
  });

  const sdk = new GodotSDK();
  const operations = [];
  const events = [];
  sdk.connectSocket(
    "wss://socket.example.com/room",
    JSON.stringify({ Authorization: "Bearer token" }),
    JSON.stringify(["chat", "binary"]),
    true,
    true,
    45000,
    true,
    (...args) => operations.push(args),
    (...args) => events.push(args));

  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].url, "wss://socket.example.com/room");
  assert.deepEqual(calls[0][1].header, { Authorization: "Bearer token" });
  assert.deepEqual(calls[0][1].protocols, ["chat", "binary"]);
  assert.equal(calls[0][1].tcpNoDelay, true);
  assert.equal(calls[0][1].perMessageDeflate, true);
  assert.equal(calls[0][1].timeout, 45000);
  assert.equal(calls[0][1].forceCellularNetwork, true);
  assert.equal(typeof listeners.open, "function");
  assert.equal(typeof listeners.message, "function");
  assert.equal(typeof listeners.error, "function");
  assert.equal(typeof listeners.close, "function");

  sdk.sendSocketMessage("hello", (...args) => operations.push(args));
  sdk.closeSocket(1000, "normal", (...args) => operations.push(args));
  listeners.open({ header: { "Sec-WebSocket-Protocol": "chat" } });
  listeners.message({ data: "hello from server" });
  listeners.error({ errMsg: "socket broken" });
  listeners.close({ code: 1000, reason: "normal" });

  assert.deepEqual(operations, [
    ["connectSocket", true, JSON.stringify({ errMsg: "connectSocket:ok" }), ""],
    ["sendSocketMessage", true, JSON.stringify({ errMsg: "sendSocketMessage:ok" }), ""],
    ["closeSocket", true, JSON.stringify({ errMsg: "closeSocket:ok" }), ""],
  ]);
  assert.deepEqual(calls.slice(1), [
    ["send", "hello"],
    ["close", 1000, "normal"],
  ]);
  assert.deepEqual(events, [
    ["open", "", JSON.stringify({ header: { "Sec-WebSocket-Protocol": "chat" } }), ""],
    ["message", "hello from server", JSON.stringify({ dataType: "string", data: "hello from server" }), ""],
    ["error", "", JSON.stringify({ errMsg: "socket broken" }), "socket broken"],
    ["close", "", JSON.stringify({ code: 1000, reason: "normal" }), ""],
  ]);
}

async function testFileSystemManagerWrapper() {
  const calls = [];
  const binary = new Uint8Array([104, 105]).buffer;
  const { GodotSDK } = await loadSdkWithApi({
    getFileSystemManager() {
      calls.push(["getFileSystemManager"]);
      return {
        writeFile(options) {
          calls.push(["writeFile", options]);
          options.success({ errMsg: "writeFile:ok" });
        },
        readFile(options) {
          calls.push(["readFile", options]);
          options.success({ errMsg: "readFile:ok", data: binary });
        },
        saveFile(options) {
          calls.push(["saveFile", options]);
          options.success({ errMsg: "saveFile:ok", savedFilePath: "wxfile://usr/save.json" });
        },
      };
    },
  });

  const sdk = new GodotSDK();
  const results = [];
  sdk.fileSystemCall("writeFile", JSON.stringify({
    filePath: "wxfile://usr/save.json",
    data: "{\"score\":9}",
    encoding: "utf8",
  }), (...args) => results.push(args));
  sdk.fileSystemCall("readFile", JSON.stringify({
    filePath: "wxfile://usr/save.json",
  }), (...args) => results.push(args));
  sdk.fileSystemCall("saveFile", JSON.stringify({
    tempFilePath: "wxfile://tmp/save.json",
    filePath: "wxfile://usr/save.json",
  }), (...args) => results.push(args));

  assert.equal(calls.length, 6);
  assert.deepEqual(calls[1][1], {
    filePath: "wxfile://usr/save.json",
    data: "{\"score\":9}",
    encoding: "utf8",
    success: calls[1][1].success,
    fail: calls[1][1].fail,
  });
  assert.equal(calls[3][1].filePath, "wxfile://usr/save.json");
  assert.equal(calls[5][1].tempFilePath, "wxfile://tmp/save.json");
  assert.equal(calls[5][1].filePath, "wxfile://usr/save.json");
  assert.deepEqual(results[0], [
    "writeFile",
    true,
    JSON.stringify({ errMsg: "writeFile:ok" }),
    "",
  ]);
  assert.deepEqual(JSON.parse(results[1][2]), {
    errMsg: "readFile:ok",
    dataType: "arraybuffer",
    base64: "aGk=",
    byteLength: 2,
  });
  assert.deepEqual(results[2], [
    "saveFile",
    true,
    JSON.stringify({ errMsg: "saveFile:ok", savedFilePath: "wxfile://usr/save.json" }),
    "",
  ]);
}

async function testSubpackageWrappers() {
  const calls = [];
  const operations = [];
  const progressEvents = [];
  const loadProgress = { progress: 48, totalBytesWritten: 480, totalBytesExpectedToWrite: 1000 };
  const preDownloadProgress = { progress: 100, totalBytesWritten: 2048, totalBytesExpectedToWrite: 2048 };
  const { GodotSDK } = await loadSdkWithApi({
    loadSubpackage(options) {
      calls.push(["loadSubpackage", options]);
      options.success({ errMsg: "loadSubpackage:ok" });
      return {
        onProgressUpdate(listener) {
          calls.push(["loadProgressListener"]);
          listener(loadProgress);
        },
      };
    },
    preDownloadSubpackage(options) {
      calls.push(["preDownloadSubpackage", options]);
      options.success({ errMsg: "preDownloadSubpackage:ok" });
      return {
        onProgressUpdate(listener) {
          calls.push(["preDownloadProgressListener"]);
          listener(preDownloadProgress);
        },
      };
    },
  });

  const sdk = new GodotSDK();
  sdk.loadSubpackage(
    "levels",
    (...args) => operations.push(args),
    (...args) => progressEvents.push(args));
  sdk.preDownloadSubpackage(
    "workers",
    "workers",
    (...args) => operations.push(args),
    (...args) => progressEvents.push(args));

  assert.equal(calls[0][0], "loadSubpackage");
  assert.equal(calls[0][1].name, "levels");
  assert.equal(calls[2][0], "preDownloadSubpackage");
  assert.equal(calls[2][1].name, "workers");
  assert.equal(calls[2][1].packageType, "workers");
  assert.deepEqual(operations, [
    ["loadSubpackage", true, JSON.stringify({ errMsg: "loadSubpackage:ok" }), ""],
    ["preDownloadSubpackage", true, JSON.stringify({ errMsg: "preDownloadSubpackage:ok" }), ""],
  ]);
  assert.deepEqual(progressEvents, [
    ["loadSubpackage", 48, 480, 1000, JSON.stringify(loadProgress)],
    ["preDownloadSubpackage", 100, 2048, 2048, JSON.stringify(preDownloadProgress)],
  ]);
}

async function testWorkerWrappers() {
  const calls = [];
  const listeners = {};
  const worker = {
    env: { USER_DATA_PATH: "wxfile://usr" },
    onMessage(listener) { listeners.message = listener; },
    onError(listener) { listeners.error = listener; },
    onProcessKilled(listener) { listeners.processKilled = listener; },
    postMessage(message) { calls.push(["postMessage", message]); },
    terminate() { calls.push(["terminate"]); },
  };
  const { GodotSDK } = await loadSdkWithApi({
    createWorker(scriptPath, options) {
      calls.push(["createWorker", scriptPath, options]);
      return worker;
    },
  });

  const sdk = new GodotSDK();
  const operations = [];
  const events = [];
  sdk.createWorker(
    "workers/index.js",
    true,
    (...args) => operations.push(args),
    (...args) => events.push(args));
  sdk.workerPostMessage(JSON.stringify({ type: "ping", value: 7 }), (...args) => operations.push(args));
  listeners.message({ message: { type: "pong", value: 7 } });
  listeners.error({ error: { message: "worker boom", stack: "line 1" } });
  listeners.processKilled({ reason: "memory" });
  sdk.workerTerminate((...args) => operations.push(args));

  assert.deepEqual(calls, [
    ["createWorker", "workers/index.js", { useExperimentalWorker: true }],
    ["postMessage", { type: "ping", value: 7 }],
    ["terminate"],
  ]);
  assert.deepEqual(operations, [
    ["createWorker", true, JSON.stringify({
      scriptPath: "workers/index.js",
      useExperimentalWorker: true,
      env: { USER_DATA_PATH: "wxfile://usr" },
    }), ""],
    ["Worker.postMessage", true, JSON.stringify({ message: { type: "ping", value: 7 } }), ""],
    ["Worker.terminate", true, "{}", ""],
  ]);
  assert.deepEqual(events, [
    ["message", JSON.stringify({ type: "pong", value: 7 }), ""],
    ["error", JSON.stringify({ error: { message: "worker boom", stack: "line 1" } }), "worker boom"],
    ["processKilled", JSON.stringify({ reason: "memory" }), ""],
  ]);
}

async function testMediaWrappers() {
  const calls = [];
  const chooseMediaResponse = {
    type: "mix",
    tempFiles: [
      { tempFilePath: "wxfile://tmp/media.jpg", size: 1234, fileType: "image" },
    ],
  };
  const chooseImageResponse = {
    tempFilePaths: ["wxfile://tmp/image.jpg"],
    tempFiles: [{ path: "wxfile://tmp/image.jpg", size: 2345 }],
  };
  const compressResponse = {
    tempFilePath: "wxfile://tmp/compressed.jpg",
  };
  const { GodotSDK } = await loadSdkWithApi({
    chooseMedia(options) {
      calls.push(["chooseMedia", {
        count: options.count,
        mediaType: options.mediaType,
        sourceType: options.sourceType,
        maxDuration: options.maxDuration,
        sizeType: options.sizeType,
        camera: options.camera,
      }]);
      options.success(chooseMediaResponse);
    },
    chooseImage(options) {
      calls.push(["chooseImage", {
        count: options.count,
        sizeType: options.sizeType,
        sourceType: options.sourceType,
      }]);
      options.success(chooseImageResponse);
    },
    previewImage(options) {
      calls.push(["previewImage", {
        urls: options.urls,
        current: options.current,
        showmenu: options.showmenu,
        referrerPolicy: options.referrerPolicy,
      }]);
      options.success({ errMsg: "previewImage:ok" });
    },
    saveImageToPhotosAlbum(options) {
      calls.push(["saveImageToPhotosAlbum", options.filePath]);
      options.success({ errMsg: "saveImageToPhotosAlbum:ok" });
    },
    compressImage(options) {
      calls.push(["compressImage", {
        src: options.src,
        quality: options.quality,
        compressedWidth: options.compressedWidth,
        compressedHeight: options.compressedHeight,
      }]);
      options.success(compressResponse);
    },
  });

  const sdk = new GodotSDK();
  const operations = [];
  sdk.chooseMedia(
    2,
    JSON.stringify(["image", "video"]),
    JSON.stringify(["album"]),
    30,
    JSON.stringify(["compressed"]),
    "front",
    (...args) => operations.push(args));
  sdk.chooseImage(
    3,
    JSON.stringify(["original"]),
    JSON.stringify(["camera"]),
    (...args) => operations.push(args));
  sdk.previewImage(
    JSON.stringify(["https://example.com/a.png", "wxfile://tmp/b.png"]),
    "wxfile://tmp/b.png",
    false,
    "origin",
    (...args) => operations.push(args));
  sdk.saveImageToPhotosAlbum(
    "wxfile://usr/result.png",
    (...args) => operations.push(args));
  sdk.compressImage(
    "wxfile://usr/result.jpg",
    60,
    320,
    240,
    (...args) => operations.push(args));

  assert.deepEqual(calls, [
    ["chooseMedia", {
      count: 2,
      mediaType: ["image", "video"],
      sourceType: ["album"],
      maxDuration: 30,
      sizeType: ["compressed"],
      camera: "front",
    }],
    ["chooseImage", {
      count: 3,
      sizeType: ["original"],
      sourceType: ["camera"],
    }],
    ["previewImage", {
      urls: ["https://example.com/a.png", "wxfile://tmp/b.png"],
      current: "wxfile://tmp/b.png",
      showmenu: false,
      referrerPolicy: "origin",
    }],
    ["saveImageToPhotosAlbum", "wxfile://usr/result.png"],
    ["compressImage", {
      src: "wxfile://usr/result.jpg",
      quality: 60,
      compressedWidth: 320,
      compressedHeight: 240,
    }],
  ]);
  assert.deepEqual(operations, [
    ["chooseMedia", true, JSON.stringify(chooseMediaResponse), ""],
    ["chooseImage", true, JSON.stringify(chooseImageResponse), ""],
    ["previewImage", true, JSON.stringify({ errMsg: "previewImage:ok" }), ""],
    ["saveImageToPhotosAlbum", true, JSON.stringify({ errMsg: "saveImageToPhotosAlbum:ok" }), ""],
    ["compressImage", true, JSON.stringify(compressResponse), ""],
  ]);
}

async function testCameraWrappers() {
  const calls = [];
  const listeners = {};
  const camera = {
    x: 10,
    y: 20,
    width: 320,
    height: 240,
    devicePosition: "front",
    flash: "off",
    size: "medium",
    onAuthCancel(listener) { listeners.authCancel = listener; },
    onStop(listener) { listeners.stop = listener; },
    onCameraFrame(listener) { listeners.frame = listener; },
    takePhoto(quality) {
      calls.push(["takePhoto", quality]);
      return Promise.resolve({ tempImagePath: "wxfile://tmp/photo.jpg", width: 320, height: 240 });
    },
    startRecord() {
      calls.push(["startRecord"]);
      return Promise.resolve({ errMsg: "Camera.startRecord:ok" });
    },
    stopRecord(compressed) {
      calls.push(["stopRecord", compressed]);
      return Promise.resolve({ tempThumbPath: "wxfile://tmp/thumb.jpg", tempVideoPath: "wxfile://tmp/video.mp4" });
    },
    setZoom(options) {
      calls.push(["setZoom", options]);
      return Promise.resolve({ zoom: options.zoom });
    },
    listenFrameChange(worker) { calls.push(["listenFrameChange", worker]); },
    closeFrameChange() { calls.push(["closeFrameChange"]); },
    destroy() { calls.push(["destroy"]); },
  };
  const { GodotSDK } = await loadSdkWithApi({
    createCamera(options) {
      calls.push(["createCamera", {
        x: options.x,
        y: options.y,
        width: options.width,
        height: options.height,
        devicePosition: options.devicePosition,
        flash: options.flash,
        size: options.size,
      }]);
      options.success({ errMsg: "createCamera:ok" });
      return camera;
    },
  });

  const sdk = new GodotSDK();
  const operations = [];
  const events = [];

  sdk.createCamera(10, 20, 320, 240, "front", "off", "medium", (...args) => operations.push(args), (...args) => events.push(args));
  await sdk.cameraTakePhoto("high", (...args) => operations.push(args));
  await sdk.cameraStartRecord((...args) => operations.push(args));
  await sdk.cameraStopRecord(false, (...args) => operations.push(args));
  await sdk.cameraSetZoom(2.5, (...args) => operations.push(args));
  sdk.cameraListenFrameChange(false, (...args) => operations.push(args));
  listeners.frame({ width: 2, height: 1, data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer });
  listeners.authCancel();
  listeners.stop({ reason: "background" });
  sdk.cameraCloseFrameChange((...args) => operations.push(args));
  sdk.cameraDestroy((...args) => operations.push(args));

  assert.deepEqual(calls, [
    ["createCamera", { x: 10, y: 20, width: 320, height: 240, devicePosition: "front", flash: "off", size: "medium" }],
    ["takePhoto", "high"],
    ["startRecord"],
    ["stopRecord", false],
    ["setZoom", { zoom: 2.5 }],
    ["listenFrameChange", undefined],
    ["closeFrameChange"],
    ["destroy"],
  ]);
  assert.deepEqual(operations, [
    ["createCamera", true, JSON.stringify({
      errMsg: "createCamera:ok",
      camera: { x: 10, y: 20, width: 320, height: 240, devicePosition: "front", flash: "off", size: "medium" },
    }), ""],
    ["Camera.takePhoto", true, JSON.stringify({ tempImagePath: "wxfile://tmp/photo.jpg", width: 320, height: 240 }), ""],
    ["Camera.startRecord", true, JSON.stringify({ errMsg: "Camera.startRecord:ok" }), ""],
    ["Camera.stopRecord", true, JSON.stringify({ tempThumbPath: "wxfile://tmp/thumb.jpg", tempVideoPath: "wxfile://tmp/video.mp4" }), ""],
    ["Camera.setZoom", true, JSON.stringify({ zoom: 2.5 }), ""],
    ["Camera.listenFrameChange", true, "{}", ""],
    ["Camera.closeFrameChange", true, "{}", ""],
    ["Camera.destroy", true, "{}", ""],
  ]);
  assert.deepEqual(events, [
    ["frame", JSON.stringify({ width: 2, height: 1, dataType: "arraybuffer", base64: "AQIDBAUGBwg=", byteLength: 8 }), ""],
    ["authCancel", "{}", ""],
    ["stop", JSON.stringify({ reason: "background" }), ""],
  ]);
}

async function testVideoWrappers() {
  const calls = [];
  const listeners = {};
  const video = {
    x: 0,
    y: 0,
    width: 300,
    height: 150,
    src: "",
    poster: "",
    initialTime: 0,
    playbackRate: 1,
    live: false,
    objectFit: "contain",
    controls: true,
    showProgress: true,
    showProgressInControlMode: true,
    backgroundColor: "#000000",
    autoplay: false,
    loop: false,
    muted: false,
    obeyMuteSwitch: false,
    enableProgressGesture: true,
    enablePlayGesture: false,
    showCenterPlayBtn: true,
    underGameView: false,
    autoPauseIfNavigate: true,
    autoPauseIfOpenNative: true,
    play() { calls.push(["play"]); return Promise.resolve({ errMsg: "Video.play:ok" }); },
    pause() { calls.push(["pause"]); return Promise.resolve({ errMsg: "Video.pause:ok" }); },
    stop() { calls.push(["stop"]); return Promise.resolve({ errMsg: "Video.stop:ok" }); },
    seek(time) { calls.push(["seek", time]); this.initialTime = time; return Promise.resolve({ errMsg: "Video.seek:ok" }); },
    requestFullScreen(direction) { calls.push(["requestFullScreen", direction]); return Promise.resolve({ errMsg: "Video.requestFullScreen:ok" }); },
    exitFullScreen() { calls.push(["exitFullScreen"]); return Promise.resolve({ errMsg: "Video.exitFullScreen:ok" }); },
    destroy() { calls.push(["destroy"]); },
    onWaiting(listener) { calls.push(["onWaiting"]); listeners.waiting = listener; },
    offWaiting(listener) { calls.push(["offWaiting", listener === listeners.waiting]); },
    onProgress(listener) { calls.push(["onProgress"]); listeners.progress = listener; },
    offProgress(listener) { calls.push(["offProgress", listener === listeners.progress]); },
    onPlay(listener) { calls.push(["onPlay"]); listeners.play = listener; },
    offPlay(listener) { calls.push(["offPlay", listener === listeners.play]); },
    onPause(listener) { calls.push(["onPause"]); listeners.pause = listener; },
    offPause(listener) { calls.push(["offPause", listener === listeners.pause]); },
    onEnded(listener) { calls.push(["onEnded"]); listeners.ended = listener; },
    offEnded(listener) { calls.push(["offEnded", listener === listeners.ended]); },
    onTimeUpdate(listener) { calls.push(["onTimeUpdate"]); listeners.timeUpdate = listener; },
    offTimeUpdate(listener) { calls.push(["offTimeUpdate", listener === listeners.timeUpdate]); },
    onError(listener) { calls.push(["onError"]); listeners.error = listener; },
    offError(listener) { calls.push(["offError", listener === listeners.error]); },
  };
  const createOptions = {
    x: 8,
    y: 12,
    width: 360,
    height: 200,
    src: "video/intro.mp4",
    poster: "images/poster.png",
    initialTime: 3,
    playbackRate: 1.25,
    live: false,
    objectFit: "contain",
    controls: true,
    showProgress: true,
    showProgressInControlMode: false,
    backgroundColor: "#111111",
    autoplay: false,
    loop: true,
    muted: true,
    obeyMuteSwitch: true,
    enableProgressGesture: true,
    enablePlayGesture: true,
    showCenterPlayBtn: false,
    underGameView: false,
    autoPauseIfNavigate: true,
    autoPauseIfOpenNative: true,
  };
  const createState = { ...createOptions };
  const updatedState = {
    ...createState,
    x: 16,
    y: 20,
    width: 400,
    muted: false,
    objectFit: "cover",
  };
  const seekState = { ...updatedState, initialTime: 8.5 };

  const { GodotSDK } = await loadSdkWithApi({
    createVideo(options) {
      calls.push(["createVideo", options]);
      Object.assign(video, options);
      return video;
    },
  });

  const sdk = new GodotSDK();
  const operations = [];
  const events = [];
  sdk.createVideo(JSON.stringify(createOptions), (...args) => operations.push(args), (...args) => events.push(args));
  sdk.setVideoProperties(JSON.stringify({ x: 16, y: 20, width: 400, muted: false, objectFit: "cover" }), (...args) => operations.push(args));
  sdk.getVideoState((...args) => operations.push(args));
  await sdk.videoPlay((...args) => operations.push(args));
  listeners.play({ source: "tap" });
  listeners.timeUpdate({ currentTime: 5, duration: 20 });
  listeners.progress({ buffered: 50 });
  listeners.waiting();
  await sdk.videoSeek(8.5, (...args) => operations.push(args));
  await sdk.videoRequestFullScreen(90, (...args) => operations.push(args));
  await sdk.videoExitFullScreen((...args) => operations.push(args));
  await sdk.videoPause((...args) => operations.push(args));
  listeners.pause();
  await sdk.videoStop((...args) => operations.push(args));
  listeners.ended();
  listeners.error({ errCode: 10002, errMsg: "video error" });
  sdk.stopVideoListener(JSON.stringify(["play", "pause", "ended", "timeUpdate", "error", "waiting", "progress"]), (...args) => operations.push(args));
  sdk.videoDestroy((...args) => operations.push(args));

  assert.deepEqual(calls, [
    ["createVideo", createOptions],
    ["onWaiting"],
    ["onProgress"],
    ["onPlay"],
    ["onPause"],
    ["onEnded"],
    ["onTimeUpdate"],
    ["onError"],
    ["play"],
    ["seek", 8.5],
    ["requestFullScreen", 90],
    ["exitFullScreen"],
    ["pause"],
    ["stop"],
    ["offWaiting", true],
    ["offProgress", true],
    ["offPlay", true],
    ["offPause", true],
    ["offEnded", true],
    ["offTimeUpdate", true],
    ["offError", true],
    ["destroy"],
  ]);
  assert.deepEqual(operations, [
    ["createVideo", true, JSON.stringify(createState), ""],
    ["Video.setProperties", true, JSON.stringify(updatedState), ""],
    ["Video.getState", true, JSON.stringify(updatedState), ""],
    ["Video.play", true, JSON.stringify(updatedState), ""],
    ["Video.seek", true, JSON.stringify(seekState), ""],
    ["Video.requestFullScreen", true, JSON.stringify(seekState), ""],
    ["Video.exitFullScreen", true, JSON.stringify(seekState), ""],
    ["Video.pause", true, JSON.stringify(seekState), ""],
    ["Video.stop", true, JSON.stringify(seekState), ""],
    ["Video.off", true, JSON.stringify({ events: ["play", "pause", "ended", "timeUpdate", "error", "waiting", "progress"] }), ""],
    ["Video.destroy", true, "{}", ""],
  ]);
  assert.deepEqual(events, [
    ["play", JSON.stringify({ source: "tap" }), ""],
    ["timeUpdate", JSON.stringify({ currentTime: 5, duration: 20 }), ""],
    ["progress", JSON.stringify({ buffered: 50 }), ""],
    ["waiting", "{}", ""],
    ["pause", "{}", ""],
    ["ended", "{}", ""],
    ["error", JSON.stringify({ errCode: 10002, errMsg: "video error" }), "code=10002 video error"],
  ]);
}

async function testRecorderManagerWrappers() {
  const calls = [];
  const listeners = {};
  const recorder = {
    start(options) { calls.push(["start", options]); },
    pause() { calls.push(["pause"]); },
    resume() { calls.push(["resume"]); },
    stop() { calls.push(["stop"]); },
    onStart(listener) { calls.push(["onStart"]); listeners.start = listener; },
    onResume(listener) { calls.push(["onResume"]); listeners.resume = listener; },
    onPause(listener) { calls.push(["onPause"]); listeners.pause = listener; },
    onStop(listener) { calls.push(["onStop"]); listeners.stop = listener; },
    onFrameRecorded(listener) { calls.push(["onFrameRecorded"]); listeners.frameRecorded = listener; },
    onError(listener) { calls.push(["onError"]); listeners.error = listener; },
    onInterruptionBegin(listener) { calls.push(["onInterruptionBegin"]); listeners.interruptionBegin = listener; },
    onInterruptionEnd(listener) { calls.push(["onInterruptionEnd"]); listeners.interruptionEnd = listener; },
  };
  const { GodotSDK } = await loadSdkWithApi({
    getRecorderManager() {
      calls.push(["getRecorderManager"]);
      return recorder;
    },
  });

  const sdk = new GodotSDK();
  const operations = [];
  const events = [];
  sdk.getRecorderManager((...args) => operations.push(args), (...args) => events.push(args));
  sdk.recorderStart(JSON.stringify({
    duration: 60000,
    sampleRate: 44100,
    numberOfChannels: 2,
    encodeBitRate: 128000,
    format: "mp3",
    frameSize: 5,
    audioSource: "auto",
  }), (...args) => operations.push(args));
  sdk.recorderPause((...args) => operations.push(args));
  sdk.recorderResume((...args) => operations.push(args));
  sdk.recorderStop((...args) => operations.push(args));
  listeners.start();
  listeners.pause();
  listeners.resume();
  listeners.frameRecorded({
    frameBuffer: new Uint8Array([1, 2, 3, 4]).buffer,
    isLastFrame: false,
  });
  listeners.stop({ tempFilePath: "wxfile://tmp/voice.mp3", duration: 2300, fileSize: 4096 });
  listeners.interruptionBegin();
  listeners.interruptionEnd();
  listeners.error({ errMsg: "record fail" });

  assert.deepEqual(calls, [
    ["getRecorderManager"],
    ["onStart"],
    ["onResume"],
    ["onPause"],
    ["onStop"],
    ["onFrameRecorded"],
    ["onError"],
    ["onInterruptionBegin"],
    ["onInterruptionEnd"],
    ["start", {
      duration: 60000,
      sampleRate: 44100,
      numberOfChannels: 2,
      encodeBitRate: 128000,
      format: "mp3",
      frameSize: 5,
      audioSource: "auto",
    }],
    ["pause"],
    ["resume"],
    ["stop"],
  ]);
  assert.deepEqual(operations, [
    ["getRecorderManager", true, "{}", ""],
    ["RecorderManager.start", true, "{}", ""],
    ["RecorderManager.pause", true, "{}", ""],
    ["RecorderManager.resume", true, "{}", ""],
    ["RecorderManager.stop", true, "{}", ""],
  ]);
  assert.deepEqual(events, [
    ["start", "{}", ""],
    ["pause", "{}", ""],
    ["resume", "{}", ""],
    ["frameRecorded", JSON.stringify({
      frameBuffer: {
        dataType: "arraybuffer",
        base64: "AQIDBA==",
        byteLength: 4,
      },
      isLastFrame: false,
    }), ""],
    ["stop", JSON.stringify({ tempFilePath: "wxfile://tmp/voice.mp3", duration: 2300, fileSize: 4096 }), ""],
    ["interruptionBegin", "{}", ""],
    ["interruptionEnd", "{}", ""],
    ["error", JSON.stringify({ errMsg: "record fail" }), "record fail"],
  ]);
}

async function testAvailableAudioSourcesWrapper() {
  const calls = [];
  const response = { audioSources: ["auto", "mic", "voice_recognition"] };
  const { GodotSDK } = await loadSdkWithApi({
    getAvailableAudioSources(options) {
      calls.push(options);
      options.success(response);
    },
  });

  const sdk = new GodotSDK();
  const result = await new Promise((resolve) => {
    sdk.getAvailableAudioSources((...args) => resolve(args));
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(result, [
    JSON.stringify(["auto", "mic", "voice_recognition"]),
    JSON.stringify(response),
    "",
  ]);
}

async function testVideoDecoderAndMediaAudioWrappers() {
  const calls = [];
  const decoderListeners = {};
  const decoder = {
    start(options) { calls.push(["decoder.start", options]); return Promise.resolve({ errMsg: "start:ok" }); },
    seek(position) { calls.push(["decoder.seek", position]); return Promise.resolve({ position }); },
    stop() { calls.push(["decoder.stop"]); return Promise.resolve({ errMsg: "stop:ok" }); },
    remove() { calls.push(["decoder.remove"]); return Promise.resolve({ errMsg: "remove:ok" }); },
    getFrameData() {
      calls.push(["decoder.getFrameData"]);
      return {
        width: 2,
        height: 1,
        data: new Uint8Array([9, 8, 7, 6]).buffer,
        pkPts: 100,
        pkDts: 80,
      };
    },
    on(eventName, callback) { calls.push(["decoder.on", eventName]); decoderListeners[eventName] = callback; },
    off(eventName, callback) { calls.push(["decoder.off", eventName, callback === decoderListeners[eventName]]); },
  };
  const mediaAudioPlayer = {
    volume: 1,
    addAudioSource(source) { calls.push(["media.addAudioSource", source === decoder]); return Promise.resolve({ errMsg: "add:ok" }); },
    removeAudioSource(source) { calls.push(["media.removeAudioSource", source === decoder]); return Promise.resolve({ errMsg: "remove-source:ok" }); },
    start() { calls.push(["media.start"]); return Promise.resolve({ errMsg: "media-start:ok" }); },
    stop() { calls.push(["media.stop"]); return Promise.resolve({ errMsg: "media-stop:ok" }); },
    destroy() { calls.push(["media.destroy"]); return Promise.resolve({ errMsg: "media-destroy:ok" }); },
  };
  const { GodotSDK } = await loadSdkWithApi({
    createVideoDecoder() {
      calls.push(["createVideoDecoder"]);
      return decoder;
    },
    createMediaAudioPlayer() {
      calls.push(["createMediaAudioPlayer"]);
      return mediaAudioPlayer;
    },
  });

  const sdk = new GodotSDK();
  const decoderOperations = [];
  const decoderEvents = [];
  const mediaOperations = [];
  sdk.createVideoDecoder((...args) => decoderOperations.push(args));
  sdk.startVideoDecoderListener(JSON.stringify(["start", "bufferchange", "ended"]), (...args) => decoderOperations.push(args), (...args) => decoderEvents.push(args));
  await sdk.videoDecoderStart(JSON.stringify({ source: "video/clip.mp4", mode: 0, abortAudio: false, abortVideo: false }), (...args) => decoderOperations.push(args));
  decoderListeners.start({ width: 640, height: 360 });
  decoderListeners.bufferchange({ buffered: 3 });
  sdk.videoDecoderGetFrameData((...args) => decoderOperations.push(args));
  await sdk.videoDecoderSeek(2.5, (...args) => decoderOperations.push(args));
  await sdk.videoDecoderStop((...args) => decoderOperations.push(args));
  decoderListeners.ended();
  sdk.stopVideoDecoderListener(JSON.stringify(["start", "bufferchange", "ended"]), (...args) => decoderOperations.push(args));
  sdk.createMediaAudioPlayer(0.75, (...args) => mediaOperations.push(args));
  await sdk.mediaAudioAddVideoDecoderSource((...args) => mediaOperations.push(args));
  await sdk.mediaAudioStart((...args) => mediaOperations.push(args));
  sdk.setMediaAudioVolume(0.5, (...args) => mediaOperations.push(args));
  await sdk.mediaAudioRemoveVideoDecoderSource((...args) => mediaOperations.push(args));
  await sdk.mediaAudioStop((...args) => mediaOperations.push(args));
  await sdk.mediaAudioDestroy((...args) => mediaOperations.push(args));
  await sdk.videoDecoderRemove((...args) => decoderOperations.push(args));

  assert.deepEqual(calls, [
    ["createVideoDecoder"],
    ["decoder.on", "start"],
    ["decoder.on", "bufferchange"],
    ["decoder.on", "ended"],
    ["decoder.start", { source: "video/clip.mp4", mode: 0, abortAudio: false, abortVideo: false }],
    ["decoder.getFrameData"],
    ["decoder.seek", 2.5],
    ["decoder.stop"],
    ["decoder.off", "start", true],
    ["decoder.off", "bufferchange", true],
    ["decoder.off", "ended", true],
    ["createMediaAudioPlayer"],
    ["media.addAudioSource", true],
    ["media.start"],
    ["media.removeAudioSource", true],
    ["media.stop"],
    ["media.destroy"],
    ["decoder.remove"],
  ]);
  assert.deepEqual(decoderOperations, [
    ["createVideoDecoder", true, "{}", ""],
    ["VideoDecoder.on", true, JSON.stringify({ events: ["start", "bufferchange", "ended"] }), ""],
    ["VideoDecoder.start", true, JSON.stringify({ errMsg: "start:ok" }), ""],
    ["VideoDecoder.getFrameData", true, JSON.stringify({
      width: 2,
      height: 1,
      pkPts: 100,
      pkDts: 80,
      dataType: "arraybuffer",
      base64: "CQgHBg==",
      byteLength: 4,
    }), ""],
    ["VideoDecoder.seek", true, JSON.stringify({ position: 2.5 }), ""],
    ["VideoDecoder.stop", true, JSON.stringify({ errMsg: "stop:ok" }), ""],
    ["VideoDecoder.off", true, JSON.stringify({ events: ["start", "bufferchange", "ended"] }), ""],
    ["VideoDecoder.remove", true, JSON.stringify({ errMsg: "remove:ok" }), ""],
  ]);
  assert.deepEqual(decoderEvents, [
    ["start", JSON.stringify({ width: 640, height: 360 }), ""],
    ["bufferchange", JSON.stringify({ buffered: 3 }), ""],
    ["ended", "{}", ""],
  ]);
  assert.deepEqual(mediaOperations, [
    ["createMediaAudioPlayer", true, JSON.stringify({ volume: 0.75 }), ""],
    ["MediaAudioPlayer.addAudioSource", true, JSON.stringify({ errMsg: "add:ok" }), ""],
    ["MediaAudioPlayer.start", true, JSON.stringify({ errMsg: "media-start:ok" }), ""],
    ["MediaAudioPlayer.setVolume", true, JSON.stringify({ volume: 0.5 }), ""],
    ["MediaAudioPlayer.removeAudioSource", true, JSON.stringify({ errMsg: "remove-source:ok" }), ""],
    ["MediaAudioPlayer.stop", true, JSON.stringify({ errMsg: "media-stop:ok" }), ""],
    ["MediaAudioPlayer.destroy", true, JSON.stringify({ errMsg: "media-destroy:ok" }), ""],
  ]);
}

async function testGameRecorderWrappers() {
  const calls = [];
  const listeners = {};
  const shareButtonListeners = {};
  const recorder = {
    isFrameSupported() { return true; },
    isSoundSupported() { return false; },
    isVolumeSupported() { return true; },
    isAtempoSupported() { return true; },
    start(options) { calls.push(["start", options]); },
    stop() { calls.push(["stop"]); return Promise.resolve({ duration: 2300 }); },
    pause() { calls.push(["pause"]); return Promise.resolve({ errMsg: "pause:ok" }); },
    resume() { calls.push(["resume"]); return Promise.resolve({ errMsg: "resume:ok" }); },
    abort() { calls.push(["abort"]); return Promise.resolve({ errMsg: "abort:ok" }); },
    on(event, listener) { calls.push(["on", event]); listeners[event] = listener; },
    off(event, listener) { calls.push(["off", event, listener === listeners[event]]); },
  };
  const shareButton = {
    show() { calls.push(["shareButton.show"]); },
    hide() { calls.push(["shareButton.hide"]); },
    onTap(listener) { calls.push(["shareButton.onTap"]); shareButtonListeners.tap = listener; },
    offTap(listener) { calls.push(["shareButton.offTap", listener === shareButtonListeners.tap]); },
  };
  const { GodotSDK } = await loadSdkWithApi({
    getGameRecorder() {
      calls.push(["getGameRecorder"]);
      return recorder;
    },
    createGameRecorderShareButton(options) {
      calls.push(["createGameRecorderShareButton", options]);
      return shareButton;
    },
    operateGameRecorderVideo(options) {
      calls.push(["operateGameRecorderVideo", {
        title: options.title,
        desc: options.desc,
        query: options.query,
        path: options.path,
        bgm: options.bgm,
        timeRange: options.timeRange,
        volume: options.volume,
        atempo: options.atempo,
        audioMix: options.audioMix,
      }]);
      options.success({ errCode: 0, errMsg: "operateGameRecorderVideo:ok" });
    },
  });

  const sdk = new GodotSDK();
  const operations = [];
  const events = [];
  sdk.getGameRecorder((...args) => operations.push(args));
  sdk.startGameRecorderListener(JSON.stringify(["start", "timeUpdate", "error", "stop"]), (...args) => operations.push(args), (...args) => events.push(args));
  sdk.gameRecorderStart(JSON.stringify({ fps: 30, duration: 60, bitrate: 1200, gop: 15, hookBgm: false }), (...args) => operations.push(args));
  await sdk.gameRecorderPause((...args) => operations.push(args));
  await sdk.gameRecorderResume((...args) => operations.push(args));
  await sdk.gameRecorderStop((...args) => operations.push(args));
  await sdk.gameRecorderAbort((...args) => operations.push(args));
  listeners.start();
  listeners.timeUpdate({ currentTime: 3.5 });
  listeners.error({ error: { code: 22143, message: "already recording" } });
  listeners.stop({ duration: 2300 });
  sdk.stopGameRecorderListener(JSON.stringify(["start", "timeUpdate", "error", "stop"]), (...args) => operations.push(args));
  sdk.operateGameRecorderVideo(JSON.stringify({
    title: "Replay",
    desc: "Great run",
    query: "from=replay",
    path: "pkg/replay",
    bgm: "audio/bgm.mp3",
    timeRange: [[0, 3000]],
    volume: 0.8,
    atempo: 1.5,
    audioMix: true,
  }), (...args) => operations.push(args));
  sdk.createGameRecorderShareButton(
    JSON.stringify({ left: 10, top: 20, height: 44, text: "Share" }),
    JSON.stringify({ bgm: "audio/bgm.mp3", timeRange: [[0, 3000]], volume: 1 }),
    (...args) => operations.push(args),
    (...args) => events.push(args));
  sdk.showGameRecorderShareButton((...args) => operations.push(args));
  sdk.hideGameRecorderShareButton((...args) => operations.push(args));
  shareButtonListeners.tap({ error: { message: "share failed" } });
  sdk.offGameRecorderShareButtonTap((...args) => operations.push(args));

  assert.deepEqual(calls, [
    ["getGameRecorder"],
    ["on", "start"],
    ["on", "timeUpdate"],
    ["on", "error"],
    ["on", "stop"],
    ["start", { fps: 30, duration: 60, bitrate: 1200, gop: 15, hookBgm: false }],
    ["pause"],
    ["resume"],
    ["stop"],
    ["abort"],
    ["off", "start", true],
    ["off", "timeUpdate", true],
    ["off", "error", true],
    ["off", "stop", true],
    ["operateGameRecorderVideo", {
      title: "Replay",
      desc: "Great run",
      query: "from=replay",
      path: "pkg/replay",
      bgm: "audio/bgm.mp3",
      timeRange: [[0, 3000]],
      volume: 0.8,
      atempo: 1.5,
      audioMix: true,
    }],
    ["createGameRecorderShareButton", {
      style: { left: 10, top: 20, height: 44, text: "Share" },
      share: { bgm: "audio/bgm.mp3", timeRange: [[0, 3000]], volume: 1 },
    }],
    ["shareButton.onTap"],
    ["shareButton.show"],
    ["shareButton.hide"],
    ["shareButton.offTap", true],
  ]);
  assert.deepEqual(operations, [
    ["getGameRecorder", true, JSON.stringify({
      frameSupported: true,
      soundSupported: false,
      volumeSupported: true,
      atempoSupported: true,
    }), ""],
    ["GameRecorder.on", true, JSON.stringify({ events: ["start", "timeUpdate", "error", "stop"] }), ""],
    ["GameRecorder.start", true, "{}", ""],
    ["GameRecorder.pause", true, JSON.stringify({ errMsg: "pause:ok" }), ""],
    ["GameRecorder.resume", true, JSON.stringify({ errMsg: "resume:ok" }), ""],
    ["GameRecorder.stop", true, JSON.stringify({ duration: 2300 }), ""],
    ["GameRecorder.abort", true, JSON.stringify({ errMsg: "abort:ok" }), ""],
    ["GameRecorder.off", true, JSON.stringify({ events: ["start", "timeUpdate", "error", "stop"] }), ""],
    ["operateGameRecorderVideo", true, JSON.stringify({ errCode: 0, errMsg: "operateGameRecorderVideo:ok" }), ""],
    ["createGameRecorderShareButton", true, JSON.stringify({ style: { left: 10, top: 20, height: 44, text: "Share" }, share: { bgm: "audio/bgm.mp3", timeRange: [[0, 3000]], volume: 1 } }), ""],
    ["GameRecorderShareButton.show", true, "{}", ""],
    ["GameRecorderShareButton.hide", true, "{}", ""],
    ["GameRecorderShareButton.offTap", true, "{}", ""],
  ]);
  assert.deepEqual(events, [
    ["start", "{}", ""],
    ["timeUpdate", JSON.stringify({ currentTime: 3.5 }), ""],
    ["error", JSON.stringify({ error: { code: 22143, message: "already recording" } }), "already recording"],
    ["stop", JSON.stringify({ duration: 2300 }), ""],
    ["shareButtonTap", JSON.stringify({ error: { message: "share failed" } }), "share failed"],
  ]);
}

async function testInnerAudioWrappers() {
  const calls = [];
  const listeners = {};
  const audio = {
    src: "",
    startTime: 0,
    autoplay: false,
    loop: false,
    obeyMuteSwitch: true,
    volume: 1,
    playbackRate: 1,
    duration: 12.5,
    currentTime: 0,
    paused: true,
    buffered: 4,
    referrerPolicy: "",
    play() { calls.push(["play"]); this.paused = false; },
    pause() { calls.push(["pause"]); this.paused = true; },
    stop() { calls.push(["stop"]); this.paused = true; this.currentTime = 0; },
    seek(position) { calls.push(["seek", position]); this.currentTime = position; },
    destroy() { calls.push(["destroy"]); },
    onCanplay(listener) { calls.push(["onCanplay"]); listeners.canplay = listener; },
    offCanplay(listener) { calls.push(["offCanplay", listener === listeners.canplay]); },
    onPlay(listener) { calls.push(["onPlay"]); listeners.play = listener; },
    offPlay(listener) { calls.push(["offPlay", listener === listeners.play]); },
    onPause(listener) { calls.push(["onPause"]); listeners.pause = listener; },
    offPause(listener) { calls.push(["offPause", listener === listeners.pause]); },
    onStop(listener) { calls.push(["onStop"]); listeners.stop = listener; },
    offStop(listener) { calls.push(["offStop", listener === listeners.stop]); },
    onEnded(listener) { calls.push(["onEnded"]); listeners.ended = listener; },
    offEnded(listener) { calls.push(["offEnded", listener === listeners.ended]); },
    onTimeUpdate(listener) { calls.push(["onTimeUpdate"]); listeners.timeUpdate = listener; },
    offTimeUpdate(listener) { calls.push(["offTimeUpdate", listener === listeners.timeUpdate]); },
    onError(listener) { calls.push(["onError"]); listeners.error = listener; },
    offError(listener) { calls.push(["offError", listener === listeners.error]); },
    onWaiting(listener) { calls.push(["onWaiting"]); listeners.waiting = listener; },
    offWaiting(listener) { calls.push(["offWaiting", listener === listeners.waiting]); },
    onSeeking(listener) { calls.push(["onSeeking"]); listeners.seeking = listener; },
    offSeeking(listener) { calls.push(["offSeeking", listener === listeners.seeking]); },
    onSeeked(listener) { calls.push(["onSeeked"]); listeners.seeked = listener; },
    offSeeked(listener) { calls.push(["offSeeked", listener === listeners.seeked]); },
  };
  const { GodotSDK } = await loadSdkWithApi({
    createInnerAudioContext(options) {
      calls.push(["createInnerAudioContext", options]);
      return audio;
    },
    setInnerAudioOption(options) {
      calls.push(["setInnerAudioOption", {
        mixWithOther: options.mixWithOther,
        obeyMuteSwitch: options.obeyMuteSwitch,
        speakerOn: options.speakerOn,
      }]);
      options.success({ errMsg: "setInnerAudioOption:ok" });
      return Promise.resolve({ errMsg: "setInnerAudioOption:ok" });
    },
  });

  const sdk = new GodotSDK();
  const operations = [];
  const events = [];
  await sdk.setInnerAudioOption(JSON.stringify({ mixWithOther: false, obeyMuteSwitch: false, speakerOn: true }), (...args) => operations.push(args));
  sdk.createInnerAudioContext(
    JSON.stringify({ useWebAudioImplement: true }),
    JSON.stringify({ src: "audio/bgm.mp3", autoplay: true, loop: true, startTime: 1.5, volume: 0.6, playbackRate: 1.25, referrerPolicy: "origin" }),
    (...args) => operations.push(args),
    (...args) => events.push(args));
  sdk.setInnerAudioProperties(JSON.stringify({ volume: 0.8, currentTime: 2.25, obeyMuteSwitch: false }), (...args) => operations.push(args));
  sdk.getInnerAudioState((...args) => operations.push(args));
  sdk.innerAudioPlay((...args) => operations.push(args));
  listeners.play({ source: "manual" });
  listeners.timeUpdate();
  sdk.innerAudioSeek(5.5, (...args) => operations.push(args));
  listeners.seeking();
  listeners.seeked();
  sdk.innerAudioPause((...args) => operations.push(args));
  listeners.pause();
  sdk.innerAudioStop((...args) => operations.push(args));
  listeners.stop();
  listeners.error({ errCode: 10001, errMsg: "audio decode failed" });
  sdk.stopInnerAudioListener(JSON.stringify(["play", "pause", "stop", "timeUpdate", "error", "seeking", "seeked"]), (...args) => operations.push(args));
  sdk.innerAudioDestroy((...args) => operations.push(args));

  assert.deepEqual(calls, [
    ["setInnerAudioOption", { mixWithOther: false, obeyMuteSwitch: false, speakerOn: true }],
    ["createInnerAudioContext", { useWebAudioImplement: true }],
    ["onCanplay"],
    ["onPlay"],
    ["onPause"],
    ["onStop"],
    ["onEnded"],
    ["onTimeUpdate"],
    ["onError"],
    ["onWaiting"],
    ["onSeeking"],
    ["onSeeked"],
    ["play"],
    ["seek", 5.5],
    ["pause"],
    ["stop"],
    ["offPlay", true],
    ["offPause", true],
    ["offStop", true],
    ["offTimeUpdate", true],
    ["offError", true],
    ["offSeeking", true],
    ["offSeeked", true],
    ["offCanplay", true],
    ["offEnded", true],
    ["offWaiting", true],
    ["destroy"],
  ]);
  assert.deepEqual(operations, [
    ["setInnerAudioOption", true, JSON.stringify({ errMsg: "setInnerAudioOption:ok" }), ""],
    ["createInnerAudioContext", true, JSON.stringify({
      src: "audio/bgm.mp3",
      startTime: 1.5,
      autoplay: true,
      loop: true,
      obeyMuteSwitch: true,
      volume: 0.6,
      playbackRate: 1.25,
      duration: 12.5,
      currentTime: 0,
      paused: true,
      buffered: 4,
      referrerPolicy: "origin",
    }), ""],
    ["InnerAudioContext.setProperties", true, JSON.stringify({
      src: "audio/bgm.mp3",
      startTime: 1.5,
      autoplay: true,
      loop: true,
      obeyMuteSwitch: false,
      volume: 0.8,
      playbackRate: 1.25,
      duration: 12.5,
      currentTime: 2.25,
      paused: true,
      buffered: 4,
      referrerPolicy: "origin",
    }), ""],
    ["InnerAudioContext.getState", true, JSON.stringify({
      src: "audio/bgm.mp3",
      startTime: 1.5,
      autoplay: true,
      loop: true,
      obeyMuteSwitch: false,
      volume: 0.8,
      playbackRate: 1.25,
      duration: 12.5,
      currentTime: 2.25,
      paused: true,
      buffered: 4,
      referrerPolicy: "origin",
    }), ""],
    ["InnerAudioContext.play", true, JSON.stringify({
      src: "audio/bgm.mp3",
      startTime: 1.5,
      autoplay: true,
      loop: true,
      obeyMuteSwitch: false,
      volume: 0.8,
      playbackRate: 1.25,
      duration: 12.5,
      currentTime: 2.25,
      paused: false,
      buffered: 4,
      referrerPolicy: "origin",
    }), ""],
    ["InnerAudioContext.seek", true, JSON.stringify({
      src: "audio/bgm.mp3",
      startTime: 1.5,
      autoplay: true,
      loop: true,
      obeyMuteSwitch: false,
      volume: 0.8,
      playbackRate: 1.25,
      duration: 12.5,
      currentTime: 5.5,
      paused: false,
      buffered: 4,
      referrerPolicy: "origin",
    }), ""],
    ["InnerAudioContext.pause", true, JSON.stringify({
      src: "audio/bgm.mp3",
      startTime: 1.5,
      autoplay: true,
      loop: true,
      obeyMuteSwitch: false,
      volume: 0.8,
      playbackRate: 1.25,
      duration: 12.5,
      currentTime: 5.5,
      paused: true,
      buffered: 4,
      referrerPolicy: "origin",
    }), ""],
    ["InnerAudioContext.stop", true, JSON.stringify({
      src: "audio/bgm.mp3",
      startTime: 1.5,
      autoplay: true,
      loop: true,
      obeyMuteSwitch: false,
      volume: 0.8,
      playbackRate: 1.25,
      duration: 12.5,
      currentTime: 0,
      paused: true,
      buffered: 4,
      referrerPolicy: "origin",
    }), ""],
    ["InnerAudioContext.off", true, JSON.stringify({ events: ["play", "pause", "stop", "timeUpdate", "error", "seeking", "seeked"] }), ""],
    ["InnerAudioContext.destroy", true, "{}", ""],
  ]);
  assert.deepEqual(events, [
    ["play", JSON.stringify({ source: "manual" }), ""],
    ["timeUpdate", "{}", ""],
    ["seeking", "{}", ""],
    ["seeked", "{}", ""],
    ["pause", "{}", ""],
    ["stop", "{}", ""],
    ["error", JSON.stringify({ errCode: 10001, errMsg: "audio decode failed" }), "code=10001 audio decode failed"],
  ]);
}

async function testSensorWrappers() {
  const calls = [];
  let accelerometerListener = null;
  let gyroscopeListener = null;
  let compassListener = null;
  let deviceMotionListener = null;
  let offAccelerometerListener = null;
  let offGyroscopeListener = null;
  let offCompassListener = null;
  let offDeviceMotionListener = null;
  const { GodotSDK } = await loadSdkWithApi({
    startAccelerometer(options) {
      calls.push(["startAccelerometer", options.interval]);
      options.success({ errMsg: "startAccelerometer:ok" });
    },
    onAccelerometerChange(listener) {
      accelerometerListener = listener;
    },
    stopAccelerometer(options) {
      calls.push(["stopAccelerometer"]);
      options.success({ errMsg: "stopAccelerometer:ok" });
    },
    offAccelerometerChange(listener) {
      offAccelerometerListener = listener;
    },
    startGyroscope(options) {
      calls.push(["startGyroscope", options.interval]);
      options.success({ errMsg: "startGyroscope:ok" });
    },
    onGyroscopeChange(listener) {
      gyroscopeListener = listener;
    },
    stopGyroscope(options) {
      calls.push(["stopGyroscope"]);
      options.success({ errMsg: "stopGyroscope:ok" });
    },
    offGyroscopeChange(listener) {
      offGyroscopeListener = listener;
    },
    startCompass(options) {
      calls.push(["startCompass", Object.hasOwn(options, "interval")]);
      options.success({ errMsg: "startCompass:ok" });
    },
    onCompassChange(listener) {
      compassListener = listener;
    },
    stopCompass(options) {
      calls.push(["stopCompass"]);
      options.success({ errMsg: "stopCompass:ok" });
    },
    offCompassChange(listener) {
      offCompassListener = listener;
    },
    startDeviceMotionListening(options) {
      calls.push(["startDeviceMotionListening", options.interval]);
      options.success({ errMsg: "startDeviceMotionListening:ok" });
    },
    onDeviceMotionChange(listener) {
      deviceMotionListener = listener;
    },
    stopDeviceMotionListening(options) {
      calls.push(["stopDeviceMotionListening"]);
      options.success({ errMsg: "stopDeviceMotionListening:ok" });
    },
    offDeviceMotionChange(listener) {
      offDeviceMotionListener = listener;
    },
  });

  const sdk = new GodotSDK();
  const startResults = [];
  const stopResults = [];
  const accelerometerEvents = [];
  const gyroscopeEvents = [];
  const compassEvents = [];
  const deviceMotionEvents = [];

  sdk.startAccelerometer("game", (...args) => startResults.push(args), (...args) => accelerometerEvents.push(args));
  assert.equal(typeof accelerometerListener, "function");
  accelerometerListener({ x: 1, y: 2, z: 3 });
  sdk.stopAccelerometer((...args) => stopResults.push(args));

  sdk.startGyroscope("ui", (...args) => startResults.push(args), (...args) => gyroscopeEvents.push(args));
  assert.equal(typeof gyroscopeListener, "function");
  gyroscopeListener({ x: 4, y: 5, z: 6 });
  sdk.stopGyroscope((...args) => stopResults.push(args));

  sdk.startCompass((...args) => startResults.push(args), (...args) => compassEvents.push(args));
  assert.equal(typeof compassListener, "function");
  compassListener({ direction: 123, accuracy: "high" });
  sdk.stopCompass((...args) => stopResults.push(args));

  sdk.startDeviceMotionListening("game", (...args) => startResults.push(args), (...args) => deviceMotionEvents.push(args));
  assert.equal(typeof deviceMotionListener, "function");
  deviceMotionListener({ alpha: 0.1, beta: -0.2, gamma: 0.3 });
  sdk.stopDeviceMotionListening((...args) => stopResults.push(args));

  assert.deepEqual(calls, [
    ["startAccelerometer", "game"],
    ["stopAccelerometer"],
    ["startGyroscope", "ui"],
    ["stopGyroscope"],
    ["startCompass", false],
    ["stopCompass"],
    ["startDeviceMotionListening", "game"],
    ["stopDeviceMotionListening"],
  ]);
  assert.deepEqual(startResults, [
    ["accelerometer", true, ""],
    ["gyroscope", true, ""],
    ["compass", true, ""],
    ["deviceMotion", true, ""],
  ]);
  assert.deepEqual(stopResults, [
    ["accelerometer", true, ""],
    ["gyroscope", true, ""],
    ["compass", true, ""],
    ["deviceMotion", true, ""],
  ]);
  assert.deepEqual(accelerometerEvents, [
    [1, 2, 3, JSON.stringify({ x: 1, y: 2, z: 3 })],
  ]);
  assert.deepEqual(gyroscopeEvents, [
    [4, 5, 6, JSON.stringify({ x: 4, y: 5, z: 6 })],
  ]);
  assert.deepEqual(compassEvents, [
    [123, "high", JSON.stringify({ direction: 123, accuracy: "high" })],
  ]);
  assert.deepEqual(deviceMotionEvents, [
    [0.1, -0.2, 0.3, JSON.stringify({ alpha: 0.1, beta: -0.2, gamma: 0.3 })],
  ]);
  assert.equal(offAccelerometerListener, accelerometerListener);
  assert.equal(offGyroscopeListener, gyroscopeListener);
  assert.equal(offCompassListener, compassListener);
  assert.equal(offDeviceMotionListener, deviceMotionListener);
}

async function testAudioInterruptionWrappers() {
  let beginListener = null;
  let endListener = null;
  let offBeginListener = null;
  let offEndListener = null;
  const { GodotSDK } = await loadSdkWithApi({
    onAudioInterruptionBegin(listener) {
      beginListener = listener;
    },
    offAudioInterruptionBegin(listener) {
      offBeginListener = listener;
    },
    onAudioInterruptionEnd(listener) {
      endListener = listener;
    },
    offAudioInterruptionEnd(listener) {
      offEndListener = listener;
    },
  });

  const sdk = new GodotSDK();
  const events = [];

  assert.equal(sdk.onAudioInterruptionBegin((...args) => events.push(args)), true);
  assert.equal(sdk.onAudioInterruptionEnd((...args) => events.push(args)), true);
  assert.equal(typeof beginListener, "function");
  assert.equal(typeof endListener, "function");

  beginListener();
  endListener({ reason: "resume" });

  assert.deepEqual(events, [
    ["begin", "{}", ""],
    ["end", JSON.stringify({ reason: "resume" }), ""],
  ]);
  assert.equal(sdk.offAudioInterruptionBegin(), true);
  assert.equal(sdk.offAudioInterruptionEnd(), true);
  assert.equal(offBeginListener, beginListener);
  assert.equal(offEndListener, endListener);
}

async function testThemeChangeWrapper() {
  let themeListener = null;
  let offThemeListener = null;
  const { GodotSDK } = await loadSdkWithApi({
    onThemeChange(listener) {
      themeListener = listener;
    },
    offThemeChange(listener) {
      offThemeListener = listener;
    },
  });

  const sdk = new GodotSDK();
  const events = [];

  assert.equal(sdk.onThemeChange((...args) => events.push(args)), true);
  assert.equal(typeof themeListener, "function");
  themeListener({ theme: "dark", source: "system" });
  assert.equal(sdk.offThemeChange(), true);

  assert.deepEqual(events, [
    ["dark", JSON.stringify({ theme: "dark", source: "system" }), ""],
  ]);
  assert.equal(offThemeListener, themeListener);
}

async function testPerformanceWrappers() {
  const entries = [
    { name: "appLaunch", entryType: "navigation", startTime: 1, duration: 100 },
    { name: "firstRender", entryType: "render", startTime: 20, duration: 30 },
  ];
  const reportCalls = [];
  const { GodotSDK } = await loadSdkWithApi({
    getPerformance() {
      return {
        getEntries() {
          return entries;
        },
        getEntriesByType(entryType) {
          return entries.filter((entry) => entry.entryType === entryType);
        },
      };
    },
    reportPerformance(id, value, dimensions) {
      reportCalls.push([id, value, dimensions]);
    },
  });

  const sdk = new GodotSDK();

  assert.equal(sdk.getPerformanceEntries(""), JSON.stringify(entries));
  assert.equal(sdk.getPerformanceEntries("render"), JSON.stringify([entries[1]]));
  assert.equal(sdk.reportPerformance(1101, 680, ""), true);
  assert.equal(sdk.reportPerformance(1102, 42, JSON.stringify(["cold", "menu"])), true);
  assert.deepEqual(reportCalls, [
    [1101, 680, undefined],
    [1102, 42, ["cold", "menu"]],
  ]);
}

async function testMiniProgramNavigationWrappers() {
  const calls = [];
  const { GodotSDK } = await loadSdkWithApi({
    navigateToMiniProgram(options) {
      calls.push(["navigateToMiniProgram", options]);
      options.success({ errMsg: "navigateToMiniProgram:ok" });
    },
    navigateBackMiniProgram(options) {
      calls.push(["navigateBackMiniProgram", options]);
      options.success({ errMsg: "navigateBackMiniProgram:ok" });
    },
    exitMiniProgram(options) {
      calls.push(["exitMiniProgram", options]);
      options.success({ errMsg: "exitMiniProgram:ok" });
    },
    restartMiniProgram(options) {
      calls.push(["restartMiniProgram", options]);
      options.success({ errMsg: "restartMiniProgram:ok" });
    },
  });

  const sdk = new GodotSDK();
  const results = [];

  sdk.navigateToMiniProgram(
    "wx-target",
    "?from=godot",
    JSON.stringify({ score: 9 }),
    "trial",
    "",
    true,
    (...args) => results.push(args)
  );
  sdk.navigateBackMiniProgram(JSON.stringify({ finished: true }), (...args) => results.push(args));
  sdk.exitMiniProgram((...args) => results.push(args));
  sdk.restartMiniProgram("pages/index/index?from=restart", (...args) => results.push(args));

  assert.equal(calls.length, 4);
  assert.deepEqual(calls[0][0], "navigateToMiniProgram");
  assert.equal(calls[0][1].appId, "wx-target");
  assert.equal(calls[0][1].path, "?from=godot");
  assert.deepEqual(calls[0][1].extraData, { score: 9 });
  assert.equal(calls[0][1].envVersion, "trial");
  assert.equal(calls[0][1].noRelaunchIfPathUnchanged, true);
  assert.equal(Object.hasOwn(calls[0][1], "shortLink"), false);
  assert.deepEqual(calls[1][1].extraData, { finished: true });
  assert.equal(calls[3][1].path, "pages/index/index?from=restart");
  assert.deepEqual(results, [
    ["navigateToMiniProgram", true, JSON.stringify({ errMsg: "navigateToMiniProgram:ok" }), ""],
    ["navigateBackMiniProgram", true, JSON.stringify({ errMsg: "navigateBackMiniProgram:ok" }), ""],
    ["exitMiniProgram", true, JSON.stringify({ errMsg: "exitMiniProgram:ok" }), ""],
    ["restartMiniProgram", true, JSON.stringify({ errMsg: "restartMiniProgram:ok" }), ""],
  ]);
}

async function testCloudStorageAndOpenDataWrappers() {
  const calls = [];
  const openDataMessages = [];
  const { GodotSDK } = await loadSdkWithApi({
    setUserCloudStorage(options) {
      calls.push(["setUserCloudStorage", options]);
      options.success({ errMsg: "setUserCloudStorage:ok" });
    },
    removeUserCloudStorage(options) {
      calls.push(["removeUserCloudStorage", options]);
      options.success({ errMsg: "removeUserCloudStorage:ok" });
    },
    getUserCloudStorageKeys(options) {
      calls.push(["getUserCloudStorageKeys", options]);
      options.success({ keys: ["score", "season"] });
    },
    getUserCloudStorage(options) {
      calls.push(["getUserCloudStorage", options]);
      options.success({ KVDataList: [{ key: "score", value: "9001" }] });
    },
    getFriendCloudStorage(options) {
      calls.push(["getFriendCloudStorage", options]);
      options.success({ data: [{ openid: "friend", KVDataList: [] }] });
    },
    getGroupCloudStorage(options) {
      calls.push(["getGroupCloudStorage", options]);
      options.success({ data: [{ openid: "group-member", KVDataList: [] }] });
    },
    getOpenDataContext(options) {
      calls.push(["getOpenDataContext", options]);
      return {
        postMessage(message) {
          openDataMessages.push(message);
        },
      };
    },
  });

  const sdk = new GodotSDK();
  const results = [];

  sdk.setUserCloudStorage(JSON.stringify({ score: 9001, season: "s1" }), (...args) => results.push(args));
  sdk.removeUserCloudStorage(JSON.stringify(["score", "season"]), (...args) => results.push(args));
  sdk.getUserCloudStorageKeys((...args) => results.push(args));
  sdk.getUserCloudStorage(JSON.stringify(["score"]), (...args) => results.push(args));
  sdk.getFriendCloudStorage(JSON.stringify(["score"]), (...args) => results.push(args));
  sdk.getGroupCloudStorage(JSON.stringify(["score"]), "share-ticket", "open-gid", (...args) => results.push(args));

  assert.equal(sdk.postOpenDataContextMessage(JSON.stringify({ type: "rank", season: "s1" }), "screenCanvas"), true);

  assert.deepEqual(calls[0][1].KVDataList, [
    { key: "score", value: "9001" },
    { key: "season", value: "s1" },
  ]);
  assert.deepEqual(calls[1][1].keyList, ["score", "season"]);
  assert.deepEqual(calls[3][1].keyList, ["score"]);
  assert.deepEqual(calls[4][1].keyList, ["score"]);
  assert.deepEqual(calls[5][1].keyList, ["score"]);
  assert.equal(calls[5][1].shareTicket, "share-ticket");
  assert.equal(calls[5][1].groupid, "open-gid");
  assert.deepEqual(calls[6], ["getOpenDataContext", { sharedCanvasMode: "screenCanvas" }]);
  assert.deepEqual(openDataMessages, [{ type: "rank", season: "s1" }]);
  assert.deepEqual(results, [
    ["setUserCloudStorage", true, JSON.stringify({ errMsg: "setUserCloudStorage:ok" }), ""],
    ["removeUserCloudStorage", true, JSON.stringify({ errMsg: "removeUserCloudStorage:ok" }), ""],
    ["getUserCloudStorageKeys", true, JSON.stringify({ keys: ["score", "season"] }), ""],
    ["getUserCloudStorage", true, JSON.stringify({ KVDataList: [{ key: "score", value: "9001" }] }), ""],
    ["getFriendCloudStorage", true, JSON.stringify({ data: [{ openid: "friend", KVDataList: [] }] }), ""],
    ["getGroupCloudStorage", true, JSON.stringify({ data: [{ openid: "group-member", KVDataList: [] }] }), ""],
  ]);
}

async function testCustomerServiceAndSubscribeWrappers() {
  const calls = [];
  const { GodotSDK } = await loadSdkWithApi({
    openCustomerServiceConversation(options) {
      calls.push(["openCustomerServiceConversation", options]);
      options.success({ path: "pages/support/index", query: { from: "card" } });
    },
    requestSubscribeMessage(options) {
      calls.push(["requestSubscribeMessage", options]);
      options.success({
        errMsg: "requestSubscribeMessage:ok",
        tmpl_a: "accept",
        tmpl_b: "reject",
      });
    },
    requestSubscribeSystemMessage(options) {
      calls.push(["requestSubscribeSystemMessage", options]);
      options.success({
        errMsg: "requestSubscribeSystemMessage:ok",
        SYS_MSG_TYPE_RANK: "accept",
      });
    },
  });

  const sdk = new GodotSDK();
  const customerResults = [];
  const subscribeResults = [];

  sdk.openCustomerServiceConversation(
    "from-godot",
    true,
    "Help",
    "pages/help/index?from=chat",
    "images/help.png",
    (...args) => customerResults.push(args)
  );
  sdk.requestSubscribeMessage(JSON.stringify(["tmpl_a", "tmpl_b"]), (...args) => subscribeResults.push(args));
  sdk.requestSubscribeSystemMessage(JSON.stringify(["SYS_MSG_TYPE_RANK"]), (...args) => subscribeResults.push(args));

  assert.equal(calls.length, 3);
  assert.equal(calls[0][1].sessionFrom, "from-godot");
  assert.equal(calls[0][1].showMessageCard, true);
  assert.equal(calls[0][1].sendMessageTitle, "Help");
  assert.equal(calls[0][1].sendMessagePath, "pages/help/index?from=chat");
  assert.equal(calls[0][1].sendMessageImg, "images/help.png");
  assert.deepEqual(calls[1][1].tmplIds, ["tmpl_a", "tmpl_b"]);
  assert.deepEqual(calls[2][1].msgTypeList, ["SYS_MSG_TYPE_RANK"]);
  assert.deepEqual(customerResults, [
    ["openCustomerServiceConversation", true, JSON.stringify({ path: "pages/support/index", query: { from: "card" } }), ""],
  ]);
  assert.deepEqual(subscribeResults, [
    ["requestSubscribeMessage", true, JSON.stringify({
      errMsg: "requestSubscribeMessage:ok",
      tmpl_a: "accept",
      tmpl_b: "reject",
    }), ""],
    ["requestSubscribeSystemMessage", true, JSON.stringify({
      errMsg: "requestSubscribeSystemMessage:ok",
      SYS_MSG_TYPE_RANK: "accept",
    }), ""],
  ]);
}

async function testBatteryWrappers() {
  const response = {
    level: 88,
    isCharging: true,
    isLowPowerModeEnabled: false,
  };
  const syncResponse = {
    level: 42,
    isCharging: false,
    isLowPowerModeEnabled: true,
  };
  const { GodotSDK } = await loadSdkWithApi({
    getBatteryInfo(options) {
      options.success(response);
    },
    getBatteryInfoSync() {
      return syncResponse;
    },
  });

  const sdk = new GodotSDK();
  const asyncResult = await new Promise((resolve) => {
    sdk.getBatteryInfo((...args) => resolve(args));
  });

  assert.deepEqual(asyncResult, [88, true, JSON.stringify(response), ""]);
  assert.equal(sdk.getBatteryInfoSync(), JSON.stringify(syncResponse));
}

async function testUpdateManagerWrapper() {
  let checkListener = null;
  let readyListener = null;
  let failedListener = null;
  let applyCalls = 0;
  let getUpdateManagerCalls = 0;
  const updateManager = {
    onCheckForUpdate(listener) {
      checkListener = listener;
    },
    onUpdateReady(listener) {
      readyListener = listener;
    },
    onUpdateFailed(listener) {
      failedListener = listener;
    },
    applyUpdate() {
      applyCalls += 1;
    },
  };
  const { GodotSDK } = await loadSdkWithApi({
    getUpdateManager() {
      getUpdateManagerCalls += 1;
      return updateManager;
    },
  });

  const sdk = new GodotSDK();
  const events = [];

  assert.equal(sdk.startUpdateListener((...args) => events.push(args)), true);
  assert.equal(typeof checkListener, "function");
  assert.equal(typeof readyListener, "function");
  assert.equal(typeof failedListener, "function");

  checkListener({ hasUpdate: true });
  readyListener();
  failedListener();

  assert.equal(sdk.applyUpdate(), true);
  assert.deepEqual(events, [
    ["check", true, JSON.stringify({ hasUpdate: true }), ""],
    ["ready", true, "{}", ""],
    ["failed", false, "{}", ""],
  ]);
  assert.equal(getUpdateManagerCalls, 1);
  assert.equal(applyCalls, 1);
}

async function testMemoryWarningWrapper() {
  let memoryListener = null;
  let offListener = null;
  const { GodotSDK } = await loadSdkWithApi({
    onMemoryWarning(listener) {
      memoryListener = listener;
    },
    offMemoryWarning(listener) {
      offListener = listener;
    },
  });

  const sdk = new GodotSDK();
  const events = [];

  assert.equal(sdk.onMemoryWarning((...args) => events.push(args)), true);
  assert.equal(typeof memoryListener, "function");
  memoryListener({ level: 10 });
  assert.equal(sdk.offMemoryWarning(), true);

  assert.deepEqual(events, [
    [10, JSON.stringify({ level: 10 }), ""],
  ]);
  assert.equal(offListener, memoryListener);
}

async function testWindowResizeWrapper() {
  let resizeListener = null;
  let offListener = null;
  const resizeEvent = {
    size: {
      windowWidth: 375,
      windowHeight: 667,
    },
  };
  const { GodotSDK } = await loadSdkWithApi({
    onWindowResize(listener) {
      resizeListener = listener;
    },
    offWindowResize(listener) {
      offListener = listener;
    },
  });

  const sdk = new GodotSDK();
  const events = [];

  assert.equal(sdk.onWindowResize((...args) => events.push(args)), true);
  assert.equal(typeof resizeListener, "function");
  resizeListener(resizeEvent);
  assert.equal(sdk.offWindowResize(), true);

  assert.deepEqual(events, [
    [375, 667, JSON.stringify(resizeEvent), ""],
  ]);
  assert.equal(offListener, resizeListener);
}

async function testUnhandledRejectionWrapper() {
  let rejectionListener = null;
  let offListener = null;
  const { GodotSDK } = await loadSdkWithApi({
    onUnhandledRejection(listener) {
      rejectionListener = listener;
    },
    offUnhandledRejection(listener) {
      offListener = listener;
    },
  });

  const sdk = new GodotSDK();
  const events = [];
  const reason = new Error("boom");
  const promise = {};

  assert.equal(sdk.onUnhandledRejection((...args) => events.push(args)), true);
  assert.equal(typeof rejectionListener, "function");
  rejectionListener({ reason, promise });
  assert.equal(sdk.offUnhandledRejection(), true);

  assert.deepEqual(events, [
    ["boom", JSON.stringify({ reason: "boom", promise }), ""],
  ]);
  assert.equal(offListener, rejectionListener);
}

async function testScreenBrightnessWrapper() {
  const calls = [];
  const brightnessResponse = { value: 0.42 };
  const { GodotSDK } = await loadSdkWithApi({
    getScreenBrightness(options) {
      calls.push(["getScreenBrightness"]);
      options.success(brightnessResponse);
    },
    setScreenBrightness(options) {
      calls.push(["setScreenBrightness", options.value]);
      options.success({ errMsg: "setScreenBrightness:ok" });
    },
  });

  const sdk = new GodotSDK();
  const getResult = await new Promise((resolve) => {
    sdk.getScreenBrightness((...args) => resolve(args));
  });
  const setResult = await new Promise((resolve) => {
    sdk.setScreenBrightness(-1, (...args) => resolve(args));
  });

  assert.deepEqual(calls, [
    ["getScreenBrightness"],
    ["setScreenBrightness", -1],
  ]);
  assert.deepEqual(getResult, [0.42, JSON.stringify(brightnessResponse), ""]);
  assert.deepEqual(setResult, [-1, true, ""]);
}

async function testScreenCaptureAndRecordingWrappers() {
  let captureListener = null;
  let recordingListener = null;
  let offRecordingListener = null;
  const calls = [];
  const { GodotSDK } = await loadSdkWithApi({
    onUserCaptureScreen(listener) {
      captureListener = listener;
    },
    offUserCaptureScreen() {
      calls.push(["offUserCaptureScreen"]);
    },
    getScreenRecordingState(options) {
      calls.push(["getScreenRecordingState"]);
      options.success({ state: "on" });
    },
    onScreenRecordingStateChanged(listener) {
      recordingListener = listener;
    },
    offScreenRecordingStateChanged(listener) {
      offRecordingListener = listener;
    },
    setVisualEffectOnCapture(options) {
      calls.push(["setVisualEffectOnCapture", options.visualEffect]);
      options.success({ errMsg: "setVisualEffectOnCapture:ok" });
    },
  });

  const sdk = new GodotSDK();
  const captureEvents = [];
  const recordingEvents = [];

  assert.equal(sdk.onUserCaptureScreen((...args) => captureEvents.push(args)), true);
  assert.equal(typeof captureListener, "function");
  captureListener({ query: "from=capture" });
  assert.equal(sdk.offUserCaptureScreen(), true);

  const recordingStateResult = await new Promise((resolve) => {
    sdk.getScreenRecordingState((...args) => resolve(args));
  });
  assert.equal(sdk.onScreenRecordingStateChanged((...args) => recordingEvents.push(args)), true);
  assert.equal(typeof recordingListener, "function");
  recordingListener({ state: "start" });
  assert.equal(sdk.offScreenRecordingStateChanged(), true);

  const visualEffectResult = await new Promise((resolve) => {
    sdk.setVisualEffectOnCapture("hidden", (...args) => resolve(args));
  });

  assert.deepEqual(captureEvents, [
    [JSON.stringify({ query: "from=capture" }), ""],
  ]);
  assert.deepEqual(recordingStateResult, ["on", JSON.stringify({ state: "on" }), ""]);
  assert.deepEqual(recordingEvents, [
    ["start", JSON.stringify({ state: "start" }), ""],
  ]);
  assert.deepEqual(visualEffectResult, ["hidden", true, ""]);
  assert.deepEqual(calls, [
    ["offUserCaptureScreen"],
    ["getScreenRecordingState"],
    ["setVisualEffectOnCapture", "hidden"],
  ]);
  assert.equal(offRecordingListener, recordingListener);
}

async function testSettingAndNetworkWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();

  const settingResult = await new Promise((resolve) => {
    sdk.getSetting(false, (...args) => resolve(args));
  });
  const openResult = await new Promise((resolve) => {
    sdk.openSetting(false, (...args) => resolve(args));
  });
  const authorizeResult = await new Promise((resolve) => {
    sdk.authorize("scope.record", (...args) => resolve(args));
  });
  const networkResult = await new Promise((resolve) => {
    sdk.getNetworkType((...args) => resolve(args));
  });

  assert.deepEqual(settingResult, ["", "wx.getSetting is not supported"]);
  assert.deepEqual(openResult, ["", "wx.openSetting is not supported"]);
  assert.deepEqual(authorizeResult, ["scope.record", false, "wx.authorize is not supported"]);
  assert.equal(sdk.getAccountInfo(), "{}");
  assert.deepEqual(networkResult, ["", "", "wx.getNetworkType is not supported"]);
  assert.equal(sdk.onNetworkStatusChange(() => {}), false);
  assert.equal(sdk.offNetworkStatusChange(), false);
}

async function testFileTransferWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const results = [];

  sdk.downloadFile(
    "https://cdn.example.com/a.bin",
    "",
    "{}",
    0,
    false,
    false,
    false,
    (...args) => results.push(args));
  sdk.uploadFile(
    "https://api.example.com/upload",
    "wxfile://usr/a.bin",
    "file",
    "{}",
    "{}",
    0,
    false,
    false,
    false,
    (...args) => results.push(args));

  assert.deepEqual(results, [
    ["downloadFile", false, 0, "", "wx.downloadFile is not supported"],
    ["uploadFile", false, 0, "", "wx.uploadFile is not supported"],
  ]);
}

async function testSocketTaskWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const operations = [];
  const events = [];

  sdk.connectSocket(
    "wss://socket.example.com/room",
    "{}",
    "[]",
    false,
    false,
    0,
    false,
    (...args) => operations.push(args),
    (...args) => events.push(args));
  sdk.sendSocketMessage("hello", (...args) => operations.push(args));
  sdk.closeSocket(1000, "normal", (...args) => operations.push(args));

  assert.deepEqual(operations, [
    ["connectSocket", false, "", "wx.connectSocket is not supported"],
    ["sendSocketMessage", false, "", "No active WebSocket connection"],
    ["closeSocket", false, "", "No active WebSocket connection"],
  ]);
  assert.deepEqual(events, []);
}

async function testFileSystemManagerWrapperReportsUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const missingManagerResult = await new Promise((resolve) => {
    sdk.fileSystemCall("access", JSON.stringify({ path: "wxfile://usr/save.json" }), (...args) => resolve(args));
  });

  const { GodotSDK: GodotSDKWithEmptyManager } = await loadSdkWithApi({
    getFileSystemManager() {
      return {};
    },
  });
  const sdkWithEmptyManager = new GodotSDKWithEmptyManager();
  const missingMethodResult = await new Promise((resolve) => {
    sdkWithEmptyManager.fileSystemCall("notReal", "{}", (...args) => resolve(args));
  });

  assert.deepEqual(missingManagerResult, [
    "access",
    false,
    "",
    "wx.getFileSystemManager is not supported",
  ]);
  assert.deepEqual(missingMethodResult, [
    "notReal",
    false,
    "",
    "FileSystemManager.notReal is not supported",
  ]);
}

async function testSubpackageWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const operations = [];
  const progressEvents = [];

  sdk.loadSubpackage(
    "levels",
    (...args) => operations.push(args),
    (...args) => progressEvents.push(args));
  sdk.preDownloadSubpackage(
    "levels",
    "normal",
    (...args) => operations.push(args),
    (...args) => progressEvents.push(args));

  assert.deepEqual(operations, [
    ["loadSubpackage", false, "", "wx.loadSubpackage is not supported"],
    ["preDownloadSubpackage", false, "", "wx.preDownloadSubpackage is not supported"],
  ]);
  assert.deepEqual(progressEvents, []);
}

async function testWorkerWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const operations = [];
  const events = [];

  sdk.createWorker(
    "workers/index.js",
    false,
    (...args) => operations.push(args),
    (...args) => events.push(args));
  sdk.workerPostMessage(JSON.stringify({ type: "ping" }), (...args) => operations.push(args));
  sdk.workerTerminate((...args) => operations.push(args));

  assert.deepEqual(operations, [
    ["createWorker", false, "", "wx.createWorker is not supported"],
    ["Worker.postMessage", false, "", "No active Worker"],
    ["Worker.terminate", false, "", "No active Worker"],
  ]);
  assert.deepEqual(events, []);
}

async function testMediaWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const operations = [];

  sdk.chooseMedia(
    1,
    JSON.stringify(["image"]),
    JSON.stringify(["album"]),
    10,
    JSON.stringify(["compressed"]),
    "back",
    (...args) => operations.push(args));
  sdk.chooseImage(
    1,
    JSON.stringify(["compressed"]),
    JSON.stringify(["album"]),
    (...args) => operations.push(args));
  sdk.previewImage(
    JSON.stringify(["wxfile://tmp/a.png"]),
    "",
    true,
    "no-referrer",
    (...args) => operations.push(args));
  sdk.saveImageToPhotosAlbum(
    "wxfile://usr/a.png",
    (...args) => operations.push(args));
  sdk.compressImage(
    "wxfile://usr/a.jpg",
    80,
    0,
    0,
    (...args) => operations.push(args));

  assert.deepEqual(operations, [
    ["chooseMedia", false, "", "wx.chooseMedia is not supported"],
    ["chooseImage", false, "", "wx.chooseImage is not supported"],
    ["previewImage", false, "", "wx.previewImage is not supported"],
    ["saveImageToPhotosAlbum", false, "", "wx.saveImageToPhotosAlbum is not supported"],
    ["compressImage", false, "", "wx.compressImage is not supported"],
  ]);
}

async function testCameraWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const operations = [];
  const events = [];

  sdk.createCamera(0, 0, 300, 150, "back", "auto", "small", (...args) => operations.push(args), (...args) => events.push(args));
  sdk.cameraTakePhoto("normal", (...args) => operations.push(args));
  sdk.cameraStartRecord((...args) => operations.push(args));
  sdk.cameraStopRecord(true, (...args) => operations.push(args));
  sdk.cameraSetZoom(1.5, (...args) => operations.push(args));
  sdk.cameraListenFrameChange(false, (...args) => operations.push(args));
  sdk.cameraCloseFrameChange((...args) => operations.push(args));
  sdk.cameraDestroy((...args) => operations.push(args));

  assert.deepEqual(operations, [
    ["createCamera", false, "", "wx.createCamera is not supported"],
    ["Camera.takePhoto", false, "", "No active Camera"],
    ["Camera.startRecord", false, "", "No active Camera"],
    ["Camera.stopRecord", false, "", "No active Camera"],
    ["Camera.setZoom", false, "", "No active Camera"],
    ["Camera.listenFrameChange", false, "", "No active Camera"],
    ["Camera.closeFrameChange", false, "", "No active Camera"],
    ["Camera.destroy", false, "", "No active Camera"],
  ]);
  assert.deepEqual(events, []);
}

async function testVideoWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const operations = [];
  const events = [];

  sdk.createVideo(JSON.stringify({ src: "video/intro.mp4" }), (...args) => operations.push(args), (...args) => events.push(args));
  sdk.setVideoProperties(JSON.stringify({ muted: true }), (...args) => operations.push(args));
  sdk.getVideoState((...args) => operations.push(args));
  sdk.videoPlay((...args) => operations.push(args));
  sdk.videoPause((...args) => operations.push(args));
  sdk.videoStop((...args) => operations.push(args));
  sdk.videoSeek(1.25, (...args) => operations.push(args));
  sdk.videoRequestFullScreen(0, (...args) => operations.push(args));
  sdk.videoExitFullScreen((...args) => operations.push(args));
  sdk.stopVideoListener(JSON.stringify(["play"]), (...args) => operations.push(args));
  sdk.videoDestroy((...args) => operations.push(args));

  assert.deepEqual(operations, [
    ["createVideo", false, "", "wx.createVideo is not supported"],
    ["Video.setProperties", false, "", "No active Video"],
    ["Video.getState", false, "", "No active Video"],
    ["Video.play", false, "", "No active Video"],
    ["Video.pause", false, "", "No active Video"],
    ["Video.stop", false, "", "No active Video"],
    ["Video.seek", false, "", "No active Video"],
    ["Video.requestFullScreen", false, "", "No active Video"],
    ["Video.exitFullScreen", false, "", "No active Video"],
    ["Video.off", false, "", "No active Video"],
    ["Video.destroy", false, "", "No active Video"],
  ]);
  assert.deepEqual(events, []);
}

async function testRecorderManagerWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const operations = [];
  const events = [];

  sdk.getRecorderManager((...args) => operations.push(args), (...args) => events.push(args));
  sdk.recorderStart(JSON.stringify({ duration: 1000 }), (...args) => operations.push(args));
  sdk.recorderPause((...args) => operations.push(args));
  sdk.recorderResume((...args) => operations.push(args));
  sdk.recorderStop((...args) => operations.push(args));

  assert.deepEqual(operations, [
    ["getRecorderManager", false, "", "wx.getRecorderManager is not supported"],
    ["RecorderManager.start", false, "", "No active RecorderManager"],
    ["RecorderManager.pause", false, "", "No active RecorderManager"],
    ["RecorderManager.resume", false, "", "No active RecorderManager"],
    ["RecorderManager.stop", false, "", "No active RecorderManager"],
  ]);
  assert.deepEqual(events, []);
}

async function testAudioSourceVideoDecoderAndMediaAudioWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const sourceResult = await new Promise((resolve) => {
    sdk.getAvailableAudioSources((...args) => resolve(args));
  });
  const decoderOperations = [];
  const decoderEvents = [];
  const mediaOperations = [];

  sdk.createVideoDecoder((...args) => decoderOperations.push(args));
  sdk.startVideoDecoderListener(JSON.stringify(["start"]), (...args) => decoderOperations.push(args), (...args) => decoderEvents.push(args));
  sdk.videoDecoderStart(JSON.stringify({ source: "video/clip.mp4" }), (...args) => decoderOperations.push(args));
  sdk.videoDecoderGetFrameData((...args) => decoderOperations.push(args));
  sdk.videoDecoderSeek(1.5, (...args) => decoderOperations.push(args));
  sdk.videoDecoderStop((...args) => decoderOperations.push(args));
  sdk.stopVideoDecoderListener(JSON.stringify(["start"]), (...args) => decoderOperations.push(args));
  sdk.videoDecoderRemove((...args) => decoderOperations.push(args));
  sdk.createMediaAudioPlayer(0.8, (...args) => mediaOperations.push(args));
  sdk.mediaAudioAddVideoDecoderSource((...args) => mediaOperations.push(args));
  sdk.mediaAudioStart((...args) => mediaOperations.push(args));
  sdk.setMediaAudioVolume(0.5, (...args) => mediaOperations.push(args));
  sdk.mediaAudioRemoveVideoDecoderSource((...args) => mediaOperations.push(args));
  sdk.mediaAudioStop((...args) => mediaOperations.push(args));
  sdk.mediaAudioDestroy((...args) => mediaOperations.push(args));

  assert.deepEqual(sourceResult, ["[]", "", "wx.getAvailableAudioSources is not supported"]);
  assert.deepEqual(decoderOperations, [
    ["createVideoDecoder", false, "", "wx.createVideoDecoder is not supported"],
    ["VideoDecoder.on", false, "", "No active VideoDecoder"],
    ["VideoDecoder.start", false, "", "No active VideoDecoder"],
    ["VideoDecoder.getFrameData", false, "", "No active VideoDecoder"],
    ["VideoDecoder.seek", false, "", "No active VideoDecoder"],
    ["VideoDecoder.stop", false, "", "No active VideoDecoder"],
    ["VideoDecoder.off", false, "", "No active VideoDecoder"],
    ["VideoDecoder.remove", false, "", "No active VideoDecoder"],
  ]);
  assert.deepEqual(decoderEvents, []);
  assert.deepEqual(mediaOperations, [
    ["createMediaAudioPlayer", false, "", "wx.createMediaAudioPlayer is not supported"],
    ["MediaAudioPlayer.addAudioSource", false, "", "No active MediaAudioPlayer"],
    ["MediaAudioPlayer.start", false, "", "No active MediaAudioPlayer"],
    ["MediaAudioPlayer.setVolume", false, "", "No active MediaAudioPlayer"],
    ["MediaAudioPlayer.removeAudioSource", false, "", "No active MediaAudioPlayer"],
    ["MediaAudioPlayer.stop", false, "", "No active MediaAudioPlayer"],
    ["MediaAudioPlayer.destroy", false, "", "No active MediaAudioPlayer"],
  ]);
}

async function testGameRecorderWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const operations = [];
  const events = [];

  sdk.getGameRecorder((...args) => operations.push(args));
  sdk.startGameRecorderListener(JSON.stringify(["start"]), (...args) => operations.push(args), (...args) => events.push(args));
  sdk.gameRecorderStart(JSON.stringify({ duration: 10 }), (...args) => operations.push(args));
  sdk.gameRecorderPause((...args) => operations.push(args));
  sdk.gameRecorderResume((...args) => operations.push(args));
  sdk.gameRecorderStop((...args) => operations.push(args));
  sdk.gameRecorderAbort((...args) => operations.push(args));
  sdk.stopGameRecorderListener(JSON.stringify(["start"]), (...args) => operations.push(args));
  sdk.operateGameRecorderVideo(JSON.stringify({ title: "Replay" }), (...args) => operations.push(args));
  sdk.createGameRecorderShareButton(JSON.stringify({ left: 0, top: 0 }), JSON.stringify({ bgm: "audio/bgm.mp3", timeRange: [[0, 3000]] }), (...args) => operations.push(args), (...args) => events.push(args));
  sdk.showGameRecorderShareButton((...args) => operations.push(args));
  sdk.hideGameRecorderShareButton((...args) => operations.push(args));
  sdk.offGameRecorderShareButtonTap((...args) => operations.push(args));

  assert.deepEqual(operations, [
    ["getGameRecorder", false, "", "wx.getGameRecorder is not supported"],
    ["GameRecorder.on", false, "", "No active GameRecorder"],
    ["GameRecorder.start", false, "", "No active GameRecorder"],
    ["GameRecorder.pause", false, "", "No active GameRecorder"],
    ["GameRecorder.resume", false, "", "No active GameRecorder"],
    ["GameRecorder.stop", false, "", "No active GameRecorder"],
    ["GameRecorder.abort", false, "", "No active GameRecorder"],
    ["GameRecorder.off", false, "", "No active GameRecorder"],
    ["operateGameRecorderVideo", false, "", "wx.operateGameRecorderVideo is not supported"],
    ["createGameRecorderShareButton", false, "", "wx.createGameRecorderShareButton is not supported"],
    ["GameRecorderShareButton.show", false, "", "No active GameRecorderShareButton"],
    ["GameRecorderShareButton.hide", false, "", "No active GameRecorderShareButton"],
    ["GameRecorderShareButton.offTap", false, "", "No active GameRecorderShareButton"],
  ]);
  assert.deepEqual(events, []);
}

async function testInnerAudioWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const operations = [];
  const events = [];

  await sdk.setInnerAudioOption(JSON.stringify({ mixWithOther: true }), (...args) => operations.push(args));
  sdk.createInnerAudioContext(JSON.stringify({}), JSON.stringify({ src: "audio/bgm.mp3" }), (...args) => operations.push(args), (...args) => events.push(args));
  sdk.setInnerAudioProperties(JSON.stringify({ volume: 0.5 }), (...args) => operations.push(args));
  sdk.getInnerAudioState((...args) => operations.push(args));
  sdk.innerAudioPlay((...args) => operations.push(args));
  sdk.innerAudioPause((...args) => operations.push(args));
  sdk.innerAudioStop((...args) => operations.push(args));
  sdk.innerAudioSeek(1.25, (...args) => operations.push(args));
  sdk.stopInnerAudioListener(JSON.stringify(["play"]), (...args) => operations.push(args));
  sdk.innerAudioDestroy((...args) => operations.push(args));

  assert.deepEqual(operations, [
    ["setInnerAudioOption", false, "", "wx.setInnerAudioOption is not supported"],
    ["createInnerAudioContext", false, "", "wx.createInnerAudioContext is not supported"],
    ["InnerAudioContext.setProperties", false, "", "No active InnerAudioContext"],
    ["InnerAudioContext.getState", false, "", "No active InnerAudioContext"],
    ["InnerAudioContext.play", false, "", "No active InnerAudioContext"],
    ["InnerAudioContext.pause", false, "", "No active InnerAudioContext"],
    ["InnerAudioContext.stop", false, "", "No active InnerAudioContext"],
    ["InnerAudioContext.seek", false, "", "No active InnerAudioContext"],
    ["InnerAudioContext.off", false, "", "No active InnerAudioContext"],
    ["InnerAudioContext.destroy", false, "", "No active InnerAudioContext"],
  ]);
  assert.deepEqual(events, []);
}

async function testRuntimeCapabilityWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();

  assert.equal(sdk.canIUse("getDeviceInfo"), false);
  assert.equal(sdk.getDeviceInfo(), "{}");
  assert.equal(sdk.getAppBaseInfo(), "{}");
  assert.equal(sdk.getSystemSetting(), "{}");
  assert.equal(sdk.getAppAuthorizeSetting(), "{}");
}

async function testSensorAndBatteryWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();

  const startAccelerometerResult = await new Promise((resolve) => {
    sdk.startAccelerometer("normal", (...args) => resolve(args), () => {});
  });
  const stopAccelerometerResult = await new Promise((resolve) => {
    sdk.stopAccelerometer((...args) => resolve(args));
  });
  const startGyroscopeResult = await new Promise((resolve) => {
    sdk.startGyroscope("normal", (...args) => resolve(args), () => {});
  });
  const stopGyroscopeResult = await new Promise((resolve) => {
    sdk.stopGyroscope((...args) => resolve(args));
  });
  const startCompassResult = await new Promise((resolve) => {
    sdk.startCompass((...args) => resolve(args), () => {});
  });
  const stopCompassResult = await new Promise((resolve) => {
    sdk.stopCompass((...args) => resolve(args));
  });
  const startDeviceMotionResult = await new Promise((resolve) => {
    sdk.startDeviceMotionListening("normal", (...args) => resolve(args), () => {});
  });
  const stopDeviceMotionResult = await new Promise((resolve) => {
    sdk.stopDeviceMotionListening((...args) => resolve(args));
  });
  const batteryResult = await new Promise((resolve) => {
    sdk.getBatteryInfo((...args) => resolve(args));
  });

  assert.deepEqual(startAccelerometerResult, ["accelerometer", false, "wx.startAccelerometer is not supported"]);
  assert.deepEqual(stopAccelerometerResult, ["accelerometer", false, "wx.stopAccelerometer is not supported"]);
  assert.deepEqual(startGyroscopeResult, ["gyroscope", false, "wx.startGyroscope is not supported"]);
  assert.deepEqual(stopGyroscopeResult, ["gyroscope", false, "wx.stopGyroscope is not supported"]);
  assert.deepEqual(startCompassResult, ["compass", false, "wx.startCompass is not supported"]);
  assert.deepEqual(stopCompassResult, ["compass", false, "wx.stopCompass is not supported"]);
  assert.deepEqual(startDeviceMotionResult, ["deviceMotion", false, "wx.startDeviceMotionListening is not supported"]);
  assert.deepEqual(stopDeviceMotionResult, ["deviceMotion", false, "wx.stopDeviceMotionListening is not supported"]);
  assert.deepEqual(batteryResult, [0, false, "", "wx.getBatteryInfo is not supported"]);
  assert.equal(sdk.getBatteryInfoSync(), "{}");
}

async function testAudioInterruptionWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();

  assert.equal(sdk.onAudioInterruptionBegin(() => {}), false);
  assert.equal(sdk.offAudioInterruptionBegin(), false);
  assert.equal(sdk.onAudioInterruptionEnd(() => {}), false);
  assert.equal(sdk.offAudioInterruptionEnd(), false);
}

async function testThemeAndPerformanceWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();

  assert.equal(sdk.onThemeChange(() => {}), false);
  assert.equal(sdk.offThemeChange(), false);
  assert.equal(sdk.getPerformanceEntries("render"), "[]");
  assert.equal(sdk.reportPerformance(1101, 680, ""), false);
}

async function testMiniProgramNavigationWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const results = [];

  sdk.navigateToMiniProgram("", "", "{}", "release", "", false, (...args) => results.push(args));
  sdk.navigateBackMiniProgram("{}", (...args) => results.push(args));
  sdk.exitMiniProgram((...args) => results.push(args));
  sdk.restartMiniProgram("pages/index/index", (...args) => results.push(args));

  assert.deepEqual(results, [
    ["navigateToMiniProgram", false, "", "wx.navigateToMiniProgram is not supported"],
    ["navigateBackMiniProgram", false, "", "wx.navigateBackMiniProgram is not supported"],
    ["exitMiniProgram", false, "", "wx.exitMiniProgram is not supported"],
    ["restartMiniProgram", false, "", "wx.restartMiniProgram is not supported"],
  ]);
}

async function testCloudStorageAndOpenDataWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const results = [];

  sdk.setUserCloudStorage("{}", (...args) => results.push(args));
  sdk.removeUserCloudStorage("[]", (...args) => results.push(args));
  sdk.getUserCloudStorageKeys((...args) => results.push(args));
  sdk.getUserCloudStorage("[]", (...args) => results.push(args));
  sdk.getFriendCloudStorage("[]", (...args) => results.push(args));
  sdk.getGroupCloudStorage("[]", "", "", (...args) => results.push(args));

  assert.equal(sdk.postOpenDataContextMessage("{}", "offscreenCanvas"), false);
  assert.deepEqual(results, [
    ["setUserCloudStorage", false, "", "wx.setUserCloudStorage is not supported"],
    ["removeUserCloudStorage", false, "", "wx.removeUserCloudStorage is not supported"],
    ["getUserCloudStorageKeys", false, "", "wx.getUserCloudStorageKeys is not supported"],
    ["getUserCloudStorage", false, "", "wx.getUserCloudStorage is not supported"],
    ["getFriendCloudStorage", false, "", "wx.getFriendCloudStorage is not supported"],
    ["getGroupCloudStorage", false, "", "wx.getGroupCloudStorage is not supported"],
  ]);
}

async function testCustomerServiceAndSubscribeWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const customerResults = [];
  const subscribeResults = [];

  sdk.openCustomerServiceConversation("", false, "", "", "", (...args) => customerResults.push(args));
  sdk.requestSubscribeMessage("[]", (...args) => subscribeResults.push(args));
  sdk.requestSubscribeSystemMessage("[]", (...args) => subscribeResults.push(args));

  assert.deepEqual(customerResults, [
    ["openCustomerServiceConversation", false, "", "wx.openCustomerServiceConversation is not supported"],
  ]);
  assert.deepEqual(subscribeResults, [
    ["requestSubscribeMessage", false, "", "wx.requestSubscribeMessage is not supported"],
    ["requestSubscribeSystemMessage", false, "", "wx.requestSubscribeSystemMessage is not supported"],
  ]);
}

async function testUpdateAndMemoryWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();
  const updateEvents = [];

  assert.equal(sdk.startUpdateListener((...args) => updateEvents.push(args)), false);
  assert.deepEqual(updateEvents, [
    ["check", false, "{}", "wx.getUpdateManager is not supported"],
  ]);
  assert.equal(sdk.applyUpdate(), false);
  assert.equal(sdk.onMemoryWarning(() => {}), false);
  assert.equal(sdk.offMemoryWarning(), false);
}

async function testWindowAndUnhandledRejectionWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();

  assert.equal(sdk.onWindowResize(() => {}), false);
  assert.equal(sdk.offWindowResize(), false);
  assert.equal(sdk.onUnhandledRejection(() => {}), false);
  assert.equal(sdk.offUnhandledRejection(), false);
}

async function testScreenWrappersReportUnsupportedMethods() {
  const { GodotSDK } = await loadSdkWithApi({});
  const sdk = new GodotSDK();

  const brightnessResult = await new Promise((resolve) => {
    sdk.getScreenBrightness((...args) => resolve(args));
  });
  const setBrightnessResult = await new Promise((resolve) => {
    sdk.setScreenBrightness(0.5, (...args) => resolve(args));
  });
  const recordingStateResult = await new Promise((resolve) => {
    sdk.getScreenRecordingState((...args) => resolve(args));
  });
  const visualEffectResult = await new Promise((resolve) => {
    sdk.setVisualEffectOnCapture("hidden", (...args) => resolve(args));
  });

  assert.deepEqual(brightnessResult, [0, "", "wx.getScreenBrightness is not supported"]);
  assert.deepEqual(setBrightnessResult, [0.5, false, "wx.setScreenBrightness is not supported"]);
  assert.equal(sdk.onUserCaptureScreen(() => {}), false);
  assert.equal(sdk.offUserCaptureScreen(), false);
  assert.deepEqual(recordingStateResult, ["", "", "wx.getScreenRecordingState is not supported"]);
  assert.equal(sdk.onScreenRecordingStateChanged(() => {}), false);
  assert.equal(sdk.offScreenRecordingStateChanged(), false);
  assert.deepEqual(visualEffectResult, ["hidden", false, "wx.setVisualEffectOnCapture is not supported"]);
}

await testBridgeInfoUsesTheSelectedDouyinProvider();
await testCallApiUsesSuccessCallback();
await testCallApiReportsUnsupportedMethods();
await testGetPrivacySettingWrapper();
await testRequirePrivacyAuthorizeWrapper();
await testOpenPrivacyContractWrapper();
await testNeedPrivacyAuthorizationListener();
await testPrivacyWrappersReportUnsupportedMethods();
await testSettingAndAuthorizeWrappers();
await testNativeButtonWrappers();
await testDebugLoggingWrappers();
await testAccountInfoWrapper();
await testRuntimeCapabilityWrappers();
await testNetworkWrappers();
await testFileTransferWrappers();
await testSocketTaskWrappers();
await testFileSystemManagerWrapper();
await testSubpackageWrappers();
await testWorkerWrappers();
await testMediaWrappers();
await testCameraWrappers();
await testVideoWrappers();
await testRecorderManagerWrappers();
await testAvailableAudioSourcesWrapper();
await testVideoDecoderAndMediaAudioWrappers();
await testGameRecorderWrappers();
await testInnerAudioWrappers();
await testSensorWrappers();
await testAudioInterruptionWrappers();
await testThemeChangeWrapper();
await testPerformanceWrappers();
await testMiniProgramNavigationWrappers();
await testCloudStorageAndOpenDataWrappers();
await testCustomerServiceAndSubscribeWrappers();
await testBatteryWrappers();
await testUpdateManagerWrapper();
await testMemoryWarningWrapper();
await testWindowResizeWrapper();
await testUnhandledRejectionWrapper();
await testScreenBrightnessWrapper();
await testScreenCaptureAndRecordingWrappers();
await testSettingAndNetworkWrappersReportUnsupportedMethods();
await testNativeButtonWrappersReportUnsupportedMethods();
await testDebugLoggingWrappersReportUnsupportedMethods();
await testFileTransferWrappersReportUnsupportedMethods();
await testSocketTaskWrappersReportUnsupportedMethods();
await testFileSystemManagerWrapperReportsUnsupportedMethods();
await testSubpackageWrappersReportUnsupportedMethods();
await testWorkerWrappersReportUnsupportedMethods();
await testMediaWrappersReportUnsupportedMethods();
await testCameraWrappersReportUnsupportedMethods();
await testVideoWrappersReportUnsupportedMethods();
await testRecorderManagerWrappersReportUnsupportedMethods();
await testAudioSourceVideoDecoderAndMediaAudioWrappersReportUnsupportedMethods();
await testGameRecorderWrappersReportUnsupportedMethods();
await testInnerAudioWrappersReportUnsupportedMethods();
await testRuntimeCapabilityWrappersReportUnsupportedMethods();
await testSensorAndBatteryWrappersReportUnsupportedMethods();
await testAudioInterruptionWrappersReportUnsupportedMethods();
await testThemeAndPerformanceWrappersReportUnsupportedMethods();
await testMiniProgramNavigationWrappersReportUnsupportedMethods();
await testCloudStorageAndOpenDataWrappersReportUnsupportedMethods();
await testCustomerServiceAndSubscribeWrappersReportUnsupportedMethods();
await testUpdateAndMemoryWrappersReportUnsupportedMethods();
await testWindowAndUnhandledRejectionWrappersReportUnsupportedMethods();
await testScreenWrappersReportUnsupportedMethods();

console.log("sdk_bridge.test.mjs: ok");
