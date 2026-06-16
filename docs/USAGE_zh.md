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

### 媒体图片

`choose_media()` 封装 `wx.chooseMedia`，是新基础库推荐使用的媒体选择入口。`choose_image()` 仍然保留用于兼容旧项目，但微信从基础库 2.21.0 起已标注 `wx.chooseImage` 停止维护。所有媒体 / 图片接口都通过 `media_result` 返回结果，可以根据 `action` 区分来源 API。

```gdscript
MiniGameSDK.media_result.connect(func(action, ok, data_json, err):
    if err.is_empty():
        var data = JSON.parse_string(data_json)
        print(action, data)
    else:
        push_warning("%s failed: %s" % [action, err])
)

# 推荐：选择图片或视频。
MiniGameSDK.choose_media(1, ["image"], ["album"], 10, ["compressed"])

# 旧版图片选择接口。
MiniGameSDK.choose_image(1, ["compressed"], ["album"])

# 预览微信支持的本地、网络或云文件图片。
MiniGameSDK.preview_image(["wxfile://tmp/example.png"])

# 保存本地临时文件或持久文件到用户相册。
MiniGameSDK.save_image_to_photos_album("wxfile://usr/result.png")

# 压缩本地或代码包图片，宽高参数可选。
MiniGameSDK.compress_image("wxfile://usr/result.jpg", 80, 720)
```

微信 `chooseMedia` 从基础库 2.23.0 开始支持。`saveImageToPhotosAlbum` 从 1.2.0 开始支持，并需要 `scope.writePhotosAlbum` 授权。`compressImage` 当前小游戏文档标注从 3.0.1 开始支持，其中 `compressedWidth` / `compressedHeight` 字段标注为 2.26.0+。`previewImage` 的 `showmenu` 和 `referrerPolicy` 从 2.13.0 开始支持。`wx.getImageInfo` 当前不在小游戏图片 API 页面中；只有在确认目标运行时支持后，才建议用 `call_api("getImageInfo", ...)` 兜底调用。

### Camera

`create_camera()` 封装 `wx.createCamera`，并保存返回的 `Camera` 对象供后续操作使用。`camera_take_photo()`、`camera_start_record()`、`camera_stop_record()`、`camera_set_zoom()`、`camera_listen_frame_change()`、`camera_close_frame_change()`、`camera_destroy()` 分别映射到对应的 `Camera` 方法。操作结果通过 `camera_operation_result` 返回；运行时事件通过 `camera_event` 返回；RGBA 帧数据通过 `camera_frame` 返回。

```gdscript
MiniGameSDK.camera_operation_result.connect(func(action, ok, data_json, err):
    print(action, ok, err, data_json)
)
MiniGameSDK.camera_event.connect(func(event_type, data_json, err):
    print("camera event: ", event_type, data_json, err)
)
MiniGameSDK.camera_frame.connect(func(data_json, err):
    if err.is_empty():
        var frame = JSON.parse_string(data_json)
        print(frame.width, frame.height, frame.byteLength)
)

MiniGameSDK.create_camera(0, 0, 320, 240, "back", "auto", "small")
MiniGameSDK.camera_take_photo("normal")
MiniGameSDK.camera_start_record()
MiniGameSDK.camera_stop_record(true)
MiniGameSDK.camera_set_zoom(1.5)
MiniGameSDK.camera_listen_frame_change(false)
MiniGameSDK.camera_close_frame_change()
MiniGameSDK.camera_destroy()
```

微信 `wx.createCamera` 和大部分 `Camera` 方法从基础库 2.9.0 开始支持。`Camera.setZoom` 当前文档标注从 3.9.2 开始支持。Camera 帧回调包含 RGBA `ArrayBuffer` 数据，bridge 会把它转成 `{ "dataType": "arraybuffer", "base64": "...", "byteLength": n }` JSON。`camera_listen_frame_change(true)` 会在已有 active Worker 时传入该 Worker 对象，对齐微信 iOS ExperimentalWorker 的取帧路径。

### Video

`create_video()` 封装 `wx.createVideo`，并保存一个 active `Video` 对象。视频控制方法通过 `video_operation_result` 返回状态快照；运行时事件通过 `video_event` 返回。

```gdscript
MiniGameSDK.video_operation_result.connect(func(action, ok, data_json, err):
    print(action, ok, err, data_json)
)
MiniGameSDK.video_event.connect(func(event_type, data_json, err):
    print("video event: ", event_type, data_json, err)
)

MiniGameSDK.create_video({
    "x": 24,
    "y": 120,
    "width": 360,
    "height": 220,
    "src": "video/intro.mp4",
    "poster": "images/poster.png",
    "objectFit": "contain",
    "controls": true,
    "muted": true,
})
MiniGameSDK.video_play()
MiniGameSDK.video_seek(3.0)
MiniGameSDK.video_request_full_screen(90)
MiniGameSDK.video_exit_full_screen()
MiniGameSDK.video_pause()
MiniGameSDK.stop_video_listener(["play", "pause", "ended", "timeUpdate", "error"])
MiniGameSDK.video_destroy()
```

`create_video()` 接收微信 `wx.createVideo` 的字段：布局尺寸（`x`、`y`、`width`、`height`）、`src`、`poster`、`initialTime`、`playbackRate`、`live`、`objectFit`、控制栏选项、自动播放 / 循环 / 静音选项，以及原生页面跳转后的暂停行为。`showProgress`、`showProgressInControlMode`、`backgroundColor` 从基础库 2.12.0 开始支持；`underGameView` 从 2.11.0 开始支持；`obeyMuteSwitch` 从 2.4.0 开始支持。默认桥接事件包括 `waiting`、`progress`、`play`、`pause`、`ended`、`timeUpdate`、`error`。当前微信文档中 `Video.play()`、`pause()`、`stop()`、`seek()`、`requestFullScreen()`、`exitFullScreen()` 都是 Promise 风格方法。

### 媒体音频与视频解码

