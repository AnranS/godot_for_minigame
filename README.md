<p align="center">
  <img src="assets/banner.svg" width="840" alt="Godot Mini Game — Export to WeChat & Douyin"/>
</p>

<p align="center">
  <strong>English</strong> · <a href="README_zh.md">简体中文</a>
</p>

---

A Godot 4.x editor plugin that converts your game into a **WeChat** or **Douyin (TikTok) Mini Game** ready for submission. Ships with a pre-compiled engine template — install the plugin, click export, open in DevTools.

## Highlights

- **Zero config** — bundled engine template works out of the box, no Emscripten setup needed
- **One-click export** — editor dock panel handles everything: `.pck`, engine files, JS adapters, platform configs
- **Real-device ready** — engine compiled without WASM SIMD / exception tags that crash `WXWebAssembly`
- **20+ native API groups** — auth, privacy, settings, native buttons, debug logging, account, ads, payment, storage, media/images, Camera, Video, VideoDecoder, MediaAudioPlayer, RecorderManager, game recorder, inner audio, file system, subpackages, Worker, cloud storage/open data, customer service, subscribe messages, share, mini program navigation, vibration, keyboard, clipboard, network, file transfer, WebSocket, sensors, battery, update manager, screen capture/recording, window events, runtime error events, and more
- **Dual platform** — WeChat + Douyin from a single codebase

## Quick Start

### 1. Install

**Recommended: install from a GitHub Release**

