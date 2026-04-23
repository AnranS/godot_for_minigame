<p align="right">
  <a href="USAGE.md">English</a> · <strong>简体中文</strong>
</p>

# Godot Mini Game 使用文档

本文档覆盖从安装到上线的完整流程，并对导出 Dock 的每个字段、SDK 每个接口、以及常见坑位做详细说明。如果只想快速跑通，看 [README_zh.md](../README_zh.md) 即可。

- [1. 环境准备](#1-环境准备)
- [2. 安装与启用](#2-安装与启用)
- [3. 创建 Web 导出预设](#3-创建-web-导出预设)
- [4. 导出 Dock 详解](#4-导出-dock-详解)
- [5. 引擎模板管理](#5-引擎模板管理)
- [6. 导出产物结构](#6-导出产物结构)
- [7. 微信 / 抖音开发者工具导入](#7-微信--抖音开发者工具导入)
- [8. MiniGameSDK 详细用法](#8-minigamesdk-详细用法)
- [9. 资源与子包策略](#9-资源与子包策略)
- [10. 本地存储与云端同步](#10-本地存储与云端同步)
- [11. 真机联调与审核](#11-真机联调与审核)
- [12. 编译自定义引擎模板](#12-编译自定义引擎模板)
- [13. 常见问题 FAQ](#13-常见问题-faq)

---

## 1. 环境准备

| 工具 | 版本 | 用途 |
|------|------|------|
| Godot | 4.3 – 4.6（测试过） | 引擎本体 |
| 微信开发者工具 | latest stable | 调试/上传微信小游戏 |
| 抖音开发者工具 | latest stable | 调试/上传抖音小游戏 |
| Node.js | ≥ 16 LTS（推荐） | 使用内置 zlib 做 Brotli 压缩 |
| brotli CLI | 可选 | Node 不可用时的回退方案 |

> macOS 安装 Brotli：`brew install brotli`
> Ubuntu / Debian：`sudo apt install brotli`

Brotli 用于在导出时把 `godot.wasm` 压缩成 `godot.wasm.br`（小游戏平台默认用 Brotli 解码 WASM，可以把包从 ~20 MB 压到 ~6 MB）。没有 Node 和 brotli CLI 时插件会跳过压缩，改为发布未压缩的 `.wasm`，体积会超过单包 4 MB 上限，不建议这么做。

---

## 2. 安装与启用

### 方式 A：下载 Release

从 [Releases 页](../../releases) 下载最新 `godot_mini_game-*.zip`，解压后把 `addons/godot_mini_game/` 放到项目根目录：

```
your_project/
├── project.godot
└── addons/
    └── godot_mini_game/
        ├── plugin.cfg
        ├── engine/           # 预编译引擎（必须保留）
        ├── templates/
        ├── exporter.gd
        ├── export_dock.gd / .tscn
        └── MiniGameSDK.gd
```

### 方式 B：克隆仓库

```bash
git clone https://github.com/AnranS/godot_for_minigame.git
cp -r godot_for_minigame/addons/godot_mini_game your_project/addons/
```

### 启用插件

Godot 编辑器 → **Project > Project Settings > Plugins** → 勾选 **Godot Mini Game Export**。启用后：

- 编辑器底部出现 **Mini Game Export** Dock
- 自动注册 `MiniGameSDK` autoload（在 Project Settings > AutoLoad 可以看到）

> 如果没看到 Dock，切换一下编辑器视图（2D/3D/Script）让布局刷新，或重启编辑器。

---

## 3. 创建 Web 导出预设

**Project > Export** → **Add...** → 选 **Web**。名字随便起（例如 `MiniGame`），其它参数保持默认即可，不需要下载 Web 导出模板。

> **为什么不需要下载模板？** 插件用 `--export-pack` 只导出 `.pck`，引擎二进制从 `addons/godot_mini_game/engine/` 读取。这绕开了 Godot 官方 Web 模板的 WASM 特性限制（SIMD / 异常 Tag 在真机 `WXWebAssembly` 上跑不起来）。

> **导出过滤会被覆盖**：插件会把所选预设的 `export_filter` 强制改成 `all_resources`，并清掉 `export_files`，确保所有资源都被打包。如果你有严格的资源筛选需求，建议专门建一个供插件使用的预设。

---

## 4. 导出 Dock 详解

Dock 位于编辑器底部，依次包含以下字段：

### 平台 Platform

| 选项 | 说明 |
|------|------|
| 微信小游戏 | 导出 `wechat` 模板，生成 `project.config.json` + `project.private.config.json` |
| 抖音小游戏 | 导出 `douyin` 模板，生成抖音用的 `project.config.json` |

平台差异：
- 微信的 `game.json` 多了 `iOSHighPerformance` 与 `workers.path`（用于音频 worklet）
- 抖音目前不启用 workers

### AppID

- 微信：在 [微信公众平台](https://mp.weixin.qq.com) 注册小游戏后获得的 `wx...` ID。
- 抖音：在 [抖音开放平台](https://developer.open-douyin.com) 获得的 `tt...` ID。
- 如果只做本地联调，可以留空或填任意字符串；上传时必须是真实 AppID。

### 屏幕方向 Orientation

- `portrait`：竖屏
- `landscape`：横屏

这会写入 `game.json` 的 `deviceOrientation`。Godot 里的 **Project Settings > Display > Window > Orientation** 不会自动同步，按需手动对齐。

### 导出预设 Preset

Dock 自动扫描 `export_presets.cfg` 里的所有预设，选择第 3 步创建的那个 Web 预设。

### 输出目录 Output

点 **浏览** 选一个**空目录**，每次导出都会覆盖里面的 `engine/`、`subpacks/`、`js/`、`images/`、`game.js`、`game.json` 等。为了避免冲突，不要把输出目录放在 Godot 项目内。

### 导出 Export

点击后，Dock 日志区会输出 5 个步骤进度：

```
步骤 1/5: 导出资源包 (.pck) ...
步骤 2/5: 获取引擎文件 (godot.js / godot.wasm) ...
步骤 3/5: 复制 JS 运行时模板 ...
步骤 4/5: 生成平台配置 (wechat) ...
步骤 5/5: 创建占位文件 ...
```

完成后会弹窗提示导出路径。任何步骤报错都会在日志里用红色标出。

---

## 5. 引擎模板管理

Dock 顶部的 **引擎模板** 栏显示当前查找结果。插件按以下顺序搜索：

| 优先级 | 位置 | 使用场景 |
|--------|------|---------|
| 1 | `addons/godot_mini_game/godot.js` + `godot.wasm.br` | 手动覆盖（调试/定制） |
| 2 | `addons/godot_mini_game/engine/` | 插件内置，默认走这里 |
| 3 | `~/.config/godot_mini_game/templates/{major.minor}/` | 通过 Dock 导入的模板库 |
| 4 | Godot 官方 Web 导出模板 zip | 仅开发者工具模拟器可用，带警告 |

### 导入新版引擎模板

点 **导入模板**，选一个 zip：
- 可以是 GitHub Actions 产出的 `minigame-template-*.zip`
- 也可以是自己用 `scripts/build_wasm_template.sh` 编出来的 zip

导入流程：
1. 插件扫描 zip 里的 `godot.js`、`godot.wasm` / `godot.wasm.br`
2. 解压到 `~/.config/godot_mini_game/templates/{4.x}/`（跨项目复用）
3. 如果只找到未压缩的 `.wasm`，会自动调 Node/brotli CLI 生成 `.wasm.br`
4. 写入 `version.txt` 做版本标记

### 刷新

点 **刷新** 重新评估模板状态（比如你手动替换了 `engine/` 里的文件）。

### 运行时补丁

在取到 `godot.js` 后，插件会自动注入若干小游戏兼容补丁（全部在 `exporter.gd::_patch_godot_js`）：

- 把裸 `document` / `window` / `navigator` 重写到 `GameGlobal.__adapter` 提供的 polyfill
- 把 `Engine` / `Godot` 挂到 `GameGlobal`，loader 能找到
- 修复 `GodotConfig.canvas.parentElement` 在小游戏里为 `null` 的崩溃
- 替换 `GL.createContext`：在 `canvas` 为 null 或 `getContext` 二次失败时，回退到 `GameGlobal.canvas` 的缓存 context
- 中和 `connectPositionWorklet`：AudioWorkletNode 在小游戏里没法连到原生 AudioNode，这里改成仅 `start()`（音频能放，只丢失采样级位置回调）
- 把 `isWebGLAvailable` 改成捕获异常、默认返回 true

这些补丁是幂等的——如果检测到文件已被补过就会跳过。

---

## 6. 导出产物结构

```
<output>/
├── game.js                # 平台入口（wechat/douyin 专属）
├── game.json              # 平台 manifest
├── project.config.json
├── project.private.config.json   # 仅微信
├── adapter.js             # DOM/BOM/Audio/Input 适配层
├── fetch.js               # fetch/XHR polyfill
├── engine/                # 引擎子包
│   ├── godot.wasm.br      # Brotli 压缩的 WASM
│   ├── godot.zip          # 由 .pck 重命名而来的资源包
│   ├── godot.audio.worklet.js
│   ├── godot.audio.position.worklet.js
│   └── game.js            # 占位（子包必须有 game.js）
├── subpacks/              # 预留的额外子包目录
│   └── game.js            # 占位
├── js/
│   ├── libs/
│   │   ├── godot.js       # 打过补丁的 Emscripten 胶水
│   │   └── sdk.js         # GDScript ↔ JS 桥
│   ├── loader.js          # 加载动画 + 启动引擎
│   └── worker/
│       └── position_reporting.js  # 微信 game.json 要求的 worker 目录
└── images/
    ├── logo.png
    └── background.png
```

### 重要约定

- **`engine/` 是微信分包 `engine`**：`game.json` 里声明 `{"root":"engine/","name":"engine"}`，loader 在启动时用 `wx.loadSubpackage({name:"engine"})` 拉取，冷启动更快。
- **`subpacks/` 是预留分包**：暂时空着。如果你有大额资源（比如关卡数据、视频），可以把它们放进 `subpacks/` 并在 `game.json` 里扩展 `subpackages`。
- **`js/worker/` 必须存在**：微信 `game.json` 里声明了 `workers.path: js/worker`，哪怕不真用 Worker 也要有这个目录，否则上传 / 真机会报错。

---

## 7. 微信 / 抖音开发者工具导入

### 微信小游戏

1. 打开微信开发者工具 → **小游戏** → **导入项目**
2. **目录** 选导出目录
3. **AppID** 填 Dock 里填的那个（自动从 `project.config.json` 读）
4. 勾选 **游戏** 作为项目类型
5. 点击 **导入**

成功后：
- 点 **编译** 查看模拟器
- **调试 → 切换基础库** 建议选最新稳定版（≥ 3.2.0），太老的版本 WXWebAssembly 可能缺失 API
- **详情 → 本地设置** 勾选 **不校验合法域名**（真机上传前记得取消）

### 抖音小游戏

1. 打开抖音开发者工具 → **小游戏** → **导入项目**
2. 选导出目录即可，AppID 从 `project.config.json` 自动识别
3. 点击 **编译**

### 常见首次报错

| 症状 | 原因 | 解决 |
|------|------|------|
| `WXWebAssembly.compile CompileError` | 用了官方 Web 模板（带 SIMD / 异常 Tag） | 换用内置/导入的兼容模板 |
| `GameGlobal.canvas is not defined` | `game.js` 没被当作入口执行 | 确认 `game.json` 里的入口 (`game.js`) 没被改名 |
| `loadSubpackage fail` | 分包目录缺失 | 检查 `engine/` 和 `subpacks/` 都有 `game.js` 占位 |
| 白屏，日志看到 `GL.createContext failed` | canvas 被二次 getContext | 基础库升级到 3.2+，或重启开发者工具 |

---

## 8. MiniGameSDK 详细用法

插件自动注册 `MiniGameSDK` 为 autoload。非小游戏环境（编辑器 / PC 导出）所有方法都是 no-op，可以安心在日常开发里直接调用。

所有异步接口都通过 **信号** 回调，不要用 await；同步接口（`storage_*`、`vibrate_*`）直接返回。

### 探测运行环境

```gdscript
if MiniGameSDK.is_mini_game:
    print("运行在小游戏环境")
else:
    print("编辑器/普通 Web/PC")
```

### 登录与用户信息

```gdscript
func _ready() -> void:
    MiniGameSDK.login_completed.connect(_on_login)
    MiniGameSDK.session_checked.connect(_on_session)
    MiniGameSDK.user_info_received.connect(_on_user_info)

    MiniGameSDK.check_session()

func _on_session(valid: bool, err: String) -> void:
    if not valid:
        MiniGameSDK.login()

func _on_login(code: String, err: String) -> void:
    if err.is_empty():
        # code 发到你自己的服务端，服务端调 jscode2session 换 openid / session_key
        MiniGameSDK.http_request("https://your.api/login", "POST",
            JSON.stringify({"code": code}))

func _on_user_info(info_json: String, err: String) -> void:
    if err.is_empty():
        var info = JSON.parse_string(info_json)
        print(info.nickName, info.avatarUrl)
```

### 本地存储

```gdscript
MiniGameSDK.storage_set("level", "5")
MiniGameSDK.storage_set("settings", JSON.stringify({"music": 0.7, "sfx": 1.0}))

var level := int(MiniGameSDK.storage_get("level", "1"))
var settings_json := MiniGameSDK.storage_get("settings", "{}")
var settings = JSON.parse_string(settings_json)

MiniGameSDK.storage_remove("old_key")
MiniGameSDK.storage_clear()

# 查容量
var info_json := MiniGameSDK.storage_info()
# { "keys":[...], "size":<bytes>, "limit":<bytes> }
```

> 微信 `wx.setStorage` 单个 value 上限 1 MB，全部存储上限 10 MB。大对象请拆 key 或自己做分片。

### 广告

```gdscript
# 激励视频
func show_rewarded() -> void:
    MiniGameSDK.ad_created.connect(_on_ad_created)
    MiniGameSDK.rewarded_ad_result.connect(_on_rewarded)
    MiniGameSDK.create_rewarded_ad("adunit-xxxxxxxxx")

func _on_ad_created(ad_type: String, ok: bool, err: String) -> void:
    if ad_type == "rewarded" and ok:
        MiniGameSDK.show_rewarded_ad()
    elif not ok:
        MiniGameSDK.show_toast("广告拉取失败: %s" % err, "error")

func _on_rewarded(completed: bool, err: String) -> void:
    if completed:
        player.add_coins(50)

# Banner
MiniGameSDK.create_banner_ad("adunit-yyyyyyyyy")
MiniGameSDK.show_banner_ad()
# ... 切场景前
MiniGameSDK.hide_banner_ad()
# 彻底销毁
MiniGameSDK.destroy_banner_ad()

# 插屏
MiniGameSDK.create_interstitial_ad("adunit-zzzzzzzzz")
MiniGameSDK.show_interstitial_ad()
```

> 广告位 ID 必须在平台后台审核通过，模拟器里通常是测试 ID。

### 支付（微信虚拟支付）

```gdscript
MiniGameSDK.payment_result.connect(func(ok, err):
    if ok: grant_item()
    else: print("支付失败:", err)
)
MiniGameSDK.request_payment({
    "offerId": "1000xxxxx",
    "currencyType": "CNY",
    "amount": 100,  # 单位：分
    "zoneId": "1",
})
```

### 振动与键盘

```gdscript
MiniGameSDK.vibrate_short("medium")  # heavy / medium / light
MiniGameSDK.vibrate_long()

MiniGameSDK.keyboard_event.connect(_on_kb)
MiniGameSDK.show_keyboard("初始文本", 32, false)

func _on_kb(event: String, value: String) -> void:
    match event:
        "input": live_preview(value)
        "confirm": commit(value)
        "complete": hide_keyboard_ui()
```

### HTTP 请求

`http_request` 底层走 `wx.request` / `tt.request`，不受 `fetch` polyfill 的影响（CORS 由微信后台的「request 合法域名」白名单控制）：

```gdscript
MiniGameSDK.http_response.connect(func(status, data, err):
    if err.is_empty() and status == 200:
        handle(JSON.parse_string(data))
)
MiniGameSDK.http_request(
    "https://api.example.com/score",
    "POST",
    JSON.stringify({"score": 999}),
    {"Content-Type": "application/json", "Authorization": "Bearer xxx"}
)
```

> 上线前必须在微信后台 **开发设置 > 服务器域名** 里添加你的 API 域名到 `request` 合法域名。

### 分享

```gdscript
# 用户点右上角 → 菜单 → 分享 时使用
MiniGameSDK.show_share_menu()

# 主动拉起分享
MiniGameSDK.share_app(
    "来挑战我的记录！",
    "https://your.cdn/share.png",
    "inviter=%s" % player_id,
)
```

### 系统信息 / 安全区

```gdscript
var info := MiniGameSDK.get_system_info()
# info 常用字段: platform, system, model, pixelRatio, screenWidth, screenHeight, statusBarHeight

var menu := MiniGameSDK.get_menu_button_rect()
# { top, bottom, left, right, width, height } — 用来避免 UI 压到胶囊按钮
```

### 生命周期

```gdscript
MiniGameSDK.app_shown.connect(func(opts_json): resume_music())
MiniGameSDK.app_hidden.connect(func(): pause_music())
MiniGameSDK.app_error.connect(func(msg): print("JS runtime error:", msg))
```

### UI 原生组件

```gdscript
MiniGameSDK.show_toast("已保存", "success", 1500)   # icon: success/error/loading/none
MiniGameSDK.show_loading("加载中…")
# ... 做完事
MiniGameSDK.hide_loading()

MiniGameSDK.modal_result.connect(func(confirmed):
    if confirmed: delete_save()
)
MiniGameSDK.show_modal("确认删除？", "删除后无法恢复")
```

### 剪贴板 / 常亮

```gdscript
MiniGameSDK.set_clipboard("邀请码: ABCD")
MiniGameSDK.clipboard_received.connect(func(data, err): print(data))
MiniGameSDK.get_clipboard()

MiniGameSDK.set_keep_screen_on(true)
```

---

## 9. 资源与子包策略

### 默认布局

| 分包 | 路径 | 内容 |
|------|------|------|
| **主包** | `/` | `game.js` 入口、polyfill、loader、图片、js worker |
| `engine` | `engine/` | `godot.wasm.br` + `godot.zip`（资源 `.pck`） |
| `subpacks` | `subpacks/` | 预留，默认空 |

微信主包上限 4 MB，分包上限 4 MB，总包上限 20 MB（截至 2026 Q1）。插件把 WASM 和资源塞进 `engine` 分包，主包通常 < 500 KB。

### 拆大资源到 `subpacks/`

如果 `godot.zip` 超过 4 MB，需要切分资源。最简单的做法：

1. 在 Godot 里把大资源（视频、音频、高清贴图）放到一个单独的目录，例如 `res://heavy/`
2. 导出预设里暂时不过滤——插件强制 `all_resources`，因此当前无法在插件内拆分
3. 进阶做法：导出后手动把 `engine/godot.zip` 里的部分资源（用 `Godot --headless --export-pack` 分多次生成）移到 `subpacks/`，并在 `game.json` 里新增 `{"root":"subpacks/","name":"subpacks"}`（插件已经声明好）

> TODO（issue 跟踪）：当前插件只生成一个 `.pck`。多包导出需要自己扩展 `exporter.gd::_export_pck`。

### 静态资源

- `images/logo.png`、`images/background.png` 由插件在首次导出时写入占位。想自定义：
  - 把 PNG 丢到 `addons/godot_mini_game/templates/common/images/` 里覆盖
  - 或者每次导出完手动替换输出目录里的图

---

## 10. 本地存储与云端同步

### 引擎侧存储

Godot 的 `user://` 默认存到 IDBFS（IndexedDB），在小游戏环境下会被 loader 拦截：

- 启动时 loader 调 `godotSdk.copyLocalToFS(p)` 把持久化路径从 `wx.getStorage` 恢复到 emscripten FS
- 每 5 秒 `setInterval` 一次 `godotSdk.syncfs()` 把 FS 落回 `wx.setStorage`

如果你想立刻落盘（比如在关键节点），可以：

```gdscript
# 没开放显式 flush 接口，暂时只能靠 5s interval。
# 或者通过 JavaScriptBridge 手动调：
JavaScriptBridge.eval("GameGlobal.godotSdk.syncfs(null, ()=>{})")
```

### 存档迁移

第一次从 Web 切到小游戏时，`user://` 是空的——因为小游戏没有 Web 平台的 IDB。想迁移旧存档需要自己用 `MiniGameSDK.storage_get/set` 从服务端拉下来写到 `user://`。

---

## 11. 真机联调与审核

### 真机预览

- 微信开发者工具 → **预览**（扫二维码）。第一次真机必看 **Vconsole** 里的 WASM 编译耗时（iPhone 7 左右机型可能 8-12s）。
- 真机白屏 99% 是两类原因：
  1. WASM 兼容性 → 用了官方模板。换内置/兼容模板。
  2. `GameGlobal.canvas` 获取失败 → 基础库 < 3.0。升级微信或指定基础库版本。

### 审核注意

| 项 | 要点 |
|----|------|
| 合规图标 | 后台上传 144x144、512x512 |
| 服务器域名白名单 | `request` / `socket` / `uploadFile` / `downloadFile` 四类分开配置 |
| 实名认证（适龄提示） | 国内小游戏强制 |
| 隐私协议 | 需要 `wx.getPrivacySetting` 流程，插件暂未封装，需要自己在 `game.js` 里加 |
| 防沉迷 | 有内购 / 社交功能的必配 |

---

## 12. 编译自定义引擎模板

仓库内 `scripts/build_wasm_template.sh` 可以为任意 Godot 4.x 编译小游戏兼容模板。

```bash
# 默认 Godot 4.6.1-stable + Emscripten 4.0.3
./scripts/build_wasm_template.sh

# 指定 Godot 版本
./scripts/build_wasm_template.sh 4.4.1-stable

# 指定 Emscripten 版本
./scripts/build_wasm_template.sh 4.6.1-stable 3.1.62
```

流程：

1. 安装 / 激活 emsdk（默认装到 `~/Desktop/build_wasm/emsdk`）
2. `git clone` Godot 源码
3. `scons platform=web target=template_release production=yes threads=no wasm_simd=no SUPPORT_LONGJMP='emscripten'`
4. 产物在 `build_wasm/output/minigame-template-{version}.zip`
5. 回到编辑器，点 Dock 里的 **导入模板** 选这个 zip

> Apple Silicon 约 5 分钟；Intel / Linux 约 8-15 分钟。

### 通过 GitHub Actions 构建

仓库有 `.github/workflows/build_wasm_template.yml`，可以手动触发（**Actions > Build Mini-Game WASM Template > Run workflow**）。适合没有本地 emcc 环境的场景。

---

## 13. 常见问题 FAQ

### Q: 导出时提示「缺少 godot.js」

A: 查看 Dock 上方的 **引擎模板** 状态。四种情况：
- 内置缺失：检查 `addons/godot_mini_game/engine/` 是否有 `godot.js` 和 `godot.wasm.br`
- 自定义没找到：看下 `addons/godot_mini_game/godot.js` / `godot.wasm.br` 拼写
- 模板库为空：点 **导入模板** 导一份
- 只有官方模板：能跑但仅限模拟器，真机可能崩。点 **导入模板** 换兼容版

### Q: 导出能跑但真机提示 `CompileError: OOM / magic Tag section`

A: 走的是官方 Web 模板（Priority 4），WASM 带了 SIMD 或异常 Tag。跑 `./scripts/build_wasm_template.sh` 编一份，或从 Release 下 `minigame-template-*.zip` 导入。

### Q: Node 已经装了，但日志还是说未找到

A: 插件在 macOS 上只检查了 `/usr/local/bin/node`、`/opt/homebrew/bin/node`、`/usr/bin/node` 这几处，以及 `which node`。如果你的 Node 装在别处（比如 nvm 的 `~/.nvm/versions/...`），可以：
- 做一个软链：`ln -s $(which node) /usr/local/bin/node`
- 或者装 brotli CLI：`brew install brotli`

### Q: 我能直接用标准 Web 导出吗？

A: 模拟器里可以，真机大概率 CompileError。核心问题是 `WXWebAssembly` 不支持 SIMD 和异常 Tag section。必须用本插件的兼容模板。

### Q: 音频有一点爆音 / 延迟大

A: 为了兼容小游戏，我们把 `connectPositionWorklet` 中和了，引擎侧拿不到采样级播放位置。对 2D / 3D 空间音效影响很小；如果确实需要精确音频同步，目前只能等小游戏宿主开放真正的 AudioWorkletNode。

### Q: 怎么在 Godot 里测试 SDK？

A: 直接在编辑器运行即可——`is_mini_game` 会是 `false`，所有方法安全返回空值/空信号；你可以用 `OS.has_feature("web")` 判断更精确，或者在测试用例里用 `MiniGameSDK._sdk = fake_sdk` 注入假实现。

### Q: 多人共享设备 / 多账号怎么处理？

A: `storage_set/get` 的 key 自己加用户前缀，例如 `"user:%s:level" % openid`。`wx.setStorage` 的作用域默认是当前微信账号，不会跨账号串数据。

### Q: PR / issue 反馈在哪里？

A: 欢迎 [issue](../../issues) 和 [discussion](../../discussions)。提 bug 请附上：
- Godot 版本
- 平台（微信/抖音）
- 基础库版本
- Dock 导出日志截图
- 开发者工具 / 真机 Vconsole 日志

---

需要更深的内部实现说明（例如 `adapter.js` 的具体 hook 清单、`sdk.js` 与 `MiniGameSDK.gd` 的 ABI 约定）请直接读源码，代码里都有详尽注释。