`get_available_audio_sources()` 封装 `wx.getAvailableAudioSources`。`create_video_decoder()` 封装 `wx.createVideoDecoder`；解码操作通过 `video_decoder_operation_result` 返回，解码事件通过 `video_decoder_event` 返回。`create_media_audio_player()` 封装 `wx.createMediaAudioPlayer`；bridge 提供 add/remove helper，使用当前 active `VideoDecoder` 作为 `MediaAudioPlayer` 的音频源。

```gdscript
MiniGameSDK.available_audio_sources_received.connect(func(sources_json, data_json, err):
    print("sources: ", sources_json, err)
)
MiniGameSDK.video_decoder_operation_result.connect(func(action, ok, data_json, err):
    print(action, ok, err, data_json)
)
MiniGameSDK.video_decoder_event.connect(func(event_type, data_json, err):
    print("decoder event: ", event_type, data_json, err)
)
MiniGameSDK.media_audio_operation_result.connect(func(action, ok, data_json, err):
    print(action, ok, err, data_json)
)

MiniGameSDK.get_available_audio_sources()

MiniGameSDK.create_video_decoder()
MiniGameSDK.start_video_decoder_listener(["start", "stop", "seek", "bufferchange", "ended"])
MiniGameSDK.video_decoder_start({
    "source": "video/intro.mp4",
    "mode": 1,
    "abortAudio": false,
    "abortVideo": false,
})
MiniGameSDK.video_decoder_get_frame_data()

MiniGameSDK.create_media_audio_player(0.75)
MiniGameSDK.media_audio_add_video_decoder_source()
MiniGameSDK.media_audio_start()
MiniGameSDK.set_media_audio_volume(0.5)
MiniGameSDK.media_audio_remove_video_decoder_source()
MiniGameSDK.media_audio_stop()
MiniGameSDK.media_audio_destroy()

MiniGameSDK.video_decoder_stop()
MiniGameSDK.stop_video_decoder_listener(["start", "stop", "seek", "bufferchange", "ended"])
MiniGameSDK.video_decoder_remove()
```

微信 `wx.getAvailableAudioSources` 从基础库 2.1.0 开始支持。`VideoDecoder` 从 2.11.1 开始支持；`VideoDecoder.start()` 接收 `source`、`mode`、`abortAudio`、`abortVideo`，其中 `abortAudio` / `abortVideo` 从 2.15.0 开始支持。远程 `http://` 和 `https://` 解码源从 2.13.0 开始支持，更低版本只支持本地路径。微信文档说明解码器异步方法从 2.16.1 开始返回 Promise；低版本应通过解码事件判断完成。`VideoDecoder.getFrameData()` 返回 `width`、`height`、`data`、`pkPts`、`pkDts`；bridge 会把帧 `data` 的 `ArrayBuffer` 转成 `{ "dataType": "arraybuffer", "base64": "...", "byteLength": n }`。`MediaAudioPlayer` 从 2.13.0 开始支持，可播放当前 active `VideoDecoder` 输出的音频。

### RecorderManager 录音

`get_recorder_manager()` 封装 `wx.getRecorderManager`，并保存微信全局唯一的音频录音 `RecorderManager`。录音控制操作通过 `recorder_operation_result` 返回；生命周期、中断、错误和分片事件通过 `recorder_event` 返回。

```gdscript
MiniGameSDK.recorder_operation_result.connect(func(action, ok, data_json, err):
    print(action, ok, err, data_json)
)
MiniGameSDK.recorder_event.connect(func(event_type, data_json, err):
    print("audio recorder event: ", event_type, data_json, err)
)

MiniGameSDK.get_recorder_manager()
MiniGameSDK.recorder_start({
    "duration": 10000,
    "sampleRate": 44100,
    "numberOfChannels": 1,
    "encodeBitRate": 192000,
    "format": "mp3",
    "frameSize": 50,
    "audioSource": "auto",
})
MiniGameSDK.recorder_pause()
MiniGameSDK.recorder_resume()
MiniGameSDK.recorder_stop()
```

微信 `wx.getRecorderManager` 从基础库 1.6.0 开始支持。`recorder_start()` 透传官方参数：毫秒级 `duration`（最大 600000）、`sampleRate`、`numberOfChannels`、`encodeBitRate`、`format`（`mp3`、`aac`、`wav`、`PCM`）、可选的 KB 级 `frameSize`，以及基础库 2.1.0 起支持的 `audioSource`。微信文档说明 `frameSize` 分片回调暂仅支持 `mp3` 和 `pcm` 格式；bridge 会把 `frameRecorded.frameBuffer` 的 `ArrayBuffer` 转成 `{ "dataType": "arraybuffer", "base64": "...", "byteLength": n }`，并保留 `isLastFrame`。停止事件包含 `tempFilePath`、`duration` 和 `fileSize`。

### 游戏录屏

`get_game_recorder()` 封装 `wx.getGameRecorder`，并保存全局唯一的 `GameRecorder` 对象。录制控制与分享相关操作通过 `game_recorder_operation_result` 返回；录制生命周期事件和分享按钮点击错误通过 `game_recorder_event` 返回。

```gdscript
MiniGameSDK.game_recorder_operation_result.connect(func(action, ok, data_json, err):
    print(action, ok, err, data_json)
)
MiniGameSDK.game_recorder_event.connect(func(event_type, data_json, err):
    print("recorder event: ", event_type, data_json, err)
)

MiniGameSDK.get_game_recorder()
MiniGameSDK.start_game_recorder_listener(["start", "stop", "timeUpdate", "error"])
MiniGameSDK.game_recorder_start({
    "fps": 24,
    "duration": 60,
    "bitrate": 1000,
    "gop": 12,
    "hookBgm": true,
})
MiniGameSDK.game_recorder_pause()
MiniGameSDK.game_recorder_resume()
MiniGameSDK.game_recorder_stop()

# 微信要求从用户点击 / 触摸行为中调用。
MiniGameSDK.operate_game_recorder_video({
    "title": "Replay",
    "desc": "Great run",
    "query": "from=replay",
    "timeRange": [[0, 3000]],
    "volume": 1,
    "atempo": 1,
})

MiniGameSDK.create_game_recorder_share_button(
    {"left": 24, "top": 96, "height": 44, "text": "Share Replay"},
    {"bgm": "audio/bgm.mp3", "timeRange": [[0, 3000]], "volume": 1}
)
MiniGameSDK.show_game_recorder_share_button()
MiniGameSDK.hide_game_recorder_share_button()
MiniGameSDK.off_game_recorder_share_button_tap()
```

