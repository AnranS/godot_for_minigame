# Godot Mini Game Export Plugin

A Godot 4.x editor plugin that converts Godot games into **WeChat Mini Games** and **Douyin (TikTok) Mini Games** with one click.

## Features

- **One-click export** from the Godot editor dock panel
- **Platform adapter** that bridges Godot's Emscripten web export to mini-game runtimes (canvas, WebGL, audio, input, file system)
- **Unified SDK** (`MiniGameSDK` autoload) exposing 13 platform API modules via clean GDScript signals:

| Module | Key Methods |
|--------|------------|
| Storage | `storage_set`, `storage_get`, `storage_remove`, `storage_clear` |
| Auth | `login`, `check_session`, `get_user_info` |
| Share | `share_app`, `show_share_menu`, `hide_share_menu` |
| Rewarded Ad | `create_rewarded_ad`, `show_rewarded_ad` |
| Banner Ad | `create_banner_ad`, `show_banner_ad`, `hide_banner_ad` |
| Interstitial Ad | `create_interstitial_ad`, `show_interstitial_ad` |
| Payment | `request_payment` |
| Vibration | `vibrate_short`, `vibrate_long` |
| Keyboard | `show_keyboard`, `hide_keyboard` |
| Clipboard | `set_clipboard`, `get_clipboard` |
| Network | `http_request` |
| System | `get_system_info`, `get_launch_options`, `get_window_info` |
| Lifecycle | `app_shown`, `app_hidden`, `app_error` (signals) |

## Requirements

- Godot 4.x (tested with 4.6)
- Godot Web export template installed (`Editor > Manage Export Templates`)
- WeChat DevTools or Douyin DevTools for testing

## Installation

1. Copy the `addons/godot_mini_game/` folder into your project's `addons/` directory.
2. In Godot, go to `Project > Project Settings > Plugins` and enable **Godot Mini Game Export**.
3. The plugin automatically registers a `MiniGameSDK` autoload singleton.

## Usage

### Exporting

1. Open the **Mini Game Export** dock (bottom-right panel).
2. Select the target platform (WeChat / Douyin).
3. Enter your App ID and choose orientation.
4. Select a Web export preset and set the output directory.
5. Click **Export**. The plugin will:
   - Export the `.pck` resource pack
   - Extract `godot.js` + `godot.wasm` from the Web export template
   - Copy and patch all runtime adapter files
   - Generate platform-specific config files
6. Open the output directory in WeChat/Douyin DevTools.

### Using the SDK in your game

```gdscript
# The MiniGameSDK autoload is available globally.
# All async results are delivered via signals.

func _ready():
    MiniGameSDK.login_completed.connect(_on_login)
    MiniGameSDK.login()

func _on_login(code: String, error: String):
    if error.is_empty():
        print("Login code: ", code)

# Storage is synchronous
MiniGameSDK.storage_set("level", "5")
var level = MiniGameSDK.storage_get("level", "1")

# Show a native toast
MiniGameSDK.show_toast("Hello!", "success")

# Vibration
MiniGameSDK.vibrate_short("medium")
```

All methods are safe no-ops when running outside a mini-game environment (e.g. in the Godot editor or a regular browser), so you can develop and test normally.

## Project Structure

```
addons/godot_mini_game/
├── plugin.cfg / plugin.gd          # Editor plugin entry
├── export_dock.gd / .tscn          # Export UI dock
├── exporter.gd                     # Export pipeline (pck, engine, patches)
├── MiniGameSDK.gd                  # GDScript SDK autoload
└── templates/
    ├── common/
    │   ├── adapter.js               # DOM/BOM/Canvas/Audio/Input polyfills
    │   ├── fetch.js                  # Fetch API polyfill
    │   ├── js/libs/sdk.js            # JS platform API bridge
    │   ├── js/loader.js              # Engine loader + loading screen
    │   └── engine/                   # Audio worklet stubs
    ├── wechat/                       # WeChat-specific templates
    └── douyin/                       # Douyin-specific templates
```

## Demo Project

This repository is itself a Godot project you can open directly. It includes a test scene (`scenes/main.tscn`) with buttons for every SDK feature.

## License

[MIT](LICENSE)
