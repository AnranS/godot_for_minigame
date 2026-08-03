import { readFile, writeFile } from "node:fs/promises";

const sourceUrl = new URL("../../addons/godot_mini_game/MiniGameSDK.gd", import.meta.url);
const outputUrl = new URL("../app/api/api-data.generated.ts", import.meta.url);

const categories = [
  { id: "bridge", title: "Bridge 运行时", titleEn: "Bridge runtime", summary: "版本化 JS/GDScript 桥接身份、ABI 握手与初始化状态。", platform: "dual" },
  { id: "storage", title: "本地存储", titleEn: "Storage", summary: "同步读写小游戏本地键值存储。", platform: "bridge" },
  { id: "auth", title: "登录与会话", titleEn: "Authentication", summary: "登录、会话校验与用户资料。", platform: "bridge" },
  { id: "privacy", title: "隐私授权", titleEn: "Privacy", summary: "隐私协议查询、授权和隐私弹窗回调。", platform: "wechat" },
  { id: "authorization", title: "授权与账号", titleEn: "Authorization", summary: "系统授权范围、设置页与账号信息。", platform: "wechat-docs" },
  { id: "native-buttons", title: "原生按钮", titleEn: "Native buttons", summary: "用户信息、设置和游戏圈等原生按钮。", platform: "wechat-docs" },
  { id: "debug", title: "调试与日志", titleEn: "Debug logging", summary: "平台调试开关、日志管理器和实时日志。", platform: "wechat-docs" },
  { id: "share", title: "分享", titleEn: "Share", summary: "主动分享与分享菜单控制。", platform: "bridge" },
  { id: "ads", title: "广告", titleEn: "Ads", summary: "激励视频、Banner 与插屏广告生命周期。", platform: "bridge" },
  { id: "payment", title: "支付", titleEn: "Payment", summary: "按 Provider 显式映射的小游戏支付请求与结果；参数不可跨宿主复用。", platform: "provider-specific" },
  { id: "tiktok-missions", title: "TikTok 入口任务", titleEn: "TikTok missions", summary: "桌面快捷方式、入口任务与奖励领取状态。", platform: "tiktok" },
  { id: "input", title: "振动与键盘", titleEn: "Input", summary: "设备振动和平台原生键盘。", platform: "bridge" },
  { id: "http", title: "HTTP 与文件传输", titleEn: "HTTP & transfer", summary: "网络请求、文件下载与上传。", platform: "dual" },
  { id: "websocket", title: "WebSocket", titleEn: "WebSocket", summary: "长连接、消息发送和连接事件。", platform: "dual" },
  { id: "filesystem", title: "文件系统", titleEn: "File system", summary: "小游戏沙盒文件系统的常用操作与通用桥接。", platform: "dual" },
  { id: "subpackages", title: "分包加载", titleEn: "Subpackages", summary: "加载与预下载资源分包并监听进度。", platform: "dual" },
  { id: "worker", title: "Worker", titleEn: "Worker", summary: "创建后台 Worker、通信与终止。", platform: "wechat-docs" },
  { id: "media", title: "图片与媒体", titleEn: "Media & images", summary: "选择、预览、保存和压缩图片或媒体。", platform: "wechat-docs" },
  { id: "camera", title: "相机", titleEn: "Camera", summary: "相机实例、拍照、录像、缩放和帧监听。", platform: "wechat-docs" },
  { id: "video", title: "视频组件", titleEn: "Video", summary: "视频实例的播放、定位、全屏和事件。", platform: "wechat-docs" },
  { id: "recorder", title: "录音管理器", titleEn: "Recorder", summary: "录音管理器的创建、录制、暂停与恢复。", platform: "wechat-docs" },
  { id: "media-audio", title: "解码与媒体音频", titleEn: "Decoder & media audio", summary: "音频源、VideoDecoder 与 MediaAudioPlayer。", platform: "wechat-docs" },
  { id: "game-recorder", title: "游戏录屏", titleEn: "Game recorder", summary: "游戏录屏、剪辑操作与录屏分享按钮。", platform: "wechat-docs" },
  { id: "inner-audio", title: "InnerAudio", titleEn: "Inner audio", summary: "背景音频上下文的播放、定位、属性与事件。", platform: "bridge" },
  { id: "network-status", title: "网络状态", titleEn: "Network status", summary: "读取网络类型并监听网络变化。", platform: "dual" },
  { id: "sensors", title: "传感器与电量", titleEn: "Sensors & battery", summary: "加速度、陀螺仪、罗盘、设备方向和电量。", platform: "wechat-docs" },
  { id: "audio-events", title: "音频中断", titleEn: "Audio interruption", summary: "监听系统级音频中断与恢复。", platform: "wechat-docs" },
  { id: "performance", title: "主题与性能", titleEn: "Theme & performance", summary: "主题变化、性能条目与性能上报。", platform: "wechat-docs" },
  { id: "app-control", title: "小程序跳转", titleEn: "App control", summary: "小程序跳转、返回、退出与重启。", platform: "wechat-docs" },
  { id: "cloud-data", title: "托管数据与开放域", titleEn: "Cloud & open data", summary: "用户、好友、群托管数据与开放数据域消息。", platform: "wechat" },
  { id: "service", title: "客服与订阅", titleEn: "Service & subscribe", summary: "客服会话与一次性订阅消息。", platform: "wechat-docs" },
  { id: "runtime", title: "更新与运行时", titleEn: "Update & runtime", summary: "更新管理、内存告警、窗口和运行时错误。", platform: "wechat-docs" },
  { id: "screen-capture", title: "屏幕与录屏状态", titleEn: "Screen & capture", summary: "亮度、截屏、系统录屏状态和捕获效果。", platform: "wechat-docs" },
  { id: "system", title: "系统信息", titleEn: "System information", summary: "能力探测、设备、窗口、启动参数和安全区。", platform: "bridge" },
  { id: "generic", title: "通用平台桥接", titleEn: "Generic bridge", summary: "调用尚未封装的平台 API，并用统一信号接收结果。", platform: "dual" },
  { id: "native-ui", title: "剪贴板与原生 UI", titleEn: "Clipboard & native UI", summary: "剪贴板、常亮、Toast、Loading 和 Modal。", platform: "bridge" },
  { id: "lifecycle", title: "应用生命周期", titleEn: "Lifecycle", summary: "前后台切换，以及宿主实际暴露时的 JavaScript 运行时错误事件。", platform: "bridge" },
];

