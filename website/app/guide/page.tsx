import { releaseData } from "../site-data.generated";
import { sitePath } from "../site-path";
import { Callout, DocsShell, GUIDE_ZH, REPO, Section, VERSION, certifiedTemplates, styles } from "../docs-shell";

const { bundled, platformContracts } = releaseData;
const tiktok = platformContracts.tiktok;
const MB = 1024 * 1024;

const toc = [
  { id: "overview", label: "接入流程概览" },
  { id: "prepare", label: "一、前期准备" },
  { id: "engine", label: "引擎版本" },
  { id: "adapt", label: "二、小游戏适配" },
  { id: "compatibility", label: "兼容性一览" },
  { id: "notes", label: "适配要点" },
  { id: "integrate", label: "三、小游戏接入" },
  { id: "capabilities", label: "开放能力" },
  { id: "testing", label: "构建与测试" },
  { id: "release", label: "四、提审和发布" },
  { id: "help", label: "五、获取帮助" },
];

type Cell = [string, "yes" | "no" | "part" | ""];

// Statuses reflect the bundled engine and runtime in this release. "part"
// marks partial support or behaviour that has not been verified on devices.
const compatibility: { item: string; wechat: Cell; douyin: Cell; tiktok: Cell; note: string }[] = [
  { item: "图形 API", wechat: ["WebGL 2.0", "yes"], douyin: ["WebGL 2.0", "yes"], tiktok: ["WebGL 2.0", "yes"], note: "加载器拿不到 WebGL 2.0 上下文时会直接报错退出。" },
  { item: "渲染器", wechat: ["Compatibility", "yes"], douyin: ["Compatibility", "yes"], tiktok: ["Compatibility", "yes"], note: "Forward+ 和 Mobile 渲染器不可用。" },
  { item: "GDScript", wechat: ["支持", "yes"], douyin: ["支持", "yes"], tiktok: ["支持", "yes"], note: "" },
  { item: "C# / .NET", wechat: ["不支持", "no"], douyin: ["不支持", "no"], tiktok: ["不支持", "no"], note: "请使用标准版 Godot 编辑器。" },
  { item: "GDExtension", wechat: ["不支持", "no"], douyin: ["不支持", "no"], tiktok: ["不支持", "no"], note: "引擎构建时关闭了动态链接。" },
  { item: "多线程（Thread）", wechat: ["不支持", "no"], douyin: ["不支持", "no"], tiktok: ["不支持", "no"], note: "引擎是单线程构建。微信可用 SDK 的 create_worker() 创建一个 JS Worker。" },
  { item: "3D", wechat: ["未验证", "part"], douyin: ["未验证", "part"], tiktok: ["未验证", "part"], note: "内置引擎包含 3D 模块，但目前只验证了 2D 场景。" },
  { item: "触摸输入", wechat: ["支持", "yes"], douyin: ["支持", "yes"], tiktok: ["支持", "yes"], note: "转换为 Godot 触摸事件；没有触摸监听时转为鼠标和指针事件。" },
  { item: "键盘与文本输入", wechat: ["部分", "part"], douyin: ["部分", "part"], tiktok: ["部分", "part"], note: "没有物理键盘事件，LineEdit 无法弹出输入法。文本输入请用 MiniGameSDK.show_keyboard()，抖音和 TikTok 尚未验证。" },
  { item: "音频播放", wechat: ["支持", "yes"], douyin: ["支持", "part"], tiktok: ["支持", "part"], note: "Godot 的 Web Audio 映射到平台音频上下文。AudioWorklet 不可用，播放位置不精确。抖音和 TikTok 尚未在真机验证。" },
  { item: "麦克风", wechat: ["不支持", "no"], douyin: ["不支持", "no"], tiktok: ["不支持", "no"], note: "AudioStreamMicrophone 不可用；微信可用 SDK 的录音管理器替代。" },
  { item: "res:// 资源", wechat: ["只读", "yes"], douyin: ["只读", "yes"], tiktok: ["只读", "yes"], note: "从 engine 分包里的资源包读取。" },
  { item: "user:// 存档", wechat: ["持久化", "yes"], douyin: ["持久化", "yes"], tiktok: ["仅启动时恢复", "part"], note: "启动时从平台文件系统恢复，每 5 秒和切到后台时写回。TikTok 写回可能导致宿主崩溃，已禁用。" },
  { item: "键值存储", wechat: ["支持", "yes"], douyin: ["支持", "yes"], tiktok: ["支持", "part"], note: "MiniGameSDK.storage_set() / storage_get()。TikTok 不能列出全部键。" },
  { item: "HTTP 请求", wechat: ["支持", "yes"], douyin: ["支持", "yes"], tiktok: ["支持", "yes"], note: "经平台 request 发出，需要在平台后台配置 request 合法域名。" },
  { item: "WebSocket", wechat: ["支持", "yes"], douyin: ["支持", "yes"], tiktok: ["未验证", "part"], note: "必须使用 wss://，并配置 socket 合法域名。" },
  { item: "TCP / UDP", wechat: ["不支持", "no"], douyin: ["不支持", "no"], tiktok: ["不支持", "no"], note: "" },
  { item: "WebRTC", wechat: ["不支持", "no"], douyin: ["不支持", "no"], tiktok: ["不支持", "no"], note: "" },
  { item: "JavaScriptBridge.eval", wechat: ["不建议", "part"], douyin: ["不建议", "part"], tiktok: ["已禁用", "no"], note: "TikTok 的包扫描禁止 eval，导出时会被替换。其它平台也不要依赖动态执行代码。" },
  { item: "远程调试器", wechat: ["不支持", "no"], douyin: ["不支持", "no"], tiktok: ["不支持", "no"], note: "内置引擎是 release 构建。请用开发者工具控制台查看 print 输出。" },
  { item: "屏幕像素比", wechat: ["1×", "part"], douyin: ["1×", "part"], tiktok: ["设备像素比", "yes"], note: "微信和抖音目前按逻辑像素渲染，高分屏上会略显模糊。" },
  { item: "屏幕方向", wechat: ["竖屏 / 横屏", "yes"], douyin: ["竖屏 / 横屏", "yes"], tiktok: ["竖屏 / 横屏", "part"], note: "在导出面板选择，写入 game.json。TikTok 横屏尚未验证。" },
  { item: "主包大小", wechat: ["≤ 4 MB", "yes"], douyin: ["≤ 4 MB", "yes"], tiktok: ["≤ 4 MB", "yes"], note: `插件导出的主包约 0.6 MB，引擎和资源在 engine 分包。TikTok 总包上限 ${tiktok.packageLimitsBytes.total / MB} MB。` },
];

