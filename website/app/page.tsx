"use client";

import { Fragment, useEffect, useState } from "react";
import { apiCounts } from "./api-counts.generated";
import { releaseData } from "./site-data.generated";
import { sitePath } from "./site-path";

type Language = "zh" | "en";

const REPO = "https://github.com/AnranS/godot_for_minigame";
const RELEASE = `${REPO}/releases/latest`;
const VERSION = releaseData.pluginVersion;
const BRIDGE_ABI = releaseData.bridgeAbi;
const EMSCRIPTEN_VERSION = releaseData.bundled.emscriptenVersion;
const PACKAGE_FILENAME = "godot_mini_game_vX.Y.Z.zip";
const METHODS = apiCounts.methods;
const SIGNALS = apiCounts.signals;

const shortVersion = (version: string) => version.replace(/\.stable$/, "");

// support-matrix.json lists certified editors oldest first; show newest first.
const CERTIFIED = [...releaseData.certified].reverse().map((row) => ({
  version: shortVersion(row.godotVersion),
  commit: row.godotCommit.slice(0, 9),
  bundled: row.template.source === "bundled",
  releaseUrl: "releaseTag" in row.template ? `${REPO}/releases/tag/${row.template.releaseTag}` : RELEASE,
}));
const LATEST = CERTIFIED[0].version;
const VERSION_LIST = releaseData.certified.map((row) => shortVersion(row.godotVersion)).join(" · ");
const BUNDLED_VERSION = shortVersion(releaseData.bundled.godotVersion);

const platformIcons = [
  ["/wechat.svg", "WeChat"],
  ["/douyin.svg", "Douyin"],
  ["/tiktok.svg", "TikTok"],
] as const;