const sectionCategory = new Map([
  ["Storage (synchronous)", "storage"],
  ["Auth / Login", "auth"],
  ["Privacy Authorization", "privacy"],
  ["Settings / Authorization / Account", "authorization"],
  ["Native Buttons", "native-buttons"],
  ["Debug Logging", "debug"],
  ["Share", "share"],
  ["Rewarded Video Ad", "ads"],
  ["Banner Ad", "ads"],
  ["Interstitial Ad", "ads"],
  ["Payment", "payment"],
  ["TikTok Shortcut / Entrance Missions", "tiktok-missions"],
  ["Vibration", "input"],
  ["Keyboard", "input"],
  ["Network / HTTP", "http"],
  ["Media / Images", "media"],
  ["Camera", "camera"],
  ["Video", "video"],
  ["Recorder Manager", "recorder"],
  ["Audio sources / VideoDecoder / MediaAudioPlayer", "media-audio"],
  ["Game Recorder", "game-recorder"],
  ["Inner Audio", "inner-audio"],
  ["Network Status", "network-status"],
  ["Sensors / Battery", "sensors"],
  ["Audio Interruption", "audio-events"],
  ["Theme / Performance", "performance"],
  ["Mini Program Navigation / App Control", "app-control"],
  ["User Cloud Storage / Open Data Context", "cloud-data"],
  ["Customer Service / Subscribe Message", "service"],
  ["Update Manager / Memory Warning", "runtime"],
  ["Window / Runtime Error Events", "runtime"],
  ["Screen Brightness / Capture / Recording", "screen-capture"],
  ["System Info", "system"],
  ["Generic platform API bridge", "generic"],
  ["Lifecycle", "lifecycle"],
  ["Clipboard", "native-ui"],
  ["Screen", "native-ui"],
  ["Toast / Modal (platform native UI)", "native-ui"],
]);

function splitTopLevel(input) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote && input[index - 1] !== "\\") quote = "";
      continue;
    }
    if (char === "\"" || char === "'") quote = char;
    else if ("([{<".includes(char)) depth += 1;
    else if (")]}>".includes(char)) depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(input.slice(start, index).trim());
      start = index + 1;
    }
  }
  const tail = input.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function parseParameter(raw) {
  let declaration = raw;
  let defaultValue = "";
  let depth = 0;
  let quote = "";
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (quote) {
      if (char === quote && raw[index - 1] !== "\\") quote = "";
      continue;
    }
    if (char === "\"" || char === "'") quote = char;
    else if ("([{<".includes(char)) depth += 1;
    else if (")]}>".includes(char)) depth -= 1;
    else if (char === "=" && depth === 0) {
      declaration = raw.slice(0, index).trim();
      defaultValue = raw.slice(index + 1).trim();
      break;
    }
  }
  const colon = declaration.indexOf(":");
  return {
    name: (colon === -1 ? declaration : declaration.slice(0, colon)).trim(),
    type: (colon === -1 ? "Variant" : declaration.slice(colon + 1)).trim(),
    defaultValue,
  };
}