微信 `GameRecorder` 和 `GameRecorderShareButton` 从基础库 2.8.0 开始支持。`operateGameRecorderVideo` 从 2.26.1 开始支持，且必须在用户点击 / 触摸行为中调用。`game_recorder_start()` 接收微信的 `fps`、`duration`、`bitrate`、`gop`、`hookBgm` 参数；达到 `duration` 后仍需要显式调用 `game_recorder_stop()` 结束。分享按钮的 `share.bgm` 必须是代码包路径或 `wxfile://` 路径，不能是 HTTP URL；`share.timeRange` 的单位是毫秒。

### InnerAudio 音频

`create_inner_audio_context()` 封装 `wx.createInnerAudioContext`，并保存一个 active `InnerAudioContext` 对象。播放控制和状态快照通过 `inner_audio_operation_result` 返回；运行时事件通过 `inner_audio_event` 返回。

```gdscript
MiniGameSDK.inner_audio_operation_result.connect(func(action, ok, data_json, err):
    print(action, ok, err, data_json)
)
MiniGameSDK.inner_audio_event.connect(func(event_type, data_json, err):
    print("audio event: ", event_type, data_json, err)
)

MiniGameSDK.set_inner_audio_option({
    "mixWithOther": true,
    "obeyMuteSwitch": false,
    "speakerOn": true,
})

MiniGameSDK.create_inner_audio_context(
    {"useWebAudioImplement": true},
    {
        "src": "audio/bgm.mp3",
        "loop": true,
        "autoplay": false,
        "volume": 0.8,
        "playbackRate": 1.0,
    }
)
MiniGameSDK.inner_audio_play()
MiniGameSDK.inner_audio_seek(2.0)
MiniGameSDK.inner_audio_pause()
MiniGameSDK.get_inner_audio_state()
MiniGameSDK.stop_inner_audio_listener(["play", "pause", "stop", "timeUpdate", "error"])
MiniGameSDK.inner_audio_destroy()
```

微信 `wx.createInnerAudioContext` 从基础库 1.6.0 开始支持。`create_options.useWebAudioImplement` 从 2.19.0 开始支持，适合短音频和高频播放音效。`set_inner_audio_option()` 封装 2.3.0 开始支持的 `wx.setInnerAudioOption`；其中 `speakerOn` 可能覆盖 `mixWithOther` 行为，且微信文档说明它暂不兼容 `useWebAudioImplement`。不再使用音频时请调用 `inner_audio_destroy()`，因为微信不会自动释放 `InnerAudioContext` 资源。默认桥接事件包括 `canplay`、`play`、`pause`、`stop`、`ended`、`timeUpdate`、`error`、`waiting`、`seeking`、`seeked`。

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

### 文件传输

`download_file()` 封装 `wx.downloadFile` / `tt.downloadFile`，`upload_file()` 封装 `wx.uploadFile` / `tt.uploadFile`。微信后台会把 `request`、`uploadFile`、`downloadFile` 域名分开配置，实际使用前要分别加入对应白名单。微信还限制单次 `downloadFile` 下载资源不超过 200 MB。

```gdscript
MiniGameSDK.file_transfer_result.connect(func(action, ok, status, data_json, err):
    if err.is_empty():
        var result := JSON.parse_string(data_json)
        print(action, ok, status, result)
)

MiniGameSDK.download_file(
    "https://cdn.example.com/asset.bin",
    "wxfile://usr/asset.bin",
    {"Authorization": "Bearer xxx"}
)

MiniGameSDK.upload_file(
    "https://api.example.com/upload",
    "wxfile://usr/asset.bin",
    "file",
    {"slot": "save-1"},
    {"Authorization": "Bearer xxx"}
)
```

当前 typed wrapper 覆盖基础成功/失败结果、HTTP 状态码和原始 JSON。`DownloadTask` / `UploadTask` 的进度和 abort 控制还没有暴露成 GDScript 类型化方法；如果需要任务级进度事件，可以先用 `call_api()` 或扩展 JS bridge。

### 文件系统

`call_file_system(method, options)` 是 `wx.getFileSystemManager()[method](options)` / `tt.getFileSystemManager()[method](options)` 的通用桥接。它覆盖使用 options object 的异步 FileSystemManager API，例如 `access`、`writeFile`、`readFile`、`appendFile`、`mkdir`、`readdir`、`saveFile`、`removeSavedFile`、`getFileInfo`、`stat`、`unlink`、`unzip` 等。

```gdscript
MiniGameSDK.file_system_result.connect(func(action, ok, data_json, err):
    if err.is_empty():
        print(action, JSON.parse_string(data_json))
)

MiniGameSDK.file_system_write_file(
    "wxfile://usr/save.json",
    JSON.stringify({"score": 999})
)
MiniGameSDK.file_system_read_file("wxfile://usr/save.json")
MiniGameSDK.file_system_mkdir("wxfile://usr/cache", true)
MiniGameSDK.file_system_readdir("wxfile://usr")

# 较少用的异步 manager 方法可以直接调用：
MiniGameSDK.call_file_system("truncate", {
    "filePath": "wxfile://usr/save.json",
    "length": 0,
})
```

当 `readFile` 返回二进制 `ArrayBuffer` 时，JS bridge 会把它序列化成 `{ "dataType": "arraybuffer", "base64": "...", "byteLength": n }`，保证跨 Godot bridge 后仍是合法 JSON。读取文本建议传 `utf8` 等 encoding。

### 分包

`load_subpackage()` 封装 `wx.loadSubpackage` / `tt.loadSubpackage`，`pre_download_subpackage()` 封装 `wx.preDownloadSubpackage` / `tt.preDownloadSubpackage`。`loadSubpackage` 会下载并执行代码包；`preDownloadSubpackage` 只提前下载代码包。两个 task wrapper 都会通过 `subpackage_progress` 回传进度。

