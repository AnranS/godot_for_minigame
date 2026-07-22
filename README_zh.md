<p align="center">
  <img src="assets/banner.svg" width="840" alt="Godot Mini Game — 导出微信与抖音小游戏"/>
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong>
</p>

---

一个 Godot 4.x 编辑器插件，把你的游戏一键打包成可直接提审的**微信小游戏**或**抖音小游戏**。内置 Godot 4.6.1 预编译引擎，并拒绝不安全的引擎/项目版本错配。

## 特性

- **版本安全**——只使用精确匹配的引擎；Godot 4.6.1 可直接使用内置模板
- **一键导出**——编辑器底部 Dock 面板搞定一切：`.pck`、引擎文件、JS 适配、平台配置
- **真机可跑**——引擎去掉了 `WXWebAssembly` 不支持的 WASM SIMD / 异常处理 Tag
- **20+ 类原生 API**——登录、隐私授权、授权设置、原生按钮、调试日志、账号信息、广告、支付、存储、媒体图片、Camera、Video、VideoDecoder、MediaAudioPlayer、RecorderManager 录音、游戏录屏、InnerAudio 音频播放、文件系统、分包、Worker、用户托管数据 / 开放数据域、客服会话、订阅消息、分享、小程序跳转、振动、键盘、剪贴板、网络、文件传输、WebSocket、传感器、电量、更新管理、截屏录屏、窗口事件、运行时错误事件等
- **双平台**——一套项目同时出微信、抖音

## 快速开始

### 1. 安装

**推荐：从 GitHub Release 安装**

1. 打开 [Releases](../../releases)
2. 在 Assets 中下载 `godot_mini_game_vX.Y.Z.zip`（不要下载 GitHub 自动生成的 Source code 压缩包）
3. 解压到你的 Godot 项目根目录：

```
your_project/
  addons/
    godot_mini_game/   ← 解压到这里
```

或者克隆本仓库后，把 `addons/godot_mini_game/` 复制到你的项目里：

```bash
git clone https://github.com/<owner>/<repo>.git
cp -R <repo>/addons/godot_mini_game your_project/addons/
```

> 维护者发布新版本时：先安装并登录 GitHub CLI（`gh auth login`），更新
> `addons/godot_mini_game/plugin.cfg` 里的 `version`，提交后运行：
>
> ```bash
> scripts/release_plugin.sh 0.1.1
> ```
>
> 脚本会打包插件、创建/推送 `v0.1.1` tag，并把可安装的
> `godot_mini_game_v0.1.1.zip` 上传到 GitHub Release 附件。

### 2. 启用插件

**Project > Project Settings > Plugins** 里启用 **Godot Mini Game Export**。

### 3. 添加一个 Web 导出预设

**Project > Export** 里添加一个 **Web** 预设（名字随便），不需要下载官方的 Web 导出模板。

### 4. 导出

打开编辑器底部的 **Mini Game Export** Dock：

1. 选平台（WeChat / Douyin）
2. 填 App ID，选屏幕方向
3. 选刚才那个 Web 预设和输出目录
4. 点 **Export**

导出目录直接用**微信开发者工具**或**抖音开发者工具**打开即可。

## SDK API

插件会把 `MiniGameSDK` 注册为 autoload，所有异步结果都通过信号回来。在非小游戏环境（比如编辑器里）所有方法都是安全的空实现，可以照常开发调试。

```gdscript
# 登录
MiniGameSDK.login_completed.connect(func(code, err):
    if err.is_empty(): print("code: ", code)
)
MiniGameSDK.login()

# 存储（同步接口）
MiniGameSDK.storage_set("level", "5")
var level = MiniGameSDK.storage_get("level", "1")

# 激励视频广告
MiniGameSDK.ad_created.connect(func(type, ok, err):
    if ok: MiniGameSDK.show_rewarded_ad()
)
MiniGameSDK.rewarded_ad_result.connect(func(completed, err):
    if completed: give_reward()
)
MiniGameSDK.create_rewarded_ad("your-ad-unit-id")

# 轻提示 / 震动
MiniGameSDK.show_toast("Hello!", "success")
MiniGameSDK.vibrate_short("medium")
```

