import { apiMethods, apiSignals } from "../api/api-data.generated";
import { releaseData } from "../site-data.generated";
import { sitePath } from "../site-path";
import { Callout, Code, DocsShell, GUIDE_ZH, RELEASE, Section, Shot, VERSION, certifiedTemplates, styles } from "../docs-shell";

const { bundled } = releaseData;
const tiktok = releaseData.platformContracts.tiktok;
const PACKAGE = `godot_mini_game_v${VERSION}.zip`;

const toc = [
  { id: "prepare", label: "开始前准备" },
  { id: "install", label: "1. 安装插件" },
  { id: "enable", label: "2. 启用插件" },
  { id: "preset", label: "3. 添加 Web 导出预设" },
  { id: "dock", label: "4. 填写导出面板" },
  { id: "export", label: "5. 导出" },
  { id: "run", label: "6. 在开发者工具中运行" },
  { id: "sdk", label: "7. 调用第一个 SDK 接口" },
  { id: "troubleshoot", label: "常见问题" },
  { id: "next", label: "下一步" },
];

const exportLog = `平台: wechat | AppID: <你的 AppID> | 方向: portrait
输出目录: /tmp/my-minigame/wechat
步骤 1/7: 导出资源包 (.pck) ...
  PCK 已导出 → engine/godot.zip (耗时 2.1s)
步骤 2/7: 获取已校验的引擎模板束 ...
  已使用 bundled 模板束 (${bundled.godotVersion})
  已注入 mini-game 兼容补丁到 godot.js
步骤 3/7: 复制 JS 运行时模板 ...
步骤 4/7: 生成平台配置 (wechat) ...
步骤 5/7: 创建占位文件 ...
步骤 6/7: 生成产物校验清单 ...
步骤 7/7: 事务发布导出结果 ...
导出完成！→ /tmp/my-minigame/wechat`;

const outputTree = `wechat/
├── game.js                       # 小游戏入口
├── game.json                     # 分包声明、屏幕方向
├── project.config.json           # AppID 等开发者工具配置
├── project.private.config.json
├── adapter.js · fetch.js         # 浏览器环境适配
├── js/                           # 加载器、平台运行时、SDK 桥、godot.js
├── images/ · audio/              # 加载页图片、示例音频
├── engine/                       # engine 分包
│   ├── godot.wasm.br             # 小游戏兼容的 Godot 引擎
│   └── godot.zip                 # 你的游戏资源包（ZIP 格式）
├── subpacks/                     # 预留分包
└── .godot-mini-game-export.json  # 插件的产物清单，请勿删除`;

const sdkSample = `func _ready() -> void:
    if not MiniGameSDK.is_mini_game:
        print("在编辑器里运行：SDK 调用会安全回退，不会报错")

    MiniGameSDK.login_completed.connect(_on_login_completed)
    MiniGameSDK.login()

    MiniGameSDK.storage_set("level", "5")
    var level := MiniGameSDK.storage_get("level", "1")
    MiniGameSDK.show_toast("Level %s" % level, "success")


func _on_login_completed(code: String, error: String) -> void:
    if error.is_empty():
        print("login code: ", code)
    else:
        print("login failed: ", error)`;

const ttmgCommands = `npm install -g @ttmg/cli@${tiktok.devtoolVersion}
ttmg setup
ttmg login

cd /path/to/my-minigame/tiktok
ttmg init        # 输入与导出时相同的 Client Key
ttmg dev         # 编译游戏资源并打开调试页`;