const copy = {
  zh: {
    nav: ["核心优势", "版本支持", "SDK 能力", "API 参考", "快速开始", "接入指引"],
    language: "EN",
    menu: "打开导航",
    badgeTag: "新",
    badge: `已支持 Godot ${LATEST}`,
    eyebrow: "Godot 4.x 小游戏导出插件 · 开源",
    heroA: "把 Godot 游戏，",
    heroB: "发布到微信、|抖音与 TikTok",
    heroBody:
      "在 Godot 编辑器里**一键导出**小游戏工程。引擎、适配层与 SDK 全部内置，**不用装 Node.js、Emscripten，也不用下载 Web 导出模板**。",
    download: `下载 v${VERSION}`,
    quickStart: "快速开始教程",
    supports: "已支持",
    shotsCaption: "真实截图：Godot 编辑器中的小游戏导出面板，以及导出结果在微信开发者工具模拟器中运行。",
    shotEditorAlt: "Godot 编辑器右侧的小游戏导出面板，已选择微信小游戏并显示兼容模板就绪",
    shotPhoneAlt: "导出的 Godot 示例项目在微信开发者工具模拟器中运行",
    shotDone: "导出完成",
    shotDoneDetail: "已在微信开发者工具中运行",
    highlights: [
      ["0", "额外依赖", "不装 Node.js、Emscripten、Brotli，也不下载 Web 导出模板"],
      ["3", "小游戏平台", "微信、抖音与 TikTok，同一个 Godot 项目导出"],
      [String(METHODS), "SDK 方法", `另有 ${SIGNALS} 个信号，调用前先检测宿主能力`],
      [String(CERTIFIED.length), "Godot 版本", `${VERSION_LIST}，引擎模板与编辑器精确匹配`],
    ],
    featuresKicker: "核心优势",
    featuresTitle: "小游戏导出里最麻烦的部分，|插件已经做好",
    featuresBody: "编译引擎、适配宿主、生成平台配置，这些容易出错又和游戏本身无关的工作，都收进了一个 Godot 面板。",
    exportTitle: "一键导出",
    exportBody: "选平台、填 AppID，点一次导出。插件生成资源包、引擎、JS 适配层和平台配置，输出目录直接用开发者工具打开。",
    exportPoints: [
      "不用装 Node.js、Emscripten 或 Brotli",
      "不用下载 Godot 官方 Web 导出模板",
      "按平台生成 game.json：抖音用 **subPackages**，微信与 TikTok 用 **subpackages**",
    ],
    exportShotAlt: "导出完成后的小游戏导出面板，日志显示导出成功",
    engineTitle: "真机能跑的引擎",
    engineBody:
      "官方 Web 模板依赖 SIMD、WASM 异常和多线程，小游戏真机的 WebAssembly 不支持这些特性，通常在编译阶段就会失败。内置引擎把它们全部关闭，并在导出时注入宿主兼容补丁。",
    enginePoints: ["wasm_simd=no", "threads=no", "无 WASM 异常", "Brotli ≈ 6 MB"],
    sdkCardTitle: "一套 SDK，三个宿主",
    sdkCardBody: "MiniGameSDK 自动注册为 Autoload。同名能力先检测宿主再调用，在编辑器里调用也不会报错。",
    sdkUnits: ["个方法", "个信号"],
    safeTitle: "放心重复导出",
    safeBody: "先在暂存目录生成并校验全部文件，只替换插件管理的路径，输出目录里你自己的文件原样保留。",
    safeFiles: [
      ["engine/", "替换", false],
      ["game.js", "替换", false],
      ["my-notes.md", "保留", true],
    ],
    versionsKicker: "版本支持",
    versionsTitle: "按 Godot 版本|精确匹配引擎",
    versionsBody:
      "每份引擎模板只对应一个 Godot 版本。版本号、源码提交或工具链任意一项对不上，导出会在预检阶段停下，避免引擎和编辑器不一致导致的运行时错误。",
    versionsNote: `所有模板都使用 Emscripten ${EMSCRIPTEN_VERSION}、release 构建，单线程、不含 SIMD，Bridge ABI ${BRIDGE_ABI}。非内置的已认证版本，导出面板会提示一键下载并自动校验。`,
    versionsCustom: "其它版本：编译自定义模板",
    versionsGuide: "引擎版本说明",
    versionLatest: "最新",
    versionBundled: "随插件内置",
    versionRelease: "下载模板",
    versionTested: "三平台导出测试",
    flowKicker: "从项目到开发者工具",
    flowTitle: "四步完成第一次导出",
    flowBody: "不需要额外的编译环境。第一次接入，建议跟着快速开始教程走一遍。",
    steps: [
      ["01", "下载插件", "从 Release 的 Assets 下载插件压缩包，不要下载 GitHub 自动生成的源码包。", PACKAGE_FILENAME],
      ["02", "解压并启用", "解压到项目根目录，在“项目设置 → 插件”中启用 Godot Mini Game Export。", "res://addons/godot_mini_game/"],
      ["03", "添加 Web 预设", "在“项目 → 导出”中添加一个 Web 预设，名称随意，不需要下载官方导出模板。", "项目 → 导出 → Web"],
      ["04", "导出并运行", "在小游戏导出面板选择平台，填写 AppID 和输出目录，导出后用开发者工具打开。", "MiniGameExport → 导出小游戏"],
    ],
    flowGuide: "带截图的快速开始",
    architectureTitle: "一套 Godot 工程，|分流到三端运行时",
    architectureBody:
      "导出器把游戏内容、认证引擎与共享适配层装配成平台工程，再交给微信、抖音和 TikTok 运行时。",
    architectureCaption:
      "Godot Mini Game 架构：Godot 4.x 项目进入导出器，导出器装配游戏资源包、认证引擎模板、共享浏览器适配与平台桥，最后分流到微信、抖音和 TikTok 运行时。",
    architectureProject: ["Godot 4.x 项目", "场景、脚本、资源和 Web 导出预设"],
    architectureExporter: ["Godot Mini Game Exporter", "一次导出事务，完成资源打包、引擎选择与平台装配。"],
    architectureModules: [
      ["PACK", "游戏资源包", "把场景、脚本与资源打包为 Godot 资源包。", "engine/godot.zip"],
      ["ENGINE", "认证引擎模板", `按编辑器版本精确匹配，锁定 Emscripten ${EMSCRIPTEN_VERSION} 与校验和。`, "godot.wasm.br"],
      ["BRIDGE", "共享浏览器适配与平台桥", "浏览器兼容层统一输入、网络、音频和 MiniGameSDK 能力。", "adapter.js + PlatformRuntime"],
    ],
    architectureRuntimeTitle: "平台运行时",
    architectureRuntimeBody: "按目标注入入口、配置与分包规则。",
    architectureRuntimes: [
      ["WeChat", "微信小游戏", "/wechat.svg"],
      ["Douyin", "抖音小游戏", "/douyin.svg"],
      ["TikTok", "TikTok Mini Game", "/tiktok.svg"],
    ],
    sdkKicker: "MiniGameSDK",
    sdkTitle: "小游戏原生能力，|用 GDScript 调用",
    sdkBody: `插件自动注册 MiniGameSDK Autoload，提供 **${METHODS} 个方法、${SIGNALS} 个信号**。同名能力先检测宿主再调用，支付等平台特有能力按平台映射。`,
    sdkNote: "API 页列出的是完整桥接接口，不代表每个宿主都支持全部方法。",
    apiGroups: ["登录鉴权", "广告支付", "本地与云存储", "媒体与录屏", "网络与 WebSocket", "传感器", "分享与订阅", "文件系统"],
    codeLabel: "GDScript · 激励视频广告",
    copyCode: "复制代码",
    copied: "已复制",
    apiReference: "查看完整 API 参考",
    faqTitle: "常见问题",
    faqs: [
      ["支持哪些 Godot 版本？", `目前认证 ${VERSION_LIST}。${BUNDLED_VERSION} 的模板随插件内置；其它已认证版本在导出面板点“下载模板”即可。不在列表里的版本，可以按使用文档编译一份完全匹配的模板。`],
      ["需要自己安装 Emscripten 吗？", "日常使用不需要。Release 已带预编译引擎；只有构建自定义 Godot 版本模板时才需要完整编译环境。"],
      ["为什么不能直接使用 Godot 官方 Web 模板？", "小游戏真机的 WXWebAssembly 对 SIMD、异常处理 Tag 与线程支持有限，官方模板可能在真机编译阶段失败。"],
      ["导出后还需要做什么？", "用对应平台工具完成应用标识、域名、隐私、审核与真机验证配置。"],
      ["支持分包吗？", "支持主包与引擎分包拆分：主包只放启动代码，引擎与游戏资源放在 engine 分包并在启动时自动加载，SDK 也提供 load_subpackage() 与 pre_download_subpackage()。目前每次导出只生成一个资源包，暂不支持把游戏资源拆成多个自定义分包。"],
      ["中文显示成方块怎么办？", "小游戏环境没有系统字体，Godot 内置字体只含拉丁字母。在项目设置 → GUI → 主题 → 自定义字体里指定一个中文字体，并先按使用文档裁剪子集，避免包体过大。导出时如果项目没有设置字体，日志也会提示。"],
      ["微信开发者工具停在 33% 怎么办？", "v0.3.0 之前的插件版本，适配层会覆盖开发者工具加载分包所用的全局对象，引擎分包因此一直没有回调；升级到 v0.3.0 或更新版本后重新导出即可。如果报 loadSubpackage:fail module not found，通常是项目以游客模式运行，请换成当前账号有开发权限的 AppID。"],
    ],
    finalTitle: "你的 Godot 游戏，|下一站是小游戏。",
    finalBody: "开源、透明、面向真实设备。现在就完成第一次导出。",
    footer: "为使用 Godot 的小游戏开发者打造。",
    copyright: "Godot Mini Game · MIT License",
    notAffiliated: "非 Godot 官方关联项目",
  },
  en: {
    nav: ["Highlights", "Versions", "SDK", "API Reference", "Quick Start", "Guide"],
    language: "中文",
    menu: "Open navigation",
    badgeTag: "New",
    badge: `Godot ${LATEST} supported`,
    eyebrow: "Open-source mini-game exporter for Godot 4.x",
    heroA: "Ship your Godot game",
    heroB: "to WeChat, Douyin & TikTok",
    heroBody:
      "Export a mini-game project **in one click** from the Godot editor. The engine, adapters, and SDK are bundled, so there is **no Node.js, Emscripten, or Web export template to install**.",
    download: `Download v${VERSION}`,
    quickStart: "Quick start guide",
    supports: "Supports",
    shotsCaption: "Real screenshots: the Mini Game Export dock in the Godot editor, and the exported game running in the WeChat DevTools simulator.",
    shotEditorAlt: "The Mini Game Export dock in the Godot editor with WeChat selected and the compatible template ready",
    shotPhoneAlt: "The exported Godot demo running in the WeChat DevTools simulator",
    shotDone: "Export complete",
    shotDoneDetail: "Running in WeChat DevTools",
    highlights: [
      ["0", "extra tools", "No Node.js, Emscripten, Brotli, or Web export templates to install"],
      ["3", "platforms", "WeChat, Douyin, and TikTok from one Godot project"],
      [String(METHODS), "SDK methods", `Plus ${SIGNALS} signals, each checked against the host before it runs`],
      [String(CERTIFIED.length), "Godot versions", `${VERSION_LIST}, each with an exactly matched engine`],
    ],
    featuresKicker: "Highlights",
    featuresTitle: "The hard parts of a mini‑game export, already done",
    featuresBody: "Building the engine, adapting to each host, and generating platform configuration are error-prone and unrelated to your game. They now live in one Godot dock.",
    exportTitle: "One-click export",
    exportBody: "Pick a platform, enter the App ID, and export. The plugin writes the pack, engine, JavaScript adapters, and platform configuration into a folder the DevTools open directly.",
    exportPoints: [
      "No Node.js, Emscripten, or Brotli to install",
      "No Godot Web export templates to download",
      "Per-platform game.json: Douyin uses **subPackages**; WeChat and TikTok use **subpackages**",
    ],
    exportShotAlt: "The Mini Game Export dock after an export, with the log reporting success",
    engineTitle: "An engine that runs on devices",
    engineBody:
      "Standard Web templates rely on SIMD, WASM exceptions, and threads. Mini-game WebAssembly on real devices supports none of them, so those builds usually fail to compile. The bundled engine turns them all off and receives host compatibility patches at export time.",
    enginePoints: ["wasm_simd=no", "threads=no", "no WASM exceptions", "Brotli ≈ 6 MB"],
    sdkCardTitle: "One SDK, three hosts",
    sdkCardBody: "MiniGameSDK is registered as an Autoload. Shared names are checked against the host before they run, and calls stay safe inside the editor.",
    sdkUnits: ["methods", "signals"],
    safeTitle: "Safe re-exports",
    safeBody: "Every file is built and validated in a staging folder first. Only paths the plugin owns are replaced; your own files in the output folder are kept.",
    safeFiles: [
      ["engine/", "replaced", false],
      ["game.js", "replaced", false],
      ["my-notes.md", "kept", true],
    ],
    versionsKicker: "Versions",
    versionsTitle: "Engine templates matched to your exact Godot version",
    versionsBody:
      "Each engine template belongs to exactly one Godot version. If the version, source commit, or toolchain differs, the export stops at preflight instead of failing at runtime.",
    versionsNote: `Every template uses Emscripten ${EMSCRIPTEN_VERSION} and a release build: single-threaded, no SIMD, Bridge ABI ${BRIDGE_ABI}. For certified versions that are not bundled, the dock offers a one-click, checksum-verified download.`,
    versionsCustom: "Other versions: build a custom template",
    versionsGuide: "Engine version notes",
    versionLatest: "Latest",
    versionBundled: "Bundled",
    versionRelease: "Get template",
    versionTested: "3-platform export tests",
    flowKicker: "Project to DevTools",
    flowTitle: "Your first export in four steps",
    flowBody: "No build environment needed. For a first run, follow the quick start guide; every step has a screenshot.",
    steps: [
      ["01", "Download", "Get the plugin archive from the Release assets, not GitHub's source archive.", PACKAGE_FILENAME],
      ["02", "Extract & enable", "Extract it into the project root and enable Godot Mini Game Export under Project Settings → Plugins.", "res://addons/godot_mini_game/"],
      ["03", "Add a Web preset", "Add a Web preset in Project → Export with any name. No official export templates needed.", "Project → Export → Web"],
      ["04", "Export & run", "Choose a platform in the dock, enter the App ID and output folder, export, then open it in DevTools.", "MiniGameExport → Export"],
    ],
    flowGuide: "Quick start with screenshots",
    architectureTitle: "One Godot project, routed to three runtimes",
    architectureBody:
      "The exporter assembles game content, a certified engine, and a shared adapter into projects for WeChat, Douyin, and TikTok.",
    architectureCaption:
      "Godot Mini Game architecture: a Godot 4.x project enters the exporter, which assembles the game resource pack, certified engine templates, shared browser adapter, and platform bridge before routing the result to WeChat, Douyin, and TikTok runtimes.",
    architectureProject: ["Godot 4.x project", "Scenes, scripts, assets, and a Web export preset"],
    architectureExporter: ["Godot Mini Game Exporter", "One export transaction packages resources, selects the engine, and assembles the platform project."],
    architectureModules: [
      ["PACK", "Game resource pack", "Package scenes, scripts, and assets into the Godot resource pack.", "engine/godot.zip"],
      ["ENGINE", "Certified engine templates", `Matched to the exact editor version, with Emscripten ${EMSCRIPTEN_VERSION} and checksums pinned.`, "godot.wasm.br"],
      ["BRIDGE", "Shared browser adapter and platform bridge", "Unify input, networking, audio, and MiniGameSDK capabilities.", "adapter.js + PlatformRuntime"],
    ],
    architectureRuntimeTitle: "Platform runtimes",
    architectureRuntimeBody: "Inject the matching entry point, configuration, and subpackage rules.",
    architectureRuntimes: [
      ["WeChat", "WeChat Mini Game", "/wechat.svg"],
      ["Douyin", "Douyin Mini Game", "/douyin.svg"],
      ["TikTok", "TikTok Mini Game", "/tiktok.svg"],
    ],
    sdkKicker: "MiniGameSDK",
    sdkTitle: "Native mini-game APIs, from GDScript",
    sdkBody: `MiniGameSDK is registered as an Autoload with **${METHODS} methods and ${SIGNALS} signals**. Shared names are capability-checked, and payments and other host-specific features use explicit per-platform mappings.`,
    sdkNote: "The API page lists the whole bridge; it is not a promise that every method works on every host.",
    apiGroups: ["Authentication", "Ads & payments", "Local & cloud storage", "Media & recording", "Network & WebSocket", "Sensors", "Share & subscribe", "File system"],
    codeLabel: "GDScript · Rewarded video",
    copyCode: "Copy code",
    copied: "Copied",
    apiReference: "Open the full API reference",
    faqTitle: "Frequently asked questions",
    faqs: [
      ["Which Godot versions are supported?", `${VERSION_LIST} are certified. The ${BUNDLED_VERSION} template ships with the plugin; for the other certified versions, click the download button in the dock. For any other version, build an exactly matching template with the usage guide.`],
      ["Do I need to install Emscripten?", "Not for normal use. Releases include a prebuilt engine. A compiler toolchain is only required when building a custom Godot template."],
      ["Why not use the standard Godot Web template?", "WXWebAssembly on real devices has limited support for SIMD, exception tags, and threads, so a standard template can fail during compilation."],
      ["What happens after export?", "Complete the platform ID, domain, privacy, review, and real-device validation settings in the matching tool."],
      ["Are subpackages supported?", "The main package and engine are split: the main package holds only the bootstrap, while the engine and game resources live in the engine subpackage and load automatically at startup. The SDK also exposes load_subpackage() and pre_download_subpackage(). Each export still produces a single resource pack, so splitting game resources across custom subpackages is not supported yet."],
      ["Why does Chinese text show as boxes?", "Mini-game hosts have no system fonts, and Godot's built-in font only covers Latin text. Set a CJK font in Project Settings → GUI → Theme → Custom Font, subset it first as the usage guide describes, and the export log will remind you when no font is set."],
      ["Why does WeChat DevTools stop at 33%?", "Plugin versions before v0.3.0 replaced globals that DevTools uses to load subpackages, so the engine subpackage never reported completion. Upgrade to v0.3.0 or later and export again. If you see loadSubpackage:fail module not found instead, the project is usually running in tourist mode; use an AppID your account can develop."],
    ],
    finalTitle: "Your Godot game belongs on mini-game platforms.",
    finalBody: "Open source, transparent, and built for real devices. Make your first export today.",
    footer: "Built for mini-game developers who use Godot.",
    copyright: "Godot Mini Game · MIT License",
    notAffiliated: "Not affiliated with the Godot Foundation",
  },
} as const;