<details>
<summary><strong>完整 API 参考</strong></summary>

### 信号

| 信号 | 参数 |
|------|------|
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

### 方法

| 分类 | 方法 |
|------|------|
| **登录鉴权** | `login()` `check_session()` `get_user_info()` |
| **隐私授权** | `get_privacy_setting()` `require_privacy_authorize()` `open_privacy_contract()` `start_privacy_authorization_listener()` `resolve_privacy_authorization(event, button_id)` `expose_privacy_authorization()` `agree_privacy_authorization(button_id)` `disagree_privacy_authorization()` |
| **授权设置** | `get_setting(with_subscriptions)` `open_setting(with_subscriptions)` `authorize(scope)` |
| **原生按钮** | `create_user_info_button(options)` `create_open_setting_button(options)` `create_game_club_button(options)` `show_native_button(button_type)` `hide_native_button(button_type)` `destroy_native_button(button_type)` `stop_native_button_tap_listener(button_type)` |
| **调试日志** | `set_enable_debug(enable_debug)` `get_log_manager(level)` `log_manager_debug(args)` `log_manager_info(args)` `log_manager_log(args)` `log_manager_warn(args)` `get_realtime_log_manager()` `realtime_log_tag(tag)` `realtime_log_info(args)` `realtime_log_warn(args)` `realtime_log_error(args)` `realtime_log_set_filter_msg(msg)` `realtime_log_add_filter_msg(msg)` |
| **账号信息** | `get_account_info()` |
| **本地存储** | `storage_set(key, val)` `storage_get(key, default)` `storage_remove(key)` `storage_clear()` `storage_info()` |
| **分享** | `share_app(title, image_url, query)` `show_share_menu()` `hide_share_menu()` |
| **激励广告** | `create_rewarded_ad(id)` `show_rewarded_ad()` |
| **Banner 广告** | `create_banner_ad(id)` `show_banner_ad()` `hide_banner_ad()` `destroy_banner_ad()` |
| **插屏广告** | `create_interstitial_ad(id)` `show_interstitial_ad()` |
| **支付** | `request_payment(params)` |
| **振动** | `vibrate_short(type)` `vibrate_long()` |
| **键盘** | `show_keyboard(default_value, max_length, multiple)` `hide_keyboard()` |
| **剪贴板** | `set_clipboard(data)` `get_clipboard()` |
| **网络请求** | `http_request(url, method, data, headers)` |
| **媒体图片** | `choose_media(count, media_type, source_type, max_duration, size_type, camera)` `choose_image(count, size_type, source_type)` `preview_image(urls, current, show_menu, referrer_policy)` `save_image_to_photos_album(file_path)` `compress_image(src, quality, compressed_width, compressed_height)` |
| **Camera** | `create_camera(x, y, width, height, device_position, flash, frame_size)` `camera_take_photo(quality)` `camera_start_record()` `camera_stop_record(compressed)` `camera_set_zoom(zoom)` `camera_listen_frame_change(use_active_worker)` `camera_close_frame_change()` `camera_destroy()` |
| **Video** | `create_video(options)` `set_video_properties(properties)` `get_video_state()` `video_play()` `video_pause()` `video_stop()` `video_seek(time)` `video_request_full_screen(direction)` `video_exit_full_screen()` `stop_video_listener(event_types)` `video_destroy()` |
| **媒体音频** | `get_available_audio_sources()` `create_video_decoder()` `video_decoder_start(options)` `video_decoder_get_frame_data()` `video_decoder_seek(position)` `video_decoder_stop()` `video_decoder_remove()` `start_video_decoder_listener(event_types)` `stop_video_decoder_listener(event_types)` `create_media_audio_player(volume)` `set_media_audio_volume(volume)` `media_audio_add_video_decoder_source()` `media_audio_remove_video_decoder_source()` `media_audio_start()` `media_audio_stop()` `media_audio_destroy()` |
| **RecorderManager 录音** | `get_recorder_manager()` `recorder_start(options)` `recorder_pause()` `recorder_resume()` `recorder_stop()` |
| **游戏录屏** | `get_game_recorder()` `game_recorder_start(options)` `game_recorder_stop()` `game_recorder_pause()` `game_recorder_resume()` `game_recorder_abort()` `start_game_recorder_listener(event_types)` `stop_game_recorder_listener(event_types)` `operate_game_recorder_video(params)` `create_game_recorder_share_button(style, share)` `show_game_recorder_share_button()` `hide_game_recorder_share_button()` `off_game_recorder_share_button_tap()` |
| **InnerAudio 音频** | `set_inner_audio_option(options)` `create_inner_audio_context(create_options, properties)` `set_inner_audio_properties(properties)` `get_inner_audio_state()` `inner_audio_play()` `inner_audio_pause()` `inner_audio_stop()` `inner_audio_seek(position)` `stop_inner_audio_listener(event_types)` `inner_audio_destroy()` |
| **文件传输** | `download_file(url, file_path, headers, timeout_ms, enable_profile, enable_http2, enable_quic)` `upload_file(url, file_path, name, form_data, headers, timeout_ms, enable_profile, enable_http2, enable_quic)` |
| **文件系统** | `call_file_system(method, options)` `file_system_access(path)` `file_system_read_file(file_path, encoding, position, length)` `file_system_write_file(file_path, data, encoding)` `file_system_append_file(file_path, data, encoding)` `file_system_mkdir(dir_path, recursive)` `file_system_readdir(dir_path)` `file_system_unlink(file_path)` `file_system_save_file(temp_file_path, file_path)` `file_system_get_saved_file_list()` `file_system_remove_saved_file(file_path)` `file_system_get_file_info(file_path, digest_algorithm)` `file_system_copy_file(src_path, dest_path)` `file_system_rename(old_path, new_path)` `file_system_rmdir(dir_path, recursive)` `file_system_stat(path, recursive)` `file_system_unzip(zip_file_path, target_path)` |
| **分包** | `load_subpackage(name)` `pre_download_subpackage(name, package_type)` |
| **Worker** | `create_worker(script_path, use_experimental_worker)` `worker_post_message(message)` `worker_terminate()` |
| **WebSocket** | `connect_socket(url, headers, protocols, tcp_no_delay, per_message_deflate, timeout_ms, force_cellular_network)` `send_socket_message(data)` `close_socket(code, reason)` |
| **网络状态** | `get_network_type()` `start_network_status_listener()` `stop_network_status_listener()` |
| **传感器** | `start_accelerometer(interval)` `stop_accelerometer()` `start_gyroscope(interval)` `stop_gyroscope()` `start_compass()` `stop_compass()` `start_device_motion_listening(interval)` `stop_device_motion_listening()` |
| **电量** | `get_battery_info()` `get_battery_info_sync()` |
| **音频事件** | `start_audio_interruption_listener()` `stop_audio_interruption_listener()` |
| **主题 / 性能** | `start_theme_change_listener()` `stop_theme_change_listener()` `get_performance_entries(entry_type)` `report_performance(id, value, dimensions)` |
| **小程序跳转** | `navigate_to_mini_program(app_id, path, extra_data, env_version, short_link, no_relaunch_if_path_unchanged)` `navigate_back_mini_program(extra_data)` `exit_mini_program()` `restart_mini_program(path)` |
| **用户托管数据 / 开放数据域** | `set_user_cloud_storage(kv_data)` `remove_user_cloud_storage(key_list)` `get_user_cloud_storage_keys()` `get_user_cloud_storage(key_list)` `get_friend_cloud_storage(key_list)` `get_group_cloud_storage(key_list, share_ticket, group_id)` `post_open_data_context_message(message, shared_canvas_mode)` |
| **客服会话 / 订阅消息** | `open_customer_service_conversation(session_from, show_message_card, send_message_title, send_message_path, send_message_img)` `request_subscribe_message(tmpl_ids)` `request_subscribe_system_message(msg_type_list)` |
| **更新管理** | `start_update_listener()` `apply_update()` |
| **内存告警** | `start_memory_warning_listener()` `stop_memory_warning_listener()` |
| **窗口事件** | `start_window_resize_listener()` `stop_window_resize_listener()` |
| **运行时错误** | `start_unhandled_rejection_listener()` `stop_unhandled_rejection_listener()` |
| **截屏 / 录屏** | `get_screen_brightness()` `set_screen_brightness(value)` `start_user_capture_screen_listener()` `stop_user_capture_screen_listener()` `get_screen_recording_state()` `start_screen_recording_state_listener()` `stop_screen_recording_state_listener()` `set_visual_effect_on_capture(effect)` |
| **系统信息 / 兼容性** | `can_i_use(schema)` `get_device_info()` `get_app_base_info()` `get_system_setting()` `get_app_authorize_setting()` `get_system_info()` `get_launch_options()` `get_window_info()` `get_menu_button_rect()` |
| **UI 交互** | `show_toast(title, icon, duration)` `show_modal(title, content)` `show_loading(title)` `hide_loading()` |
| **屏幕** | `set_keep_screen_on(keep_on)` |
| **通用 API** | `call_api(api_name, params)` |

