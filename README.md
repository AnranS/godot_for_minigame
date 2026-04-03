<p align="center">
  <img src="assets/banner.svg" width="840" alt="Godot Mini Game — Export to WeChat & Douyin"/>
</p>

---

A Godot 4.x editor plugin that converts your game into a **WeChat** or **Douyin (TikTok) Mini Game** ready for submission. Ships with a pre-compiled engine template — install the plugin, click export, open in DevTools.

## Highlights

- **Zero config** — bundled engine template works out of the box, no Emscripten setup needed
- **One-click export** — editor dock panel handles everything: `.pck`, engine files, JS adapters, platform configs
- **Real-device ready** — engine compiled without WASM SIMD / exception tags that crash `WXWebAssembly`
- **13 native APIs** — auth, ads, payment, storage, share, vibration, keyboard, clipboard, network, and more
- **Dual platform** — WeChat + Douyin from a single codebase

## Quick Start

### 1. Install

Download the [latest release](../../releases) and extract into your project root:

```
your_project/
  addons/
    godot_mini_game/   ← extracted here
```

Or clone this repo and copy the `addons/godot_mini_game/` folder.

### 2. Enable

**Project > Project Settings > Plugins** — enable **Godot Mini Game Export**.

### 3. Create a Web export preset

**Project > Export** — add a **Web** preset (any name). No need to download standard export templates.

### 4. Export

Open the **Mini Game Export** dock at the bottom of the editor:

1. Choose platform (WeChat / Douyin)
2. Enter App ID, pick orientation
3. Select your Web preset and output directory
4. Click **Export**

Open the output folder in **WeChat DevTools** or **Douyin DevTools**.

## SDK API

The plugin registers `MiniGameSDK` as an autoload. All async results come through signals.
Methods are safe no-ops outside mini-game environments — develop and test normally in the editor.

```gdscript
# Login
MiniGameSDK.login_completed.connect(func(code, err):
    if err.is_empty(): print("code: ", code)
)
MiniGameSDK.login()

# Storage (synchronous)
MiniGameSDK.storage_set("level", "5")
var level = MiniGameSDK.storage_get("level", "1")

# Rewarded Ad
MiniGameSDK.ad_created.connect(func(type, ok, err):
    if ok: MiniGameSDK.show_rewarded_ad()
)
MiniGameSDK.rewarded_ad_result.connect(func(completed, err):
    if completed: give_reward()
)
MiniGameSDK.create_rewarded_ad("your-ad-unit-id")

# Toast / Vibration
MiniGameSDK.show_toast("Hello!", "success")
MiniGameSDK.vibrate_short("medium")
```

<details>
<summary><strong>Full API Reference</strong></summary>

### Signals

| Signal | Parameters |
|--------|-----------|
| `login_completed` | `code: String, error: String` |
| `session_checked` | `valid: bool, error: String` |
| `user_info_received` | `info_json: String, error: String` |
| `ad_created` | `ad_type: String, success: bool, error: String` |
| `rewarded_ad_result` | `is_ended: bool, error: String` |
| `interstitial_ad_result` | `success: bool, error: String` |
| `payment_result` | `success: bool, error: String` |
| `keyboard_event` | `event_type: String, value: String` |
| `http_response` | `status_code: int, data: String, error: String` |
| `clipboard_received` | `data: String, error: String` |
| `modal_result` | `confirmed: bool` |
| `app_shown` | `options_json: String` |
| `app_hidden` | — |
| `app_error` | `message: String` |

### Methods

| Category | Methods |
|----------|---------|
| **Auth** | `login()` `check_session()` `get_user_info()` |
| **Storage** | `storage_set(key, val)` `storage_get(key, default)` `storage_remove(key)` `storage_clear()` `storage_info()` |
| **Share** | `share_app(title, image_url, query)` `show_share_menu()` `hide_share_menu()` |
| **Rewarded Ad** | `create_rewarded_ad(id)` `show_rewarded_ad()` |
| **Banner Ad** | `create_banner_ad(id)` `show_banner_ad()` `hide_banner_ad()` `destroy_banner_ad()` |
| **Interstitial** | `create_interstitial_ad(id)` `show_interstitial_ad()` |
| **Payment** | `request_payment(params)` |
| **Vibration** | `vibrate_short(type)` `vibrate_long()` |
| **Keyboard** | `show_keyboard(default_value, max_length, multiple)` `hide_keyboard()` |
| **Clipboard** | `set_clipboard(data)` `get_clipboard()` |
| **Network** | `http_request(url, method, data, headers)` |
| **System** | `get_system_info()` `get_launch_options()` `get_window_info()` `get_menu_button_rect()` |
| **UI** | `show_toast(title, icon, duration)` `show_modal(title, content)` `show_loading(title)` `hide_loading()` |
| **Screen** | `set_keep_screen_on(keep_on)` |

</details>

## Engine Template

The plugin bundles a pre-compiled engine in `addons/godot_mini_game/engine/` (Godot 4.6.1, ~6 MB compressed).

**Why a custom template?** Standard Godot web exports use WASM features (SIMD, exception-handling tags) that `WXWebAssembly` on real devices doesn't support. The bundled template is compiled with:

- `wasm_simd=no`
- `SUPPORT_LONGJMP='emscripten'` (avoids WASM Tag section)
- `threads=no`

### Template resolution order

| Priority | Source | Notes |
|----------|--------|-------|
| 1 | `addons/godot_mini_game/godot.js` + `godot.wasm.br` | Manual override |
| 2 | `addons/godot_mini_game/engine/` | Bundled (default) |
| 3 | `~/.config/godot_mini_game/templates/{version}/` | Imported via dock |
| 4 | Standard Godot Web export template | DevTools only, warns |

### Building for a different Godot version

```bash
# Local build (~5 min on Apple Silicon)
./scripts/build_wasm_template.sh 4.x.x-stable

# Then import the zip via the dock's "Import Engine Template" button
```

Or use the GitHub Actions workflow: **Actions > Build Mini-Game WASM Template**.

## Project Structure

```
addons/godot_mini_game/
├── plugin.cfg / plugin.gd          # Editor plugin entry
├── export_dock.gd / .tscn          # Export UI dock
├── exporter.gd                     # Export pipeline
├── MiniGameSDK.gd                  # GDScript SDK autoload
├── engine/                          # Bundled engine (godot.js + godot.wasm.br)
└── templates/
    ├── common/
    │   ├── adapter.js               # DOM/BOM/Canvas/Audio/Input polyfills
    │   ├── fetch.js                 # Fetch API polyfill
    │   ├── js/libs/sdk.js           # JS ↔ GDScript bridge
    │   └── js/loader.js             # Engine loader + loading screen
    ├── wechat/                      # WeChat configs
    └── douyin/                      # Douyin configs
```

## Requirements

- **Godot 4.x** (tested 4.3 – 4.6)
- **WeChat DevTools** or **Douyin DevTools**
- `brotli` CLI for custom template builds (`brew install brotli`)

## Contributing

Issues and PRs welcome. For custom engine template builds, see `scripts/build_wasm_template.sh`.

## License

[MIT](LICENSE)
