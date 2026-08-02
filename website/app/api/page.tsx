"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sitePath } from "../site-path";
import { apiCategories, apiMethods, apiSignals } from "./api-data.generated";
import styles from "./page.module.css";

const REPO = "https://github.com/AnranS/godot_for_minigame";
const SOURCE = REPO + "/blob/main/addons/godot_mini_game/MiniGameSDK.gd";
const GUIDE = REPO + "/blob/main/docs/USAGE_zh.md";

type ApiMethod = (typeof apiMethods)[number];
type ApiSignal = (typeof apiSignals)[number];
type ApiCategory = (typeof apiCategories)[number];
type EntryKind = "all" | "method" | "signal";
type Parameter = ApiMethod["parameters"][number] | ApiSignal["parameters"][number];

const quickStart = [
  "func _ready() -> void:",
  "    MiniGameSDK.login_completed.connect(_on_login_completed)",
  "    MiniGameSDK.login()",
  "",
  "func _on_login_completed(code: String, error: String) -> void:",
  "    if error.is_empty():",
  "        print(code)",
].join("\n");

const methodDescriptions: Record<string, string> = {
  storage_set: "写入一个本地键值；该调用同步完成。",
  storage_get: "同步读取本地键值，不存在时返回 default_value。",
  storage_info: "同步返回 keys、当前占用空间 size 与存储上限 limit。",
  login: "请求平台登录凭证；结果由 login_completed 返回。",
  check_session: "校验当前登录会话是否仍然有效。",
  get_user_info: "读取已授权的用户资料，结果以 JSON 字符串返回。",
  get_privacy_setting: "读取微信隐私授权状态和隐私协议名称。",
  start_privacy_authorization_listener: "监听平台提出的隐私授权请求；收到事件后必须显式 resolve。",
  resolve_privacy_authorization: "用 agree、disagree 或 exposureAuthorization 解决挂起的隐私授权请求。",
  authorize: "申请一个平台权限 scope，例如 scope.record。",
  get_account_info: "同步读取当前小程序、插件与账号信息。",
  share_app: "主动拉起平台分享面板，并设置标题、图片和 query。",
  create_rewarded_ad: "创建激励视频广告实例并返回创建结果。",
  show_rewarded_ad: "展示已创建的激励视频广告；根据播放完成状态发放奖励。",
  request_payment: "发起微信 Midas 虚拟支付，业务参数通过 Dictionary 传入。",
  http_request: "发起平台 HTTP 请求；状态码、响应正文和错误由 http_response 返回。",
  download_file: "下载远程文件到临时路径或指定小游戏文件路径。",
  upload_file: "以 multipart/form-data 上传小游戏本地文件。",
  connect_socket: "创建 WebSocket 连接并注册 open、message、close 与 error 事件。",
  call_file_system: "调用 FileSystemManager 的任意 options-object 异步方法。",
  load_subpackage: "加载一个已在平台配置中声明的资源分包。",
  pre_download_subpackage: "预下载资源分包并持续返回下载进度。",
  create_worker: "创建后台 Worker；新建前会终止已有的活跃 Worker。",
  choose_media: "从相册或相机选择图片/视频媒体。",
  create_camera: "创建平台原生 Camera 实例并注册相机事件。",
  create_video: "创建平台原生 Video 实例；options 直接映射平台组件属性。",
  get_recorder_manager: "取得全局 RecorderManager，并注册录音事件。",
  create_video_decoder: "创建 VideoDecoder 实例，用于逐帧读取视频数据。",
  create_media_audio_player: "创建 MediaAudioPlayer，并设置初始音量。",
  get_game_recorder: "取得平台 GameRecorder 实例并注册录屏事件。",
  create_inner_audio_context: "创建 InnerAudioContext，并应用创建参数与实例属性。",
  get_network_type: "读取当前网络类型，例如 wifi、4g 或 none。",
  start_network_status_listener: "开始监听网络连接状态和网络类型变化。",
  get_battery_info_sync: "同步返回电量百分比与充电状态。",
  get_performance_entries: "同步读取平台性能条目；可按 entry_type 过滤。",
  report_performance: "向平台上报自定义性能指标。",
  navigate_to_mini_program: "跳转到另一个小程序，可携带路径和 extra_data。",
  set_user_cloud_storage: "写入用户托管数据，供开放数据域排行榜等场景使用。",
  post_open_data_context_message: "向开放数据域发送消息；返回是否成功发起。",
  open_customer_service_conversation: "从用户触摸事件中打开客服会话。",
  start_update_listener: "绑定更新管理器的 check、ready 与 failed 事件。",
  apply_update: "应用已准备好的更新并重启小游戏。",
  get_screen_brightness: "异步读取屏幕亮度，取值范围为 0 到 1。",
  can_i_use: "按平台 schema 同步探测 API、参数或返回字段是否可用。",
  get_system_info: "同步读取完整系统信息；不支持时返回空 Dictionary。",
  get_menu_button_rect: "同步读取胶囊按钮矩形，用于计算 UI 安全区。",
  call_api: "调用未被显式封装的平台 API；位置参数可通过 _args 数组传入。",
  set_clipboard: "写入系统剪贴板。",
  get_clipboard: "读取系统剪贴板，结果由 clipboard_received 返回。",
  show_modal: "显示平台原生确认弹窗，选择结果由 modal_result 返回。",
};

