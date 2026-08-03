"use client";

import { useEffect, useState } from "react";
import { releaseData } from "./site-data.generated";
import { sitePath } from "./site-path";

type Language = "zh" | "en";

const REPO = "https://github.com/AnranS/godot_for_minigame";
const VERSION = releaseData.pluginVersion;
const BRIDGE_ABI = releaseData.bridgeAbi;
const CERTIFIED = releaseData.bundled;
const GODOT_VERSION = CERTIFIED.godotVersion;
const GODOT_COMMIT_SHORT = CERTIFIED.godotCommit.slice(0, 7);
const EMSCRIPTEN_VERSION = CERTIFIED.emscriptenVersion;
const TEMPLATE_REVISION = CERTIFIED.templateRevision;
const RELEASE = `${REPO}/releases/latest`;
const PACKAGE_FILENAME = "godot_mini_game_vX.Y.Z.zip";

const copy = {
  zh: {
    nav: ["产品特性", "导出流程", "SDK 能力", "API 参考", "快速开始"],
    language: "EN",
    menu: "打开导航",
    badge: `开源 · MIT License · v${VERSION}`,
    eyebrow: "Godot 4.x 小游戏导出插件",
    heroA: "把 Godot 游戏，",
    heroB: "发布到微信、抖音与 TikTok",
    heroBody:
      "内置小游戏兼容的 WASM 引擎、平台适配层与能力桥接，支持微信、抖音与 TikTok。",
    download: "下载最新版",
    docs: "查看中文文档",
    github: "GitHub",
    supports: "已支持",
    visualProject: "项目",
    visualExport: "小游戏导出",
    visualPlatform: "目标平台",
    visualAppId: "平台标识",
    visualOrientation: "屏幕方向",
    visualOutput: "输出目录",
    visualButton: "导出小游戏",
    visualDone: "导出完成",
    visualReady: "可直接在开发者工具中打开",
    metrics: [
      ["3", "小游戏平台"],
      ["20+", "类原生 API"],
      ["≈ 6 MB", "Brotli 引擎"],
      ["MIT", "开源许可"],
    ],
    sectionFeatures: "为小游戏交付而生",
    sectionFeaturesBody:
      "把复杂的引擎编译、运行时适配与平台配置，收进一个清晰的 Godot Dock。",
    features: [
      ["01", "开箱即用", "内置小游戏兼容引擎模板，无需从头配置 Emscripten。"],
      ["02", "一键导出", "自动生成资源包、引擎文件、JS 适配层与平台配置。"],
      ["03", "宿主兼容引擎", "移除小游戏 WebAssembly 不支持的 SIMD、异常 Tag 与线程特性。"],
      ["04", "三平台交付", "同一套 Godot 项目输出微信、抖音与 TikTok 工程。"],
      ["05", "原生能力桥接", "同名能力先检测再调用；支付等平台特有能力走显式映射。"],
      ["06", "可验证工程链路", "中英文指南、模板构建、自动发布与三平台导出冒烟测试一应俱全。"],
    ],
    flowKicker: "从项目到真机",
    flowTitle: "四步完成一次交付",
    flowBody: "插件接管重复而脆弱的构建细节，你只需要专注游戏本身。",
    steps: [
      ["01", "安装插件", "把 Release 中的 addons/godot_mini_game 放入项目。"],
      ["02", "启用并配置", "启用插件，添加一个 Godot Web 导出预设。"],
      ["03", "选择目标平台", "在 Dock 中填写平台标识、方向与输出目录。"],
      ["04", "打开开发者工具", "点击导出，再用对应平台的开发与调试工具打开。"],
    ],
    architectureKicker: "可验证的导出内核",
    architectureTitle: "从一次点击，到一次事务发布",
    architectureBody:
      "Dock 与无界面自动化脚本进入同一条事务式导出管线。构建失败只影响 staging；进程内发布错误会回滚，崩溃则保留 lock、backup 与 journal 供人工归档比对。",
    architectureCaption:
      "Godot Mini Game 产品架构：Dock 或无界面脚本进入 exporter.gd，依次经过预检、模板解析、资源包构建、平台装配与输出验证，最后从 staging 目录事务式发布。",
    architectureEntry: "统一入口",
    architectureEntryBody: "编辑器操作与自动化脚本共享同一控制面。",
    architectureControllerBody: "持有一次导出事务，统一调度、日志与错误边界。",
    architecturePipeline: "构建管线",
    architectureServices: [
      ["预检", "校验项目、预设、输出所有权与目标参数"],
      ["模板解析", "匹配版本、提交、Emscripten、ABI 与 revision"],
      ["资源构建", "在 staging 中生成游戏资源包"],
      ["平台装配", "装配微信、抖音或 TikTok 运行时与配置"],
      ["输出验证", "校验结构、体积与每个产物的 SHA-256"],
    ],
    architectureDelivery: "安全交付",
    architectureOutputs: [
      ["staging/", "所有构建产物先写入隔离目录"],
      ["transaction publish", "加锁复核后替换封闭的受管顶层路径，失败时回滚"],
    ],
    architectureFoundation: "支撑层与运行时契约",
    architectureFoundationBody: "稳定内核与可替换能力包，为上层管线提供明确边界。",
    architectureSupports: [
      ["Plugin Core", "插件生命周期、输出所有权、进程内回滚与崩溃日志", "plugin.gd · output_guard.gd · exporter.gd"],
      ["Engine Packs", "由版本、提交、工具链、ABI 与校验和锁定", "template_bundle.gd"],
      ["Bridge ABI", "PlatformRuntime 统一能力；SDK 两端完成版本握手", "platform_runtime.js · sdk.js ↔ MiniGameSDK.gd"],
    ],
    architecturePlatforms: "平台适配器",
    techKicker: "真实设备优先",
    techTitle: "不是“模拟器能跑”，而是真机可用",
    techBody:
      `官方 Web 模板包含部分小游戏运行时不支持的 WASM 特性。项目内置 Godot ${GODOT_VERSION} 引擎并自动注入宿主兼容补丁。`,
    techPoints: [
      ["wasm_simd=no", "避开真机 SIMD 编译错误"],
      ["threads=no", "适配小游戏线程限制"],
      ["Brotli", "引擎压缩后约 6 MB"],
      ["Subpackages", "抖音用 subPackages；微信与 TikTok 用 subpackages"],
    ],
    templateNote: `v${VERSION} 认证 Godot ${GODOT_VERSION} · commit ${GODOT_COMMIT_SHORT}… · Emscripten ${EMSCRIPTEN_VERSION} · Bridge ABI ${BRIDGE_ABI} · r${TEMPLATE_REVISION}；发布前仍需完成目标平台真机验证。`,
    sdkKicker: "MiniGameSDK",
    sdkTitle: "小游戏原生能力，用 GDScript 调用",
    sdkBody:
      "插件自动注册 MiniGameSDK Autoload。API 页展示完整 Bridge 接口面，不代表三个宿主全部兼容；运行时按能力门控。",
    apiGroups: ["登录鉴权", "广告支付", "本地与云存储", "媒体与录屏", "网络与 WebSocket", "传感器", "分享与订阅", "文件系统"],
    codeLabel: "GDScript · 激励视频广告",
    copyCode: "复制代码",
    copied: "已复制",
    apiReference: "查看完整 API 参考",
    startKicker: "现在开始",
    startTitle: "让下一次发布少一点折腾",
    startBody: "下载插件、启用 Dock，几分钟内得到可被开发者工具直接打开的小游戏工程。",
    startRelease: "前往 Releases",
    startGuide: "阅读完整指南",
    faqTitle: "常见问题",
    faqs: [
      ["支持哪些 Godot 版本？", `当前内置模板与自动化流程认证 Godot ${GODOT_VERSION}。其它编辑器构建必须导入版本、提交、工具链与 ABI 完全匹配的模板包。`],
      ["需要自己安装 Emscripten 吗？", "日常使用不需要。Release 已带预编译引擎；只有构建自定义 Godot 版本模板时才需要完整编译环境。"],
      ["为什么不能直接使用 Godot 官方 Web 模板？", "小游戏真机的 WXWebAssembly 对 SIMD、异常处理 Tag 与线程支持有限，官方模板可能在真机编译阶段失败。"],
      ["导出后还需要做什么？", "用对应平台工具完成应用标识、域名、隐私、审核与真机验证配置。"],
    ],
    finalTitle: "你的 Godot 游戏，下一站是小游戏。",
    finalBody: "开源、透明、面向真实设备。现在就完成第一次导出。",
    footer: "为使用 Godot 的小游戏开发者打造。",
    copyright: "Godot Mini Game · MIT License",
  },
  en: {
    nav: ["Features", "Workflow", "SDK", "API Reference", "Quick Start"],
    language: "中文",
    menu: "Open navigation",
    badge: `Open source · MIT License · v${VERSION}`,
    eyebrow: "Mini-game exporter for Godot 4.x",
    heroA: "Ship your Godot game",
    heroB: "to WeChat, Douyin & TikTok",
    heroBody:
      "A mini-game-compatible WASM engine, platform adapters, and capability bridge for WeChat, Douyin, and TikTok.",
    download: "Download latest",
    docs: "Read English docs",
    github: "GitHub",
    supports: "Supports",
    visualProject: "Project",
    visualExport: "Mini Game Export",
    visualPlatform: "Target platform",
    visualAppId: "Platform ID",
    visualOrientation: "Orientation",
    visualOutput: "Output folder",
    visualButton: "Export mini game",
    visualDone: "Export complete",
    visualReady: "Ready to open in platform DevTools",
    metrics: [
      ["3", "mini-game platforms"],
      ["20+", "native API groups"],
      ["≈ 6 MB", "Brotli engine"],
      ["MIT", "open-source license"],
    ],
    sectionFeatures: "Built for mini-game delivery",
    sectionFeaturesBody:
      "Engine compilation, runtime adaptation, and platform configuration—made approachable inside one Godot Dock.",
    features: [
      ["01", "Zero configuration", "A compatible engine template is bundled. No Emscripten setup for everyday use."],
      ["02", "One-click export", "Generate the pack, engine, JavaScript adapters, and platform configuration together."],
      ["03", "Host-compatible engine", "Avoid WASM SIMD, exception-tag, and threading features unsupported by mini-game hosts."],
      ["04", "Three platforms", "Export one Godot project to WeChat, Douyin, and TikTok projects."],
      ["05", "Native API bridge", "Gate same-name capabilities and explicitly map payments and other host-specific flows."],
      ["06", "Verifiable toolchain", "Bilingual docs, template builds, automated releases, and three-platform export smoke tests."],
    ],
    flowKicker: "Project to device",
    flowTitle: "A complete delivery in four steps",
    flowBody: "The plugin owns the repetitive build details, so you can stay focused on the game.",
    steps: [
      ["01", "Install", "Drop addons/godot_mini_game from the latest Release into your project."],
      ["02", "Enable & configure", "Enable the plugin and add a Godot Web export preset."],
      ["03", "Choose a platform", "Set the platform ID, orientation, and output folder in the Dock."],
      ["04", "Open DevTools", "Export once, then open the result with the matching platform development tools."],
    ],
    architectureKicker: "Verifiable export core",
    architectureTitle: "From one command to one transactional publish",
    architectureBody:
      "The Dock and headless automation enter one transactional pipeline. Build failures affect staging only; in-process publish errors roll back, while a crash preserves its lock, backup, and journal for operator review.",
    architectureCaption:
      "Godot Mini Game product architecture: the Dock or a headless script enters exporter.gd, then passes through preflight, template resolution, pack building, platform assembly, and output validation before a transactional publish from staging.",
    architectureEntry: "Shared entry points",
    architectureEntryBody: "Editor actions and automation use one control plane.",
    architectureControllerBody: "Owns one export transaction, orchestration, logs, and error boundaries.",
    architecturePipeline: "Build pipeline",
    architectureServices: [
      ["Preflight", "Validate the project, preset, output ownership, and target"],
      ["Template resolution", "Match version, commit, Emscripten, ABI, and revision"],
      ["Pack build", "Build the game pack inside staging"],
      ["Platform assembly", "Add WeChat, Douyin, or TikTok runtime and configuration"],
      ["Output validation", "Verify structure, size, and artifact SHA-256 hashes"],
    ],
    architectureDelivery: "Safe delivery",
    architectureOutputs: [
      ["staging/", "Write every generated artifact to an isolated directory"],
      ["transaction publish", "Lock, recheck, replace closed managed top-level paths, and roll back"],
    ],
    architectureFoundation: "Foundation and runtime contracts",
    architectureFoundationBody: "A stable core and replaceable capability packs give the pipeline explicit boundaries.",
    architectureSupports: [
      ["Plugin Core", "Plugin lifecycle, output ownership, in-process rollback, and crash journals", "plugin.gd · output_guard.gd · exporter.gd"],
      ["Engine Packs", "Pinned by version, commit, toolchain, ABI, and checksums", "template_bundle.gd"],
      ["Bridge ABI", "PlatformRuntime owns capabilities; both SDK ends negotiate versions", "platform_runtime.js · sdk.js ↔ MiniGameSDK.gd"],
    ],
    architecturePlatforms: "Platform adapters",
    techKicker: "Real devices first",
    techTitle: "Beyond “it works in the simulator”",
    techBody:
      `Standard Web templates can include WASM features unavailable in mini-game runtimes. The bundled Godot ${GODOT_VERSION} engine receives host compatibility patches automatically.`,
    techPoints: [
      ["wasm_simd=no", "Avoid device-side SIMD compile errors"],
      ["threads=no", "Respect mini-game thread limits"],
      ["Brotli", "Compress the engine to about 6 MB"],
      ["Subpackages", "Douyin uses subPackages; WeChat and TikTok use subpackages"],
    ],
    templateNote: `v${VERSION} certifies Godot ${GODOT_VERSION} · commit ${GODOT_COMMIT_SHORT}… · Emscripten ${EMSCRIPTEN_VERSION} · Bridge ABI ${BRIDGE_ABI} · r${TEMPLATE_REVISION}; complete a real-device gate on the target platform before release.`,
    sdkKicker: "MiniGameSDK",
    sdkTitle: "Native mini-game APIs, from GDScript",
    sdkBody:
      "MiniGameSDK is registered as an Autoload. The API page lists the full bridge surface, not blanket three-host compatibility; runtime calls are capability-gated.",
    apiGroups: ["Authentication", "Ads & payments", "Local & cloud storage", "Media & recording", "Network & WebSocket", "Sensors", "Share & subscribe", "File system"],
    codeLabel: "GDScript · Rewarded video",
    copyCode: "Copy code",
    copied: "Copied",
    apiReference: "Open the full API reference",
    startKicker: "Get started",
    startTitle: "Spend less time wrestling with exports",
    startBody: "Download, enable the Dock, and produce a DevTools-ready mini-game project in minutes.",
    startRelease: "Open Releases",
    startGuide: "Read the full guide",
    faqTitle: "Frequently asked questions",
    faqs: [
      ["Which Godot versions are supported?", `The bundled template and automated workflow certify Godot ${GODOT_VERSION}. Other editor builds must import a pack with an exact version, commit, toolchain, and ABI match.`],
      ["Do I need to install Emscripten?", "Not for normal use. Releases include a prebuilt engine. A compiler toolchain is only required when building a custom Godot template."],
      ["Why not use the standard Godot Web template?", "WXWebAssembly on real devices has limited support for SIMD, exception tags, and threads, so a standard template can fail during compilation."],
      ["What happens after export?", "Complete the platform ID, domain, privacy, review, and real-device validation settings in the matching tool."],
    ],
    finalTitle: "Your Godot game belongs on mini-game platforms.",
    finalBody: "Open source, transparent, and built for real devices. Make your first export today.",
    footer: "Built for mini-game developers who use Godot.",
    copyright: "Godot Mini Game · MIT License",
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

export default function Home() {
  const [language, setLanguage] = useState<Language>("zh");
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const t = copy[language];

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  useEffect(() => {
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

    document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [language]);

  async function copySnippet() {
    await navigator.clipboard.writeText(sdkCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const docsLink = language === "zh" ? `${REPO}/blob/main/docs/USAGE_zh.md` : `${REPO}/blob/main/docs/USAGE.md`;

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
            <a href="#features" onClick={() => setMenuOpen(false)}>{t.nav[0]}</a>
            <a href="#workflow" onClick={() => setMenuOpen(false)}>{t.nav[1]}</a>
            <a href="#sdk" onClick={() => setMenuOpen(false)}>{t.nav[2]}</a>
            <a href={sitePath("/api/")} onClick={() => setMenuOpen(false)}>{t.nav[3]}</a>
            <a href="#start" onClick={() => setMenuOpen(false)}>{t.nav[4]}</a>
          </nav>

          <div className="nav-actions">
            <button className="language-switch" type="button" onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>{t.language}</button>
            <a className="github-button" href={REPO} target="_blank" rel="noreferrer">{t.github}<span>↗</span></a>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid-bg" aria-hidden="true" />
        <div className="hero-glow hero-glow-blue" aria-hidden="true" />
        <div className="hero-glow hero-glow-green" aria-hidden="true" />
        <div className="container hero-layout">
          <div className="hero-copy">
            <div className="status-pill"><span />{t.badge}</div>
            <p className="eyebrow">{t.eyebrow}</p>
            <h1>
              <span>{t.heroA}</span>
              <em>{t.heroB}</em>
            </h1>
            <p className="hero-body">{t.heroBody}</p>
            <div className="hero-actions">
              <a className="button button-primary" href={RELEASE} target="_blank" rel="noreferrer">{t.download}<span>↓</span></a>
              <a className="button button-secondary" href={docsLink} target="_blank" rel="noreferrer">{t.docs}<span>↗</span></a>
            </div>
            <div className="platform-line">
              <span>{t.supports}</span>
              <span className="platform-chip"><img src={asset("/wechat.svg")} alt="" />WeChat</span>
              <span className="platform-chip"><img src={asset("/tiktok.svg")} alt="" />Douyin</span>
              <span className="platform-chip"><img src={asset("/tiktok.svg")} alt="" />TikTok</span>
            </div>
          </div>

          <div className="product-visual" aria-label="Godot Mini Game export workflow preview">
            <div className="visual-halo" />
            <div className="window-frame">
              <div className="window-bar">
                <div className="traffic-lights"><span /><span /><span /></div>
                <span className="window-title">Godot Engine — game_project</span>
                <span className="window-version">{GODOT_VERSION}</span>
              </div>
              <div className="window-content">
                <aside className="project-rail">
                  <p>{t.visualProject}</p>
                  <div className="tree-row active"><span>◆</span> game_project</div>
                  <div className="tree-row indent"><span>▾</span> addons</div>
                  <div className="tree-row indent-2"><span>⌁</span> godot_mini_game</div>
                  <div className="tree-row indent"><span>▦</span> scenes</div>
                  <div className="tree-row indent"><span>⌘</span> scripts</div>
                  <div className="project-canvas">
                    <div className="canvas-orbit" />
                    <img src={asset("/godot.svg")} alt="Godot" />
                  </div>
                </aside>

                <section className="export-dock">
                  <div className="dock-heading">
                    <span className="dock-icon">↗</span>
                    <div><strong>{t.visualExport}</strong><small>Godot Mini Game Export</small></div>
                  </div>
                  <label><span>{t.visualPlatform}</span><div className="fake-select"><span className="mini-logo"><img src={asset("/wechat.svg")} alt="" /></span>WeChat <b>⌄</b></div></label>
                  <label><span>{t.visualAppId}</span><div className="fake-input">wx••••••••••••••</div></label>
                  <div className="dock-two-col">
                    <label><span>{t.visualOrientation}</span><div className="fake-input">Portrait</div></label>
                    <label><span>Web Preset</span><div className="fake-input">MiniGame</div></label>
                  </div>
                  <label><span>{t.visualOutput}</span><div className="fake-input fake-path">~/build/minigame <b>•••</b></div></label>
                  <button type="button" tabIndex={-1} className="fake-export">{t.visualButton}<span>→</span></button>
                  <div className="progress-list">
                    <span className="done">✓</span><span>.pck</span>
                    <span className="done">✓</span><span>WASM</span>
                    <span className="done">✓</span><span>Adapter</span>
                    <span className="done">✓</span><span>Config</span>
                  </div>
                </section>

                <aside className="output-preview">
                  <div className="output-status"><span>✓</span><div><strong>{t.visualDone}</strong><small>{t.visualReady}</small></div></div>
                  <div className="phone-card">
                    <div className="phone-notch" />
                    <div className="phone-scene">
                      <div className="scene-cloud one" />
                      <div className="scene-cloud two" />
                      <div className="scene-land land-back" />
                      <div className="scene-land land-front" />
                      <div className="scene-player">◆</div>
                    </div>
                    <div className="phone-progress"><span /></div>
                    <small>Loading game.pck</small>
                  </div>
                  <div className="output-platforms">
                    <span><img src={asset("/wechat.svg")} alt="WeChat" /></span>
                    <i>+</i>
                    <span><img src={asset("/tiktok.svg")} alt="Douyin" /></span>
                    <i>+</i>
                    <span><img src={asset("/tiktok.svg")} alt="TikTok" /></span>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
        <div className="container metric-strip">
          {t.metrics.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
        </div>
      </section>

      <section className="section features-section" id="features">
        <div className="container">
          <div className="section-heading reveal">
            <p className="section-kicker">Godot Mini Game</p>
            <h2>{t.sectionFeatures}</h2>
            <p>{t.sectionFeaturesBody}</p>
          </div>
          <div className="feature-grid">
            {t.features.map(([number, title, body], index) => (
              <article className={`feature-card reveal feature-${index + 1}`} key={title}>
                <div className="feature-top"><span>{number}</span><i>{index === 0 ? "READY" : index === 1 ? "EXPORT" : index === 2 ? "WASM" : index === 3 ? "3×" : index === 4 ? "SDK" : "CI"}</i></div>
                <h3>{title}</h3>
                <p>{body}</p>
                <div className="feature-decoration" aria-hidden="true">
                  <span /><span /><span />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section workflow-section" id="workflow">
        <div className="container">
          <div className="split-heading reveal">
            <div><p className="section-kicker">{t.flowKicker}</p><h2>{t.flowTitle}</h2></div>
            <p>{t.flowBody}</p>
          </div>
          <div className="steps-grid">
            {t.steps.map(([number, title, body], index) => (
              <article className="step-card reveal" key={title}>
                <div className="step-number">{number}</div>
                <div className="step-connector"><span /></div>
                <h3>{title}</h3>
                <p>{body}</p>
                <span className="step-tag">{index === 0 ? "RELEASE" : index === 1 ? "GODOT" : index === 2 ? "DOCK" : "DEVTOOLS"}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section architecture-section" id="architecture" aria-labelledby="architecture-title">
        <div className="container">
          <div className="split-heading architecture-heading reveal">
            <div>
              <p className="section-kicker">{t.architectureKicker}</p>
              <h2 id="architecture-title">{t.architectureTitle}</h2>
            </div>
            <p>{t.architectureBody}</p>
          </div>

          <figure className="architecture-figure reveal" aria-label={t.architectureCaption}>
            <figcaption className="sr-only">{t.architectureCaption}</figcaption>

            <ol className="architecture-flow">
              <li className="architecture-stage architecture-entry">
                <div className="architecture-stage-head"><span>01</span><small>ENTRY</small></div>
                <h3>{t.architectureEntry}</h3>
                <p>{t.architectureEntryBody}</p>
                <ul className="architecture-entry-points" aria-label={t.architectureEntry}>
                  <li><span aria-hidden="true">◫</span><code>Godot Dock</code></li>
                  <li><span aria-hidden="true">›_</span><code>Headless script</code></li>
                </ul>
              </li>

              <li className="architecture-stage architecture-controller">
                <div className="architecture-stage-head"><span>02</span><small>CONTROL</small></div>
                <div className="architecture-controller-mark" aria-hidden="true"><i /><b>CTRL</b></div>
                <h3><code>exporter.gd</code></h3>
                <p>{t.architectureControllerBody}</p>
              </li>

              <li className="architecture-stage architecture-pipeline">
                <div className="architecture-stage-head"><span>03</span><small>PIPELINE</small></div>
                <h3>{t.architecturePipeline}</h3>
                <ul className="architecture-services">
                  {t.architectureServices.map(([name, detail], index) => (
                    <li key={name}>
                      <span aria-hidden="true">0{index + 1}</span>
                      <div><code>{name}</code><p>{detail}</p></div>
                      <i aria-hidden="true">✓</i>
                    </li>
                  ))}
                </ul>
              </li>

              <li className="architecture-stage architecture-delivery">
                <div className="architecture-stage-head"><span>04</span><small>COMMIT</small></div>
                <h3>{t.architectureDelivery}</h3>
                <div className="architecture-output-path">
                  {t.architectureOutputs.map(([name, detail], index) => (
                    <div className="architecture-output-node" key={name}>
                      <code>{name}</code>
                      <p>{detail}</p>
                      {index === 0 && <span className="architecture-output-arrow" aria-hidden="true">↓</span>}
                    </div>
                  ))}
                </div>
              </li>
            </ol>

            <aside className="architecture-foundation" aria-labelledby="architecture-foundation-title">
              <div className="architecture-foundation-heading">
                <div><span aria-hidden="true">DEPENDENCIES</span><h3 id="architecture-foundation-title">{t.architectureFoundation}</h3></div>
                <p>{t.architectureFoundationBody}</p>
              </div>
              <div className="architecture-support-grid">
                {t.architectureSupports.map(([name, detail, target], index) => (
                  <article className={`architecture-support-card architecture-support-${index + 1}`} key={name}>
                    <div className="architecture-support-top"><span>{index === 0 ? "CORE" : index === 1 ? "ENGINE" : "RUNTIME"}</span><i aria-hidden="true" /></div>
                    <h4><code>{name}</code></h4>
                    <p>{detail}</p>
                    {name === "Bridge ABI" && (
                      <div className="architecture-platforms" aria-label={t.architecturePlatforms}>
                        <span><i aria-hidden="true" />WeChat</span>
                        <span><i aria-hidden="true" />Douyin</span>
                        <span><i aria-hidden="true" />TikTok</span>
                      </div>
                    )}
                    <div className="architecture-binding"><span aria-hidden="true">↳</span><code>{target}</code></div>
                  </article>
                ))}
              </div>
            </aside>
          </figure>
        </div>
      </section>

      <section className="section tech-section">
        <div className="container tech-layout">
          <div className="tech-copy reveal">
            <p className="section-kicker">{t.techKicker}</p>
            <h2>{t.techTitle}</h2>
            <p>{t.techBody}</p>
            <div className="template-note"><span>i</span>{t.templateNote}</div>
          </div>
          <div className="tech-console reveal">
            <div className="console-bar"><span /><span /><span /><b>engine.template</b></div>
            <div className="tech-list">
              {t.techPoints.map(([name, detail], index) => (
                <div key={name}><span className="tech-index">0{index + 1}</span><code>{name}</code><p>{detail}</p><i>✓</i></div>
              ))}
            </div>
            <div className="engine-meter"><span>godot.wasm.br</span><div><i /></div><b>≈ 6 MB</b></div>
          </div>
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
            <h2>{t.sdkTitle}</h2>
            <p>{t.sdkBody}</p>
            <div className="api-cloud">
              {t.apiGroups.map((group, index) => <span key={group}><i>{["AUTH", "ADS", "DATA", "MEDIA", "NET", "SENSOR", "SHARE", "FS"][index]}</i>{group}</span>)}
            </div>
            <a className="sdk-api-link" href={sitePath("/api/")}>{t.apiReference}<span>→</span></a>
          </div>
        </div>
      </section>

      <section className="section start-section" id="start">
        <div className="container start-layout">
          <div className="start-copy reveal">
            <p className="section-kicker">{t.startKicker}</p>
            <h2>{t.startTitle}</h2>
            <p>{t.startBody}</p>
            <div className="hero-actions">
              <a className="button button-primary" href={RELEASE} target="_blank" rel="noreferrer">{t.startRelease}<span>↗</span></a>
              <a className="button button-secondary" href={docsLink} target="_blank" rel="noreferrer">{t.startGuide}<span>→</span></a>
            </div>
          </div>
          <div className="install-card reveal">
            <div className="install-bar"><span>INSTALLATION</span><b>v{VERSION}</b></div>
            <ol>
              <li><span>1</span><div><strong>Download</strong><code>{PACKAGE_FILENAME}</code></div></li>
              <li><span>2</span><div><strong>Extract to project</strong><code>res://addons/godot_mini_game/</code></div></li>
              <li><span>3</span><div><strong>Enable plugin</strong><code>Project Settings → Plugins</code></div></li>
              <li><span>4</span><div><strong>Export</strong><code>Mini Game Export → Export</code></div></li>
            </ol>
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
          <div className="final-logos"><span><img src={asset("/godot.svg")} alt="Godot" /></span><i>→</i><span><img src={asset("/wechat.svg")} alt="WeChat" /></span><span><img src={asset("/tiktok.svg")} alt="Douyin" /></span><span><img src={asset("/tiktok.svg")} alt="TikTok" /></span></div>
          <h2>{t.finalTitle}</h2>
          <p>{t.finalBody}</p>
          <div className="hero-actions">
            <a className="button button-light" href={RELEASE} target="_blank" rel="noreferrer">{t.download}<span>↓</span></a>
            <a className="button button-dark-outline" href={REPO} target="_blank" rel="noreferrer">{t.github}<span>↗</span></a>
          </div>
        </div>
      </section>

      <footer>
        <div className="container footer-main">
          <div><a className="brand" href="#top"><span className="brand-mark"><img src={asset("/godot.svg")} alt="" /></span><span>Godot <b>Mini Game</b></span></a><p>{t.footer}</p></div>
          <nav aria-label="Footer navigation"><a href={sitePath("/api/")}>API</a><a href={REPO} target="_blank" rel="noreferrer">GitHub</a><a href={RELEASE} target="_blank" rel="noreferrer">Releases</a><a href={docsLink} target="_blank" rel="noreferrer">Docs</a><a href={`${REPO}/issues`} target="_blank" rel="noreferrer">Issues</a></nav>
        </div>
        <div className="container footer-bottom"><span>© 2026 {t.copyright}</span><span>{language === "zh" ? "非 Godot 官方关联项目" : "Not affiliated with the Godot Foundation"}</span></div>
      </footer>
    </main>
  );
}
