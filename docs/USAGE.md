<p align="right">
  <strong>English</strong> · <a href="USAGE_zh.md">简体中文</a>
</p>

# Godot Mini Game Usage Guide

This guide walks through every step from install to store submission, and documents every field in the export dock, every SDK call, and the common pitfalls. For a quick start, see the [README](../README.md).

- [1. Prerequisites](#1-prerequisites)
- [2. Install & Enable](#2-install--enable)
- [3. Create a Web export preset](#3-create-a-web-export-preset)
- [4. Export dock reference](#4-export-dock-reference)
- [5. Engine template management](#5-engine-template-management)
- [6. Output layout](#6-output-layout)
- [7. Importing into DevTools](#7-importing-into-devtools)
- [8. MiniGameSDK deep dive](#8-minigamesdk-deep-dive)
- [9. Assets & subpackages](#9-assets--subpackages)
- [10. Persistent storage](#10-persistent-storage)
- [11. On-device testing & review](#11-on-device-testing--review)
- [12. Building a custom engine template](#12-building-a-custom-engine-template)
- [13. FAQ](#13-faq)

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Godot | 4.3 – 4.6 (tested) | Engine |
| WeChat DevTools | latest stable | Debug + upload WeChat mini games |
| Douyin DevTools | latest stable | Debug + upload Douyin mini games |
| Node.js | ≥ 16 LTS (recommended) | Built-in zlib Brotli compression |
| brotli CLI | optional | Fallback when Node is unavailable |

> macOS: `brew install brotli`
> Ubuntu / Debian: `sudo apt install brotli`

Brotli is used to compress `godot.wasm` (~20 MB) into `godot.wasm.br` (~6 MB) during export — mini-game runtimes decode it natively. Without Node or a brotli CLI the plugin ships the uncompressed `.wasm`, which blows past the 4 MB per-subpackage limit, so you really want one of the two.

---

## 2. Install & Enable

### Option A: Download a release

Grab the latest `godot_mini_game-*.zip` from [Releases](../../releases), unzip into your project:

```
your_project/
├── project.godot
└── addons/
    └── godot_mini_game/
        ├── plugin.cfg
        ├── engine/           # pre-compiled engine (keep it)
        ├── templates/
        ├── exporter.gd
        ├── export_dock.gd / .tscn
        └── MiniGameSDK.gd
```

### Option B: Clone the repo

```bash
git clone https://github.com/AnranS/godot_for_minigame.git
cp -r godot_for_minigame/addons/godot_mini_game your_project/addons/
```

### Enable

Godot editor → **Project > Project Settings > Plugins** → check **Godot Mini Game Export**. Once enabled:

- The **Mini Game Export** dock appears at the bottom
- `MiniGameSDK` is registered as an autoload (visible in *Project Settings > AutoLoad*)

> If the dock does not show up, switch editor modes (2D/3D/Script) to refresh the layout, or restart the editor.

---

## 3. Create a Web export preset

**Project > Export** → **Add...** → **Web**. Name it anything (e.g. `MiniGame`). Default settings are fine; you do NOT need to download a standard Web export template.

> **Why no template download?** The plugin uses `--export-pack` to produce a bare `.pck`, then supplies its own engine binaries from `addons/godot_mini_game/engine/`. This sidesteps the WASM features (SIMD, exception tags) that `WXWebAssembly` on real devices refuses to compile.

> **Export filter is overridden:** the plugin forces `export_filter=all_resources` and clears `export_files` on the chosen preset. If you have a carefully curated filter preset for another purpose, create a dedicated preset for mini-game export.

---

## 4. Export dock reference

The dock sits at the bottom of the editor and contains:

### Platform

| Option | Notes |
|--------|-------|
| 微信小游戏 | `wechat` template; writes `project.config.json` + `project.private.config.json` |
| 抖音小游戏 | `douyin` template; writes the Douyin-shaped `project.config.json` |

Platform differences:
- WeChat `game.json` includes `iOSHighPerformance` and `workers.path` (audio worklet hookup)
- Douyin does not declare workers

### AppID

- WeChat: the `wx...` ID from [mp.weixin.qq.com](https://mp.weixin.qq.com)
- Douyin: the `tt...` ID from [developer.open-douyin.com](https://developer.open-douyin.com)
- Leave blank or type anything for local dev; must be real for upload

### Orientation

- `portrait`
- `landscape`

Written into `game.json → deviceOrientation`. This is **not** synced from **Project Settings > Display > Window > Orientation**; align them yourself if needed.

### Preset

The dock scans `export_presets.cfg` and lists every defined preset. Pick the Web preset you made in step 3.

### Output directory

Pick an **empty folder**. Every export overwrites `engine/`, `subpacks/`, `js/`, `images/`, `game.js`, `game.json`, etc. Don't nest it inside the Godot project.

### Export

Click — the dock log shows 5 steps:

```
Step 1/5: Export resource pack (.pck) ...
Step 2/5: Obtain engine files (godot.js / godot.wasm) ...
Step 3/5: Copy JS runtime templates ...
Step 4/5: Generate platform configs (wechat) ...
Step 5/5: Create placeholder files ...
```

A modal shows the output path on success. Any failure is printed in red in the log.

---

## 5. Engine template management

The **Engine Template** strip at the top of the dock shows the current lookup result. Search order:

| Priority | Location | When it's used |
|----------|----------|----------------|
| 1 | `addons/godot_mini_game/godot.js` + `godot.wasm.br` | Manual override (debugging / custom builds) |
| 2 | `addons/godot_mini_game/engine/` | Bundled default |
| 3 | `~/.config/godot_mini_game/templates/{major.minor}/` | Imported via dock, shared across projects |
| 4 | Godot's standard Web export template zip | Simulator-only fallback, with warning |

### Import a new engine template

Click **Import Template**, pick a zip:
- Either the `minigame-template-*.zip` from GitHub Actions
- Or one you built locally with `scripts/build_wasm_template.sh`

Steps performed:
1. Scan the zip for `godot.js`, `godot.wasm` / `godot.wasm.br`
2. Extract into `~/.config/godot_mini_game/templates/{4.x}/` (reusable across projects)
3. If only an uncompressed `.wasm` is present, auto-run Node or brotli CLI to produce `.wasm.br`
4. Write a `version.txt` marker

### Refresh

Click **Refresh** to re-evaluate template status (e.g. after swapping files in `engine/` manually).

### Runtime patches

After fetching `godot.js`, the exporter injects idempotent mini-game compatibility patches (see `exporter.gd::_patch_godot_js`):

- Rewrite bare `document` / `window` / `navigator` to the polyfills on `GameGlobal.__adapter`
- Export `Engine` / `Godot` on `GameGlobal` so the loader can find them
- Guard against `GodotConfig.canvas.parentElement` being null
- Replace `GL.createContext` with a version that recovers when canvas is null or `getContext` fails twice (falls back to `GameGlobal.canvas` and a cached context)
- Neutralise `connectPositionWorklet` — the AudioWorkletNode cannot connect to native audio nodes, so we just `start()`. Audio plays; you lose sample-accurate position callbacks.
- Make `isWebGLAvailable` catch exceptions and default to `true`

If a file has already been patched, the patch is skipped.

---

## 6. Output layout

```
<output>/
├── game.js                # platform entry (wechat/douyin-specific)
├── game.json              # platform manifest
├── project.config.json
├── project.private.config.json   # WeChat only
├── adapter.js             # DOM/BOM/Audio/Input polyfill
├── fetch.js               # fetch/XHR polyfill
├── engine/                # engine subpackage
│   ├── godot.wasm.br      # Brotli-compressed WASM
│   ├── godot.zip          # renamed .pck
│   ├── godot.audio.worklet.js
│   ├── godot.audio.position.worklet.js
│   └── game.js            # placeholder (subpackages need a game.js)
├── subpacks/              # reserved empty subpackage
│   └── game.js            # placeholder
├── js/
│   ├── libs/
│   │   ├── godot.js       # patched Emscripten glue
│   │   └── sdk.js         # GDScript ↔ JS bridge
│   ├── loader.js          # loading screen + engine startup
│   └── worker/
│       └── position_reporting.js  # required by game.json → workers.path
└── images/
    ├── logo.png
    └── background.png
```

### Contracts worth noting

- **`engine/` is the `engine` subpackage**: declared in `game.json` as `{"root":"engine/","name":"engine"}`. The loader calls `wx.loadSubpackage({name:"engine"})` so cold-start only downloads the main bundle upfront.
- **`subpacks/` is reserved**: empty by default. Drop large assets (levels, videos) here and extend `game.json → subpackages` if you need to stay under the 4 MB per-subpackage limit.
- **`js/worker/` must exist**: WeChat's `game.json` declares `workers.path: js/worker`; even if you never spawn a Worker, the directory must be there or upload/real device errors out.

---

## 7. Importing into DevTools

### WeChat

1. Open WeChat DevTools → **MiniGame** → **Import Project**
2. Directory: pick the output folder
3. AppID: auto-read from `project.config.json`
4. Project type: **Game**
5. Click **Import**

After import:
- Hit **Compile** to launch the simulator
- **Debug → Switch Base Library**: pick a recent stable (≥ 3.2.0). Older libs are missing `WXWebAssembly` APIs.
- **Details → Local Settings**: enable **Don't verify valid domains** for local testing (disable before upload)

### Douyin

1. Douyin DevTools → **MiniGame** → **Import Project**
2. Pick the output folder; AppID auto-detected from `project.config.json`
3. **Compile**

### Common first-run errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| `WXWebAssembly.compile CompileError` | Using the standard Web template (SIMD / exception tags) | Switch to bundled or imported compatible template |
| `GameGlobal.canvas is not defined` | `game.js` wasn't treated as the entry | Don't rename the entry in `game.json` |
| `loadSubpackage fail` | Subpackage directory missing | Ensure both `engine/` and `subpacks/` contain the placeholder `game.js` |
| Black screen, log shows `GL.createContext failed` | `getContext` called a second time and failed | Upgrade base library to 3.2+, or restart DevTools |

---

## 8. MiniGameSDK deep dive

The plugin registers `MiniGameSDK` as an autoload. In non-mini-game environments (editor, desktop export) every method is a safe no-op, so you can call it freely during development.

Async calls deliver results via **signals** — no `await`. Sync calls (`storage_*`, `vibrate_*`) return immediately.

### Detect runtime

```gdscript
if MiniGameSDK.is_mini_game:
    print("Running inside mini-game host")
else:
    print("Editor / plain web / PC")
```

### Login & user info

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
        # Send `code` to your backend, which calls jscode2session
        # to exchange it for an openid + session_key.
        MiniGameSDK.http_request("https://your.api/login", "POST",
            JSON.stringify({"code": code}))

func _on_user_info(info_json: String, err: String) -> void:
    if err.is_empty():
        var info = JSON.parse_string(info_json)
        print(info.nickName, info.avatarUrl)
```

### Storage

```gdscript
MiniGameSDK.storage_set("level", "5")
MiniGameSDK.storage_set("settings", JSON.stringify({"music": 0.7, "sfx": 1.0}))

var level := int(MiniGameSDK.storage_get("level", "1"))
var settings_json := MiniGameSDK.storage_get("settings", "{}")
var settings = JSON.parse_string(settings_json)

MiniGameSDK.storage_remove("old_key")
MiniGameSDK.storage_clear()

var info_json := MiniGameSDK.storage_info()
# { "keys":[...], "size":<bytes>, "limit":<bytes> }
```

> WeChat `wx.setStorage` caps a single value at 1 MB and total storage at 10 MB. Shard large blobs across keys yourself.

### Ads

```gdscript
# Rewarded video
func show_rewarded() -> void:
    MiniGameSDK.ad_created.connect(_on_ad_created)
    MiniGameSDK.rewarded_ad_result.connect(_on_rewarded)
    MiniGameSDK.create_rewarded_ad("adunit-xxxxxxxxx")

func _on_ad_created(ad_type: String, ok: bool, err: String) -> void:
    if ad_type == "rewarded" and ok:
        MiniGameSDK.show_rewarded_ad()
    elif not ok:
        MiniGameSDK.show_toast("Ad fetch failed: %s" % err, "error")

func _on_rewarded(completed: bool, err: String) -> void:
    if completed:
        player.add_coins(50)

# Banner
MiniGameSDK.create_banner_ad("adunit-yyyyyyyyy")
MiniGameSDK.show_banner_ad()
# ... on scene change
MiniGameSDK.hide_banner_ad()
MiniGameSDK.destroy_banner_ad()

# Interstitial
MiniGameSDK.create_interstitial_ad("adunit-zzzzzzzzz")
MiniGameSDK.show_interstitial_ad()
```

> Ad unit IDs must be approved in the platform console. Simulator usually accepts test IDs.

### Payment (WeChat virtual currency)

```gdscript
MiniGameSDK.payment_result.connect(func(ok, err):
    if ok: grant_item()
    else: print("payment failed:", err)
)
MiniGameSDK.request_payment({
    "offerId": "1000xxxxx",
    "currencyType": "CNY",
    "amount": 100,  # unit: cents
    "zoneId": "1",
})
```

### Vibration & keyboard

```gdscript
MiniGameSDK.vibrate_short("medium")  # heavy / medium / light
MiniGameSDK.vibrate_long()

MiniGameSDK.keyboard_event.connect(_on_kb)
MiniGameSDK.show_keyboard("initial", 32, false)

func _on_kb(event: String, value: String) -> void:
    match event:
        "input": live_preview(value)
        "confirm": commit(value)
        "complete": hide_keyboard_ui()
```

### HTTP

`http_request` goes through `wx.request` / `tt.request`, not the `fetch` polyfill. CORS is governed by the platform "request whitelisted domain" list:

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

> Before release, whitelist your API domain under **Development Settings → Server Domains → request** in the WeChat console.

### Share

```gdscript
# User opens the built-in menu → Share
MiniGameSDK.show_share_menu()

# Programmatic share
MiniGameSDK.share_app(
    "Beat my score!",
    "https://your.cdn/share.png",
    "inviter=%s" % player_id,
)
```

### System info / safe area

```gdscript
var info := MiniGameSDK.get_system_info()
# common fields: platform, system, model, pixelRatio, screenWidth, screenHeight, statusBarHeight

var menu := MiniGameSDK.get_menu_button_rect()
# { top, bottom, left, right, width, height } — avoid your UI overlapping the capsule button
```

### Lifecycle

```gdscript
MiniGameSDK.app_shown.connect(func(opts_json): resume_music())
MiniGameSDK.app_hidden.connect(func(): pause_music())
MiniGameSDK.app_error.connect(func(msg): print("JS runtime error:", msg))
```

### Native UI

```gdscript
MiniGameSDK.show_toast("Saved", "success", 1500)   # icon: success / error / loading / none
MiniGameSDK.show_loading("Loading…")
# ... work
MiniGameSDK.hide_loading()

MiniGameSDK.modal_result.connect(func(confirmed):
    if confirmed: delete_save()
)
MiniGameSDK.show_modal("Delete save?", "Cannot be undone")
```

### Clipboard / screen

```gdscript
MiniGameSDK.set_clipboard("Invite code: ABCD")
MiniGameSDK.clipboard_received.connect(func(data, err): print(data))
MiniGameSDK.get_clipboard()

MiniGameSDK.set_keep_screen_on(true)
```

---

## 9. Assets & subpackages

### Default layout

| Subpackage | Path | Contents |
|------------|------|----------|
| **main** | `/` | `game.js`, polyfills, loader, images, js worker |
| `engine` | `engine/` | `godot.wasm.br` + `godot.zip` (the `.pck`) |
| `subpacks` | `subpacks/` | Reserved, empty by default |

WeChat limits: main 4 MB, each subpackage 4 MB, total 20 MB (as of 2026 Q1). The plugin keeps WASM + assets in `engine`, so the main bundle is usually < 500 KB.

### Splitting large assets into `subpacks/`

If `godot.zip` overflows 4 MB you need to shard assets:

1. Group heavy assets (videos, audio, hi-res textures) under e.g. `res://heavy/`
2. The plugin currently forces `all_resources` on the preset, so sharding via the preset alone is not possible yet
3. Advanced: run `Godot --headless --export-pack` manually multiple times to produce separate `.pck` files, place them in `subpacks/`, and add an entry to `game.json → subpackages` (the `subpacks` root is already declared)

> Tracked as a follow-up: the exporter only produces a single `.pck` today. Multi-pack export requires extending `exporter.gd::_export_pck`.

### Static assets

- `images/logo.png` and `images/background.png` are written as placeholders on first export. To customise:
  - Drop PNGs into `addons/godot_mini_game/templates/common/images/` to override
  - Or replace them in the output directory after each export

---

## 10. Persistent storage

### Engine side

Godot `user://` normally maps to IDBFS. Inside a mini-game host the loader bridges it:

- At startup `godotSdk.copyLocalToFS(p)` restores every persistent path from `wx.getStorage` into the Emscripten FS
- Every 5s a `setInterval` calls `godotSdk.syncfs()` to push the FS back into `wx.setStorage`

To force a flush at a critical moment (no dedicated API yet):

```gdscript
JavaScriptBridge.eval("GameGlobal.godotSdk.syncfs(null, ()=>{})")
```

### Migrating old saves

First time a Web-published game becomes a mini-game, `user://` is empty — the mini-game host has no access to the old IDB. Pull old saves from your server and write them to `user://` yourself through `MiniGameSDK.storage_get`/`set`.

---

## 11. On-device testing & review

### Preview on a phone

- WeChat DevTools → **Preview** (scan QR). First real-device run: watch the Vconsole for WASM compile time (an iPhone 7 takes ~8–12s).
- Real-device black screen is almost always one of:
  1. WASM incompat → you picked the standard Web template. Swap to a compatible one.
  2. `GameGlobal.canvas` acquisition failed → base library < 3.0. Upgrade WeChat or pin the base library version.

### Submission checklist

| Item | Notes |
|------|-------|
| Icons | Upload 144×144 and 512×512 via console |
| Server domain whitelist | Configure `request` / `socket` / `uploadFile` / `downloadFile` separately |
| Real-name verification (China) | Mandatory for mini games |
| Privacy agreement | Requires the `wx.getPrivacySetting` flow — not yet wrapped by the SDK. Add it in `game.js` yourself. |
| Anti-addiction | Required for titles with IAP or social features |

---

## 12. Building a custom engine template

`scripts/build_wasm_template.sh` can build a mini-game-compatible template for any Godot 4.x.

```bash
# Default: Godot 4.6.1-stable + Emscripten 4.0.3
./scripts/build_wasm_template.sh

# Specific Godot version
./scripts/build_wasm_template.sh 4.4.1-stable

# Specific Emscripten version
./scripts/build_wasm_template.sh 4.6.1-stable 3.1.62
```

Steps the script performs:

1. Install/activate emsdk (default `~/Desktop/build_wasm/emsdk`)
2. `git clone` Godot source
3. `scons platform=web target=template_release production=yes threads=no wasm_simd=no SUPPORT_LONGJMP='emscripten'`
4. Produces `build_wasm/output/minigame-template-{version}.zip`
5. Back in the editor, click **Import Template** in the dock and pick the zip

> Apple Silicon: ~5 min. Intel / Linux: ~8–15 min.

### GitHub Actions

The repo ships `.github/workflows/build_wasm_template.yml`. Trigger it manually from **Actions > Build Mini-Game WASM Template > Run workflow** when you don't have emcc locally.

---

## 13. FAQ

### Q: Export says "missing godot.js"

A: Check the **Engine Template** status at the top of the dock. Four scenarios:
- Bundled missing: make sure `addons/godot_mini_game/engine/` has both `godot.js` and `godot.wasm.br`
- Custom override not picked up: double-check filenames at `addons/godot_mini_game/godot.js` / `godot.wasm.br`
- Template store empty: click **Import Template** and pick a zip
- Only the standard template is found: will run but simulator-only; import a compatible one for real devices

### Q: Export works on simulator, but real device throws `CompileError: OOM / magic Tag section`

A: You're on the priority-4 fallback (standard Web template) which carries SIMD / exception tags. Build a compatible template via `./scripts/build_wasm_template.sh` or download `minigame-template-*.zip` from Releases and import it.

### Q: Node is installed, but the log still says "not found"

A: On macOS the plugin checks `/usr/local/bin/node`, `/opt/homebrew/bin/node`, `/usr/bin/node`, and `which node`. If your Node lives elsewhere (e.g. nvm under `~/.nvm/versions/...`):
- Symlink it: `ln -s $(which node) /usr/local/bin/node`
- Or install brotli CLI: `brew install brotli`

### Q: Can I just use the standard Web export?

A: Simulator yes, real device usually CompileError. `WXWebAssembly` lacks SIMD and exception tags. Use the plugin's compatible template.

### Q: Audio pops or feels laggy

A: We neutralised `connectPositionWorklet` for host compatibility, so the engine loses sample-accurate playback position. Impact on 2D / 3D spatial audio is tiny; if you need exact audio sync, you'll have to wait for mini-game hosts to expose proper `AudioWorkletNode`.

### Q: How do I test the SDK inside the editor?

A: Run the scene normally — `is_mini_game` returns `false`, every method is a safe no-op. For more precise stubbing, inject a fake into `MiniGameSDK._sdk` in your tests, or branch on `OS.has_feature("web")`.

### Q: Multiple accounts on the same device?

A: Prefix your keys with an account id, e.g. `"user:%s:level" % openid`. `wx.setStorage` is already scoped to the current WeChat account, so data won't cross accounts on its own.

### Q: Where do I file bugs or PRs?

A: Please use [issues](../../issues) and [discussions](../../discussions). Bug reports benefit from:
- Godot version
- Platform (WeChat / Douyin)
- Base library version
- Dock export log screenshot
- DevTools or on-device Vconsole log

---

For deeper internals (the full hook list inside `adapter.js`, or the `sdk.js` ↔ `MiniGameSDK.gd` ABI), the source is thoroughly commented — read the code.