export default function QuickStartPage() {
  return (
    <DocsShell
      current="quick-start"
      title="快速开始：把 Godot 游戏跑进小游戏开发者工具"
      lead="从下载插件到在开发者工具里看到游戏画面，按顺序走一遍大约 10 分钟。微信、抖音和 TikTok 只有最后的运行步骤不同。本页截图都来自插件的真实导出和微信开发者工具运行结果。"
      meta={[`插件 v${VERSION}`, `Godot ${certifiedTemplates.map((template) => template.version.replace(".stable", "")).join(" / ")}`, "微信 · 抖音 · TikTok"]}
      toc={toc}
    >
      <Section id="prepare" title="开始前准备">
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>项目</th><th>要求</th><th>说明</th></tr></thead>
            <tbody>
              <tr>
                <td>Godot 编辑器</td>
                <td>已认证的精确版本，标准版</td>
                <td>
                  {certifiedTemplates.map((template, index) => (
                    <span key={template.version}>
                      {index > 0 ? "、" : ""}<code>{template.version}</code>
                      {template.bundled ? "（内置）" : <>（<a href={template.releaseUrl} target="_blank" rel="noreferrer">模板 Release</a>）</>}
                    </span>
                  ))}
                  。使用非内置版本时，先下载对应的模板 ZIP，在导出面板点“导入引擎模板…”。其它版本需要构建版本完全一致的模板，见<a href={sitePath("/guide/#engine")}>接入指引</a>。不支持 .NET（C#）版本。
                </td>
              </tr>
              <tr>
                <td>渲染器</td>
                <td>Compatibility</td>
                <td>小游戏只提供 WebGL 2.0。在“项目设置 → 渲染 → 渲染器”里选择 Compatibility。</td>
              </tr>
              <tr>
                <td>平台账号</td>
                <td>AppID 或 Client Key</td>
                <td>微信、抖音在开放平台创建小游戏后得到 AppID；TikTok 导出必须填写 Client Key。</td>
              </tr>
              <tr>
                <td>开发者工具</td>
                <td>按目标平台准备</td>
                <td>微信开发者工具、抖音开发者工具；TikTok 用 Node.js 安装 <code>ttmg</code> 命令行工具。</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout title="不需要额外的编译环境">
          <p>日常导出不需要安装 Node.js、Emscripten 或 Brotli，也不需要下载 Godot 官方 Web 导出模板。插件已经带好小游戏兼容的引擎。只有 TikTok 调试要用 Node.js 安装 <code>ttmg</code>。</p>
        </Callout>
      </Section>

      <Section id="install" step="01" title="安装插件">
        <ol>
          <li>打开 <a href={RELEASE} target="_blank" rel="noreferrer">GitHub Releases 的最新版本</a>，在 Assets 里下载 <code>{PACKAGE}</code>。不要下载 GitHub 自动生成的 Source code 压缩包。</li>
          <li>把压缩包解压到 Godot 项目根目录，确认目录结构如下：</li>
        </ol>
        <Code label="项目目录">{`your_project/
├── project.godot
└── addons/
    └── godot_mini_game/
        ├── plugin.cfg
        ├── MiniGameSDK.gd
        ├── engine/        # 内置的小游戏 WASM 引擎
        └── templates/     # 微信、抖音、TikTok 运行时模板`}</Code>
      </Section>

      <Section id="enable" step="02" title="启用插件">
        <p>打开<strong>项目（Project）→ 项目设置（Project Settings）→ 插件（Plugins）</strong>，勾选 <strong>Godot Mini Game Export</strong>。</p>
        <Shot
          src="godot-plugins.webp"
          width={1400}
          height={204}
          alt="Godot 项目设置的插件页，Godot Mini Game Export 0.3.0 已启用"
          caption="启用后，插件版本和作者信息显示在列表里。"
        />
        <p>启用插件会发生两件事：</p>
        <ul>
          <li>编辑器右侧出现 <strong>MiniGameExport</strong> 面板，后面的导出都在这里完成；</li>
          <li>插件把 <code>MiniGameSDK</code> 注册为自动加载（Autoload），游戏代码里可以直接调用。如果项目里已经有同名的自动加载，插件会在输出面板报错，不会覆盖它。</li>
        </ul>
      </Section>

      <Section id="preset" step="03" title="添加 Web 导出预设">
        <p>打开<strong>项目 → 导出（Export）</strong>，点击<strong>添加（Add…）→ Web</strong>。名称随意，下面的截图里叫 <code>MiniGame</code>。</p>
        <Shot
          src="godot-export-preset.webp"
          width={1400}
          height={595}
          alt="Godot 导出对话框，左侧是名为 MiniGame 的 Web 预设，Thread Support 和 Extensions Support 均为关闭"
          caption="保持 Thread Support（线程支持）和 Extensions Support（扩展支持）关闭：小游戏引擎是单线程构建，也不支持 GDExtension。"
        />
        <Callout title="导出对话框里的红字可以忽略" warn>
          <p>这里会提示 “No export template found”。插件只用这个预设导出游戏资源包（engine/godot.zip），引擎来自插件自带的模板，所以不需要下载官方 Web 模板。预设的 Resources 标签决定哪些资源进包，插件会原样使用，不会改写它。</p>
        </Callout>
      </Section>

      <Section id="dock" step="04" title="填写导出面板">
        <p>回到编辑器，在右侧 <strong>MiniGameExport</strong> 面板里填写导出参数：</p>
        <Shot
          src="godot-editor-dock.webp"
          width={1600}
          height={812}
          alt="Godot 编辑器全貌，右侧 MiniGameExport 面板已选择微信小游戏、填写 AppID、竖屏、MiniGame 预设和输出目录"
          caption="导出面板位于编辑器右侧。示例里的 AppID 是占位值，请换成你自己的。"
        />
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>字段</th><th>怎么填</th></tr></thead>
            <tbody>
              <tr><td>目标平台</td><td>微信小游戏、抖音小游戏或 TikTok Mini Game。一次导出一个平台，每个平台用各自的输出目录。</td></tr>
              <tr><td>App ID / Client Key</td><td>微信、抖音填 AppID，写入 <code>project.config.json</code>；TikTok 必须填 Client Key。</td></tr>
              <tr><td>屏幕方向</td><td>竖屏或横屏，写入 <code>game.json</code> 的 <code>deviceOrientation</code>。不会读取项目设置里的方向，两边请保持一致。</td></tr>
              <tr><td>Web 导出预设</td><td>上一步创建的 Web 预设。</td></tr>
              <tr><td>输出目录</td><td>第一次请选一个<strong>新的空目录</strong>，并且必须在 Godot 项目之外。之后可以一直导出到同一个目录，插件只替换它自己管理的文件。</td></tr>
              <tr><td>引擎模板</td><td>显示绿色的“兼容模板就绪”才能导出。使用非内置的已认证版本时，先点“导入引擎模板…”导入对应的模板 ZIP。显示不匹配时，说明编辑器版本和模板不一致。</td></tr>
              <tr><td>资源导出超时</td><td>导出游戏资源包的时间上限，默认 600 秒。资源很多的项目可以调大。</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="export" step="05" title="导出">
        <p>点击<strong>导出小游戏</strong>。面板底部会依次打印 7 个步骤，最后显示“导出成功”。</p>
        <div className={styles.figurePair}>
          <Shot
            src="godot-dock-exported.webp"
            width={600}
            height={1472}
            alt="导出面板底部显示导出成功"
            caption="导出完成后，面板底部显示绿色的“导出成功”。"
            narrow
          />
          <div>
            <Code label="导出日志（节选）">{exportLog}</Code>
            <p>导出时插件先在输出目录旁边的临时目录里生成全部文件，校验通过后才替换输出目录里由插件管理的文件；替换过程中出错会回滚，不会破坏上一次的导出结果。</p>
          </div>
        </div>
        <h3>输出目录结构</h3>
        <Code label="/tmp/my-minigame/wechat">{outputTree}</Code>
        <p>主包只放启动代码，示例项目的主包约 0.6 MB。引擎和游戏资源放在 <code>engine</code> 分包里（示例里约 14 MB，其中引擎约 6 MB），游戏启动时自动加载。</p>
        <Callout title="不要手动修改插件管理的文件" warn>
          <p><code>audio/</code>、<code>engine/</code>、<code>images/</code>、<code>js/</code>、<code>subpacks/</code> 和顶层的入口、配置文件都由插件管理。手动放进去的文件会让下一次导出在预检阶段被拒绝；需要额外文件时，请放在其它顶层目录里。</p>
        </Callout>
      </Section>

      <Section id="run" step="06" title="在开发者工具中运行">
        <h3>微信小游戏</h3>
        <ol>
          <li>打开<a href="https://developers.weixin.qq.com/minigame/dev/devtools/download.html" target="_blank" rel="noreferrer">微信开发者工具</a>，选择<strong>小游戏 → 导入项目</strong>。</li>
          <li>目录选择上一步的输出目录，AppID 会自动从 <code>project.config.json</code> 读取。</li>
          <li>导入后工具会自动编译。模拟器先显示加载进度条，加载完成后进入游戏。</li>
        </ol>
        <div className={styles.figurePair}>
          <Shot
            src="wechat-simulator.webp"
            width={478}
            height={1023}
            alt="微信开发者工具模拟器中运行的 Godot 示例游戏"
            caption="微信开发者工具模拟器里运行的示例项目。"
            narrow
          />
          <div>
            <Shot
              src="wechat-console.webp"
              width={1200}
              height={340}
              alt="微信开发者工具控制台显示 Compatibility 渲染器、单线程构建和加载完成日志"
              caption="控制台里出现这几行，说明启动成功。"
            />
            <p>判断启动成功的依据：</p>
            <ul>
              <li><code>OpenGL API OpenGL ES 3.0 (WebGL 2.0 …) – Compatibility</code>：WebGL 2.0 上下文创建成功；</li>
              <li><code>Build configuration: Emscripten {bundled.emscriptenVersion}, single-threaded, no GDExtension support</code>：运行的是插件内置的引擎；</li>
              <li><code>[Loader] ✓ 加载完成，游戏已启动</code>：引擎分包加载、存档恢复和引擎启动都已完成。</li>
            </ul>
          </div>
        </div>
        <Callout title="模拟器停在 33%？" warn>
          <ul>
            <li>v0.3.0 之前的插件版本，适配层会覆盖开发者工具加载分包所用的全局对象，<code>engine</code> 分包因此一直没有回调。升级到 v0.3.0 或更新版本后重新导出即可。</li>
            <li>如果报 <code>loadSubpackage:fail module not found</code>，通常是项目在游客模式下运行：当前登录的账号没有这个 AppID 的开发权限。请换成有开发权限的 AppID。</li>
          </ul>
        </Callout>
        <p>模拟器正常后，用工具栏的<strong>预览</strong>扫码，或用<strong>真机调试</strong>，在手机上验证一遍。发布前一定要在真机上测试。</p>

        <h3>抖音小游戏</h3>
        <ol>
          <li>在<a href="https://developer.open-douyin.com/" target="_blank" rel="noreferrer">抖音开放平台</a>文档的“开发工具”栏目下载抖音开发者工具。</li>
          <li>选择<strong>导入项目</strong>，目录选择抖音平台的输出目录。抖音的 <code>game.json</code> 使用区分大小写的 <code>subPackages</code> 字段，插件导出时已经处理好。</li>
          <li>编译后在模拟器中运行，再用预览扫码在真机上验证。</li>
        </ol>

        <h3>TikTok 小游戏（beta）</h3>
        <p>TikTok 用 <code>ttmg</code> 命令行工具编译和调试：</p>
        <Code label="终端">{ttmgCommands}</Code>
        <p>编译成功时终端会显示 <code>✔ 游戏资源编译成功！</code>，然后用 TikTok {tiktok.minimumClientVersion} 或更新版本的客户端扫码，在真机上调试。</p>
        <Callout title="TikTok 的注意事项" warn>
          <ul>
            <li>第一次使用前必须在导出目录里运行 <code>ttmg init</code>。导出时填的 Client Key 不会自动写入 <code>ttmg</code> 的配置，跳过这一步会报 <code>Missing clientKey</code>。</li>
            <li><code>ttmg build</code> 目前对 Native 小游戏只是占位命令，不会真正打包。编译和调试请用 <code>ttmg dev</code>。</li>
            <li>TikTok 上 <code>user://</code> 的文件只在启动时恢复，不会写回。需要持久保存的数据请用 <code>MiniGameSDK.storage_set()</code>。</li>
          </ul>
        </Callout>
      </Section>

      <Section id="sdk" step="07" title="调用第一个 SDK 接口">
        <p>插件启用后，<code>MiniGameSDK</code> 可以在任何脚本里直接使用。异步接口通过信号返回结果；在编辑器或普通 Web 环境里调用也是安全的，会走回退逻辑而不是报错。</p>
        <Code label="GDScript">{sdkSample}</Code>
        <p>SDK 共提供 {apiMethods.length} 个方法和 {apiSignals.length} 个信号，但并不是每个方法在三个平台上都可用。调用平台特有能力前，请先查看 <a href={sitePath("/api/")}>API 参考</a>里的平台说明。</p>
      </Section>

      <Section id="troubleshoot" title="常见问题">
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>现象</th><th>原因</th><th>处理</th></tr></thead>
            <tbody>
              <tr><td>面板提示没有匹配的引擎模板</td><td>编辑器不是 {bundled.godotVersion}</td><td>换用 {bundled.godotVersion}，或导入版本完全一致的模板包。</td></tr>
              <tr><td>输出目录预检失败</td><td>目录在 Godot 项目内，或是非空且不是插件导出过的目录</td><td>选一个项目外的新空目录。</td></tr>
              <tr><td>模拟器停在 33%</td><td>v0.3.0 之前的插件版本的适配层问题</td><td>升级到 v0.3.0 或更新版本后重新导出。</td></tr>
              <tr><td><code>module not found</code>，存储目录是 <code>touristappid</code></td><td>项目在游客模式下运行</td><td>换成当前账号有开发权限的 AppID。</td></tr>
              <tr><td><code>WXWebAssembly.compile CompileError</code></td><td>用了 Godot 官方 Web 模板</td><td>使用插件内置或导入的兼容模板。</td></tr>
              <tr><td>白屏，日志有 <code>GL.createContext failed</code></td><td>画布被重复获取上下文</td><td>基础库升级到 3.2 及以上，或重启开发者工具。</td></tr>
              <tr><td><code>Missing clientKey</code></td><td>跳过了 <code>ttmg init</code></td><td>在导出目录里用同一个 Client Key 运行 <code>ttmg init</code>。</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="next" title="下一步">
        <div className={styles.nextGrid}>
          <a href={sitePath("/guide/")}><strong>接入指引 →</strong><span>兼容性一览、适配要点、平台开放能力和提审发布。</span></a>
          <a href={sitePath("/api/")}><strong>API 参考 →</strong><span>MiniGameSDK 全部方法、信号和平台支持说明。</span></a>
          <a href={GUIDE_ZH} target="_blank" rel="noreferrer"><strong>完整使用文档 ↗</strong><span>自定义模板、存储、网络、广告支付等详细用法。</span></a>
        </div>
      </Section>
    </DocsShell>
  );
}