</details>

## 引擎模板

插件在 `addons/godot_mini_game/engine/` 内置了一份预编译引擎（Godot 4.6.1，Brotli 压缩后约 6 MB）。

**为什么要自定义模板？** 官方 Godot Web 导出默认启用了 SIMD、异常处理 Tag 等 WASM 特性，真机上的 `WXWebAssembly` 不支持，加载会直接 CompileError 挂掉。内置模板改用下面的参数重新编译：

- `wasm_simd=no`
- `SUPPORT_LONGJMP='emscripten'`（避免生成 WASM Tag section）
- `threads=no`

### 模板查找顺序

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1 | `addons/godot_mini_game/godot.js` + `godot.wasm.br` + `version.txt` | 精确版本的手动覆盖 |
| 2 | `~/.config/godot_mini_game/templates/{完整版本}/` | 通过 Dock 导入的精确版本模板 |
| 3 | `addons/godot_mini_game/engine/` | 版本精确匹配时使用内置模板 |
| 4 | 精确版本的 Godot 官方 Web 导出模板 | 仅开发者工具模拟器可用，会给出警告 |

JS 与 WASM 始终从同一个来源选择；没有精确匹配时，插件会在触碰输出目录前终止导出。

### 为其它 Godot 版本编译模板

```bash
# 本地构建（Apple Silicon 约 5 分钟）
./scripts/build_wasm_template.sh 4.x.x-stable

# 然后在 Dock 里点「Import Engine Template」导入生成的 zip
```