```gdscript
MiniGameSDK.subpackage_result.connect(func(action, ok, data_json, err):
    if err.is_empty():
        print(action, JSON.parse_string(data_json))
)
MiniGameSDK.subpackage_progress.connect(func(action, progress, written, expected, data_json):
    print("%s %d%% %d/%d" % [action, progress, written, expected])
)

MiniGameSDK.pre_download_subpackage("levels", "normal")
MiniGameSDK.load_subpackage("levels")
```

微信 `loadSubpackage` 从基础库 2.1.0 开始支持。`preDownloadSubpackage` 从 2.27.3 开始支持；普通分包预下载要求 3.4.9+，`package_type = "workers"` 用于 worker 分包。

### Worker

`create_worker()` 封装 `wx.createWorker`，操作结果通过 `worker_operation_result` 返回。Worker 消息、错误、实验 Worker 进程被回收的事件分别通过 `worker_message`、`worker_error`、`worker_process_killed` 转发。

```gdscript
MiniGameSDK.worker_operation_result.connect(func(action, ok, data_json, err):
    print(action, ok, err, data_json)
)
MiniGameSDK.worker_message.connect(func(data_json, err):
    if err.is_empty():
        print("worker message: ", JSON.parse_string(data_json))
)
MiniGameSDK.worker_error.connect(func(data_json, err):
    push_warning("worker error: %s" % err)
)
MiniGameSDK.worker_process_killed.connect(func(data_json, err):
    push_warning("worker process killed: %s" % data_json)
)

MiniGameSDK.create_worker("js/worker/position_reporting.js")
MiniGameSDK.worker_post_message({
    "type": "process",
    "inputLength": 1024,
    "currentTime": 0.2,
})
MiniGameSDK.worker_terminate()
```

微信 `wx.createWorker` 从基础库 1.9.90 开始支持。脚本路径必须指向已配置 `workers.path` 下的文件，且不能以 `/` 开头。`use_experimental_worker = true` 会映射到 `useExperimentalWorker`（基础库 2.13.0+）；使用实验 Worker 时建议始终监听 `worker_process_killed`，因为微信可能在内存压力下回收 Worker 进程。微信当前文档也限制一个游戏最多同时存在一个 Worker，因此 SDK 在创建新 Worker 前会先终止上一条活跃 Worker。

### WebSocket

`connect_socket()` 封装 `wx.connectSocket` / `tt.connectSocket`，并使用返回的 `SocketTask` 处理 `send`、`close` 和生命周期事件。微信要求 WebSocket 地址使用 `wss://`，并在独立的 `socket` 服务器域名白名单中配置。

```gdscript
MiniGameSDK.socket_operation_result.connect(func(action, ok, data_json, err):
    print(action, ok, err)
)
MiniGameSDK.socket_opened.connect(func(data_json, err):
    if err.is_empty():
        MiniGameSDK.send_socket_message("hello")
)
MiniGameSDK.socket_message_received.connect(func(data, data_json, err):
    if err.is_empty():
        print("socket message: ", data)
)
MiniGameSDK.socket_closed.connect(func(code, reason, data_json, err):
    print("socket closed: ", code, reason)
)
MiniGameSDK.socket_error.connect(func(data_json, err):
    push_warning(err)
)

MiniGameSDK.connect_socket(
    "wss://socket.example.com/room",
    {"Authorization": "Bearer xxx"},
    ["chat"],
    true
)
```

字符串消息会直接通过 `data` 返回。二进制 `ArrayBuffer` 消息会放在 `data_json` 中，字段为 `dataType: "arraybuffer"` 和 base64 payload。

### 网络状态

`get_network_type()` 封装 `wx.getNetworkType` / `tt.getNetworkType`。原始 JSON 会保留微信较新基础库返回的 `signalStrength`、`hasSystemProxy`、`weakNet` 等字段。

```gdscript
MiniGameSDK.network_type_received.connect(func(network_type, data_json, err):
    if err.is_empty():
        print(network_type, JSON.parse_string(data_json))
)
MiniGameSDK.get_network_type()

MiniGameSDK.network_status_changed.connect(func(is_connected, network_type, data_json):
    if not is_connected:
        show_offline_badge()
)
MiniGameSDK.start_network_status_listener()
# ... 场景退出时
MiniGameSDK.stop_network_status_listener()
```

### 传感器与电量

运动传感器对应微信的 `start*` / `on*Change` / `stop*` 系列 API。加速度计和陀螺仪支持 `interval`：`game`（约 20ms）、`ui`（约 60ms）、`normal`（约 200ms）。信号里会保留原始 JSON，便于读取平台新增字段。

```gdscript
MiniGameSDK.sensor_started.connect(func(sensor, ok, err):
    print("start", sensor, ok, err)
)
MiniGameSDK.sensor_stopped.connect(func(sensor, ok, err):
    print("stop", sensor, ok, err)
)

MiniGameSDK.accelerometer_changed.connect(func(x, y, z, data_json):
    player.apply_tilt(Vector3(x, y, z))
)
MiniGameSDK.start_accelerometer("game")
# ... 场景退出时
MiniGameSDK.stop_accelerometer()

MiniGameSDK.gyroscope_changed.connect(func(x, y, z, data_json):
    camera_controller.apply_angular_velocity(Vector3(x, y, z))
)
MiniGameSDK.start_gyroscope("game")

MiniGameSDK.compass_changed.connect(func(direction, accuracy, data_json):
    print("heading:", direction, "accuracy:", accuracy)
)
MiniGameSDK.start_compass()

MiniGameSDK.device_motion_changed.connect(func(alpha, beta, gamma, data_json):
    camera_controller.apply_device_orientation(alpha, beta, gamma)
)
MiniGameSDK.start_device_motion_listening("game")
# ... 场景退出时
MiniGameSDK.stop_device_motion_listening()
```

`compass_changed` 的 `accuracy` 是 `Variant`：微信 iOS 返回数字，Android 返回 `high`、`medium`、`low`、`unreliable` 等字符串。

设备方向对应 `wx.startDeviceMotionListening` / `wx.onDeviceMotionChange` / `wx.stopDeviceMotionListening`。`alpha`、`beta`、`gamma` 是平台 API 返回的弧度值，`interval` 支持 `game`、`ui`、`normal`。

### 音频中断