const capabilities = [
  ["登录与会话", "login() · check_session() · get_user_info()", "三个平台"],
  ["隐私授权", "get_privacy_setting() · require_privacy_authorize()", "微信"],
  ["本地存储", "storage_set() · storage_get()", "三个平台"],
  ["分享", "share_app() · show_share_menu()", "按平台能力"],
  ["广告变现", "create_rewarded_ad() · show_rewarded_ad() · create_interstitial_ad()", "按平台能力"],
  ["支付", "request_payment()", "参数是平台契约，不能跨平台复用"],
  ["网络", "http_request() · connect_socket()", "三个平台"],
  ["分包", "load_subpackage() · pre_download_subpackage()", "三个平台"],
  ["屏幕与安全区", "get_window_info() · get_menu_button_rect() · get_system_info()", "三个平台"],
  ["文本输入", "show_keyboard()", "微信；其它平台未验证"],
  ["TikTok 快捷方式与入口任务", "add_shortcut() · start_entrance_mission() 等", "TikTok"],
  ["其它平台接口", "can_i_use() · call_api()", "通用调用，先检查能力"],
];

function Status({ cell }: { cell: Cell }) {
  const [text, kind] = cell;
  return <span className={kind ? styles[kind] : undefined}>{text}</span>;
}

export default function GuidePage() {
  return (
    <DocsShell
      current="guide"
      title="接入指引：Godot 游戏接入微信、抖音与 TikTok 小游戏"
      lead="小游戏运行环境和浏览器不同：没有 DOM、只有单线程和 WebGL 2.0，网络和文件都要经过平台接口。这份指引按“准备 → 适配 → 接入 → 测试 → 发布”的顺序，说明用本插件接入时每一步要做什么、哪些能力可用。"
      meta={[`插件 v${VERSION}`, `Godot ${bundled.godotVersion}`, `Emscripten ${bundled.emscriptenVersion}`]}
      toc={toc}
    >
      <Section id="overview" title="接入流程概览">
        <ol className={styles.flow}>
          <li><strong>前期准备</strong><span>注册小游戏，确认引擎版本</span></li>
          <li><strong>小游戏适配</strong><span>对照兼容性调整游戏</span></li>
          <li><strong>接入插件</strong><span>导出工程，接入开放能力</span></li>
          <li><strong>构建与测试</strong><span>开发者工具和真机验证</span></li>
          <li><strong>提审发布</strong><span>按平台要求提交审核</span></li>
          <li><strong>上线运营</strong><span>迭代版本，持续导出</span></li>
        </ol>
        <p>第一次接入建议先按<a href={sitePath("/quick-start/")}>快速开始</a>把示例跑通，再回到这里逐项适配。</p>
      </Section>

      <Section id="prepare" title="一、前期准备">
        <h3>注册与创建小游戏</h3>
        <p>开发前需要在对应平台注册开发者账号并创建小游戏，拿到导出时要填的标识；上线前还要按平台要求完成备案、类目和资质审核。</p>
        <div className={styles.platformGrid}>
          <div className={styles.platformCard}>
            <header><img src={sitePath("/wechat.svg")} alt="" /><strong>微信小游戏</strong></header>
            <ul>
              <li>在<a href="https://mp.weixin.qq.com/" target="_blank" rel="noreferrer">微信公众平台</a>注册小游戏，获取 AppID。</li>
              <li>参考<a href="https://developers.weixin.qq.com/minigame/dev/guide/" target="_blank" rel="noreferrer">小游戏开发文档</a>配置服务器域名等开发设置。</li>
            </ul>
          </div>
          <div className={styles.platformCard}>
            <header><img src={sitePath("/douyin.svg")} alt="" /><strong>抖音小游戏</strong></header>
            <ul>
              <li>在<a href="https://developer.open-douyin.com/" target="_blank" rel="noreferrer">抖音开放平台</a>入驻并创建小游戏，获取 AppID。</li>
              <li>上线前完成小游戏备案。</li>
            </ul>
          </div>
          <div className={styles.platformCard}>
            <header><img src={sitePath("/tiktok.svg")} alt="" /><strong>TikTok 小游戏（beta）</strong></header>
            <ul>
              <li>在 <a href="https://developers.tiktok.com/doc/mini-games-overview" target="_blank" rel="noreferrer">TikTok for Developers</a> 创建小游戏，获取 Client Key。</li>
              <li>调试需要 TikTok {tiktok.minimumClientVersion} 或更新版本的客户端。</li>
            </ul>
          </div>
        </div>

        <h3 id="engine">引擎版本</h3>
        <p>每份小游戏引擎模板只与一个精确的 Godot 版本匹配。版本号、源码提交和工具链任意一项不一致，导出都会在预检阶段被拒绝，避免引擎和编辑器不匹配导致的运行时错误。目前已认证的编辑器版本：</p>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Godot 编辑器</th><th>源码提交</th><th>引擎模板</th></tr></thead>
            <tbody>
              {certifiedTemplates.map((template) => (
                <tr key={template.version}>
                  <td><code>{template.version}</code></td>
                  <td><code>{template.commit}</code></td>
                  <td>{template.bundled ? "随插件内置" : <><a href={template.releaseUrl} target="_blank" rel="noreferrer">模板 Release</a>，在导出面板导入</>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>所有已认证模板都使用 Emscripten <code>{bundled.emscriptenVersion}</code>、<code>{bundled.target}</code> 构建，单线程，不含 SIMD、WASM 异常和动态链接，Bridge ABI 为 <code>{releaseData.bridgeAbi}</code>。官方编辑器报告的提交号与 tag 不同时（例如 4.6.3），模板会记录官方编辑器的提交号，导出时一并接受。</p>
        <p>需要使用其它 Godot 版本时，按<a href={`${GUIDE_ZH}#12-编译自定义引擎模板`} target="_blank" rel="noreferrer">使用文档的“编译自定义引擎模板”</a>构建一份完全匹配的模板包，再在导出面板里点击“导入引擎模板…”。不同版本的模板可以并存，导出时按编辑器版本自动选择。</p>
        <Callout title="不能用 Godot 官方 Web 导出模板" warn>
          <p>官方 Web 模板会用到 SIMD、WASM 异常等特性，小游戏真机的 WebAssembly 实现不支持，通常会在编译阶段失败。插件不会回退到官方模板。</p>
        </Callout>
      </Section>

      <Section id="adapt" title="二、小游戏适配">
        <p>插件的适配层已经处理了画布、触摸、网络、文件系统和音频的对接，但游戏本身仍需要按小游戏环境做一些调整。建议先让游戏在手机浏览器的 Web 导出里正常运行，再按下表检查差异。</p>

        <h3 id="compatibility">兼容性一览</h3>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>能力</th><th>微信</th><th>抖音</th><th>TikTok</th><th>说明</th></tr></thead>
            <tbody>
              {compatibility.map((row) => (
                <tr key={row.item}>
                  <td>{row.item}</td>
                  <td><Status cell={row.wechat} /></td>
                  <td><Status cell={row.douyin} /></td>
                  <td><Status cell={row.tiktok} /></td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>表中“未验证”表示代码层面已对接，但尚未在该平台的真机上确认；上线前请在真机上实测这些能力。</p>

        <h3 id="notes">适配要点</h3>
        <ul>
          <li><strong>输入</strong>：以触摸为主。需要输入文字时调用 <code>MiniGameSDK.show_keyboard()</code>，通过 <code>keyboard_event</code> 信号拿到输入内容。</li>
          <li><strong>屏幕与安全区</strong>：引擎不会自动避开刘海和右上角胶囊按钮。用 <code>get_window_info()</code> 和 <code>get_menu_button_rect()</code> 读取区域后自行留白。屏幕方向在导出面板里选择，请和项目设置保持一致。</li>
          <li><strong>存档</strong>：微信和抖音上 <code>user://</code> 会自动持久化；TikTok 上只在启动时恢复。需要跨平台可靠保存的数据，用 <code>storage_set()</code>。第一次以小游戏运行时 <code>user://</code> 是空的，读取不到浏览器版本的旧存档。</li>
          <li><strong>网络</strong>：请求、WebSocket、上传和下载的合法域名要在平台后台分别配置，WebSocket 必须使用 <code>wss://</code>。</li>
          <li><strong>包体</strong>：主包只有启动代码，引擎和全部游戏资源在 <code>engine</code> 分包里。目前每次导出只生成一个资源包，暂不支持把游戏资源拆成多个自定义分包；请用导出预设的资源过滤和资源压缩控制包体。</li>
          <li><strong>不可用的能力</strong>：多线程、GDExtension、C#、TCP/UDP、WebRTC、麦克风和远程调试器都不可用，需要的话请改用平台能力或其它实现。</li>
        </ul>
      </Section>

      <Section id="integrate" title="三、小游戏接入">
        <p>插件由两部分组成：</p>
        <ul>
          <li><strong>导出面板与导出器</strong>：校验引擎模板，生成各平台的入口、配置和分包结构，校验通过后再发布到输出目录。</li>
          <li><strong>MiniGameSDK</strong>：启用插件后自动注册的单例，用一套 GDScript 接口访问微信 <code>wx</code>、抖音 <code>tt</code> 和 TikTok 的平台能力。异步结果通过信号返回，在编辑器里调用也会安全回退。</li>
        </ul>

        <h3 id="capabilities">开放能力</h3>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>能力</th><th>主要接口</th><th>平台</th></tr></thead>
            <tbody>
              {capabilities.map(([name, api, platforms]) => (
                <tr key={name}><td>{name}</td><td><code>{api}</code></td><td>{platforms}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>同名接口会先检查当前平台是否支持，不支持时通过信号返回错误，而不是直接崩溃。支付等平台特有能力的参数各不相同，需要分别对接。完整列表见 <a href={sitePath("/api/")}>API 参考</a>。</p>

        <h3 id="testing">构建与测试</h3>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>平台</th><th>调试工具</th><th>本项目的自动化验证</th><th>发布前需要</th></tr></thead>
            <tbody>
              <tr><td>微信</td><td>微信开发者工具</td><td>每次提交自动导出并检查包结构</td><td>开发者工具运行和真机测试</td></tr>
              <tr><td>抖音</td><td>抖音开发者工具</td><td>每次提交自动导出并检查包结构</td><td>开发者工具运行和真机测试</td></tr>
              <tr><td>TikTok</td><td><code>ttmg dev</code>（{tiktok.devtoolVersion}）</td><td>每次提交自动导出并检查包结构</td><td><code>ttmg</code> 编译通过，并在 {tiktok.minimumClientVersion}+ 客户端真机运行</td></tr>
            </tbody>
          </table>
        </div>
        <p>自动化检查只能证明导出结果结构正确，不能代替开发者工具和真机测试。导入和运行的具体步骤见<a href={sitePath("/quick-start/#run")}>快速开始</a>。</p>
      </Section>

      <Section id="release" title="四、提审和发布">
        <p>导出结果用对应平台的开发者工具上传，再到平台后台提交审核。提审前请逐项检查：</p>
        <ul>
          <li><strong>真机测试</strong>：在目标平台的真机上完整跑一遍主要流程，包括首次启动、存档和网络。</li>
          <li><strong>服务器域名</strong>：request、socket、uploadFile、downloadFile 的合法域名已在后台配置。</li>
          <li><strong>隐私协议</strong>：微信上用 <code>get_privacy_setting()</code> 和 <code>require_privacy_authorize()</code> 处理授权，并在开发者工具和真机上验证同意弹窗。</li>
          <li><strong>实名认证与适龄提示</strong>：国内小游戏必须接入。</li>
          <li><strong>防沉迷</strong>：有内购或社交功能的游戏必须配置。</li>
          <li><strong>图标与资料</strong>：按平台后台要求上传各尺寸图标并完善游戏信息。</li>
        </ul>
        <p>各平台的审核规则以官方文档为准：<a href="https://developers.weixin.qq.com/minigame/dev/guide/" target="_blank" rel="noreferrer">微信小游戏开发文档</a>、<a href="https://developer.open-douyin.com/" target="_blank" rel="noreferrer">抖音开放平台</a>、<a href="https://developers.tiktok.com/doc/mini-games-overview" target="_blank" rel="noreferrer">TikTok for Developers</a>。</p>
      </Section>

      <Section id="help" title="五、获取帮助">
        <div className={styles.nextGrid}>
          <a href={sitePath("/quick-start/#troubleshoot")}><strong>常见问题 →</strong><span>启动卡住、游客模式、模板不匹配等问题的排查方法。</span></a>
          <a href={GUIDE_ZH} target="_blank" rel="noreferrer"><strong>完整使用文档 ↗</strong><span>自定义模板、存储、网络、广告支付等详细用法。</span></a>
          <a href={`${REPO}/issues`} target="_blank" rel="noreferrer"><strong>GitHub Issues ↗</strong><span>报告问题或提出功能建议，请附上平台、插件版本和控制台日志。</span></a>
        </div>
      </Section>
    </DocsShell>
  );
}
