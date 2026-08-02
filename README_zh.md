<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.png" />
    <img src="assets/banner-light.png" width="720" alt="Godot 项目通过 Godot Mini Game 导出为微信与抖音小游戏" />
  </picture>
</p>

<h1 align="center">Godot Mini Game</h1>

<p align="center">
  <strong>将 Godot 游戏导出为微信与抖音小游戏。</strong><br />
  经项目 CI 验证的 WASM 引擎 · 带保护边界的导出事务 · 一套版本化 GDScript SDK
</p>

<p align="center">
  <a href="https://github.com/AnranS/godot_for_minigame/releases/latest"><img alt="最新版本" src="https://img.shields.io/github/v/release/AnranS/godot_for_minigame?display_name=tag&style=flat-square" /></a>
  <a href="https://github.com/AnranS/godot_for_minigame/actions/workflows/smoke-test-export.yml"><img alt="导出测试" src="https://img.shields.io/github/actions/workflow/status/AnranS/godot_for_minigame/smoke-test-export.yml?branch=main&label=export%20tests&style=flat-square" /></a>
  <img alt="Godot 4.6.1" src="https://img.shields.io/badge/Godot-4.6.1-478CBF?logo=godot-engine&logoColor=white&style=flat-square" />
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/github/license/AnranS/godot_for_minigame?style=flat-square" /></a>
</p>

<p align="center">
  <strong><a href="https://github.com/AnranS/godot_for_minigame/releases/latest">下载最新版 →</a></strong> ·
  <a href="https://anrans.github.io/godot_for_minigame/">官方网站</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="https://anrans.github.io/godot_for_minigame/api/">API 文档</a> ·
  <a href="README.md">English</a>
</p>

---

Godot Mini Game 可以把普通 Godot 项目转换成微信或抖音小游戏工程。日常导出
不需要安装 Node.js、Brotli、Emscripten，也不需要另外下载 Godot Web 导出模板。

## 为什么选择 Godot Mini Game？

| | |
|---|---|
| **编辑器内完成工作流**<br />在一个 Dock 中构建 PCK、装配平台文件、验证并发布。 | **精确模板身份**<br />Godot 源码、Emscripten、profile、revision、schema、特性和哈希保持一致。 |
| **一套 SDK，两个 Provider**<br />`MiniGameSDK` 通过共享的 `wx` / `tt` 运行时契约提供 220 个方法、82 个信号。 | **受保护的发布边界**<br />暂存区、所有权 Manifest、哈希、输出锁、backup 和回滚只处理受管路径，并保留 sidecars。 |

## 系统架构

<p align="center">
  <a href="assets/export-architecture-zh.svg">
    <img src="assets/export-architecture-zh.svg" width="720" alt="架构：单个目标平台依次经过预检、精确模板解析、同级暂存、验证与锁内受管路径发布，产物运行时再通过 PlatformRuntime 和版本化 JavaScript 到 GDScript Bridge 工作" />
  </a>
</p>

<p align="center"><sub>点击架构图可查看原始尺寸。</sub></p>

- **导出控制面**——每次事务只选择微信或抖音之一，解析一个完整引擎模板包，在目标目录之外装配，验证所有受管产物，再在锁内发布。
- **导出产物运行时**——`game.js` 只选择一个 `PlatformRuntime` Provider；Loader 启动修补后的引擎与 PCK，`GodotSDK` 和 `MiniGameSDK` 协商 Bridge ABI。

发布过程支持进程内失败回滚并记录恢复证据，但它不是跨文件系统的 crash-atomic
原语。完整边界见[架构与版本管理](docs/ARCHITECTURE.md)。

## 已验证兼容性

| 契约 | 内置值 |
|---|---|
| 插件版本 | `v0.2.1` |
| Godot | `4.6.1.stable` · commit `14d19694e0c8` |
| Emscripten | `4.0.3` |
| 构建 | `2d_full` · `release` · revision `1` |
| 运行时契约 | Bridge ABI `1` · template schema `1` · output schema `1` |