微信在电话、闹钟、语音聊天、有声广告等系统音频占用场景会触发音频中断事件。收到 `begin` 后小游戏内音频会被平台暂停，等 `end` 后再恢复播放。

```gdscript
MiniGameSDK.audio_interruption.connect(func(event_type, data_json, err):
    if err.is_empty() and event_type == "end":
        music_player.play()
)

MiniGameSDK.start_audio_interruption_listener()
# ... 场景退出时
MiniGameSDK.stop_audio_interruption_listener()
```

### 主题与性能

`start_theme_change_listener()` 封装 `wx.onThemeChange`。微信只有在全局配置开启 `darkmode: true` 时才会触发该事件；信号会返回 `light` 或 `dark`，并保留原始 JSON 方便兼容后续字段。

```gdscript
MiniGameSDK.theme_changed.connect(func(theme, data_json, err):
    if err.is_empty():
        apply_theme(theme)
)

MiniGameSDK.start_theme_change_listener()
# ... 场景退出时
MiniGameSDK.stop_theme_change_listener()
```

`get_performance_entries(entry_type)` 封装 `wx.getPerformance()` 和 `Performance.getEntries()` / `getEntriesByType()`。传空字符串可读取全部缓冲区条目，也可以传 `render`、`script`、`navigation` 等类型。

```gdscript
var all_entries := MiniGameSDK.get_performance_entries()
var render_entries := MiniGameSDK.get_performance_entries("render")
print("performance entries:", all_entries.size(), render_entries.size())
```

`report_performance(id, value, dimensions)` 封装 `wx.reportPerformance`。正式依赖上报数据前，需要先在微信小程序管理后台配置对应测速指标 ID。

```gdscript
MiniGameSDK.report_performance(1101, 680.0, ["cold_start", "main_menu"])
```

```gdscript
MiniGameSDK.battery_info_received.connect(func(level, is_charging, data_json, err):
    if err.is_empty():
        print("battery:", level, is_charging, JSON.parse_string(data_json))
)
MiniGameSDK.get_battery_info()

var battery := MiniGameSDK.get_battery_info_sync()
```

`get_battery_info_sync()` 在不可用时返回 `{}`；微信文档注明同步电量接口在 iOS 不可用。跨设备逻辑建议优先使用异步信号。

### 小程序跳转

这组封装对应 `wx.navigateToMiniProgram`、`wx.navigateBackMiniProgram`、`wx.exitMiniProgram`、`wx.restartMiniProgram`。微信要求 `navigateToMiniProgram` 和 `exitMiniProgram` 必须由用户点击/触摸触发。开发者工具可以校验调用和接收方调试流程，但不一定会发生真实跳转。

```gdscript
MiniGameSDK.mini_program_navigation_result.connect(func(action, ok, data_json, err):
    if err.is_empty():
        print(action, " ok=", ok, " raw=", data_json)
    else:
        push_warning("%s failed: %s" % [action, err])
)

MiniGameSDK.navigate_to_mini_program(
    "wx-target-appid",
    "?from=godot",
    {"score": 9},
    "release"
)
MiniGameSDK.navigate_back_mini_program({"finished": true})
MiniGameSDK.exit_mini_program()
MiniGameSDK.restart_mini_program("?from=restart")
```

`navigate_to_mini_program()` 还支持 `short_link` 和 `no_relaunch_if_path_unchanged`。`restart_mini_program(path)` 需要微信基础库 3.0.1+，并且需要传入非空 path/query 作为重新启动入口。

### 用户托管数据与开放数据域

用户托管数据是微信小游戏排行榜常用的数据通道。`set_user_cloud_storage()` 和 `remove_user_cloud_storage()` 对应主域可调用的写入/删除接口。跨 JS bridge 前，插件会把字典序列化成微信 `KVDataList` 要求的字符串值。

```gdscript
MiniGameSDK.cloud_storage_result.connect(func(action, ok, data_json, err):
    if err.is_empty():
        print(action, " ok=", ok, " raw=", data_json)
    else:
        push_warning("%s failed: %s" % [action, err])
)

MiniGameSDK.set_user_cloud_storage({
    "score": 9001,
    "season": "s1",
})
MiniGameSDK.remove_user_cloud_storage(["score", "season"])
```

微信文档注明 `get_user_cloud_storage_keys()`、`get_user_cloud_storage()`、`get_friend_cloud_storage()`、`get_group_cloud_storage()` 只在开放数据域下可用。好友/群数据读取需要 `scope.WxFriendInteraction` 授权；群数据还需要传入群 `shareTicket` 或 `groupid`。

```gdscript
MiniGameSDK.get_user_cloud_storage(["score"])
MiniGameSDK.get_friend_cloud_storage(["score"])
MiniGameSDK.get_group_cloud_storage(["score"], "", "opengid-from-getGroupEnterInfo")
```

在主域 Godot 游戏里，通常用 `post_open_data_context_message()` 通知开放数据域脚本去读取或渲染排行榜。微信要求 `OpenDataContext.postMessage()` 的消息对象及嵌套对象只能包含 primitive leaf value（`number`、`string`、`boolean`、`null`、`undefined`）。

```gdscript
MiniGameSDK.post_open_data_context_message({
    "type": "rank",
    "season": "s1",
}, "offscreenCanvas")
```

### 客服会话与订阅消息

`open_customer_service_conversation()` 封装 `wx.openCustomerServiceConversation`。微信要求用户至少发生过一次 touch 事件后才能打开客服会话。如果用户在客服会话内点击消息卡片回到小游戏，微信会通过这个 API 的 success 回调返回卡片 path/query，因此从 `customer_service_result` 里读取。

```gdscript
MiniGameSDK.customer_service_result.connect(func(action, ok, data_json, err):
    if err.is_empty():
        print(action, " ok=", ok, " raw=", data_json)
)

MiniGameSDK.open_customer_service_conversation(
    "battle-result",
    true,
    "Need help?",
    "?from=customer-service",
    ""
)
```