1. Open [Releases](../../releases)
2. Download `godot_mini_game_vX.Y.Z.zip` from Assets (not GitHub's auto-generated Source code archives)
3. Extract it into your Godot project root:

```
your_project/
  addons/
    godot_mini_game/   ← extracted here
```

Or clone this repo and copy `addons/godot_mini_game/` into your project:

```bash
git clone https://github.com/<owner>/<repo>.git
cp -R <repo>/addons/godot_mini_game your_project/addons/
```

> Maintainers: install and authenticate GitHub CLI (`gh auth login`), update
> `version` in `addons/godot_mini_game/plugin.cfg`, commit the change, then run:
>
> ```bash
> scripts/release_plugin.sh 0.1.1
> ```
>
> The script packages the plugin, creates/pushes the `v0.1.1` tag, and uploads
> the installable `godot_mini_game_v0.1.1.zip` to the GitHub Release assets.

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
| `privacy_setting_received` | `need_authorization: bool, privacy_contract_name: String, data_json: String, error: String` |
| `privacy_authorize_result` | `success: bool, error: String` |
| `privacy_contract_opened` | `success: bool, error: String` |
| `privacy_authorization_needed` | `event_info_json: String, error: String` |
| `setting_received` | `settings_json: String, error: String` |
| `setting_opened` | `settings_json: String, error: String` |
| `authorization_result` | `scope: String, success: bool, error: String` |
| `native_button_operation_result` | `button_type: String, action: String, success: bool, data_json: String, error: String` |
| `native_button_tapped` | `button_type: String, data_json: String, error: String` |
| `debug_operation_result` | `action: String, success: bool, data_json: String, error: String` |
| `ad_created` | `ad_type: String, success: bool, error: String` |
| `rewarded_ad_result` | `is_ended: bool, error: String` |
| `interstitial_ad_result` | `success: bool, error: String` |
| `payment_result` | `success: bool, error: String` |
| `keyboard_event` | `event_type: String, value: String` |
| `http_response` | `status_code: int, data: String, error: String` |
| `file_transfer_result` | `action: String, success: bool, status_code: int, data_json: String, error: String` |
| `media_result` | `action: String, success: bool, data_json: String, error: String` |
| `camera_operation_result` | `action: String, success: bool, data_json: String, error: String` |
| `camera_frame` | `data_json: String, error: String` |
| `camera_event` | `event_type: String, data_json: String, error: String` |
| `video_operation_result` | `action: String, success: bool, data_json: String, error: String` |
| `video_event` | `event_type: String, data_json: String, error: String` |
| `recorder_operation_result` | `action: String, success: bool, data_json: String, error: String` |
| `recorder_event` | `event_type: String, data_json: String, error: String` |
| `available_audio_sources_received` | `sources_json: String, data_json: String, error: String` |
| `video_decoder_operation_result` | `action: String, success: bool, data_json: String, error: String` |
| `video_decoder_event` | `event_type: String, data_json: String, error: String` |
| `media_audio_operation_result` | `action: String, success: bool, data_json: String, error: String` |
| `game_recorder_operation_result` | `action: String, success: bool, data_json: String, error: String` |
| `game_recorder_event` | `event_type: String, data_json: String, error: String` |
| `inner_audio_operation_result` | `action: String, success: bool, data_json: String, error: String` |
| `inner_audio_event` | `event_type: String, data_json: String, error: String` |
| `socket_operation_result` | `action: String, success: bool, data_json: String, error: String` |
| `socket_opened` | `data_json: String, error: String` |
| `socket_message_received` | `data: String, data_json: String, error: String` |
| `socket_closed` | `code: int, reason: String, data_json: String, error: String` |
| `socket_error` | `data_json: String, error: String` |
| `file_system_result` | `action: String, success: bool, data_json: String, error: String` |
| `subpackage_result` | `action: String, success: bool, data_json: String, error: String` |
| `subpackage_progress` | `action: String, progress: int, total_bytes_written: int, total_bytes_expected: int, data_json: String` |
| `worker_operation_result` | `action: String, success: bool, data_json: String, error: String` |
| `worker_message` | `data_json: String, error: String` |
| `worker_error` | `data_json: String, error: String` |
| `worker_process_killed` | `data_json: String, error: String` |
| `network_type_received` | `network_type: String, data_json: String, error: String` |
| `network_status_changed` | `is_connected: bool, network_type: String, data_json: String` |
| `sensor_started` | `sensor: String, success: bool, error: String` |
| `sensor_stopped` | `sensor: String, success: bool, error: String` |
| `accelerometer_changed` | `x: float, y: float, z: float, data_json: String` |
| `gyroscope_changed` | `x: float, y: float, z: float, data_json: String` |
| `compass_changed` | `direction: float, accuracy: Variant, data_json: String` |
| `device_motion_changed` | `alpha: float, beta: float, gamma: float, data_json: String` |
| `battery_info_received` | `level: int, is_charging: bool, data_json: String, error: String` |
| `audio_interruption` | `event_type: String, data_json: String, error: String` |
| `theme_changed` | `theme: String, data_json: String, error: String` |
| `mini_program_navigation_result` | `action: String, success: bool, data_json: String, error: String` |
| `cloud_storage_result` | `action: String, success: bool, data_json: String, error: String` |
| `customer_service_result` | `action: String, success: bool, data_json: String, error: String` |
| `subscribe_message_result` | `action: String, success: bool, data_json: String, error: String` |
| `update_checked` | `has_update: bool, data_json: String, error: String` |
| `update_ready` | `error: String` |
| `update_failed` | `error: String` |
| `memory_warning` | `level: int, data_json: String, error: String` |
| `window_resized` | `width: int, height: int, data_json: String, error: String` |
| `unhandled_rejection` | `reason: String, data_json: String, error: String` |
| `screen_brightness_received` | `value: float, data_json: String, error: String` |
| `screen_brightness_set` | `value: float, success: bool, error: String` |
| `user_capture_screen` | `data_json: String, error: String` |
| `screen_recording_state_received` | `state: String, data_json: String, error: String` |
| `screen_recording_state_changed` | `state: String, data_json: String, error: String` |
| `visual_effect_on_capture_set` | `effect: String, success: bool, error: String` |
| `clipboard_received` | `data: String, error: String` |
| `modal_result` | `confirmed: bool` |
| `generic_api_result` | `api_name: String, success: bool, data_json: String, error: String` |
| `app_shown` | `options_json: String` |
| `app_hidden` | — |
| `app_error` | `message: String` |

### Methods

| Category | Methods |
|----------|---------|
| **Auth** | `login()` `check_session()` `get_user_info()` |
| **Privacy** | `get_privacy_setting()` `require_privacy_authorize()` `open_privacy_contract()` `start_privacy_authorization_listener()` `resolve_privacy_authorization(event, button_id)` `expose_privacy_authorization()` `agree_privacy_authorization(button_id)` `disagree_privacy_authorization()` |
| **Settings / Authorization** | `get_setting(with_subscriptions)` `open_setting(with_subscriptions)` `authorize(scope)` |
| **Native Buttons** | `create_user_info_button(options)` `create_open_setting_button(options)` `create_game_club_button(options)` `show_native_button(button_type)` `hide_native_button(button_type)` `destroy_native_button(button_type)` `stop_native_button_tap_listener(button_type)` |
| **Debug Logging** | `set_enable_debug(enable_debug)` `get_log_manager(level)` `log_manager_debug(args)` `log_manager_info(args)` `log_manager_log(args)` `log_manager_warn(args)` `get_realtime_log_manager()` `realtime_log_tag(tag)` `realtime_log_info(args)` `realtime_log_warn(args)` `realtime_log_error(args)` `realtime_log_set_filter_msg(msg)` `realtime_log_add_filter_msg(msg)` |
| **Account** | `get_account_info()` |
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
| **Media / Images** | `choose_media(count, media_type, source_type, max_duration, size_type, camera)` `choose_image(count, size_type, source_type)` `preview_image(urls, current, show_menu, referrer_policy)` `save_image_to_photos_album(file_path)` `compress_image(src, quality, compressed_width, compressed_height)` |
| **Camera** | `create_camera(x, y, width, height, device_position, flash, frame_size)` `camera_take_photo(quality)` `camera_start_record()` `camera_stop_record(compressed)` `camera_set_zoom(zoom)` `camera_listen_frame_change(use_active_worker)` `camera_close_frame_change()` `camera_destroy()` |
| **Video** | `create_video(options)` `set_video_properties(properties)` `get_video_state()` `video_play()` `video_pause()` `video_stop()` `video_seek(time)` `video_request_full_screen(direction)` `video_exit_full_screen()` `stop_video_listener(event_types)` `video_destroy()` |
| **Media Audio** | `get_available_audio_sources()` `create_video_decoder()` `video_decoder_start(options)` `video_decoder_get_frame_data()` `video_decoder_seek(position)` `video_decoder_stop()` `video_decoder_remove()` `start_video_decoder_listener(event_types)` `stop_video_decoder_listener(event_types)` `create_media_audio_player(volume)` `set_media_audio_volume(volume)` `media_audio_add_video_decoder_source()` `media_audio_remove_video_decoder_source()` `media_audio_start()` `media_audio_stop()` `media_audio_destroy()` |
| **RecorderManager** | `get_recorder_manager()` `recorder_start(options)` `recorder_pause()` `recorder_resume()` `recorder_stop()` |
| **Game Recorder** | `get_game_recorder()` `game_recorder_start(options)` `game_recorder_stop()` `game_recorder_pause()` `game_recorder_resume()` `game_recorder_abort()` `start_game_recorder_listener(event_types)` `stop_game_recorder_listener(event_types)` `operate_game_recorder_video(params)` `create_game_recorder_share_button(style, share)` `show_game_recorder_share_button()` `hide_game_recorder_share_button()` `off_game_recorder_share_button_tap()` |
| **Inner Audio** | `set_inner_audio_option(options)` `create_inner_audio_context(create_options, properties)` `set_inner_audio_properties(properties)` `get_inner_audio_state()` `inner_audio_play()` `inner_audio_pause()` `inner_audio_stop()` `inner_audio_seek(position)` `stop_inner_audio_listener(event_types)` `inner_audio_destroy()` |
| **File Transfer** | `download_file(url, file_path, headers, timeout_ms, enable_profile, enable_http2, enable_quic)` `upload_file(url, file_path, name, form_data, headers, timeout_ms, enable_profile, enable_http2, enable_quic)` |
| **File System** | `call_file_system(method, options)` `file_system_access(path)` `file_system_read_file(file_path, encoding, position, length)` `file_system_write_file(file_path, data, encoding)` `file_system_append_file(file_path, data, encoding)` `file_system_mkdir(dir_path, recursive)` `file_system_readdir(dir_path)` `file_system_unlink(file_path)` `file_system_save_file(temp_file_path, file_path)` `file_system_get_saved_file_list()` `file_system_remove_saved_file(file_path)` `file_system_get_file_info(file_path, digest_algorithm)` `file_system_copy_file(src_path, dest_path)` `file_system_rename(old_path, new_path)` `file_system_rmdir(dir_path, recursive)` `file_system_stat(path, recursive)` `file_system_unzip(zip_file_path, target_path)` |
| **Subpackage** | `load_subpackage(name)` `pre_download_subpackage(name, package_type)` |
| **Worker** | `create_worker(script_path, use_experimental_worker)` `worker_post_message(message)` `worker_terminate()` |
| **WebSocket** | `connect_socket(url, headers, protocols, tcp_no_delay, per_message_deflate, timeout_ms, force_cellular_network)` `send_socket_message(data)` `close_socket(code, reason)` |
| **Network Status** | `get_network_type()` `start_network_status_listener()` `stop_network_status_listener()` |
| **Sensors** | `start_accelerometer(interval)` `stop_accelerometer()` `start_gyroscope(interval)` `stop_gyroscope()` `start_compass()` `stop_compass()` `start_device_motion_listening(interval)` `stop_device_motion_listening()` |
| **Battery** | `get_battery_info()` `get_battery_info_sync()` |
| **Audio Events** | `start_audio_interruption_listener()` `stop_audio_interruption_listener()` |
| **Theme / Performance** | `start_theme_change_listener()` `stop_theme_change_listener()` `get_performance_entries(entry_type)` `report_performance(id, value, dimensions)` |
| **Mini Program Navigation** | `navigate_to_mini_program(app_id, path, extra_data, env_version, short_link, no_relaunch_if_path_unchanged)` `navigate_back_mini_program(extra_data)` `exit_mini_program()` `restart_mini_program(path)` |
| **Cloud Storage / Open Data** | `set_user_cloud_storage(kv_data)` `remove_user_cloud_storage(key_list)` `get_user_cloud_storage_keys()` `get_user_cloud_storage(key_list)` `get_friend_cloud_storage(key_list)` `get_group_cloud_storage(key_list, share_ticket, group_id)` `post_open_data_context_message(message, shared_canvas_mode)` |
| **Customer Service / Subscribe** | `open_customer_service_conversation(session_from, show_message_card, send_message_title, send_message_path, send_message_img)` `request_subscribe_message(tmpl_ids)` `request_subscribe_system_message(msg_type_list)` |
| **Update Manager** | `start_update_listener()` `apply_update()` |
| **Memory Warning** | `start_memory_warning_listener()` `stop_memory_warning_listener()` |
| **Window Events** | `start_window_resize_listener()` `stop_window_resize_listener()` |
| **Runtime Errors** | `start_unhandled_rejection_listener()` `stop_unhandled_rejection_listener()` |
| **Screen Capture / Recording** | `get_screen_brightness()` `set_screen_brightness(value)` `start_user_capture_screen_listener()` `stop_user_capture_screen_listener()` `get_screen_recording_state()` `start_screen_recording_state_listener()` `stop_screen_recording_state_listener()` `set_visual_effect_on_capture(effect)` |
| **System / Compatibility** | `can_i_use(schema)` `get_device_info()` `get_app_base_info()` `get_system_setting()` `get_app_authorize_setting()` `get_system_info()` `get_launch_options()` `get_window_info()` `get_menu_button_rect()` |
| **UI** | `show_toast(title, icon, duration)` `show_modal(title, content)` `show_loading(title)` `hide_loading()` |
| **Screen** | `set_keep_screen_on(keep_on)` |
| **Generic API** | `call_api(api_name, params)` |

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
    │   ├── js/loader.js             # Engine loader + loading screen
    │   └── js/worker/               # Worker scripts required by WeChat game.json
    ├── wechat/                      # WeChat configs
    └── douyin/                      # Douyin configs
```

## Requirements

- **Godot 4.6.x** — the bundled engine template is compiled against 4.6.1-stable.
  Other 4.x versions will likely fail at runtime because `.pck` bytecode and the
  bundled WASM must be from the same Godot version. To use a different version
  you must rebuild a matching template (see "Building for a different Godot
  version" below) and import it via the dock.
- **WeChat DevTools** or **Douyin DevTools**
- **Node.js** *required* (used for built-in Brotli compression) or `brotli` CLI
  (`brew install brotli`). Without one of these the export will fail —
  uncompressed WASM exceeds WeChat's 4 MB single-package limit.

## Documentation

- [Usage guide](docs/USAGE.md) — detailed walkthrough of the dock, SDK, subpackages, troubleshooting, and custom engine builds.
- [使用文档（中文）](docs/USAGE_zh.md)

## Contributing

Issues and PRs welcome. For custom engine template builds, see `scripts/build_wasm_template.sh`.

## License

[MIT](LICENSE)