const exactSignalHints: Record<string, readonly string[]> = {
  login: ["login_completed"],
  check_session: ["session_checked"],
  get_user_info: ["user_info_received"],
  get_privacy_setting: ["privacy_setting_received"],
  require_privacy_authorize: ["privacy_authorize_result"],
  open_privacy_contract: ["privacy_contract_opened"],
  start_privacy_authorization_listener: ["privacy_authorization_needed"],
  get_setting: ["setting_received"],
  open_setting: ["setting_opened"],
  authorize: ["authorization_result"],
  create_rewarded_ad: ["ad_created"],
  show_rewarded_ad: ["rewarded_ad_result"],
  create_interstitial_ad: ["ad_created"],
  show_interstitial_ad: ["interstitial_ad_result"],
  request_payment: ["payment_result"],
  show_keyboard: ["keyboard_event"],
  http_request: ["http_response"],
  download_file: ["file_transfer_result"],
  upload_file: ["file_transfer_result"],
  get_network_type: ["network_type_received"],
  get_battery_info: ["battery_info_received"],
  get_screen_brightness: ["screen_brightness_received"],
  set_screen_brightness: ["screen_brightness_set"],
  get_clipboard: ["clipboard_received"],
  show_modal: ["modal_result"],
  call_api: ["generic_api_result"],
};

const platformLabels = {
  dual: {
    label: "双平台明确",
    detail: "仓库文档明确映射 wx 与 tt；仍建议按宿主版本做能力探测。",
  },
  bridge: {
    label: "统一桥接",
    detail: "运行时会分发到 wx 或 tt，但仓库没有对全部宿主能力做独立验证。",
  },
  "wechat-docs": {
    label: "微信文档",
    detail: "当前文档和自动化覆盖以微信为主；抖音需确认存在同名能力。",
  },
  wechat: {
    label: "微信专属",
    detail: "接口语义与微信隐私、Midas 或开放数据域能力绑定。",
  },
} as const;

const paramDescriptions: Record<string, string> = {
  url: "请求或连接的完整 URL。",
  method: "平台方法名或 HTTP 方法。",
  headers: "请求头键值对。",
  data: "发送的数据内容。",
  options: "直接传给平台 API 的 options object。",
  params: "平台 API 参数字典。",
  error: "空字符串表示成功，否则为错误信息。",
  data_json: "平台原始响应序列化后的 JSON 字符串。",
  action: "触发本次结果的具体平台动作。",
  success: "操作是否成功。",
  event_type: "事件类型。",
  default_value: "键不存在或离开小游戏运行时时使用的默认值。",
  interval: "采样频率：game、ui 或 normal。",
  button_type: "原生按钮类型：userInfo、openSetting 或 gameClub。",
  ad_unit_id: "平台后台创建的广告位 ID。",
  file_path: "小游戏文件系统路径。",
  path: "目标路径或小程序页面路径。",
};

function categoryFor(id: string) {
  return apiCategories.find((category) => category.id === id) as ApiCategory;
}