`request_subscribe_message(tmpl_ids)` 封装 `wx.requestSubscribeMessage`；`request_subscribe_system_message(msg_type_list)` 封装 `wx.requestSubscribeSystemMessage`。两者都必须由用户点击/触摸触发。结果 JSON 会保留微信的动态 key：每个模板 id 或系统消息类型对应 `accept`、`reject`、`ban` 或 `filter` 等状态。

```gdscript
MiniGameSDK.subscribe_message_result.connect(func(action, ok, data_json, err):
    if err.is_empty():
        print(action, JSON.parse_string(data_json))
)

MiniGameSDK.request_subscribe_message(["tmpl_id_a", "tmpl_id_b"])
MiniGameSDK.request_subscribe_system_message([
    "SYS_MSG_TYPE_INTERACTIVE",
    "SYS_MSG_TYPE_RANK",
])
```

### 更新管理与内存告警

微信会在小游戏启动或从后台回到前台时自动检查新版本。`start_update_listener()` 暴露 `wx.getUpdateManager()` 事件，适合接入自定义更新 UI；只有在 `update_ready` 触发后才调用 `apply_update()`。

```gdscript
MiniGameSDK.update_checked.connect(func(has_update, data_json, err):
    if err.is_empty():
        print("has update:", has_update, JSON.parse_string(data_json))
)

MiniGameSDK.update_ready.connect(func(err):
    if err.is_empty():
        MiniGameSDK.apply_update()
)

MiniGameSDK.update_failed.connect(func(err):
    print("update package download failed:", err)
)

MiniGameSDK.start_update_listener()
```

内置微信模板已经带有基础的原生弹窗更新提示。如果你的游戏要完全自定义提示样式，再使用 SDK 监听器，并避免同一个 ready 事件弹两次。

`start_memory_warning_listener()` 封装 `wx.onMemoryWarning`。收到告警时应主动释放大缓存、可选资源、已解码音频或场景资源，降低系统杀进程的风险。Android 会返回 `5`、`10`、`15` 等告警等级；iOS 或旧运行时可能是 `0`。

```gdscript
MiniGameSDK.memory_warning.connect(func(level, data_json, err):
    if err.is_empty():
        print("memory warning:", level, JSON.parse_string(data_json))
        clear_large_caches()
)

MiniGameSDK.start_memory_warning_listener()
# ... 场景退出时
MiniGameSDK.stop_memory_warning_listener()
```

### 窗口尺寸变化与运行时错误

`start_window_resize_listener()` 封装 `wx.onWindowResize`，从 `res.size` 中返回新的 `windowWidth` / `windowHeight`。桌面窗口调整、折叠屏变化或宿主布局变化后，可以用它重新计算 UI 锚点。

```gdscript
MiniGameSDK.window_resized.connect(func(width, height, data_json, err):
    if err.is_empty():
        resize_game_ui(Vector2i(width, height))
        print(JSON.parse_string(data_json))
)

MiniGameSDK.start_window_resize_listener()
# ... 场景退出时
MiniGameSDK.stop_window_resize_listener()
```

`start_unhandled_rejection_listener()` 封装 `wx.onUnhandledRejection`，用于捕获 JS 侧未处理的 Promise 拒绝。信号会提取可读的 `reason` 字符串，同时保留 JSON 载荷便于日志上报。

```gdscript
MiniGameSDK.unhandled_rejection.connect(func(reason, data_json, err):
    if err.is_empty():
        push_warning("Unhandled JS promise rejection: %s" % reason)
        MiniGameSDK.call_api("reportEvent", {
            "eventId": "js_unhandled_rejection",
            "data": {"reason": reason}
        })
)

MiniGameSDK.start_unhandled_rejection_listener()
# ... 场景退出时
MiniGameSDK.stop_unhandled_rejection_listener()
```

微信文档标注 `onWindowResize/offWindowResize` 从基础库 2.3.0 起支持，`onUnhandledRejection/offUnhandledRejection` 从基础库 2.10.0 起支持。SDK 会保留原始 JS listener 对象，确保 `stop_*` 能移除 `start_*` 注册的同一个监听器。

### 屏幕亮度、截屏与录屏

`get_screen_brightness()` / `set_screen_brightness(value)` 封装微信屏幕亮度接口。取值范围是 `0.0` 到 `1.0`；Android 还支持传 `-1` 表示跟随系统亮度。

```gdscript
MiniGameSDK.screen_brightness_received.connect(func(value, data_json, err):
    if err.is_empty():
        print("brightness:", value)
)

MiniGameSDK.screen_brightness_set.connect(func(value, ok, err):
    print("set brightness:", value, ok, err)
)

MiniGameSDK.get_screen_brightness()
MiniGameSDK.set_screen_brightness(0.5)
```

`start_user_capture_screen_listener()` 封装 `wx.onUserCaptureScreen`。微信只允许一个截屏监听器，SDK 会保留一个持久 listener，`stop_user_capture_screen_listener()` 会调用平台 off API 取消监听。

```gdscript
MiniGameSDK.user_capture_screen.connect(func(data_json, err):
    if err.is_empty():
        print("user captured screen:", JSON.parse_string(data_json))
)

MiniGameSDK.start_user_capture_screen_listener()
# ... 场景退出时
MiniGameSDK.stop_user_capture_screen_listener()
```

iOS 录屏检测可以使用 `get_screen_recording_state()` 和 `start_screen_recording_state_listener()`。微信查询状态返回 `on` / `off`，监听事件返回 `start` / `stop`。

```gdscript
MiniGameSDK.screen_recording_state_received.connect(func(state, data_json, err):
    if err.is_empty():
        print("recording:", state)
)

MiniGameSDK.screen_recording_state_changed.connect(func(state, data_json, err):
    if err.is_empty() and state == "start":
        pause_sensitive_cutscene()
)

MiniGameSDK.get_screen_recording_state()
MiniGameSDK.start_screen_recording_state_listener()
# ... 场景退出时
MiniGameSDK.stop_screen_recording_state_listener()
```

`set_visual_effect_on_capture("hidden")` 会请求宿主在截屏 / 录屏时隐藏屏幕；传 `"none"` 恢复普通表现。微信文档标注该接口从基础库 2.20.1 起支持；iOS 要求更高：基础库 3.3.0+、iOS 16+，且目前仅处理录屏表现。

