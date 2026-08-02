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
| Godot | 4.6.1 certified; exact template required otherwise | Engine |
| WeChat DevTools | latest stable | Debug + upload WeChat mini games |
| Douyin DevTools | latest stable | Debug + upload Douyin mini games |

Normal export needs no Node.js, Brotli CLI, Emscripten, or standard Godot Web
template. A Release already contains a validated Brotli engine bundle. The
compiler and validation tools are maintainer dependencies only; see section 12.

---

## 2. Install & Enable

### Option A: Download a release

Grab the latest `godot_mini_game_v*.zip` from [Releases](https://github.com/AnranS/godot_for_minigame/releases), unzip into your project:

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

> **Why no standard template download?** The plugin uses `--export-pack` to
> produce a bare `.pck`, then selects one complete manifest-backed mini-game
> engine bundle. This sidesteps the WASM features (SIMD, exception tags) that
> `WXWebAssembly` on real devices refuses to compile.

> **Your export filter is preserved:** the plugin reads the selected Web preset
> without rewriting `export_presets.cfg`. Configure the resources you want in
> that preset before exporting.

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

For the first export, pick an **empty folder outside the Godot project**. A
successful export writes a verified `.godot-mini-game-export.json` ownership
manifest. Later exports may reuse that managed folder; an unrelated non-empty
folder, a modified managed artifact, or unlisted content inside an exporter-owned
directory is rejected instead of being adopted or overwritten. Unrelated files
under other top-level names are preserved.

### Export

Click — the dock log shows seven transactional stages:

```
Step 1/7: export the resource pack to staging
Step 2/7: copy one validated engine bundle
Step 3/7: copy the shared JavaScript runtime
Step 4/7: assemble WeChat or Douyin files
Step 5/7: create required package placeholders
Step 6/7: write and verify the artifact manifest
Step 7/7: lock, recheck, and transactionally publish
```

A modal shows the output path on success. Any failure is printed in red in the log.

If an ordinary publish operation fails, the same process rolls the managed
paths back from its sibling backup. A process or power failure is different:
the exporter leaves `.name.godot-mini-game.lock/journal.json`, staging, and any
backup beside the output and refuses another publish. Close Godot and the
platform tools, keep all of those paths, and move the whole output plus recovery
paths to a safe archive before exporting again to a new empty folder. Compare
the archive and new export before removing anything; the exporter deliberately
does not guess through a crash window.

---

## 5. Engine template management

The **Engine Template** strip at the top of the dock shows the current lookup result. Search order:

| Priority | Location | When it's used |
|----------|----------|----------------|
| 1 | `addons/godot_mini_game/` | Complete project override with `template.json` |
| 2 | `{config}/godot_mini_game/templates/v1/{version}/{commit}/emsdk-{emscripten}/2d_full/release/abi-{abi}/r{revision}/` | Imported exact bundles; highest matching revision first |
| 3 | `addons/godot_mini_game/engine/` | Bundled certified bundle |
| 4 | Old exact/major-minor store directories | Read-only compatibility, only with a complete exact manifest |

The exporter never combines files from two sources and never falls back to the
standard Web template. See [Architecture and versioning](ARCHITECTURE.md) for
the complete compatibility contract.
Within the exact-version store, revision wins first; equal revisions select the
numerically newest Emscripten identity and then use a stable path tie-break.

### Import a new engine template

Click **Import Template**, pick a zip:
- Either a `godot_minigame_template_*_emsdk-*_2d-full_release_abi-*_r*.zip` from GitHub Actions
- Or one you built locally with `scripts/build_wasm_template.sh`

Steps performed:
1. Require exactly `template.json`, `version.txt`, `godot.js`, `godot.wasm.br`, and `GODOT_COPYRIGHT.txt` in the bundle
2. Validate the exact version, full source commit, Emscripten version, profile,
   target, revision, Bridge ABI, feature flags, and both SHA-256 values
3. Stage the complete bundle under the schema-versioned multi-version store
4. Transactionally publish it to the identity path encoded by its manifest

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
├── .godot-mini-game-export.json   # ownership, template identity, artifact hashes
├── game.js                # platform entry (wechat/douyin-specific)
├── game.json              # platform manifest
├── project.config.json
├── project.private.config.json   # WeChat only
├── adapter.js             # DOM/BOM/Audio/Input polyfill
├── fetch.js               # fetch/XHR polyfill
├── audio/
│   └── demo-tone.wav      # runtime audio probe asset
├── engine/                # engine subpackage
│   ├── godot.wasm.br      # Brotli-compressed WASM
│   ├── godot.zip          # renamed .pck
│   └── game.js            # placeholder (subpackages need a game.js)
├── subpacks/              # reserved empty subpackage
│   └── game.js            # placeholder
├── js/
│   ├── libs/
│   │   ├── godot.js       # patched Emscripten glue
│   │   └── sdk.js         # GDScript ↔ JS bridge
│   ├── image_loader.js    # host image loader
│   ├── loader.js          # loading screen + engine startup
│   ├── platform_runtime.js # wx/tt provider + capability contract
│   └── worker/
│       └── position_reporting.js  # required by game.json → workers.path
└── images/
    ├── logo.png
    └── background.png
```

### Contracts worth noting

- **`engine/` is the `engine` subpackage**: declared in `game.json` as `{"root":"engine/","name":"engine"}`. The loader calls the selected `wx`/`tt` provider's `loadSubpackage({name:"engine"})`, so cold-start only downloads the main bundle upfront.
- **The listed top-level files and `audio/`, `engine/`, `images/`, `js/`, `subpacks/` are exporter-owned.** Do not add custom files inside them: preflight rejects unlisted content instead of silently deleting it. Put sidecar files under a different top-level name, or package game assets through the Godot export preset/PCK.
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

### Media / images

`choose_media()` wraps `wx.chooseMedia` and is the recommended picker for new WeChat base libraries. `choose_image()` is still exposed for compatibility with older projects, but WeChat marks `wx.chooseImage` as no longer maintained from base library 2.21.0. All media/image calls report through `media_result`; inspect `action` to distinguish the originating API.

```gdscript
MiniGameSDK.media_result.connect(func(action, ok, data_json, err):
    if err.is_empty():
        var data = JSON.parse_string(data_json)
        print(action, data)
    else:
        push_warning("%s failed: %s" % [action, err])
)

# Recommended: image/video picker.
MiniGameSDK.choose_media(1, ["image"], ["album"], 10, ["compressed"])

# Legacy image picker.
MiniGameSDK.choose_image(1, ["compressed"], ["album"])

# Preview local, network, or cloud-file images supported by WeChat.
MiniGameSDK.preview_image(["wxfile://tmp/example.png"])

# Save a local temporary or persistent file path to the user's album.
MiniGameSDK.save_image_to_photos_album("wxfile://usr/result.png")

# Compress a local/code-package image. Width/height are optional.
MiniGameSDK.compress_image("wxfile://usr/result.jpg", 80, 720)
```

WeChat supports `chooseMedia` from base library 2.23.0. `saveImageToPhotosAlbum` starts at 1.2.0 and requires `scope.writePhotosAlbum`. `compressImage` is currently documented for mini games from 3.0.1, with `compressedWidth` / `compressedHeight` listed as 2.26.0+ fields. `previewImage` supports `showmenu` and `referrerPolicy` from 2.13.0. `wx.getImageInfo` is not listed under the current mini-game image API pages; use `call_api("getImageInfo", ...)` only after verifying the target runtime supports it.

### Camera

`create_camera()` wraps `wx.createCamera` and stores the returned `Camera` object for later operations. `camera_take_photo()`, `camera_start_record()`, `camera_stop_record()`, `camera_set_zoom()`, `camera_listen_frame_change()`, `camera_close_frame_change()`, and `camera_destroy()` map to the matching `Camera` methods. Operation results use `camera_operation_result`; runtime events use `camera_event`, and RGBA frame data uses `camera_frame`.

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

WeChat supports `wx.createCamera` and most `Camera` methods from base library 2.9.0. `Camera.setZoom` is documented from 3.9.2. Camera frame callbacks contain RGBA `ArrayBuffer` data; the bridge converts it to JSON as `{ "dataType": "arraybuffer", "base64": "...", "byteLength": n }`. `camera_listen_frame_change(true)` passes the active Worker object when one exists, matching WeChat's worker-frame path for iOS ExperimentalWorker.

### Video

`create_video()` wraps `wx.createVideo` and stores one active `Video` object. Video control methods report state snapshots through `video_operation_result`; runtime events report through `video_event`.

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

`create_video()` accepts WeChat's `wx.createVideo` fields: geometry (`x`, `y`, `width`, `height`), `src`, `poster`, `initialTime`, `playbackRate`, `live`, `objectFit`, control flags, autoplay/loop/mute flags, and native pause behavior. `showProgress`, `showProgressInControlMode`, and `backgroundColor` start at base library 2.12.0; `underGameView` starts at 2.11.0; `obeyMuteSwitch` starts at 2.4.0. Default bridged events are `waiting`, `progress`, `play`, `pause`, `ended`, `timeUpdate`, and `error`. `Video.play()`, `pause()`, `stop()`, `seek()`, `requestFullScreen()`, and `exitFullScreen()` are Promise-style methods in the current WeChat docs.

### Media audio and video decoding

`get_available_audio_sources()` wraps `wx.getAvailableAudioSources`. `create_video_decoder()` wraps `wx.createVideoDecoder`; decoder operations report through `video_decoder_operation_result` and decoder events report through `video_decoder_event`. `create_media_audio_player()` wraps `wx.createMediaAudioPlayer`; the bridge exposes add/remove helpers that use the active `VideoDecoder` as the `MediaAudioPlayer` audio source.

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

WeChat supports `wx.getAvailableAudioSources` from base library 2.1.0. `VideoDecoder` starts at 2.11.1; `VideoDecoder.start()` accepts `source`, `mode`, `abortAudio`, and `abortVideo`, with `abortAudio` / `abortVideo` from 2.15.0. Remote `http://` and `https://` decoder sources start at 2.13.0; lower versions only support local paths. WeChat documents Promise returns for decoder async methods from 2.16.1; older versions should use decoder events for completion. `VideoDecoder.getFrameData()` returns `width`, `height`, `data`, `pkPts`, and `pkDts`; the bridge converts frame `data` `ArrayBuffer` to `{ "dataType": "arraybuffer", "base64": "...", "byteLength": n }`. `MediaAudioPlayer` starts at 2.13.0 and can play audio output from the active `VideoDecoder`.

### RecorderManager

`get_recorder_manager()` wraps `wx.getRecorderManager` and stores WeChat's global audio `RecorderManager`. Recording operations report through `recorder_operation_result`; lifecycle, interruption, error, and frame events report through `recorder_event`.

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

WeChat supports `wx.getRecorderManager` from base library 1.6.0. `recorder_start()` forwards the official options: `duration` in ms up to 600000, `sampleRate`, `numberOfChannels`, `encodeBitRate`, `format` (`mp3`, `aac`, `wav`, `PCM`), optional `frameSize` in KB, and `audioSource` from base library 2.1.0. WeChat documents `frameSize` callbacks only for `mp3` and `pcm` formats; the bridge converts each `frameRecorded.frameBuffer` `ArrayBuffer` to `{ "dataType": "arraybuffer", "base64": "...", "byteLength": n }` and preserves `isLastFrame`. Stop events include `tempFilePath`, `duration`, and `fileSize`.

### Game recorder

`get_game_recorder()` wraps `wx.getGameRecorder` and stores the global `GameRecorder` object. Recording controls and share helpers report through `game_recorder_operation_result`. Recorder lifecycle events and share-button tap errors report through `game_recorder_event`.

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

# Must be triggered from a user gesture in WeChat.
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

WeChat supports `GameRecorder` and `GameRecorderShareButton` from base library 2.8.0. `operateGameRecorderVideo` starts at 2.26.1 and must be called from a user click/tap. `game_recorder_start()` accepts WeChat's `fps`, `duration`, `bitrate`, `gop`, and `hookBgm` options; `duration` is still ended explicitly by calling `game_recorder_stop()`. Share button `share.bgm` must be a code-package path or `wxfile://` path, not an HTTP URL, and `share.timeRange` clips are measured in milliseconds.

### Inner audio

`create_inner_audio_context()` wraps `wx.createInnerAudioContext` and stores one active `InnerAudioContext` object. Playback operations and state snapshots report through `inner_audio_operation_result`. Runtime events report through `inner_audio_event`.

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

WeChat supports `wx.createInnerAudioContext` from base library 1.6.0. `create_options.useWebAudioImplement` starts at 2.19.0 and is intended for short, frequently played sounds. `set_inner_audio_option()` wraps `wx.setInnerAudioOption` from 2.3.0; its `speakerOn` behavior can override `mixWithOther`, and WeChat notes it is not compatible with `useWebAudioImplement` yet. Call `inner_audio_destroy()` when the sound is no longer needed because WeChat does not release `InnerAudioContext` resources automatically. Events bridged by default are `canplay`, `play`, `pause`, `stop`, `ended`, `timeUpdate`, `error`, `waiting`, `seeking`, and `seeked`.

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

### File transfer

`download_file()` wraps `wx.downloadFile` / `tt.downloadFile`, and `upload_file()` wraps `wx.uploadFile` / `tt.uploadFile`. WeChat keeps `request`, `uploadFile`, and `downloadFile` domains in separate whitelists, so configure each domain category you use. WeChat also limits a single `downloadFile` response to 200 MB.

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

The typed wrapper currently reports the basic success/fail result, HTTP status, and raw JSON payload. `DownloadTask` / `UploadTask` progress and abort controls are not exposed as typed GDScript methods yet; use `call_api()` or extend the JS bridge if you need task-level progress events.

### File system

`call_file_system(method, options)` is a generic bridge to `wx.getFileSystemManager()[method](options)` / `tt.getFileSystemManager()[method](options)`. It covers the async FileSystemManager APIs that use an options object, such as `access`, `writeFile`, `readFile`, `appendFile`, `mkdir`, `readdir`, `saveFile`, `removeSavedFile`, `getFileInfo`, `stat`, `unlink`, and `unzip`.

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

# Direct access to less common async manager methods:
MiniGameSDK.call_file_system("truncate", {
    "filePath": "wxfile://usr/save.json",
    "length": 0,
})
```

When `readFile` returns binary `ArrayBuffer` data, the JS bridge serializes it as `{ "dataType": "arraybuffer", "base64": "...", "byteLength": n }` so the result remains valid JSON across the Godot bridge. Text reads should pass an encoding such as `utf8`.

### Subpackages

`load_subpackage()` wraps `wx.loadSubpackage` / `tt.loadSubpackage`, and `pre_download_subpackage()` wraps `wx.preDownloadSubpackage` / `tt.preDownloadSubpackage`. `loadSubpackage` downloads and executes the code package; `preDownloadSubpackage` only downloads it ahead of time. Both task wrappers report progress through `subpackage_progress`.

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

WeChat supports `loadSubpackage` from base library 2.1.0. `preDownloadSubpackage` starts at 2.27.3; normal subpackage pre-download requires 3.4.9+, while `package_type = "workers"` targets worker subpackages.

### Worker

`create_worker()` wraps `wx.createWorker` and returns operation status through `worker_operation_result`. Worker messages, errors, and experimental-worker process recovery events are bridged through `worker_message`, `worker_error`, and `worker_process_killed`.

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

WeChat supports `wx.createWorker` from base library 1.9.90. The script path must point to a file under the configured `workers.path` and must not start with `/`. `use_experimental_worker = true` maps to `useExperimentalWorker` (base library 2.13.0+); when using it, keep `worker_process_killed` connected because WeChat may reclaim the worker process under memory pressure. Current WeChat docs also limit a game to one Worker, so the SDK terminates the previous active Worker before creating a new one.

### WebSocket

`connect_socket()` wraps `wx.connectSocket` / `tt.connectSocket` and uses the returned `SocketTask` for `send`, `close`, and lifecycle events. WeChat requires WebSocket endpoints to use `wss://` and to be configured under the separate `socket` server-domain whitelist.

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

String messages are surfaced directly as `data`. Binary `ArrayBuffer` messages are reported in `data_json` with `dataType: "arraybuffer"` and a base64 payload.

### Network status

`get_network_type()` wraps `wx.getNetworkType` / `tt.getNetworkType`. The raw JSON includes newer WeChat fields such as `signalStrength`, `hasSystemProxy`, and `weakNet` when the base library provides them.

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
# ... on scene shutdown
MiniGameSDK.stop_network_status_listener()
```

### Sensors and battery

Motion sensors map to the WeChat `start*` / `on*Change` / `stop*` API family. Accelerometer and gyroscope accept `interval`: `game` (~20 ms), `ui` (~60 ms), or `normal` (~200 ms). The raw JSON is preserved so newer platform fields can still be inspected.

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
# ... on scene shutdown
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
# ... on scene shutdown
MiniGameSDK.stop_device_motion_listening()
```

`compass_changed.accuracy` is a `Variant`: WeChat returns a number on iOS and strings such as `high`, `medium`, `low`, or `unreliable` on Android.

Device motion maps to `wx.startDeviceMotionListening` / `wx.onDeviceMotionChange` / `wx.stopDeviceMotionListening`. `alpha`, `beta`, and `gamma` are radians from the platform API, and `interval` accepts `game`, `ui`, or `normal`.

### Audio interruption

WeChat emits audio interruption events when phone calls, alarms, voice chats, audio ads, or similar system-owned audio takes over. On `begin`, mini-game audio is paused by the platform; wait for `end` before resuming playback.

```gdscript
MiniGameSDK.audio_interruption.connect(func(event_type, data_json, err):
    if err.is_empty() and event_type == "end":
        music_player.play()
)

MiniGameSDK.start_audio_interruption_listener()
# ... on scene shutdown
MiniGameSDK.stop_audio_interruption_listener()
```

### Theme and performance

`start_theme_change_listener()` wraps `wx.onThemeChange`. WeChat only fires this event when `darkmode: true` is enabled in global configuration; the signal reports `light` or `dark` plus raw JSON for future fields.

```gdscript
MiniGameSDK.theme_changed.connect(func(theme, data_json, err):
    if err.is_empty():
        apply_theme(theme)
)

MiniGameSDK.start_theme_change_listener()
# ... on scene shutdown
MiniGameSDK.stop_theme_change_listener()
```

`get_performance_entries(entry_type)` wraps `wx.getPerformance()` and `Performance.getEntries()` / `getEntriesByType()`. Pass an empty string for all buffered entries, or values such as `render`, `script`, or `navigation`.

```gdscript
var all_entries := MiniGameSDK.get_performance_entries()
var render_entries := MiniGameSDK.get_performance_entries("render")
print("performance entries:", all_entries.size(), render_entries.size())
```

`report_performance(id, value, dimensions)` wraps `wx.reportPerformance`. Configure the metric ID in the WeChat Mini Program admin console before relying on uploaded data.

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

`get_battery_info_sync()` returns `{}` when unavailable; WeChat documents the sync battery API as unavailable on iOS. Prefer the async signal path for cross-device code.

### Mini Program navigation

These wrappers map to `wx.navigateToMiniProgram`, `wx.navigateBackMiniProgram`, `wx.exitMiniProgram`, and `wx.restartMiniProgram`. WeChat requires `navigateToMiniProgram` and `exitMiniProgram` to be called from a user tap/click. DevTools can validate the call and receiver debug flow, but it may not perform a real jump.

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

`navigate_to_mini_program()` also accepts `short_link` and `no_relaunch_if_path_unchanged`. `restart_mini_program(path)` requires WeChat base library 3.0.1+ and a non-empty path/query for the new launch.

### Cloud storage and open data context

User cloud storage is the WeChat Mini Game data channel normally used by leaderboards. `set_user_cloud_storage()` and `remove_user_cloud_storage()` call the main-domain write/delete APIs. Values are serialized as WeChat `KVDataList` strings before crossing the JS bridge.

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

WeChat documents `get_user_cloud_storage_keys()`, `get_user_cloud_storage()`, `get_friend_cloud_storage()`, and `get_group_cloud_storage()` as open-data-context APIs. Friend/group reads require `scope.WxFriendInteraction`; group reads require a group `shareTicket` or `groupid`.

```gdscript
MiniGameSDK.get_user_cloud_storage(["score"])
MiniGameSDK.get_friend_cloud_storage(["score"])
MiniGameSDK.get_group_cloud_storage(["score"], "", "opengid-from-getGroupEnterInfo")
```

From the main game domain, use `post_open_data_context_message()` to ask your open data script to fetch/render leaderboard data. WeChat requires `OpenDataContext.postMessage()` messages to contain only primitive leaf values (`number`, `string`, `boolean`, `null`, `undefined`).

```gdscript
MiniGameSDK.post_open_data_context_message({
    "type": "rank",
    "season": "s1",
}, "offscreenCanvas")
```

### Customer service and subscribe messages

`open_customer_service_conversation()` wraps `wx.openCustomerServiceConversation`. WeChat requires at least one prior touch event before opening customer service. If the user returns through a customer-service message card, WeChat reports the card path/query through this API's success callback, so read it from `customer_service_result`.

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

`request_subscribe_message(tmpl_ids)` wraps `wx.requestSubscribeMessage`; `request_subscribe_system_message(msg_type_list)` wraps `wx.requestSubscribeSystemMessage`. Both must be triggered by user tap/click. The result JSON keeps WeChat's dynamic keys: each template id or system message type maps to `accept`, `reject`, `ban`, or `filter` depending on the API.

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

### Update manager and memory warning

WeChat checks for new versions automatically when the mini game launches or returns from background. `start_update_listener()` exposes `wx.getUpdateManager()` events so your game can show its own update UX; call `apply_update()` only after `update_ready` fires.

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

The bundled WeChat template already includes a basic native modal for updates. Use the SDK listener when you need custom in-game UI, and avoid showing two prompts for the same ready event.

`start_memory_warning_listener()` wraps `wx.onMemoryWarning`. Use it to release large caches, optional assets, decoded audio, or scene resources before the operating system kills the process. On Android, WeChat reports warning `level` values such as `5`, `10`, and `15`; on iOS or older runtimes the level may be `0`.

```gdscript
MiniGameSDK.memory_warning.connect(func(level, data_json, err):
    if err.is_empty():
        print("memory warning:", level, JSON.parse_string(data_json))
        clear_large_caches()
)

MiniGameSDK.start_memory_warning_listener()
# ... on scene shutdown
MiniGameSDK.stop_memory_warning_listener()
```

### Window resize and runtime errors

`start_window_resize_listener()` wraps `wx.onWindowResize` and reports the new `windowWidth` / `windowHeight` from `res.size`. This is useful when your exported game needs to recompute UI anchors after desktop window resize, foldable-screen changes, or host layout changes.

```gdscript
MiniGameSDK.window_resized.connect(func(width, height, data_json, err):
    if err.is_empty():
        resize_game_ui(Vector2i(width, height))
        print(JSON.parse_string(data_json))
)

MiniGameSDK.start_window_resize_listener()
# ... on scene shutdown
MiniGameSDK.stop_window_resize_listener()
```

`start_unhandled_rejection_listener()` wraps `wx.onUnhandledRejection` and surfaces Promise rejections that were not caught on the JavaScript side. The signal extracts a readable `reason` string and also preserves a JSON payload for logging.

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
# ... on scene shutdown
MiniGameSDK.stop_unhandled_rejection_listener()
```

WeChat documents `onWindowResize/offWindowResize` from base library 2.3.0, and `onUnhandledRejection/offUnhandledRejection` from base library 2.10.0. The SDK keeps the original JavaScript listener objects alive so `stop_*` can remove the exact listener registered by `start_*`.

### Screen brightness, capture, and recording

`get_screen_brightness()` / `set_screen_brightness(value)` wrap the WeChat screen brightness APIs. Values are `0.0` to `1.0`; on Android, WeChat also accepts `-1` to follow the system brightness setting.

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

`start_user_capture_screen_listener()` wraps `wx.onUserCaptureScreen`. WeChat only allows one active screenshot listener, so the SDK keeps a single persistent listener and `stop_user_capture_screen_listener()` calls the platform off API.

```gdscript
MiniGameSDK.user_capture_screen.connect(func(data_json, err):
    if err.is_empty():
        print("user captured screen:", JSON.parse_string(data_json))
)

MiniGameSDK.start_user_capture_screen_listener()
# ... on scene shutdown
MiniGameSDK.stop_user_capture_screen_listener()
```

For iOS screen recording detection, use `get_screen_recording_state()` and `start_screen_recording_state_listener()`. WeChat reports query states as `on` / `off` and listener events as `start` / `stop`.

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
# ... on scene shutdown
MiniGameSDK.stop_screen_recording_state_listener()
```

`set_visual_effect_on_capture("hidden")` requests the host to hide the screen during screenshot / recording capture; pass `"none"` to restore normal behavior. WeChat documents this from base library 2.20.1, with stricter iOS requirements: base library 3.3.0+, iOS 16+, and currently only recording behavior is handled on iOS.

```gdscript
MiniGameSDK.visual_effect_on_capture_set.connect(func(effect, ok, err):
    print("visual effect:", effect, ok, err)
)

MiniGameSDK.set_visual_effect_on_capture("hidden")
```

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

### Compatibility, system info, and safe area

Use `can_i_use(schema)` before calling APIs whose availability depends on the WeChat base library. The schema follows WeChat's `${API}.${method}.${param}.${option}` form.

```gdscript
if MiniGameSDK.can_i_use("getAppBaseInfo.return.SDKVersion"):
    var app := MiniGameSDK.get_app_base_info()
    print("base library:", app.get("SDKVersion", "?"))

var device := MiniGameSDK.get_device_info()
# common fields: brand, model, platform, system, memorySize

var settings := MiniGameSDK.get_system_setting()
# common fields: wifiEnabled, bluetoothEnabled, locationEnabled, deviceOrientation

var authorize := MiniGameSDK.get_app_authorize_setting()
# common fields: cameraAuthorized, locationAuthorized, microphoneAuthorized, albumAuthorized

var info := MiniGameSDK.get_system_info()
# common fields: platform, system, model, pixelRatio, screenWidth, screenHeight, statusBarHeight

var menu := MiniGameSDK.get_menu_button_rect()
# { top, bottom, left, right, width, height } — avoid your UI overlapping the capsule button
```

The modern `get_device_info()`, `get_app_base_info()`, `get_system_setting()`, and `get_app_authorize_setting()` wrappers return `{}` when the host base library does not expose the corresponding API. `get_system_info()` remains as the broad fallback for older runtimes.

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

### Privacy authorization (WeChat)

WeChat privacy helpers require base library 2.32.3+. `get_privacy_setting()` tells you whether the user still needs to authorize the privacy agreement; `require_privacy_authorize()` can trigger the same authorization flow before you call privacy-sensitive APIs.

Register `start_privacy_authorization_listener()` only when your game is ready to show a privacy prompt and call one of the resolve helpers. WeChat keeps the original privacy API pending until you resolve the event.

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
        show_privacy_prompt("Privacy agreement")

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

For `agree`, WeChat validates the platform-side consent interaction behind the supplied `button_id`. Keep this flow in your DevTools and real-device review checklist.

### Authorization settings / account info

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

WeChat requires `openSetting` to be called from a user tap/click interaction. `get_setting()` only returns permissions that your mini game has already requested.

### Native buttons (WeChat)

Some WeChat open abilities must be triggered by a platform native button that overlays the game canvas. The SDK keeps one active button per type and reports operations through `native_button_operation_result`; tap callbacks report through `native_button_tapped`.

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
        # Optional, WeChat base library 2.30.3+:
        # "openlink": "MP-generated game-club jump id",
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

Supported button types are `"userInfo"`, `"openSetting"`, and `"gameClub"`. `create_user_info_button()` wraps WeChat `wx.createUserInfoButton` from base library 2.0.1. `create_open_setting_button()` wraps `wx.createOpenSettingButton` from 2.0.7, but the official docs mark it as no longer maintained from base library 3.0.0 and recommend `wx.openSetting` where possible. `create_game_club_button()` wraps `wx.createGameClubButton` from 2.0.3; `openlink` and `hasRedDot` start at 2.30.3.

### Debug logging (WeChat)

WeChat exposes two debug-log surfaces: local debug logging through `wx.setEnableDebug` / `wx.getLogManager`, and realtime reporting through `wx.getRealtimeLogManager`. The SDK keeps the active manager objects on the JS side and reports every operation through `debug_operation_result`.

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

`set_enable_debug()` wraps `wx.setEnableDebug` from base library 1.4.0. `get_log_manager()` wraps `wx.getLogManager` from 2.1.0; its `level` option starts at 2.3.2, where `0` includes App/Page/wx lifecycle/API logs and `1` does not. WeChat stores up to about 5 MB of local `LogManager` logs before deleting old entries. `get_realtime_log_manager()` wraps `wx.getRealtimeLogManager` from 2.14.4; official plugin support starts at 2.16.0 and the plugin example uses `tag()`, so `realtime_log_tag()` calls it when the runtime exposes the method. The `RealtimeLogManager` object docs state that standard object methods are not supported in plugins.

### Generic fallback for unwrapped APIs

For WeChat / Douyin APIs that do not have a typed wrapper yet, call the same platform method through `call_api()`. Async results are normalized through the `generic_api_result` signal.

```gdscript
MiniGameSDK.generic_api_result.connect(func(api_name, ok, data_json, err):
    if ok:
        print(api_name, JSON.parse_string(data_json))
    else:
        push_warning("%s failed: %s" % [api_name, err])
)

# Calls wx.setClipboardData({ data: "hello" })
MiniGameSDK.call_api("setClipboardData", {"data": "hello"})

# For positional / sync APIs such as getStorageSync(key), use _args.
MiniGameSDK.call_api("getStorageSync", {"_args": ["level"]})
```

`call_api()` is a fallback for long-tail platform coverage. Prefer typed methods for auth, payment, ads, file-system, lifecycle, and other high-risk flows where stable parameters, result shapes, and error semantics matter.

---

## 9. Assets & subpackages

### Default layout

| Subpackage | Path | Contents |
|------------|------|----------|
| **main** | `/` | `game.js`, polyfills, loader, images, js worker |
| `engine` | `engine/` | `godot.wasm.br` + `godot.zip` (the `.pck`) |
| `subpacks` | `subpacks/` | Reserved, empty by default |

The exporter keeps the engine and the selected Godot resources in `engine`, and
CI checks the generated WeChat main package against its configured size limit.
Always confirm current per-package and total limits in the target platform's
developer console before submission.

### Large assets and `subpacks/`

Version 0.2 produces one `.pck` and does not yet expose a managed multi-pack
input. Use the selected Web preset's export filters (the plugin preserves them)
and normal Godot asset compression to reduce `godot.zip`. Do not place a custom
PCK in the exported `subpacks/` or edit `game.json`: both paths are exporter-owned
and the next preflight correctly rejects changed or unlisted output. Supporting
custom packages requires extending the exporter to copy them into staging and
record them in the ownership manifest.

### Static assets

- `images/logo.png` is copied from `addons/godot_mini_game/templates/common/images/logo.png`; replace that source asset before export to customise it.
- `images/background.png` is generated by the current exporter. A supported custom background needs a source-template option; editing the managed output makes the next preflight fail closed.

---

## 10. Persistent storage

### Engine side

Godot `user://` normally maps to IDBFS. Inside a mini-game host the loader bridges it:

- At startup `godotSdk.copyLocalToFS(p)` restores persistent paths from the selected `wx`/`tt` provider into the Emscripten FS
- Every 5s a `setInterval` calls `godotSdk.syncfs()` to push the FS back into host storage

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

### DevTools automation

There is no built-in WeChat DevTools MCP / Codex skill in this repo. The official automation surfaces are:

| Surface | Best use |
|---------|----------|
| `cli open/preview/upload/auto` | Open projects, preview, upload, and enable automation listening |
| `127.0.0.1:{port}/v2/...` HTTP API | Trigger open, preview, upload, autopreview, build-npm, and cache cleanup from scripts |
| `miniprogram-automator` | Drive page navigation, read page data, trigger events, and call `wx` APIs from Node.js |

Enable CLI / HTTP access in **WeChat DevTools → Settings → Security Settings** first. Mini games render through canvas, so the automation SDK has limited visibility into the internal scene. Use it mainly to open exported folders, collect preview / upload package-size metadata, and run platform API smoke checks. For visual assertions, pair it with screenshots or real-device VConsole logs.

### Submission checklist

| Item | Notes |
|------|-------|
| Icons | Upload 144×144 and 512×512 via console |
| Server domain whitelist | Configure `request` / `socket` / `uploadFile` / `downloadFile` separately |
| Real-name verification (China) | Mandatory for mini games |
| Privacy agreement | Use `MiniGameSDK.get_privacy_setting()` / `require_privacy_authorize()` and verify the consent prompt on DevTools + real device |
| Anti-addiction | Required for titles with IAP or social features |

---

## 12. Building a custom engine template

`scripts/build_wasm_template.sh` can build a mini-game-compatible template from
an exact Godot 4.x tag. A new version is not certified until its bundle is added
to `support-matrix.json` and passes both platform smoke exports.

```bash
# Default: Godot 4.6.1-stable + Emscripten 4.0.3
./scripts/build_wasm_template.sh

# Specific Godot version
./scripts/build_wasm_template.sh 4.4.1-stable

# Specific Emscripten version
./scripts/build_wasm_template.sh 4.6.1-stable 3.1.62
```

Steps the script performs:

1. Installs and activates the exact emsdk release (cache: `build_wasm/emsdk`, or the directory selected with `GODOT_MINIGAME_BUILD_DIR`).
2. Clones the exact Godot tag and refuses a dirty or mismatched cached source tree.
3. Temporarily enforces Emscripten longjmp mode, then builds the Web release template with `wasm_simd=no`, `threads=no`, dynamic linking disabled, and the WebRTC/XR modules disabled. The source patch is restored on exit.
4. Validates JavaScript syntax, Brotli/WASM structure, disabled features, provenance, and hashes with the shared verifier.
5. Produces `build_wasm/output/{tag}/emsdk-{version}/2d_full/release/abi-{abi}/r{revision}/godot_minigame_template_{tag}_emsdk-{version}_2d-full_release_abi-{abi}_r{revision}.zip`.
6. Back in the editor, click **Import Template** in the dock and pick that ZIP.

> Apple Silicon: ~5 min. Intel / Linux: ~8–15 min.

### GitHub Actions

The repo ships `.github/workflows/build-template.yml`. Trigger it manually from **Actions > Build Mini-Game WASM Template > Run workflow** when you don't have emcc locally. The workflow publishes nothing by default; a release is created only when the explicit publish input is enabled and every binary validation passes.

---

## 13. FAQ

### Q: Export says "missing godot.js"

A: Check the **Engine Template** status at the top of the dock:
- Bundled missing: make sure `addons/godot_mini_game/engine/` has both `godot.js` and `godot.wasm.br`
- Custom override not picked up: it must also include a matching `template.json`
- Template store empty: click **Import Template** and pick a zip
- Version or commit mismatch: build/import a bundle for the exact editor build

### Q: Export works on simulator, but real device throws `CompileError: OOM / magic Tag section`

A: The running project contains an incompatible or externally replaced engine.
The 0.2 exporter no longer selects the standard Web template. Re-export with a
validated exact bundle, or build one with `./scripts/build_wasm_template.sh`.

### Q: Why is an older template ZIP rejected?

A: Version 0.2 requires a complete `template.json` and does not synthesize one
from unknown binaries. Rebuild the template with the current script or download
a validated bundle from Releases.

### Q: Can I just use the standard Web export?

A: Simulator yes, real device usually CompileError. `WXWebAssembly` lacks SIMD and exception tags. Use the plugin's compatible template.

### Q: Audio pops or feels laggy

A: We neutralised `connectPositionWorklet` for host compatibility, so the engine loses sample-accurate playback position. Impact on 2D / 3D spatial audio is tiny; if you need exact audio sync, you'll have to wait for mini-game hosts to expose proper `AudioWorkletNode`.

### Q: How do I test the SDK inside the editor?

A: Run the scene normally — `is_mini_game` returns `false`, every method is a safe no-op. For more precise stubbing, inject a fake into `MiniGameSDK._sdk` in your tests, or branch on `OS.has_feature("web")`.

### Q: Multiple accounts on the same device?

A: Prefix your keys with an account id, e.g. `"user:%s:level" % openid`. `wx.setStorage` is already scoped to the current WeChat account, so data won't cross accounts on its own.

### Q: Where do I file bugs or PRs?

A: Please use [issues](https://github.com/AnranS/godot_for_minigame/issues) and [discussions](https://github.com/AnranS/godot_for_minigame/discussions). Bug reports benefit from:
- Godot version
- Platform (WeChat / Douyin)
- Base library version
- Dock export log screenshot
- DevTools or on-device Vconsole log

---

For deeper internals (the full hook list inside `adapter.js`, or the `sdk.js` ↔ `MiniGameSDK.gd` ABI), the source is thoroughly commented — read the code.