const sdkCode = `MiniGameSDK.ad_created.connect(func(type, ok, err):
    if ok:
        MiniGameSDK.show_rewarded_ad()
)

MiniGameSDK.rewarded_ad_result.connect(func(done, err):
    if done:
        give_reward()
)

MiniGameSDK.create_rewarded_ad("your-ad-unit-id")`;

function asset(path: string) {
  return sitePath(path);
}

// Headings mark preferred line breaks with "|"; each phrase stays on one line
// when it fits, so CJK titles do not split in the middle of a word.
function Phrases({ text }: { text: string }) {
  if (!text.includes("|")) return <>{text}</>;
  return <>{text.split("|").map((part, index) => <span className="phrase" key={index}>{part}</span>)}</>;
}

// Renders **bold** segments of a copy string as <strong>.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, index) =>
        index % 2 ? <strong key={index}>{part}</strong> : <Fragment key={index}>{part}</Fragment>,
      )}
    </>
  );
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("zh");
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const t = copy[language];

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  useEffect(() => {
    // Content is visible in the static HTML. Only once this runs are sections
    // below the fold hidden for their scroll-in transition; anything already
    // on screen is marked visible first so it never flickers.
    const nodes = Array.from(document.querySelectorAll(".reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 },
    );
    nodes.forEach((node) => {
      if (node.getBoundingClientRect().top < window.innerHeight) node.classList.add("is-visible");
      else observer.observe(node);
    });
    document.documentElement.classList.add("reveal-ready");
    return () => observer.disconnect();
  }, [language]);

  async function copySnippet() {
    await navigator.clipboard.writeText(sdkCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const docsLink = language === "zh" ? `${REPO}/blob/main/docs/USAGE_zh.md` : `${REPO}/blob/main/docs/USAGE.md`;
  const customTemplateLink = language === "zh"
    ? `${docsLink}#12-编译自定义引擎模板`
    : `${docsLink}#12-building-a-custom-engine-template`;
  const closeMenu = () => setMenuOpen(false);

  return (
    <main>
      <header className="site-header">
        <div className="nav-shell">
          <a className="brand" href="#top" aria-label="Godot Mini Game">
            <span className="brand-mark"><img src={asset("/godot.svg")} alt="" /></span>
            <span>Godot <b>Mini Game</b></span>
          </a>

          <button
            className="mobile-menu"
            type="button"
            aria-label={t.menu}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
          </button>

          <nav className={menuOpen ? "nav-links is-open" : "nav-links"} aria-label="Primary navigation">
            <a href="#features" onClick={closeMenu}>{t.nav[0]}</a>
            <a href="#versions" onClick={closeMenu}>{t.nav[1]}</a>
            <a href="#sdk" onClick={closeMenu}>{t.nav[2]}</a>
            <a href={sitePath("/api/")} onClick={closeMenu}>{t.nav[3]}</a>
            <a href={sitePath("/quick-start/")} onClick={closeMenu}>{t.nav[4]}</a>
            <a href={sitePath("/guide/")} onClick={closeMenu}>{t.nav[5]}</a>
          </nav>

          <div className="nav-actions">
            <button className="language-switch" type="button" onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>{t.language}</button>
            <a className="github-button" href={REPO} target="_blank" rel="noreferrer">GitHub<span>↗</span></a>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid-bg" aria-hidden="true" />
        <div className="hero-glow hero-glow-blue" aria-hidden="true" />
        <div className="hero-glow hero-glow-green" aria-hidden="true" />
        <div className="container hero-layout">
          <div className="hero-copy">
            <a className="status-pill" href="#versions"><b>{t.badgeTag}</b>{t.badge}<i aria-hidden="true">→</i></a>
            <p className="eyebrow">{t.eyebrow}</p>
            <h1>
              <span>{t.heroA}</span>
              <em><Phrases text={t.heroB} /></em>
            </h1>
            <p className="hero-body"><Rich text={t.heroBody} /></p>
            <div className="hero-actions">
              <a className="button button-primary" href={RELEASE} target="_blank" rel="noreferrer">{t.download}<span>↓</span></a>
              <a className="button button-secondary" href={sitePath("/quick-start/")}>{t.quickStart}<span>→</span></a>
            </div>
            <div className="platform-line">
              <span>{t.supports}</span>
              <span className="platform-chip"><img src={asset("/wechat.svg")} alt="" />WeChat</span>
              <span className="platform-chip"><img src={asset("/douyin.svg")} alt="" />Douyin</span>
              <span className="platform-chip"><img src={asset("/tiktok.svg")} alt="" />TikTok</span>
            </div>
          </div>

          <figure className="hero-shots">
            <div className="shot-editor">
              <img src={asset("/screenshots/godot-editor-dock.webp")} alt={t.shotEditorAlt} width={1600} height={812} />
            </div>
            <div className="shot-phone">
              <img src={asset("/screenshots/wechat-simulator.webp")} alt={t.shotPhoneAlt} width={478} height={1023} />
            </div>
            <div className="shot-status" aria-hidden="true">
              <span>✓</span>
              <div><strong>{t.shotDone}</strong><small>{t.shotDoneDetail}</small></div>
            </div>
            <figcaption className="sr-only">{t.shotsCaption}</figcaption>
          </figure>
        </div>

        <div className="container highlight-strip">
          {t.highlights.map(([value, unit, detail]) => (
            <div key={unit}>
              <strong>{value}<small>{unit}</small></strong>
              <p>{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section features-section" id="features">
        <div className="container">
          <div className="split-heading reveal">
            <div><p className="section-kicker">{t.featuresKicker}</p><h2><Phrases text={t.featuresTitle} /></h2></div>
            <p>{t.featuresBody}</p>
          </div>

          <div className="bento">
            <article className="bento-card bento-export reveal">
              <span className="bento-no">01</span>
              <h3>{t.exportTitle}</h3>
              <p>{t.exportBody}</p>
              <ul className="check-list">
                {t.exportPoints.map((point) => <li key={point}><span><Rich text={point} /></span></li>)}
              </ul>
              <div className="export-shot">
                <img src={asset("/screenshots/godot-dock-exported.webp")} alt={t.exportShotAlt} width={600} height={1472} loading="lazy" />
              </div>
            </article>

            <article className="bento-card bento-engine reveal">
              <span className="bento-no">02</span>
              <h3>{t.engineTitle}</h3>
              <p>{t.engineBody}</p>
              <ul className="spec-list">
                {t.enginePoints.map((point) => <li key={point}><b aria-hidden="true">✓</b>{point}</li>)}
              </ul>
            </article>

            <article className="bento-card bento-sdk reveal">
              <span className="bento-no">03</span>
              <h3>{t.sdkCardTitle}</h3>
              <div className="sdk-figures">
                <div><strong>{METHODS}</strong><span>{t.sdkUnits[0]}</span></div>
                <div><strong>{SIGNALS}</strong><span>{t.sdkUnits[1]}</span></div>
              </div>
              <p>{t.sdkCardBody}</p>
            </article>

            <article className="bento-card bento-safe reveal">
              <span className="bento-no">04</span>
              <h3>{t.safeTitle}</h3>
              <p>{t.safeBody}</p>
              <ul className="file-list">
                {t.safeFiles.map(([name, state, kept]) => (
                  <li key={name} className={kept ? "is-kept" : undefined}><code>{name}</code><span>{state}</span></li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="section versions-section" id="versions">
        <div className="container versions-layout">
          <div className="versions-copy reveal">
            <p className="section-kicker">{t.versionsKicker}</p>
            <h2><Phrases text={t.versionsTitle} /></h2>
            <p>{t.versionsBody}</p>
            <div className="template-note"><span>i</span>{t.versionsNote}</div>
            <div className="versions-links">
              <a className="sdk-api-link" href={customTemplateLink} target="_blank" rel="noreferrer">{t.versionsCustom}<span>↗</span></a>
              <a className="sdk-api-link" href={sitePath("/guide/#engine")}>{t.versionsGuide}<span>→</span></a>
            </div>
          </div>

          <ul className="version-list reveal">
            {CERTIFIED.map((row, index) => (
              <li key={row.version} className={index === 0 ? "is-latest" : undefined}>
                <div>
                  <div className="version-name">
                    <strong>{row.version}</strong>
                    <small>stable</small>
                    {index === 0 ? <em>{t.versionLatest}</em> : null}
                  </div>
                  <div className="version-meta">
                    <code>commit {row.commit}</code>
                    <span className="version-platforms">
                      {platformIcons.map(([icon, name]) => <img key={name} src={asset(icon)} alt={name} />)}
                      {t.versionTested}
                    </span>
                  </div>
                </div>
                {row.bundled
                  ? <span className="version-source is-bundled">{t.versionBundled}</span>
                  : <a className="version-source" href={row.releaseUrl} target="_blank" rel="noreferrer">{t.versionRelease}<span>↗</span></a>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section workflow-section" id="workflow">
        <div className="container">
          <div className="section-heading reveal">
            <p className="section-kicker">{t.flowKicker}</p>
            <h2>{t.flowTitle}</h2>
            <p>{t.flowBody}</p>
          </div>
          <div className="steps-grid">
            {t.steps.map(([number, title, body, code]) => (
              <article className="step-card reveal" key={number}>
                <div className="step-number">{number}</div>
                <div className="step-connector"><span /></div>
                <h3>{title}</h3>
                <p>{body}</p>
                <code>{code}</code>
              </article>
            ))}
          </div>
          <div className="workflow-actions reveal">
            <a className="button button-primary" href={sitePath("/quick-start/")}>{t.flowGuide}<span>→</span></a>
            <a className="button button-secondary" href={RELEASE} target="_blank" rel="noreferrer">{t.download}<span>↓</span></a>
          </div>
        </div>
      </section>

      <section className="section architecture-section" id="architecture" aria-labelledby="architecture-title">
        <div className="container">
          <header className="architecture-heading reveal">
            <h2 id="architecture-title"><Phrases text={t.architectureTitle} /></h2>
            <p>{t.architectureBody}</p>
          </header>

          <figure className="architecture-diagram reveal" aria-labelledby="architecture-title architecture-caption">
            <figcaption className="sr-only" id="architecture-caption">{t.architectureCaption}</figcaption>

            <ol className="architecture-path">
              <li className="architecture-project-node">
                <article className="architecture-project">
                  <span className="architecture-node-type">SOURCE</span>
                  <div className="architecture-project-mark" aria-hidden="true">
                    <img src={asset("/godot.svg")} alt="" />
                  </div>
                  <h3>{t.architectureProject[0]}</h3>
                  <p>{t.architectureProject[1]}</p>
                  <code>project.godot</code>
                </article>
              </li>

              <li className="architecture-exporter-node">
                <article className="architecture-exporter">
                  <header className="architecture-exporter-heading">
                    <div>
                      <span className="architecture-node-type">EXPORTER</span>
                      <h3>{t.architectureExporter[0]}</h3>
                      <code>exporter.gd</code>
                    </div>
                    <p>{t.architectureExporter[1]}</p>
                  </header>
                  <div className="architecture-module-grid">
                    {t.architectureModules.map(([label, title, body, target], index) => (
                      <section className={`architecture-module architecture-module-${index + 1}`} key={title}>
                        <span>{label}</span>
                        <h4>{title}</h4>
                        <p>{body}</p>
                        <code>{target}</code>
                      </section>
                    ))}
                  </div>
                </article>
              </li>

              <li className="architecture-runtime-node">
                <section className="architecture-runtime-group" aria-labelledby="architecture-runtime-title">
                  <header>
                    <span className="architecture-node-type">OUTPUT</span>
                    <h3 id="architecture-runtime-title">{t.architectureRuntimeTitle}</h3>
                    <p>{t.architectureRuntimeBody}</p>
                  </header>
                  <ul className="architecture-runtime-list" aria-label={t.architectureRuntimeTitle}>
                    {t.architectureRuntimes.map(([name, detail, icon]) => (
                      <li key={name}>
                        <span className="architecture-runtime-mark"><img src={asset(icon)} alt="" /></span>
                        <span><strong>{name}</strong><small>{detail}</small></span>
                        <i aria-hidden="true">→</i>
                      </li>
                    ))}
                  </ul>
                </section>
              </li>
            </ol>
          </figure>
        </div>
      </section>

      <section className="section sdk-section" id="sdk">
        <div className="container sdk-layout">
          <div className="code-window reveal">
            <div className="code-bar"><div><span /><span /><span /></div><strong>{t.codeLabel}</strong><button type="button" onClick={copySnippet}>{copied ? `✓ ${t.copied}` : t.copyCode}</button></div>
            <pre><code>{sdkCode}</code></pre>
            <div className="code-status"><span>●</span> MiniGameSDK Autoload <b>READY</b></div>
          </div>
          <div className="sdk-copy reveal">
            <p className="section-kicker">{t.sdkKicker}</p>
            <h2><Phrases text={t.sdkTitle} /></h2>
            <p><Rich text={t.sdkBody} /></p>
            <p className="sdk-note">{t.sdkNote}</p>
            <div className="api-cloud">
              {t.apiGroups.map((group, index) => <span key={group}><i>{["AUTH", "ADS", "DATA", "MEDIA", "NET", "SENSOR", "SHARE", "FS"][index]}</i>{group}</span>)}
            </div>
            <a className="sdk-api-link" href={sitePath("/api/")}>{t.apiReference}<span>→</span></a>
          </div>
        </div>
      </section>

      <section className="section faq-section">
        <div className="container faq-layout">
          <div className="faq-heading reveal"><p className="section-kicker">FAQ</p><h2>{t.faqTitle}</h2></div>
          <div className="faq-list reveal">
            {t.faqs.map(([question, answer], index) => (
              <details key={question} open={index === 0}>
                <summary><span>{question}</span><i>+</i></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="final-grid" aria-hidden="true" />
        <div className="container final-content reveal">
          <div className="final-logos"><span><img src={asset("/godot.svg")} alt="Godot" /></span><i>→</i><span><img src={asset("/wechat.svg")} alt="WeChat" /></span><span><img src={asset("/douyin.svg")} alt="Douyin" /></span><span><img src={asset("/tiktok.svg")} alt="TikTok" /></span></div>
          <h2><Phrases text={t.finalTitle} /></h2>
          <p>{t.finalBody}</p>
          <div className="hero-actions">
            <a className="button button-light" href={RELEASE} target="_blank" rel="noreferrer">{t.download}<span>↓</span></a>
            <a className="button button-dark-outline" href={REPO} target="_blank" rel="noreferrer">GitHub<span>↗</span></a>
          </div>
        </div>
      </section>

      <footer>
        <div className="container footer-main">
          <div><a className="brand" href="#top"><span className="brand-mark"><img src={asset("/godot.svg")} alt="" /></span><span>Godot <b>Mini Game</b></span></a><p>{t.footer}</p></div>
          <nav aria-label="Footer navigation"><a href={sitePath("/quick-start/")}>{t.nav[4]}</a><a href={sitePath("/guide/")}>{t.nav[5]}</a><a href={sitePath("/api/")}>API</a><a href={REPO} target="_blank" rel="noreferrer">GitHub</a><a href={RELEASE} target="_blank" rel="noreferrer">Releases</a><a href={docsLink} target="_blank" rel="noreferrer">Docs</a><a href={`${REPO}/issues`} target="_blank" rel="noreferrer">Issues</a></nav>
        </div>
        <div className="container footer-bottom"><span>© 2026 {t.copyright}</span><span>{t.notAffiliated}</span></div>
      </footer>
    </main>
  );
}