```gdscript
MiniGameSDK.visual_effect_on_capture_set.connect(func(effect, ok, err):
    print("visual effect:", effect, ok, err)
)

MiniGameSDK.set_visual_effect_on_capture("hidden")
```

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

### 兼容性、系统信息与安全区

调用依赖微信基础库版本的 API 前，可以用 `can_i_use(schema)` 做能力探测。schema 使用微信的 `${API}.${method}.${param}.${option}` 形式。

```gdscript
if MiniGameSDK.can_i_use("getAppBaseInfo.return.SDKVersion"):
    var app := MiniGameSDK.get_app_base_info()
    print("base library:", app.get("SDKVersion", "?"))

var device := MiniGameSDK.get_device_info()
# 常用字段: brand, model, platform, system, memorySize

var settings := MiniGameSDK.get_system_setting()
# 常用字段: wifiEnabled, bluetoothEnabled, locationEnabled, deviceOrientation

var authorize := MiniGameSDK.get_app_authorize_setting()
# 常用字段: cameraAuthorized, locationAuthorized, microphoneAuthorized, albumAuthorized

var info := MiniGameSDK.get_system_info()
# info 常用字段: platform, system, model, pixelRatio, screenWidth, screenHeight, statusBarHeight

var menu := MiniGameSDK.get_menu_button_rect()
# { top, bottom, left, right, width, height } — 用来避免 UI 压到胶囊按钮
```

现代拆分接口 `get_device_info()`、`get_app_base_info()`、`get_system_setting()`、`get_app_authorize_setting()` 在宿主基础库不支持时返回 `{}`。`get_system_info()` 仍保留为旧运行时的宽口径兜底。

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

### 隐私授权（微信）

微信隐私接口需要基础库 2.32.3+。`get_privacy_setting()` 用来判断用户是否还需要授权隐私协议；`require_privacy_authorize()` 可以在调用隐私敏感 API 前主动触发同一套授权流程。

只有当你的游戏已经准备好展示隐私弹窗、并且会调用 resolve 方法时，才注册 `start_privacy_authorization_listener()`。微信会让触发隐私授权的原始 API 处于 pending，直到你 resolve。

```gdscript
func _ready() -> void:
    MiniGameSDK.privacy_setting_received.connect(_on_privacy_setting)
    MiniGameSDK.privacy_authorization_needed.connect(_on_privacy_needed)
    MiniGameSDK.privacy_authorize_result.connect(_on_privacy_authorize)

    MiniGameSDK.get_privacy_setting()

func _on_privacy_setting(need: bool, contract_name: String, data_json: String, err: String) -> void:
    if not err.is_empty():
        push_warning(err)
        return
    if need:
        MiniGameSDK.start_privacy_authorization_listener()
        show_privacy_prompt(contract_name)

func _on_privacy_needed(event_info_json: String, err: String) -> void:
    if err.is_empty():
        show_privacy_prompt("隐私协议")

func _on_privacy_authorize(ok: bool, err: String) -> void:
    print("privacy authorize:", ok, err)

func on_privacy_prompt_exposed() -> void:
    MiniGameSDK.expose_privacy_authorization()

func on_privacy_agreed() -> void:
    MiniGameSDK.agree_privacy_authorization("agree-btn")

func on_privacy_rejected() -> void:
    MiniGameSDK.disagree_privacy_authorization()

func open_contract() -> void:
    MiniGameSDK.open_privacy_contract()

func require_before_sensitive_api() -> void:
    MiniGameSDK.require_privacy_authorize()
```

`agree` 事件会让微信校验传入 `button_id` 对应的平台侧同意操作。这个流程需要放进开发者工具和真机审核检查清单里验证。

### 授权设置 / 账号信息

```gdscript
MiniGameSDK.setting_received.connect(func(settings_json, err):
    if err.is_empty():
        var settings = JSON.parse_string(settings_json)
        print(settings.authSetting)
)
MiniGameSDK.get_setting(true)  # withSubscriptions

MiniGameSDK.authorization_result.connect(func(scope, ok, err):
    print(scope, ok, err)
)
MiniGameSDK.authorize("scope.record")

MiniGameSDK.setting_opened.connect(func(settings_json, err):
    print(settings_json, err)
)
MiniGameSDK.open_setting(false)

var account := MiniGameSDK.get_account_info()
print(account.get("miniProgram", {}).get("appId", ""))
```

微信要求 `openSetting` 必须由用户点击行为触发。`get_setting()` 只会返回小游戏已经向用户请求过的权限。

### 原生按钮（微信）

部分微信开放能力必须通过覆盖在游戏 canvas 之上的平台原生按钮触发。SDK 会为每种按钮保留一个 active 对象，操作结果通过 `native_button_operation_result` 返回，点击事件通过 `native_button_tapped` 返回。

```gdscript
func _ready() -> void:
    MiniGameSDK.native_button_operation_result.connect(_on_native_button_operation)
    MiniGameSDK.native_button_tapped.connect(_on_native_button_tapped)

func create_profile_button() -> void:
    MiniGameSDK.create_user_info_button({
        "type": "text",
        "text": "Profile",
        "style": {
            "left": 24,
            "top": 96,
            "width": 180,
            "height": 44,
            "lineHeight": 44,
            "backgroundColor": "#07c160",
            "color": "#ffffff",
            "textAlign": "center",
            "fontSize": 16,
            "borderRadius": 4,
        },
        "withCredentials": false,
        "lang": "zh_CN",
    })

func create_settings_button() -> void:
    MiniGameSDK.create_open_setting_button({
        "type": "text",
        "text": "Settings",
        "style": {"left": 24, "top": 148, "width": 180, "height": 44},
    })

func create_game_club_button() -> void:
    MiniGameSDK.create_game_club_button({
        "type": "image",
        "icon": "green",
        "style": {"left": 224, "top": 96, "width": 44, "height": 44},
        # 可选，微信基础库 2.30.3+:
        # "openlink": "MP 后台生成的游戏圈跳转 ID",
        # "hasRedDot": false,
    })

func _on_native_button_operation(button_type: String, action: String, ok: bool, data_json: String, err: String) -> void:
    print(button_type, action, ok, err, data_json)

func _on_native_button_tapped(button_type: String, data_json: String, err: String) -> void:
    if err.is_empty():
        print(button_type, JSON.parse_string(data_json))
    else:
        push_warning("%s tap failed: %s" % [button_type, err])

func hide_profile_button() -> void:
    MiniGameSDK.hide_native_button("userInfo")

func show_profile_button() -> void:
    MiniGameSDK.show_native_button("userInfo")

func destroy_buttons() -> void:
    MiniGameSDK.destroy_native_button("userInfo")
    MiniGameSDK.destroy_native_button("openSetting")
    MiniGameSDK.destroy_native_button("gameClub")
```