- ✅ **微信小游戏（`wx`）**——完整导出、Manifest、WASM 与包结构检查。
- ✅ **抖音小游戏（`tt`）**——完整导出、Manifest、WASM 与包结构检查。

> [!IMPORTANT]
> 内置引擎只经过本项目对上述精确身份的验证。其它 Godot 编辑器构建必须导入
> 完全匹配的模板包。自动化检查不能替代平台开发者工具和目标真机上的最终验收。

[`support-matrix.json`](support-matrix.json) 是已验证身份与平台状态在 Release、CI
和官网中的唯一事实源。

## 快速开始

### 1 · 安装 Release 资产

打开[最新版本](https://github.com/AnranS/godot_for_minigame/releases/latest)，
从 **Assets** 下载 `godot_mini_game_vX.Y.Z.zip`，然后解压到 Godot 项目根目录。
不要下载 GitHub 自动生成的 Source code 压缩包。

```text
your_project/
└── addons/
    └── godot_mini_game/
```

<details>
<summary>从源码安装，用于开发调试</summary>

```bash
git clone https://github.com/AnranS/godot_for_minigame.git
mkdir -p your_project/addons
cp -R godot_for_minigame/addons/godot_mini_game your_project/addons/godot_mini_game
```

</details>

### 2 · 启用插件

打开 **项目 > 项目设置 > 插件**，启用 **Godot Mini Game Export**。

### 3 · 添加 Web 导出预设

打开 **项目 > 导出** 并添加一个 **Web** preset，名称可以自定，不需要下载
标准 Web 导出模板。

### 4 · 导出

打开 **Mini Game Export** Dock，选择一个平台，输入 App ID，选择屏幕方向、Web
preset 和专用输出目录，然后点击 **Export**。再用对应的平台开发者工具打开结果。

## 60 秒上手 SDK

插件会将 `MiniGameSDK` 注册成 Autoload。异步接口通过信号返回；在非小游戏
环境中开发时，也可以安全调用这些方法。

```gdscript
MiniGameSDK.login_completed.connect(func(code: String, error: String) -> void:
    if error.is_empty():
        print("login code: ", code)
)
MiniGameSDK.login()

MiniGameSDK.storage_set("level", "5")
var level := MiniGameSDK.storage_get("level", "1")
MiniGameSDK.show_toast("Level %s" % level, "success")
```

启动时 SDK 会先验证 Bridge 的 brand、全局名称、ABI 和必需方法，再绑定生命周期。
排查集成问题时可检查 `bridge_info` 和 `bridge_initialization_error`。

**[查看全部 220 个方法、82 个信号 →](https://anrans.github.io/godot_for_minigame/api/)**

## 文档导航

| 我想要…… | 文档 |
|---|---|
| 安装、配置并导出游戏 | [中文使用指南](docs/USAGE_zh.md) |
| 查找 SDK 方法或信号 | [可搜索 API 文档](https://anrans.github.io/godot_for_minigame/api/) |
| 理解导出事务与版本策略 | [架构与版本管理](docs/ARCHITECTURE.md) |
| 构建或导入其它引擎模板 | [自定义模板指南](docs/USAGE_zh.md#12-编译自定义引擎模板) |
| 发布新的插件版本 | [发布流程](docs/RELEASING.md) |
| 报告问题或提出功能建议 | [GitHub Issues](https://github.com/AnranS/godot_for_minigame/issues) |

英文文档：[Usage guide](docs/USAGE.md) · [English README](README.md)

## 参与贡献

欢迎提交 Issue 和 Pull Request。平台差异应保持在共享 Runtime 与 Bridge 契约之后，
提交变更前请运行完整导出测试。维护者请遵循不可变 Tag 的
[发布流程](docs/RELEASING.md)。

## 许可证

插件采用 [MIT License](LICENSE)。内置 Godot 引擎保留上游版权声明，详见
[`GODOT_COPYRIGHT.txt`](addons/godot_mini_game/GODOT_COPYRIGHT.txt) 和
[`THIRD_PARTY_NOTICES.md`](addons/godot_mini_game/THIRD_PARTY_NOTICES.md)。