也可以跑 GitHub Actions 工作流：**Actions > Build Mini-Game WASM Template**。

## 目录结构

```
addons/godot_mini_game/
├── plugin.cfg / plugin.gd          # 编辑器插件入口
├── export_dock.gd / .tscn          # 导出 UI Dock
├── exporter.gd                     # 导出流水线
├── MiniGameSDK.gd                  # GDScript SDK autoload
├── engine/                          # 内置引擎（godot.js + godot.wasm.br）
└── templates/
    ├── common/
    │   ├── adapter.js               # DOM/BOM/Canvas/Audio/Input 适配层
    │   ├── fetch.js                 # Fetch API polyfill
    │   ├── js/libs/sdk.js           # JS ↔ GDScript 桥
    │   ├── js/loader.js             # 引擎加载器 + 加载动画
    │   └── js/worker/               # 微信 game.json 需要的 worker 脚本
    ├── wechat/                      # 微信平台配置
    └── douyin/                      # 抖音平台配置
```

## 依赖

- **Godot 4.x**，并提供精确版本的引擎模板。内置引擎是 4.6.1-stable；其它版本若要真机运行，
  需导入对应版本的小游戏兼容模板。已安装的官方 Web 模板只能作为开发者工具/模拟器回退。
- **微信开发者工具** 或 **抖音开发者工具**
- **Node.js** *必需*（用于内置 Brotli 压缩）或 `brotli` CLI（`brew install brotli`）。
  两者都没有时导出会失败 —— 未压缩的 WASM 超过微信单包 4 MB 上限。

## 文档

- [使用文档（中文）](docs/USAGE_zh.md)——Dock 面板、SDK、分包、排错、自建引擎模板的完整说明
- [Usage guide (English)](docs/USAGE.md)

## 参与贡献

欢迎提 Issue 和 PR。自己编译引擎模板参考 `scripts/build_wasm_template.sh`。

## 许可证

[MIT](LICENSE)