function relatedSignals(method: ApiMethod) {
  const exact = exactSignalHints[method.name];
  if (exact) return exact;
  const ignored = new Set(["get", "set", "start", "stop", "create", "show", "hide", "destroy", "request"]);
  const tokens = method.name.split("_").filter((token) => token.length > 2 && !ignored.has(token));
  return apiSignals
    .filter((signal) => signal.category === method.category)
    .map((signal) => ({
      name: signal.name,
      score: tokens.filter((token) => signal.name.includes(token)).length,
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((candidate) => candidate.name);
}

function describeMethod(method: ApiMethod) {
  if (methodDescriptions[method.name]) return methodDescriptions[method.name];
  const category = categoryFor(method.category);
  const actions: Array<[string, string]> = [
    ["get_", "读取"],
    ["set_", "设置"],
    ["start_", "开始"],
    ["stop_", "停止"],
    ["create_", "创建"],
    ["show_", "显示"],
    ["hide_", "隐藏"],
    ["destroy_", "销毁"],
    ["request_", "请求"],
    ["open_", "打开"],
    ["close_", "关闭"],
    ["send_", "发送"],
    ["load_", "加载"],
    ["remove_", "移除"],
    ["preview_", "预览"],
    ["save_", "保存"],
    ["compress_", "压缩"],
    ["navigate_", "跳转"],
  ];
  const action = actions.find(([prefix]) => method.name.startsWith(prefix));
  if (action) {
    return action[1] + " " + method.name.slice(action[0].length) + "；" + category.summary;
  }
  return "调用 " + method.name + "；" + category.summary;
}

function describeSignal(signal: ApiSignal) {
  const category = categoryFor(signal.category);
  if (signal.name.endsWith("_result")) return "相关平台操作完成后触发；success/error 字段表示结果。";
  if (signal.name.endsWith("_received")) return "异步数据返回时触发；JSON 字段保留平台原始响应。";
  if (signal.name.endsWith("_changed")) return "监听期间的平台状态发生变化时触发。";
  if (signal.name.endsWith("_completed")) return "对应异步流程结束时触发。";
  if (signal.name.endsWith("_error") || signal.name.endsWith("_failed")) return "对应能力发生错误或失败时触发。";
  if (signal.name.endsWith("_ready")) return "对应资源或更新准备完成时触发。";
  return category.summary + " 相关事件发生时触发。";
}

function parameterDescription(parameter: Parameter) {
  return paramDescriptions[parameter.name] ?? "传给该接口的 " + parameter.name + " 参数。";
}

function sourceUrl(line: number) {
  return SOURCE + "#L" + line;
}

function MethodCard({
  method,
  copied,
  onCopy,
}: {
  method: ApiMethod;
  copied: string;
  onCopy: (value: string, key: string) => void;
}) {
  const category = categoryFor(method.category);
  const signals = relatedSignals(method);
  const platform = platformLabels[category.platform];
  const synchronous = method.returnType !== "void";

  return (
    <details className={styles.entry} id={"method-" + method.name}>
      <summary>
        <div className={styles.entryTop}>
          <span className={styles.methodBadge}>METHOD</span>
          <span className={styles.platformBadge} data-platform={category.platform}>{platform.label}</span>
          <span className={styles.returnBadge}>{synchronous ? "同步返回" : signals.length ? "信号回调" : "无返回"}</span>
        </div>
        <h3>{method.name}</h3>
        <code className={styles.signature}>{method.signature}</code>
        <p>{describeMethod(method)}</p>
        <span className={styles.expandLabel}>查看参数与行为 <i>+</i></span>
      </summary>
      <div className={styles.entryBody}>
        <div className={styles.behaviorGrid}>
          <div><span>平台支持</span><strong>{platform.label}</strong><p>{platform.detail}</p></div>
          <div><span>返回值</span><strong>{method.returnType}</strong><p>{synchronous ? "同步返回；离开小游戏运行时会返回类型安全的默认值。" : signals.length ? "无同步返回；先连接关联信号，再调用方法。" : "无同步返回；属于实例操作或 fire-and-forget 调用。"}</p></div>
          <div><span>非小游戏环境</span><strong>Safe fallback</strong><p>{synchronous ? "返回空值、false 或调用方提供的默认值，不会崩溃。" : signals.length ? "结果型调用会发出包含 Not in mini-game environment 的信号。" : "安全 no-op，不会在编辑器中报错。"}</p></div>
        </div>

        {method.parameters.length > 0 ? (
          <div className={styles.parameters}>
            <h4>参数</h4>
            <div className={styles.paramTable}>
              {method.parameters.map((parameter) => (
                <div className={styles.paramRow} key={parameter.name}>
                  <code>{parameter.name}</code>
                  <span>{parameter.type}</span>
                  <span>{parameter.defaultValue || "必填"}</span>
                  <p>{parameterDescription(parameter)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className={styles.noParams}>此方法没有参数。</p>
        )}

        {signals.length > 0 && (
          <div className={styles.related}>
            <h4>关联信号</h4>
            <div>{signals.map((signal) => <a href={"#signal-" + signal} key={signal}>{signal}</a>)}</div>
          </div>
        )}

        <div className={styles.entryActions}>
          <button type="button" onClick={() => onCopy(method.signature, method.name)}>
            {copied === method.name ? "✓ 已复制" : "复制签名"}
          </button>
          <a href={sourceUrl(method.line)} target="_blank" rel="noreferrer">查看源码 L{method.line} ↗</a>
          <a href={GUIDE} target="_blank" rel="noreferrer">使用指南 ↗</a>
        </div>
      </div>
    </details>
  );
}

function SignalCard({ signal }: { signal: ApiSignal }) {
  const category = categoryFor(signal.category);
  const platform = platformLabels[category.platform];
  return (
    <details className={styles.entry} id={"signal-" + signal.name}>
      <summary>
        <div className={styles.entryTop}>
          <span className={styles.signalBadge}>SIGNAL</span>
          <span className={styles.platformBadge} data-platform={category.platform}>{platform.label}</span>
          <span className={styles.returnBadge}>事件</span>
        </div>
        <h3>{signal.name}</h3>
        <code className={styles.signature}>{signal.signature}</code>
        <p>{describeSignal(signal)}</p>
        <span className={styles.expandLabel}>查看信号载荷 <i>+</i></span>
      </summary>
      <div className={styles.entryBody}>
        <div className={styles.behaviorGrid}>
          <div><span>触发方式</span><strong>Signal</strong><p>使用 connect() 连接回调；监听型信号可能多次触发。</p></div>
          <div><span>错误约定</span><strong>error == &quot;&quot;</strong><p>包含 error 参数时，空字符串表示成功。</p></div>
          <div><span>JSON 约定</span><strong>JSON.parse_string()</strong><p>data_json 等字段是序列化 JSON，字段形状由宿主平台决定。</p></div>
        </div>
        {signal.parameters.length > 0 ? (
          <div className={styles.parameters}>
            <h4>载荷</h4>
            <div className={styles.paramTable}>
              {signal.parameters.map((parameter) => (
                <div className={styles.paramRow} key={parameter.name}>
                  <code>{parameter.name}</code>
                  <span>{parameter.type}</span>
                  <span>事件参数</span>
                  <p>{parameterDescription(parameter)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className={styles.noParams}>此信号不携带参数。</p>
        )}
        <div className={styles.entryActions}>
          <a href={sourceUrl(signal.line)} target="_blank" rel="noreferrer">查看源码 L{signal.line} ↗</a>
        </div>
      </div>
    </details>
  );
}

export default function ApiReference() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<EntryKind>("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [copied, setCopied] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return apiCategories
      .map((category) => {
        const methods = apiMethods.filter((method) => {
          if (kind === "signal") return false;
          if (activeCategory !== "all" && method.category !== activeCategory) return false;
          const haystack = [method.name, method.signature, category.title, category.titleEn, describeMethod(method)].join(" ").toLowerCase();
          return !normalized || haystack.includes(normalized);
        });
        const signals = apiSignals.filter((signal) => {
          if (kind === "method") return false;
          if (activeCategory !== "all" && signal.category !== activeCategory) return false;
          const haystack = [signal.name, signal.signature, category.title, category.titleEn, describeSignal(signal)].join(" ").toLowerCase();
          return !normalized || haystack.includes(normalized);
        });
        return { category, methods, signals };
      })
      .filter((group) => group.methods.length + group.signals.length > 0);
  }, [activeCategory, kind, query]);

  const resultCount = groups.reduce((total, group) => total + group.methods.length + group.signals.length, 0);

  async function copySignature(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1400);
  }

  function selectCategory(id: string) {
    setActiveCategory(id);
    document.getElementById("reference")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href={sitePath("/")} aria-label="返回 Godot Mini Game 官网">
            <span><img src={sitePath("/godot.svg")} alt="" /></span>
            <strong>Godot <b>Mini Game</b></strong>
          </a>
          <nav aria-label="API 页面导航">
            <a href="#overview">快速使用</a>
            <a href="#reference">API 索引</a>
            <a href={GUIDE} target="_blank" rel="noreferrer">指南 ↗</a>
          </nav>
          <a className={styles.github} href={REPO} target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.breadcrumb}><a href={sitePath("/")}>官网</a><span>/</span><strong>API 参考</strong></div>
          <div className={styles.heroLayout}>
            <div className={styles.heroCopy}>
              <div className={styles.version}>MiniGameSDK · v0.1.1</div>
              <h1>每一个方法、<br /><em>每一个信号</em></h1>
              <p>从 GDScript 源码自动生成的完整接口索引。搜索方法与信号，核对参数默认值、同步返回、回调约定、平台兼容性和源码位置。</p>
              <div className={styles.heroStats}>
                <div><strong>{apiMethods.length}</strong><span>公开方法</span></div>
                <div><strong>{apiSignals.length}</strong><span>公开信号</span></div>
                <div><strong>{apiCategories.length}</strong><span>能力分类</span></div>
                <div><strong>1</strong><span>只读属性</span></div>
              </div>
            </div>
            <div className={styles.quickCode} id="overview">
              <div className={styles.codeBar}><span /><span /><span /><strong>GDScript · connect before call</strong></div>
              <pre><code>{quickStart}</code></pre>
              <div className={styles.codeFoot}><span>●</span> error.is_empty() = success <b>AUTOLOAD</b></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.conventions}>
        <div className={styles.conventionGrid}>
          <article>
            <span>READONLY PROPERTY</span>
            <code>is_mini_game: bool</code>
            <p>当前是否运行在已加载 godotSdk 的小游戏环境中。</p>
          </article>
          <article>
            <span>ERROR CONTRACT</span>
            <code>error == &quot;&quot;</code>
            <p>空字符串表示成功；异步调用应先连接 signal。</p>
          </article>
          <article>
            <span>JSON PAYLOAD</span>
            <code>JSON.parse_string(data_json)</code>
            <p>原始平台对象以 JSON 字符串跨越 JS/GDScript 边界。</p>
          </article>
          <article>
            <span>EDITOR SAFE</span>
            <code>NOT_IN_RUNTIME</code>
            <p>编辑器与非小游戏环境使用安全默认值或错误信号。</p>
          </article>
        </div>
        <div className={styles.compatibility}>
          <div>
            <strong>平台标签怎么读</strong>
            <p>统一桥接不等于双平台均已验证。涉及宿主版本的能力，请先调用 <code>can_i_use()</code>。</p>
          </div>
          {(Object.entries(platformLabels) as Array<[keyof typeof platformLabels, (typeof platformLabels)[keyof typeof platformLabels]]>).map(([key, value]) => (
            <span data-platform={key} key={key}>{value.label}</span>
          ))}
        </div>
        <div className={styles.unions}>
          <strong>常用字符串取值</strong>
          <code>privacy: exposureAuthorization | agree | disagree</code>
          <code>button: userInfo | openSetting | gameClub</code>
          <code>interval: game | ui | normal</code>
          <code>toast: success | error | loading | none</code>
        </div>
      </section>

      <section className={styles.reference} id="reference">
        <div className={styles.referenceShell}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeading}><span>{"// INDEX"}</span><strong>能力分类</strong></div>
            <button className={activeCategory === "all" ? styles.activeCategory : ""} type="button" onClick={() => selectCategory("all")}>
              <span>全部接口</span><b>{apiMethods.length + apiSignals.length}</b>
            </button>
            {apiCategories.map((category) => {
              const count = apiMethods.filter((method) => method.category === category.id).length + apiSignals.filter((signal) => signal.category === category.id).length;
              return (
                <button className={activeCategory === category.id ? styles.activeCategory : ""} type="button" onClick={() => selectCategory(category.id)} key={category.id}>
                  <span>{category.title}<small>{category.titleEn}</small></span><b>{count}</b>
                </button>
              );
            })}
          </aside>

          <div className={styles.referenceMain}>
            <div className={styles.searchPanel}>
              <label className={styles.searchBox}>
                <span>⌕</span>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索 login、WebSocket、录屏、signal…"
                  aria-label="搜索 MiniGameSDK API"
                />
                <kbd>/</kbd>
              </label>
              <div className={styles.kindTabs} aria-label="接口类型筛选">
                {([
                  ["all", "全部"],
                  ["method", "方法"],
                  ["signal", "信号"],
                ] as const).map(([value, label]) => (
                  <button className={kind === value ? styles.activeKind : ""} type="button" onClick={() => setKind(value)} key={value}>{label}</button>
                ))}
              </div>
            </div>

            <div className={styles.resultSummary} aria-live="polite">
              <div>
                <span>{"// API REFERENCE"}</span>
                <h2>{activeCategory === "all" ? "完整接口索引" : categoryFor(activeCategory).title}</h2>
              </div>
              <p>找到 <strong>{resultCount}</strong> 项{query && <>，关键词 “{query}”</>}</p>
            </div>

            {groups.length === 0 ? (
              <div className={styles.empty}>
                <strong>没有匹配的接口</strong>
                <p>换一个方法名、功能关键词或清除筛选。</p>
                <button type="button" onClick={() => { setQuery(""); setKind("all"); setActiveCategory("all"); }}>清除筛选</button>
              </div>
            ) : groups.map(({ category, methods, signals }) => (
              <section className={styles.apiGroup} id={"category-" + category.id} key={category.id}>
                <div className={styles.groupHeading}>
                  <div><span>{category.titleEn}</span><h2>{category.title}</h2></div>
                  <p>{category.summary}</p>
                  <span className={styles.platformBadge} data-platform={category.platform}>{platformLabels[category.platform].label}</span>
                </div>

                {methods.length > 0 && (
                  <div className={styles.entrySection}>
                    <div className={styles.entrySectionTitle}><span>METHODS</span><b>{methods.length}</b></div>
                    <div className={styles.entryList}>
                      {methods.map((method) => <MethodCard method={method} copied={copied} onCopy={copySignature} key={method.name} />)}
                    </div>
                  </div>
                )}

                {signals.length > 0 && (
                  <div className={styles.entrySection}>
                    <div className={styles.entrySectionTitle}><span>SIGNALS</span><b>{signals.length}</b></div>
                    <div className={styles.entryList}>
                      {signals.map((signal) => <SignalCard signal={signal} key={signal.name} />)}
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.help}>
        <div>
          <span>{"// NEED MORE CONTEXT?"}</span>
          <h2>签名在这里，完整用法也在。</h2>
          <p>参数 Dictionary 的业务字段、权限、用户手势与平台基础库版本，请结合使用指南和源码查看。</p>
        </div>
        <div>
          <a href={GUIDE} target="_blank" rel="noreferrer">阅读中文使用指南 ↗</a>
          <a href={SOURCE} target="_blank" rel="noreferrer">查看 MiniGameSDK.gd ↗</a>
        </div>
      </section>

      <footer className={styles.footer}>
        <a className={styles.brand} href={sitePath("/")}>
          <span><img src={sitePath("/godot.svg")} alt="" /></span>
          <strong>Godot <b>Mini Game</b></strong>
        </a>
        <p>API 数据在每次官网构建时从 MiniGameSDK.gd 自动生成。</p>
        <nav><a href={sitePath("/")}>官网</a><a href={GUIDE}>指南</a><a href={REPO}>GitHub</a></nav>
      </footer>
    </main>
  );
}