function refineMethodCategory(name, category) {
  if (category !== "http") return category;
  if (name === "call_file_system" || name.startsWith("file_system_")) return "filesystem";
  if (name.includes("subpackage")) return "subpackages";
  if (name.startsWith("worker_" ) || name === "create_worker") return "worker";
  if (name.includes("socket")) return "websocket";
  return "http";
}

function categoryForSignal(name) {
  const rules = [
    [/^bridge_/, "bridge"],
    [/^(login_|session_|user_info_)/, "auth"],
    [/^privacy_/, "privacy"],
    [/^(setting_|authorization_)/, "authorization"],
    [/^native_button_/, "native-buttons"],
    [/^debug_/, "debug"],
    [/^(ad_|rewarded_|interstitial_)/, "ads"],
    [/^payment_/, "payment"],
    [/^tiktok_mission_/, "tiktok-missions"],
    [/^keyboard_/, "input"],
    [/^(http_|file_transfer_)/, "http"],
    [/^socket_/, "websocket"],
    [/^file_system_/, "filesystem"],
    [/^subpackage_/, "subpackages"],
    [/^worker_/, "worker"],
    [/^media_result$/, "media"],
    [/^camera_/, "camera"],
    [/^video_(operation|event)/, "video"],
    [/^(recorder_|available_audio_)/, "recorder"],
    [/^(video_decoder_|media_audio_)/, "media-audio"],
    [/^game_recorder_/, "game-recorder"],
    [/^inner_audio_/, "inner-audio"],
    [/^network_/, "network-status"],
    [/^(sensor_|accelerometer_|gyroscope_|compass_|device_motion_|battery_)/, "sensors"],
    [/^audio_interruption$/, "audio-events"],
    [/^theme_/, "performance"],
    [/^mini_program_/, "app-control"],
    [/^cloud_storage_/, "cloud-data"],
    [/^(customer_service_|subscribe_message_)/, "service"],
    [/^(update_|memory_warning|window_resized|unhandled_rejection)/, "runtime"],
    [/^(screen_|user_capture_|visual_effect_)/, "screen-capture"],
    [/^clipboard_/, "native-ui"],
    [/^modal_/, "native-ui"],
    [/^generic_api_/, "generic"],
    [/^app_/, "lifecycle"],
  ];
  return rules.find(([pattern]) => pattern.test(name))?.[1] ?? "generic";
}

const source = await readFile(sourceUrl, "utf8");
const lines = source.split(/\r?\n/);
const methods = [];
const signals = [];
let section = "";

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  const sectionMatch = line.match(/^# ── (.+?) ─/);
  if (sectionMatch) section = sectionMatch[1].trim();

  const signalMatch = line.match(/^signal\s+([A-Za-z0-9_]+)\((.*)\)$/);
  if (signalMatch) {
    const [, name, parameterText] = signalMatch;
    signals.push({
      name,
      signature: `${name}(${parameterText})`,
      parameters: splitTopLevel(parameterText).map(parseParameter),
      category: categoryForSignal(name),
      line: index + 1,
    });
    continue;
  }

  if (!/^func\s+[a-z][A-Za-z0-9_]*\(/.test(line)) continue;
  const startLine = index + 1;
  const signatureLines = [line.trim()];
  while (!signatureLines.at(-1).endsWith(":") && index + 1 < lines.length) {
    index += 1;
    signatureLines.push(lines[index].trim());
  }
  const normalized = signatureLines.join(" ").replace(/\s+/g, " ").replace(/,$/, "");
  const match = normalized.match(/^func\s+([A-Za-z0-9_]+)\((.*)\)(?:\s*->\s*([^:]+))?:$/);
  if (!match) throw new Error(`Unable to parse public method at line ${startLine}: ${normalized}`);

  const [, name, parameterText, returnType = "Variant"] = match;
  const rawCategory = sectionCategory.get(section) ?? "generic";
  methods.push({
    name,
    signature: `${name}(${parameterText}) -> ${returnType.trim()}`,
    parameters: splitTopLevel(parameterText).map(parseParameter),
    returnType: returnType.trim(),
    category: refineMethodCategory(name, rawCategory),
    line: startLine,
  });
}

const usedCategories = categories.filter((category) =>
  methods.some((method) => method.category === category.id) ||
  signals.some((signal) => signal.category === category.id),
);

const generated = `// Generated by scripts/generate-api-data.mjs. Do not edit by hand.\n` +
  `export const apiCategories = ${JSON.stringify(usedCategories, null, 2)} as const;\n\n` +
  `export const apiMethods = ${JSON.stringify(methods, null, 2)} as const;\n\n` +
  `export const apiSignals = ${JSON.stringify(signals, null, 2)} as const;\n`;

await writeFile(outputUrl, generated, "utf8");
console.log(`Generated ${methods.length} methods and ${signals.length} signals.`);
