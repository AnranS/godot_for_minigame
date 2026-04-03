# Godot Mini Game

A Godot 4.x editor plugin that exports Godot games to **WeChat** and **Douyin (TikTok) Mini Games** with one click.

Ships with a pre-compiled mini-game compatible engine template (Godot 4.6) — install, export, done.

## Features

- **One-click export** from an editor dock panel
- **Platform adapter** bridging Emscripten to mini-game runtimes (Canvas, WebGL, Audio, Input, FS)
- **Bundled engine template** compiled without WASM SIMD / exception-handling tags, ready for real devices
- **Unified SDK** — 13 native API modules exposed to GDScript via signals
- **WeChat + Douyin** support from a single codebase

## Quick Start

### 1. Install the plugin

Copy `addons/godot_mini_game/` into your Godot project:

```
your_project/
  addons/
    godot_mini_game/   ← copy this folder
  ...
```

Then enable it in **Project > Project Settings > Plugins > Godot Mini Game Export**.

### 2. Create a Web export preset

Go to **Project > Export**, add a **Web** preset. Name it anything (e.g. "Web").
You do **not** need to download the standard Web export template — the plugin ships its own engine.

### 3. Export

1. Open the **Mini Game Export** dock (appears at the bottom of the editor).
2. Select platform (WeChat / Douyin), enter your App ID, choose orientation.
3. Pick the Web preset and output directory.
4. Click **Export**.

Open the output folder in WeChat DevTools or Douyin DevTools.

## SDK Usage

The plugin registers a `MiniGameSDK` autoload singleton automatically.
All async results are delivered via signals. Methods are safe no-ops outside mini-game environments.

### Basic Example

```gdscript
func _ready():
    MiniGameSDK.login_completed.connect(_on_login)
    MiniGameSDK.login()

func _on_login(code: String, error: String):
    if error.is_empty():
        print("Login code: ", code)
```

### Storage (synchronous)

```gdscript
MiniGameSDK.storage_set("level", "5")
var level = MiniGameSDK.storage_get("level", "1")
MiniGameSDK.storage_remove("level")
MiniGameSDK.storage_clear()
```

### Ads

```gdscript
MiniGameSDK.ad_created.connect(func(type, ok, err):
    if ok: MiniGameSDK.show_rewarded_ad()
)
MiniGameSDK.rewarded_ad_result.connect(func(completed, err):
    if completed: give_reward()
)
MiniGameSDK.create_rewarded_ad("your-ad-unit-id")
```

### All API

| Module | Methods | Signals |
|--------|---------|---------|
| **Auth** | `login()`, `check_session()`, `get_user_info()` | `login_completed`, `session_checked`, `user_info_received` |
| **Storage** | `storage_set()`, `storage_get()`, `storage_remove()`, `storage_clear()`, `storage_info()` | — |
| **Share** | `share_app()`, `show_share_menu()`, `hide_share_menu()` | — |
| **Rewarded Ad** | `create_rewarded_ad()`, `show_rewarded_ad()` | `ad_created`, `rewarded_ad_result` |
| **Banner Ad** | `create_banner_ad()`, `show_banner_ad()`, `hide_banner_ad()`, `destroy_banner_ad()` | `ad_created` |
| **Interstitial Ad** | `create_interstitial_ad()`, `show_interstitial_ad()` | `ad_created`, `interstitial_ad_result` |
| **Payment** | `request_payment()` | `payment_result` |
| **Vibration** | `vibrate_short()`, `vibrate_long()` | — |
| **Keyboard** | `show_keyboard()`, `hide_keyboard()` | `keyboard_event` |
| **Clipboard** | `set_clipboard()`, `get_clipboard()` | `clipboard_received` |
| **Network** | `http_request()` | `http_response` |
| **System** | `get_system_info()`, `get_launch_options()`, `get_window_info()` | — |
| **UI** | `show_toast()`, `show_modal()`, `show_loading()`, `hide_loading()` | `modal_result` |
| **Lifecycle** | — | `app_shown`, `app_hidden`, `app_error` |

## Engine Template

The plugin bundles a pre-compiled engine template in `addons/godot_mini_game/engine/`.
It is built from Godot 4.6.1 with the following flags for mini-game compatibility:

- `wasm_simd=no` — WXWebAssembly does not support SIMD
- `SUPPORT_LONGJMP='emscripten'` — avoids WASM Tag section
- `threads=no` — mini-game runtimes are single-threaded

### Template resolution order

1. User-provided `godot.js` + `godot.wasm.br` in `addons/godot_mini_game/` (manual override)
2. Bundled engine in `addons/godot_mini_game/engine/`
3. Imported template in `~/.config/godot_mini_game/templates/{version}/`
4. Standard Godot Web export template (DevTools only, will warn)

### Building your own template

If you need a template for a different Godot version:

```bash
./scripts/build_wasm_template.sh 4.x.x-stable
```

This clones Godot, sets up Emscripten, compiles with compatible flags, and packages a `.zip`.
Import the zip via the dock's **"Import Engine Template"** button.

You can also use the GitHub Actions workflow (`.github/workflows/build-template.yml`).

## Project Structure

```
addons/godot_mini_game/
├── plugin.cfg / plugin.gd            Editor plugin entry point
├── export_dock.gd / .tscn            Export UI dock panel
├── exporter.gd                       Export pipeline (pck, engine, patches)
├── MiniGameSDK.gd                    GDScript SDK autoload
├── engine/                            Bundled engine template
│   ├── godot.js
│   ├── godot.wasm.br
│   └── version.txt
└── templates/
    ├── common/
    │   ├── adapter.js                 DOM/BOM/Canvas/Audio/Input polyfills
    │   ├── fetch.js                   Fetch API polyfill
    │   ├── js/libs/sdk.js             JS ↔ GDScript bridge
    │   └── js/loader.js               Engine loader + loading screen
    ├── wechat/                        WeChat game.js + configs
    └── douyin/                        Douyin game.js + configs
```

## Requirements

- Godot 4.x (tested 4.3 – 4.6)
- WeChat DevTools or Douyin DevTools
- `brotli` CLI recommended for custom template builds (`brew install brotli`)

## License

[MIT](LICENSE)