支持的 `button_type` 为 `"userInfo"`、`"openSetting"`、`"gameClub"`。`create_user_info_button()` 封装基础库 2.0.1 起支持的 `wx.createUserInfoButton`。`create_open_setting_button()` 封装基础库 2.0.7 起支持的 `wx.createOpenSettingButton`，但官方文档标注它从基础库 3.0.0 起停止维护，能用 `wx.openSetting` 时应优先用 `open_setting()`。`create_game_club_button()` 封装基础库 2.0.3 起支持的 `wx.createGameClubButton`；`openlink` 和 `hasRedDot` 从 2.30.3 开始支持。

### 调试日志（微信）

微信提供两组调试日志能力：通过 `wx.setEnableDebug` / `wx.getLogManager` 写本地调试日志，通过 `wx.getRealtimeLogManager` 写实时日志。SDK 会把 active manager 对象保存在 JS 侧，所有操作结果统一从 `debug_operation_result` 返回。

```gdscript
func _ready() -> void:
    MiniGameSDK.debug_operation_result.connect(_on_debug_operation)

func enable_runtime_logs() -> void:
    MiniGameSDK.set_enable_debug(true)

func write_local_logs() -> void:
    MiniGameSDK.get_log_manager(1)
    MiniGameSDK.log_manager_debug(["boot", {"scene": "main"}])
    MiniGameSDK.log_manager_info(["player", {"id": "p001"}])
    MiniGameSDK.log_manager_log(["score", 1200])
    MiniGameSDK.log_manager_warn(["slow-frame", {"dt": 33.4}])

func write_realtime_logs() -> void:
    MiniGameSDK.get_realtime_log_manager()
    MiniGameSDK.realtime_log_tag("godot-demo")
    MiniGameSDK.realtime_log_set_filter_msg("session-123")
    MiniGameSDK.realtime_log_add_filter_msg("player-p001")
    MiniGameSDK.realtime_log_info(["scene", {"name": "main"}])
    MiniGameSDK.realtime_log_warn(["retry", {"count": 2}])
    MiniGameSDK.realtime_log_error(["crash", {"code": 500}])

func _on_debug_operation(action: String, ok: bool, data_json: String, err: String) -> void:
    if ok:
        print(action, JSON.parse_string(data_json))
    else:
        push_warning("%s failed: %s" % [action, err])
```

`set_enable_debug()` 封装基础库 1.4.0 起支持的 `wx.setEnableDebug`。`get_log_manager()` 封装基础库 2.1.0 起支持的 `wx.getLogManager`；其中 `level` 参数从 2.3.2 开始支持，`0` 会包含 App/Page/wx 生命周期与 API 调用日志，`1` 不包含。微信本地 `LogManager` 日志最多约 5 MB，超过后会删除旧日志。`get_realtime_log_manager()` 封装基础库 2.14.4 起支持的 `wx.getRealtimeLogManager`；官方插件示例从 2.16.0 开始支持插件侧实时日志，并使用了 `tag()`，所以 `realtime_log_tag()` 会在运行时暴露该方法时调用它。`RealtimeLogManager` 对象文档标注标准对象方法在插件中不可用。

### 未封装 API 兜底调用

对于插件暂时没有强类型封装的微信 / 抖音 API，可以用 `call_api()` 直接调用平台对象上的同名方法。异步结果统一从 `generic_api_result` 信号返回。

```gdscript
MiniGameSDK.generic_api_result.connect(func(api_name, ok, data_json, err):
    if ok:
        print(api_name, JSON.parse_string(data_json))
    else:
        push_warning("%s failed: %s" % [api_name, err])
)

# 调用 wx.setClipboardData({ data: "hello" })
MiniGameSDK.call_api("setClipboardData", {"data": "hello"})

# 对 getStorageSync(key) 这类位置参数 / 同步 API，使用 _args。
MiniGameSDK.call_api("getStorageSync", {"_args": ["level"]})
```

`call_api()` 是覆盖长尾 API 的兜底能力。登录、支付、广告、文件系统、生命周期等高频或语义复杂能力仍建议优先使用强类型方法，方便获得稳定参数、返回值和错误语义。

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

### 开发者工具自动化

目前没有内置的微信开发者工具 MCP / Codex skill。可用的官方自动化入口有三类：

| 入口 | 适合做什么 |
|------|------------|
| `cli open/preview/upload/auto` | 打开项目、预览、上传、开启自动化监听 |
| `127.0.0.1:{port}/v2/...` HTTP 接口 | 从脚本触发 open、preview、upload、autopreview、build-npm、清缓存 |
| `miniprogram-automator` | 外部 Node.js 脚本驱动页面跳转、读页面数据、触发事件、调用 `wx` API |

使用前需要在微信开发者工具 **设置 → 安全设置** 中开启 CLI / HTTP 调用。小游戏是 canvas 场景，自动化 SDK 对页面组件树的可观测性有限；建议优先用于打开导出目录、收集预览 / 上传包体积信息、调用平台 API 做冒烟验证。画面级断言仍应结合截图或真机 VConsole 日志。

### 审核注意

| 项 | 要点 |
|----|------|
| 合规图标 | 后台上传 144x144、512x512 |
| 服务器域名白名单 | `request` / `socket` / `uploadFile` / `downloadFile` 四类分开配置 |
| 实名认证（适龄提示） | 国内小游戏强制 |
| 隐私协议 | 使用 `MiniGameSDK.get_privacy_setting()` / `require_privacy_authorize()`，并在开发者工具和真机验证同意弹窗 |
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
