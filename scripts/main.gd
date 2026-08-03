extends Control

# ── Scene nodes ────────────────────────────────────────────────────

@onready var score_label: Label = $Scroll/Content/ScoreLabel
@onready var tap_button: Button = $Scroll/Content/TapButton
@onready var color_rect: ColorRect = $Scroll/Content/ColorRect
@onready var play_btn: Button = $Scroll/Content/AudioRow/PlayBtn
@onready var pause_btn: Button = $Scroll/Content/AudioRow/PauseBtn
@onready var audio_label: Label = $Scroll/Content/AudioLabel
@onready var audio_player: AudioStreamPlayer = $AudioPlayer
@onready var sdk_tests: VBoxContainer = $Scroll/Content/SDKTests
@onready var info_label: Label = $Scroll/Content/InfoLabel

const DEMO_AUDIO_MIX_RATE := 44100.0
const DEMO_AUDIO_DURATION := 0.85
const DEMO_AUDIO_FREQUENCY := 660.0
const DEMO_AUDIO_VOLUME := 0.28
const DEMO_INNER_AUDIO_SRC := "audio/demo-tone.wav"
const DEMO_LOADING_AUTO_HIDE_SECONDS := 1.0

var score := 0
var colors: Array[Color] = [
	Color("#478cbf"), Color("#e74c3c"), Color("#2ecc71"),
	Color("#f39c12"), Color("#9b59b6"), Color("#1abc9c"),
]

var _result_labels: Dictionary = {}  # String → Label
var _demo_audio_playback: AudioStreamGeneratorPlayback = null
var _demo_audio_phase := 0.0
var _demo_audio_frames_left := 0
var _demo_audio_total_frames := 0
var _demo_audio_seconds_left := 0.0
var _demo_audio_native_active := false
var _demo_audio_native_paused := false


func _ready() -> void:
	_ensure_demo_audio_stream()
	tap_button.pressed.connect(_on_tap)
	play_btn.pressed.connect(_on_play)
	pause_btn.pressed.connect(_on_pause)
	audio_player.finished.connect(func() -> void: audio_label.text = "Audio: Stopped")
	score_label.text = "Score: 0"
	color_rect.color = colors[0]

	_build_sdk_tests()
	_connect_sdk_signals()
	_log("Ready — tap buttons to test SDK features")


func _process(delta: float) -> void:
	if _demo_audio_native_active:
		if _demo_audio_native_paused:
			return
		_demo_audio_seconds_left = maxf(0.0, _demo_audio_seconds_left - delta)
		if _demo_audio_seconds_left <= 0.0:
			MiniGameSDK.inner_audio_stop()
			_demo_audio_native_active = false
			audio_label.text = "Audio: Stopped"
		return

	if _demo_audio_playback == null:
		return
	if not audio_player.playing or audio_player.stream_paused:
		return

	_fill_demo_audio_buffer()
	_demo_audio_seconds_left = maxf(0.0, _demo_audio_seconds_left - delta)
	if _demo_audio_seconds_left <= 0.0:
		audio_player.stop()
		_demo_audio_playback = null
		audio_label.text = "Audio: Stopped"


# ── Basic interactions ─────────────────────────────────────────────

func _on_tap() -> void:
	score += 1
	score_label.text = "Score: %d" % score
	color_rect.color = colors[score % colors.size()]


func _on_play() -> void:
	if _demo_audio_native_active and _demo_audio_native_paused:
		_demo_audio_native_paused = false
		MiniGameSDK.inner_audio_play()
		audio_label.text = "Audio: Playing"
	elif audio_player.stream_paused:
		audio_player.stream_paused = false
		audio_label.text = "Audio: Playing"
	elif not _demo_audio_native_active and not audio_player.playing:
		_start_demo_audio_tone()


func _on_pause() -> void:
	if _demo_audio_native_active and not _demo_audio_native_paused:
		_demo_audio_native_paused = true
		MiniGameSDK.inner_audio_pause()
		audio_label.text = "Audio: Paused"
	elif audio_player.playing and not audio_player.stream_paused:
		audio_player.stream_paused = true
		audio_label.text = "Audio: Paused"


func _ensure_demo_audio_stream() -> void:
	if audio_player.stream != null:
		return
	var stream := AudioStreamGenerator.new()
	stream.mix_rate = DEMO_AUDIO_MIX_RATE
	stream.buffer_length = 0.2
	audio_player.stream = stream


func _start_demo_audio_tone() -> void:
	if _start_mini_game_demo_audio():
		return

	_ensure_demo_audio_stream()
	var stream := audio_player.stream as AudioStreamGenerator
	var mix_rate := DEMO_AUDIO_MIX_RATE
	if stream != null:
		mix_rate = stream.mix_rate

	_demo_audio_total_frames = maxi(1, int(mix_rate * DEMO_AUDIO_DURATION))
	_demo_audio_frames_left = _demo_audio_total_frames
	_demo_audio_seconds_left = DEMO_AUDIO_DURATION
	_demo_audio_phase = 0.0
	audio_player.play()
	_demo_audio_playback = audio_player.get_stream_playback() as AudioStreamGeneratorPlayback
	_fill_demo_audio_buffer()
	audio_label.text = "Audio: Playing"


func _start_mini_game_demo_audio() -> bool:
	if not MiniGameSDK.is_mini_game:
		return false

	if audio_player.playing:
		audio_player.stop()
	_demo_audio_playback = null
	MiniGameSDK.create_inner_audio_context(
		{"useWebAudioImplement": false},
		{
			"src": DEMO_INNER_AUDIO_SRC,
			"loop": false,
			"autoplay": false,
			"obeyMuteSwitch": false,
			"volume": 0.8,
			"playbackRate": 1.0,
		})
	MiniGameSDK.inner_audio_play()
	_demo_audio_seconds_left = DEMO_AUDIO_DURATION
	_demo_audio_native_active = true
	_demo_audio_native_paused = false
	audio_label.text = "Audio: Playing"
	return true


func _fill_demo_audio_buffer() -> void:
	if _demo_audio_playback == null:
		return
	if _demo_audio_frames_left <= 0:
		return

	var stream := audio_player.stream as AudioStreamGenerator
	var mix_rate := DEMO_AUDIO_MIX_RATE
	if stream != null:
		mix_rate = stream.mix_rate
	var phase_step := TAU * DEMO_AUDIO_FREQUENCY / mix_rate
	var fade_frames := int(mix_rate * 0.03)

	while _demo_audio_playback.get_frames_available() > 0 and _demo_audio_frames_left > 0:
		var played_frames := _demo_audio_total_frames - _demo_audio_frames_left
		var fade_in := minf(1.0, float(played_frames) / float(fade_frames))
		var fade_out := minf(1.0, float(_demo_audio_frames_left) / float(fade_frames))
		var envelope := minf(fade_in, fade_out)
		var sample := sin(_demo_audio_phase) * DEMO_AUDIO_VOLUME * envelope
		_demo_audio_playback.push_frame(Vector2(sample, sample))
		_demo_audio_phase = fmod(_demo_audio_phase + phase_step, TAU)
		_demo_audio_frames_left -= 1


# ── SDK test UI builder ───────────────────────────────────────────

func _build_sdk_tests() -> void:
	_add_section("Storage", [
		["Save", _test_storage_save],
		["Load", _test_storage_load],
		["Remove", _test_storage_remove],
		["Clear", _test_storage_clear],
		["Info", _test_storage_info],
	])

	_add_section("Auth / Login", [
		["Login", _test_login],
		["Check Session", _test_check_session],
		["User Info", _test_user_info],
	])

	_add_section("Privacy", [
		["Setting", _test_privacy_setting],
		["Listen", _test_privacy_listen],
		["Require", _test_privacy_require],
		["Contract", _test_privacy_contract],
	], "WeChat base lib 2.32.3+")

	_add_section("Privacy Resolve", [
		["Expose", _test_privacy_expose],
		["Agree", _test_privacy_agree],
		["Reject", _test_privacy_reject],
	], "Call after listener fires")

	_add_section("Settings / Account", [
		["Setting", _test_get_setting],
		["Open", _test_open_setting],
		["Authorize", _test_authorize_record],
		["Account", _test_account_info],
	])

	_add_section("Native Buttons", [
		["User", _test_native_user_button],
		["Setting", _test_native_setting_button],
		["Club", _test_native_game_club_button],
		["Show U", _test_native_user_show],
		["Hide U", _test_native_user_hide],
		["Off U", _test_native_user_off],
		["Destroy U", _test_native_user_destroy],
		["Destroy S", _test_native_setting_destroy],
		["Destroy C", _test_native_game_club_destroy],
	], "WeChat UserInfo/OpenSetting/GameClub native buttons")

	_add_section("Debug Logging", [
		["Enable", _test_enable_debug],
		["LogMgr", _test_log_manager],
		["Debug", _test_log_manager_debug],
		["Info", _test_log_manager_info],
		["Warn", _test_log_manager_warn],
		["RTMgr", _test_realtime_log_manager],
		["RT Tag", _test_realtime_log_tag],
		["RT Info", _test_realtime_log_info],
		["RT Warn", _test_realtime_log_warn],
		["RT Error", _test_realtime_log_error],
		["Filter", _test_realtime_log_filter],
		["Add Filter", _test_realtime_log_add_filter],
	], "WeChat debug logs and realtime logs")

	_add_section("Share", [
		["Share", _test_share],
		["Show Menu", _test_show_share_menu],
		["Hide Menu", _test_hide_share_menu],
	])

	_add_section("Rewarded Ad", [
		["Create", _test_create_rewarded_ad],
		["Show", _test_show_rewarded_ad],
	], "Requires real ad unit ID + real device")

	_add_section("Banner Ad", [
		["Create", _test_create_banner_ad],
		["Show", _test_show_banner_ad],
		["Hide", _test_hide_banner_ad],
	], "Requires real ad unit ID + real device")

	_add_section("Interstitial Ad", [
		["Create", _test_create_interstitial_ad],
		["Show", _test_show_interstitial_ad],
	], "Requires real ad unit ID + real device")

	_add_section("Payment", [
		["Pay", _test_payment],
	])

	_add_section("Vibration", [
		["Short", _test_vibrate_short],
		["Medium", _test_vibrate_medium],
		["Long", _test_vibrate_long],
	])

	_add_section("Keyboard", [
		["Show", _test_show_keyboard],
		["Hide", _test_hide_keyboard],
	])

	_add_section("Clipboard", [
		["Copy", _test_clipboard_set],
		["Paste", _test_clipboard_get],
	])

	_add_section("Media", [
		["Choose", _test_media_choose],
		["Image", _test_media_choose_image],
		["Preview", _test_media_preview],
		["Save", _test_media_save],
		["Compress", _test_media_compress],
	], "Album/camera require user permission")

	_add_section("Camera", [
		["Create", _test_camera_create],
		["Photo", _test_camera_photo],
		["Rec", _test_camera_start_record],
		["Stop Rec", _test_camera_stop_record],
		["Zoom", _test_camera_zoom],
		["Frames", _test_camera_frames],
		["F Stop", _test_camera_frames_stop],
		["Destroy", _test_camera_destroy],
	], "WeChat base lib 2.9.0+")

	_add_section("Video", [
		["Create", _test_video_create],
		["State", _test_video_state],
		["Play", _test_video_play],
		["Pause", _test_video_pause],
		["Seek", _test_video_seek],
		["Stop", _test_video_stop],
		["Full", _test_video_fullscreen],
		["Exit", _test_video_exit_fullscreen],
		["Off", _test_video_off],
		["Destroy", _test_video_destroy],
	], "Requires a video file or HTTPS URL")

	_add_section("Media Audio", [
		["Sources", _test_available_audio_sources],
		["VDec", _test_video_decoder_create],
		["V On", _test_video_decoder_listen],
		["V Start", _test_video_decoder_start],
		["Frame", _test_video_decoder_frame],
		["V Seek", _test_video_decoder_seek],
		["V Stop", _test_video_decoder_stop],
		["V Off", _test_video_decoder_off],
		["Player", _test_media_audio_create],
		["Add", _test_media_audio_add],
		["M Start", _test_media_audio_start],
		["Vol", _test_media_audio_volume],
		["Remove", _test_media_audio_remove],
		["M Stop", _test_media_audio_stop],
		["M Destroy", _test_media_audio_destroy],
		["V Remove", _test_video_decoder_remove],
	], "VideoDecoder 2.11.1+, MediaAudioPlayer 2.13.0+")

	_add_section("Recorder", [
		["Get", _test_recorder_get],
		["Start", _test_recorder_start],
		["Pause", _test_recorder_pause],
		["Resume", _test_recorder_resume],
		["Stop", _test_recorder_stop],
	], "WeChat base lib 1.6.0+")

	_add_section("Game Recorder", [
		["Get", _test_game_recorder_get],
		["Listen", _test_game_recorder_listen],
		["Start", _test_game_recorder_start],
		["Pause", _test_game_recorder_pause],
		["Resume", _test_game_recorder_resume],
		["Stop", _test_game_recorder_stop],
		["Abort", _test_game_recorder_abort],
		["Share", _test_game_recorder_share],
		["Button", _test_game_recorder_button],
		["Show", _test_game_recorder_button_show],
		["Hide", _test_game_recorder_button_hide],
	], "WeChat base lib 2.8.0+")

	_add_section("Inner Audio", [
		["Option", _test_inner_audio_option],
		["Create", _test_inner_audio_create],
		["State", _test_inner_audio_state],
		["Play", _test_inner_audio_play],
		["Pause", _test_inner_audio_pause],
		["Seek", _test_inner_audio_seek],
		["Stop", _test_inner_audio_stop],
		["Off", _test_inner_audio_off],
		["Destroy", _test_inner_audio_destroy],
	], "WeChat base lib 1.6.0+")

	_add_section("Network", [
		["GET httpbin", _test_http_get],
	])

	_add_section("File Transfer", [
		["Download", _test_download_file],
		["Upload", _test_upload_file],
	], "Requires upload/download domain whitelist")

	_add_section("File System", [
		["Write", _test_file_system_write],
		["Read", _test_file_system_read],
		["Mkdir", _test_file_system_mkdir],
		["List", _test_file_system_list],
		["Stat", _test_file_system_stat],
		["Delete", _test_file_system_delete],
	], "wxfile://usr sandbox")

	_add_section("Subpackage", [
		["Load", _test_subpackage_load],
		["Preload", _test_subpackage_preload],
	], "Requires subpackages in game.json")

	_add_section("Worker", [
		["Create", _test_worker_create],
		["Post", _test_worker_post],
		["Stop", _test_worker_stop],
	], "WeChat only; base lib 1.9.90+")

	_add_section("WebSocket", [
		["Connect", _test_socket_connect],
		["Send", _test_socket_send],
		["Close", _test_socket_close],
	], "Requires socket domain whitelist")

	_add_section("Network Status", [
		["Type", _test_network_type],
		["Listen", _test_network_listen],
		["Stop", _test_network_stop],
	])

	_add_section("Sensors", [
		["Accel", _test_accelerometer_start],
		["A Stop", _test_accelerometer_stop],
		["Gyro", _test_gyroscope_start],
		["G Stop", _test_gyroscope_stop],
		["Compass", _test_compass_start],
		["C Stop", _test_compass_stop],
	])

	_add_section("Device Motion", [
		["Start", _test_device_motion_start],
		["Stop", _test_device_motion_stop],
	], "WeChat base lib 2.3.0+")

	_add_section("Battery", [
		["Async", _test_battery_info],
		["Sync", _test_battery_info_sync],
	])

	_add_section("Audio Events", [
		["Listen", _test_audio_interruption_listen],
		["Stop", _test_audio_interruption_stop],
	], "WeChat base lib 2.6.2+")

	_add_section("Theme / Performance", [
		["Theme", _test_theme_listen],
		["T Stop", _test_theme_stop],
		["Entries", _test_performance_entries],
		["Report", _test_report_performance],
	], "Theme/performance base lib 2.11.0+")

	_add_section("Mini Program Nav", [
		["To App", _test_navigate_to_mini_program],
		["Back", _test_navigate_back_mini_program],
		["Exit", _test_exit_mini_program],
		["Restart", _test_restart_mini_program],
	], "Requires user tap; restart 3.0.1+")

	_add_section("Cloud / Open Data", [
		["Set", _test_cloud_storage_set],
		["Remove", _test_cloud_storage_remove],
		["Keys", _test_cloud_storage_keys],
		["Mine", _test_cloud_storage_user],
		["Friends", _test_cloud_storage_friend],
		["Group", _test_cloud_storage_group],
		["Post", _test_open_data_post],
	], "Read APIs run in open data context")

	_add_section("Service / Subscribe", [
		["Customer", _test_customer_service],
		["Subscribe", _test_subscribe_message],
		["System Sub", _test_subscribe_system_message],
	], "Requires user tap")

	_add_section("Update", [
		["Listen", _test_update_listen],
		["Apply", _test_update_apply],
	], "WeChat base lib 1.9.90+")

	_add_section("Memory", [
		["Listen", _test_memory_listen],
		["Stop", _test_memory_stop],
	], "WeChat base lib 2.0.2+")

	_add_section("Window / Errors", [
		["Resize", _test_window_resize_listen],
		["R Stop", _test_window_resize_stop],
		["Reject", _test_unhandled_rejection_listen],
		["J Stop", _test_unhandled_rejection_stop],
	], "Resize 2.3.0+, rejection 2.10.0+")

	_add_section("Screen Brightness", [
		["Get", _test_screen_brightness_get],
		["Set 50%", _test_screen_brightness_set],
		["System", _test_screen_brightness_system],
	], "WeChat base lib 1.2.0+")

	_add_section("Capture / Recording", [
		["Shot", _test_capture_listen],
		["S Stop", _test_capture_stop],
		["Rec", _test_recording_state],
		["R Listen", _test_recording_listen],
		["R Stop", _test_recording_stop],
		["Hide", _test_visual_effect_hidden],
	], "Recording iOS base lib 2.24.0+")

	_add_section("System", [
		["CanIUse", _test_can_i_use],
		["Device", _test_device_info],
		["App Base", _test_app_base_info],
		["Sys Setting", _test_system_setting],
		["App Auth", _test_app_authorize_setting],
		["System Info", _test_system_info],
		["Launch Opts", _test_launch_options],
		["Window Info", _test_window_info],
		["Menu Rect", _test_menu_rect],
	])

	_add_section("Screen / UI", [
		["Keep On", _test_keep_screen_on],
		["Toast", _test_toast],
		["Modal", _test_modal],
		["Loading", _test_show_loading],
		["Hide Load", _test_hide_loading],
	])

	_add_section("Lifecycle", [
		["(auto)", func() -> void: _set_result("Lifecycle", "Listening for onShow/onHide...")],
	])


func _add_section(title: String, buttons: Array, hint: String = "") -> void:
	var section := VBoxContainer.new()
	section.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	section.add_theme_constant_override("separation", 6)

	var header := Label.new()
	header.text = title if hint.is_empty() else "%s  (%s)" % [title, hint]
	header.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	header.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_theme_font_size_override("font_size", 18)
	header.add_theme_color_override("font_color", Color(0.3, 0.75, 1.0))
	section.add_child(header)

	# A single HBox makes the widest SDK section dictate the width of the whole
	# ScrollContainer. On narrow phone viewports that turns the demo into a
	# horizontally clipped page. Flow rows keep every section inside the visible
	# width while preserving large touch targets.
	var button_flow := HFlowContainer.new()
	button_flow.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button_flow.add_theme_constant_override("h_separation", 8)
	button_flow.add_theme_constant_override("v_separation", 8)
	for btn_def in buttons:
		var btn := Button.new()
		btn.text = btn_def[0]
		btn.custom_minimum_size = Vector2(96, 44)
		btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		btn.add_theme_font_size_override("font_size", 15)
		btn.pressed.connect(btn_def[1])
		button_flow.add_child(btn)
	section.add_child(button_flow)

	var result := Label.new()
	result.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	result.add_theme_font_size_override("font_size", 13)
	result.add_theme_color_override("font_color", Color(0.65, 0.65, 0.65))
	result.text = ""
	section.add_child(result)
	_result_labels[title] = result

	sdk_tests.add_child(section)


func _set_result(section: String, text: String) -> void:
	if _result_labels.has(section):
		_result_labels[section].text = text
	_log(text)


func _log(msg: String) -> void:
	info_label.text = msg


# ── SDK signal connections ─────────────────────────────────────────

func _connect_sdk_signals() -> void:
	MiniGameSDK.login_completed.connect(func(code: String, err: String) -> void:
		if err.is_empty():
			_set_result("Auth / Login", "Login OK, code: %s" % code)
		else:
			_set_result("Auth / Login", "Login failed: %s" % err))

	MiniGameSDK.session_checked.connect(func(valid: bool, err: String) -> void:
		_set_result("Auth / Login", "Session valid: %s %s" % [valid, err]))

	MiniGameSDK.user_info_received.connect(func(info: String, err: String) -> void:
		if err.is_empty():
			_set_result("Auth / Login", "UserInfo: %s" % info.left(120))
		else:
			_set_result("Auth / Login", "UserInfo failed: %s" % err))

	MiniGameSDK.privacy_setting_received.connect(func(need_authorization: bool, contract_name: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Privacy", "Need auth: %s, contract: %s, raw: %s" % [
				need_authorization,
				contract_name,
				data_json.left(120),
			])
		else:
			_set_result("Privacy", "Privacy setting failed: %s" % err))

	MiniGameSDK.privacy_authorize_result.connect(func(ok: bool, err: String) -> void:
		_set_result("Privacy", "Authorize OK: %s, err: %s" % [ok, err]))

	MiniGameSDK.privacy_contract_opened.connect(func(ok: bool, err: String) -> void:
		_set_result("Privacy", "Open contract OK: %s, err: %s" % [ok, err]))

	MiniGameSDK.privacy_authorization_needed.connect(func(event_info_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Privacy", "Need authorization: %s" % event_info_json.left(160))
		else:
			_set_result("Privacy", "Privacy listener failed: %s" % err))

	MiniGameSDK.setting_received.connect(func(settings_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Settings / Account", "Setting: %s" % settings_json.left(180))
		else:
			_set_result("Settings / Account", "Setting failed: %s" % err))

	MiniGameSDK.setting_opened.connect(func(settings_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Settings / Account", "Open setting: %s" % settings_json.left(180))
		else:
			_set_result("Settings / Account", "Open setting failed: %s" % err))

	MiniGameSDK.authorization_result.connect(func(scope: String, ok: bool, err: String) -> void:
		_set_result("Settings / Account", "Authorize %s OK: %s, err: %s" % [scope, ok, err]))

	MiniGameSDK.native_button_operation_result.connect(func(button_type: String, action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Native Buttons", "%s %s OK: %s raw: %s" % [button_type, action, ok, data_json.left(160)])
		else:
			_set_result("Native Buttons", "%s %s failed: %s" % [button_type, action, err]))

	MiniGameSDK.native_button_tapped.connect(func(button_type: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Native Buttons", "%s tapped: %s" % [button_type, data_json.left(180)])
		else:
			_set_result("Native Buttons", "%s tap failed: %s raw: %s" % [button_type, err, data_json.left(120)]))

	MiniGameSDK.debug_operation_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Debug Logging", "%s OK: %s raw: %s" % [action, ok, data_json.left(180)])
		else:
			_set_result("Debug Logging", "%s failed: %s" % [action, err]))

	MiniGameSDK.ad_created.connect(func(ad_type: String, ok: bool, err: String) -> void:
		var names := {"rewarded": "Rewarded Ad", "banner": "Banner Ad", "interstitial": "Interstitial Ad"}
		var section: String = names.get(ad_type, ad_type)
		if ok:
			_set_result(section, "Created OK")
		else:
			_set_result(section, "Create failed: %s" % err))

	MiniGameSDK.rewarded_ad_result.connect(func(ended: bool, err: String) -> void:
		_set_result("Rewarded Ad", "Ended: %s, err: %s" % [ended, err]))

	MiniGameSDK.interstitial_ad_result.connect(func(ok: bool, err: String) -> void:
		_set_result("Interstitial Ad", "OK: %s, err: %s" % [ok, err]))

	MiniGameSDK.payment_result.connect(func(ok: bool, err: String) -> void:
		_set_result("Payment", "OK: %s, err: %s" % [ok, err]))

	MiniGameSDK.keyboard_event.connect(func(evt: String, val: String) -> void:
		_set_result("Keyboard", "[%s] %s" % [evt, val]))

	MiniGameSDK.http_response.connect(func(status: int, data: String, err: String) -> void:
		if err.is_empty():
			_set_result("Network", "HTTP %d: %s" % [status, data.left(200)])
		else:
			_set_result("Network", "HTTP err: %s" % err))

	MiniGameSDK.file_transfer_result.connect(func(action: String, ok: bool, status: int, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("File Transfer", "%s OK: %s, HTTP %d, raw: %s" % [
				action,
				ok,
				status,
				data_json.left(160),
			])
		else:
			_set_result("File Transfer", "%s failed: %s" % [action, err]))

	MiniGameSDK.media_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Media", "%s OK: %s raw: %s" % [action, ok, data_json.left(180)])
		else:
			_set_result("Media", "%s failed: %s" % [action, err]))

	MiniGameSDK.camera_operation_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Camera", "%s OK: %s raw: %s" % [action, ok, data_json.left(180)])
		else:
			_set_result("Camera", "%s failed: %s" % [action, err]))

	MiniGameSDK.camera_frame.connect(func(data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Camera", "Frame: %s" % data_json.left(180))
		else:
			_set_result("Camera", "Frame failed: %s" % err))

	MiniGameSDK.camera_event.connect(func(event_type: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Camera", "Event %s: %s" % [event_type, data_json.left(160)])
		else:
			_set_result("Camera", "Event %s failed: %s" % [event_type, err]))

	MiniGameSDK.video_operation_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Video", "%s OK: %s raw: %s" % [action, ok, data_json.left(180)])
		else:
			_set_result("Video", "%s failed: %s" % [action, err]))

	MiniGameSDK.video_event.connect(func(event_type: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Video", "Event %s: %s" % [event_type, data_json.left(160)])
		else:
			_set_result("Video", "Event %s failed: %s raw: %s" % [event_type, err, data_json.left(120)]))

	MiniGameSDK.available_audio_sources_received.connect(func(sources_json: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Media Audio", "Sources: %s raw: %s" % [sources_json, data_json.left(160)])
		else:
			_set_result("Media Audio", "Audio sources failed: %s" % err))

	MiniGameSDK.video_decoder_operation_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Media Audio", "%s OK: %s raw: %s" % [action, ok, data_json.left(180)])
		else:
			_set_result("Media Audio", "%s failed: %s" % [action, err]))

	MiniGameSDK.video_decoder_event.connect(func(event_type: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Media Audio", "Decoder event %s: %s" % [event_type, data_json.left(160)])
		else:
			_set_result("Media Audio", "Decoder event %s failed: %s" % [event_type, err]))

	MiniGameSDK.media_audio_operation_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Media Audio", "%s OK: %s raw: %s" % [action, ok, data_json.left(180)])
		else:
			_set_result("Media Audio", "%s failed: %s" % [action, err]))

	MiniGameSDK.recorder_operation_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Recorder", "%s OK: %s raw: %s" % [action, ok, data_json.left(180)])
		else:
			_set_result("Recorder", "%s failed: %s" % [action, err]))

	MiniGameSDK.recorder_event.connect(func(event_type: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Recorder", "Event %s: %s" % [event_type, data_json.left(160)])
		else:
			_set_result("Recorder", "Event %s failed: %s raw: %s" % [event_type, err, data_json.left(120)]))

	MiniGameSDK.game_recorder_operation_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Game Recorder", "%s OK: %s raw: %s" % [action, ok, data_json.left(180)])
		else:
			_set_result("Game Recorder", "%s failed: %s" % [action, err]))

	MiniGameSDK.game_recorder_event.connect(func(event_type: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Game Recorder", "Event %s: %s" % [event_type, data_json.left(160)])
		else:
			_set_result("Game Recorder", "Event %s failed: %s raw: %s" % [event_type, err, data_json.left(120)]))

	MiniGameSDK.inner_audio_operation_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Inner Audio", "%s OK: %s raw: %s" % [action, ok, data_json.left(180)])
		else:
			_set_result("Inner Audio", "%s failed: %s" % [action, err]))

	MiniGameSDK.inner_audio_event.connect(func(event_type: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Inner Audio", "Event %s: %s" % [event_type, data_json.left(160)])
		else:
			_set_result("Inner Audio", "Event %s failed: %s raw: %s" % [event_type, err, data_json.left(120)]))

	MiniGameSDK.socket_operation_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("WebSocket", "%s OK: %s raw: %s" % [action, ok, data_json.left(140)])
		else:
			_set_result("WebSocket", "%s failed: %s" % [action, err]))

	MiniGameSDK.socket_opened.connect(func(data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("WebSocket", "Open: %s" % data_json.left(140))
		else:
			_set_result("WebSocket", "Open failed: %s" % err))

	MiniGameSDK.socket_message_received.connect(func(data: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("WebSocket", "Message: %s raw: %s" % [data.left(80), data_json.left(120)])
		else:
			_set_result("WebSocket", "Message failed: %s" % err))

	MiniGameSDK.socket_closed.connect(func(code: int, reason: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("WebSocket", "Closed %d %s raw: %s" % [code, reason, data_json.left(120)])
		else:
			_set_result("WebSocket", "Close event failed: %s" % err))

	MiniGameSDK.socket_error.connect(func(data_json: String, err: String) -> void:
		_set_result("WebSocket", "Error: %s raw: %s" % [err, data_json.left(120)]))

	MiniGameSDK.file_system_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("File System", "%s OK: %s raw: %s" % [action, ok, data_json.left(160)])
		else:
			_set_result("File System", "%s failed: %s" % [action, err]))

	MiniGameSDK.subpackage_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Subpackage", "%s OK: %s raw: %s" % [action, ok, data_json.left(160)])
		else:
			_set_result("Subpackage", "%s failed: %s" % [action, err]))

	MiniGameSDK.subpackage_progress.connect(func(action: String, progress: int, written: int, expected: int, data_json: String) -> void:
		_set_result("Subpackage", "%s %d%% %d/%d raw: %s" % [
			action,
			progress,
			written,
			expected,
			data_json.left(120),
		]))

	MiniGameSDK.worker_operation_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Worker", "%s OK: %s raw: %s" % [action, ok, data_json.left(160)])
		else:
			_set_result("Worker", "%s failed: %s" % [action, err]))

	MiniGameSDK.worker_message.connect(func(data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Worker", "Message: %s" % data_json.left(160))
		else:
			_set_result("Worker", "Message failed: %s" % err))

	MiniGameSDK.worker_error.connect(func(data_json: String, err: String) -> void:
		_set_result("Worker", "Error: %s raw: %s" % [err, data_json.left(120)]))

	MiniGameSDK.worker_process_killed.connect(func(data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Worker", "Process killed: %s" % data_json.left(160))
		else:
			_set_result("Worker", "Process killed event failed: %s" % err))

	MiniGameSDK.network_type_received.connect(func(network_type: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Network Status", "%s: %s" % [network_type, data_json.left(160)])
		else:
			_set_result("Network Status", "Network type failed: %s" % err))

	MiniGameSDK.network_status_changed.connect(func(is_connected: bool, network_type: String, data_json: String) -> void:
		_set_result("Network Status", "Connected: %s, type: %s, raw: %s" % [
			is_connected,
			network_type,
			data_json.left(120),
		]))

	MiniGameSDK.sensor_started.connect(func(sensor: String, ok: bool, err: String) -> void:
		var section := "Device Motion" if sensor == "deviceMotion" else "Sensors"
		_set_result(section, "Start %s OK: %s, err: %s" % [sensor, ok, err]))

	MiniGameSDK.sensor_stopped.connect(func(sensor: String, ok: bool, err: String) -> void:
		var section := "Device Motion" if sensor == "deviceMotion" else "Sensors"
		_set_result(section, "Stop %s OK: %s, err: %s" % [sensor, ok, err]))

	MiniGameSDK.accelerometer_changed.connect(func(x: float, y: float, z: float, data_json: String) -> void:
		_set_result("Sensors", "Accel x=%.3f y=%.3f z=%.3f raw=%s" % [
			x,
			y,
			z,
			data_json.left(100),
		]))

	MiniGameSDK.gyroscope_changed.connect(func(x: float, y: float, z: float, data_json: String) -> void:
		_set_result("Sensors", "Gyro x=%.3f y=%.3f z=%.3f raw=%s" % [
			x,
			y,
			z,
			data_json.left(100),
		]))

	MiniGameSDK.compass_changed.connect(func(direction: float, accuracy: Variant, data_json: String) -> void:
		_set_result("Sensors", "Compass %.1f accuracy=%s raw=%s" % [
			direction,
			str(accuracy),
			data_json.left(100),
		]))

	MiniGameSDK.device_motion_changed.connect(func(alpha: float, beta: float, gamma: float, data_json: String) -> void:
		_set_result("Device Motion", "alpha=%.3f beta=%.3f gamma=%.3f raw=%s" % [
			alpha,
			beta,
			gamma,
			data_json.left(100),
		]))

	MiniGameSDK.battery_info_received.connect(func(level: int, is_charging: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Battery", "Level %d%%, charging: %s, raw: %s" % [
				level,
				is_charging,
				data_json.left(120),
			])
		elif str(MiniGameSDK.bridge_info.get("platform", "")) == "tiktok":
			_set_result("Battery", "Battery unavailable on TikTok Native")
		else:
			_set_result("Battery", "Battery failed: %s" % err))

	MiniGameSDK.audio_interruption.connect(func(event_type: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Audio Events", "Audio interruption %s: %s" % [event_type, data_json.left(120)])
		else:
			_set_result("Audio Events", "Audio interruption listener failed: %s" % err))

	MiniGameSDK.theme_changed.connect(func(theme: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Theme / Performance", "Theme: %s raw: %s" % [theme, data_json.left(120)])
		else:
			_set_result("Theme / Performance", "Theme listener failed: %s" % err))

	MiniGameSDK.mini_program_navigation_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Mini Program Nav", "%s OK: %s raw: %s" % [action, ok, data_json.left(120)])
		else:
			_set_result("Mini Program Nav", "%s failed: %s" % [action, err]))

	MiniGameSDK.cloud_storage_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Cloud / Open Data", "%s OK: %s raw: %s" % [action, ok, data_json.left(160)])
		else:
			_set_result("Cloud / Open Data", "%s failed: %s" % [action, err]))

	MiniGameSDK.customer_service_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Service / Subscribe", "%s OK: %s raw: %s" % [action, ok, data_json.left(160)])
		else:
			_set_result("Service / Subscribe", "%s failed: %s" % [action, err]))

	MiniGameSDK.subscribe_message_result.connect(func(action: String, ok: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Service / Subscribe", "%s OK: %s raw: %s" % [action, ok, data_json.left(160)])
		else:
			_set_result("Service / Subscribe", "%s failed: %s" % [action, err]))

	MiniGameSDK.update_checked.connect(func(has_update: bool, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Update", "Has update: %s, raw: %s" % [has_update, data_json.left(120)])
		else:
			_set_result("Update", "Update listener failed: %s" % err))

	MiniGameSDK.update_ready.connect(func(err: String) -> void:
		if err.is_empty():
			_set_result("Update", "Update package ready. Tap Apply to restart.")
		else:
			_set_result("Update", "Update ready error: %s" % err))

	MiniGameSDK.update_failed.connect(func(err: String) -> void:
		_set_result("Update", "Update failed: %s" % err))

	MiniGameSDK.memory_warning.connect(func(level: int, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Memory", "Warning level: %d, raw: %s" % [level, data_json.left(120)])
		else:
			_set_result("Memory", "Memory listener failed: %s" % err))

	MiniGameSDK.window_resized.connect(func(width: int, height: int, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Window / Errors", "Window: %dx%d, raw: %s" % [width, height, data_json.left(120)])
		else:
			_set_result("Window / Errors", "Window listener failed: %s" % err))

	MiniGameSDK.unhandled_rejection.connect(func(reason: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Window / Errors", "Unhandled rejection: %s, raw: %s" % [reason.left(80), data_json.left(120)])
		else:
			_set_result("Window / Errors", "Unhandled rejection listener failed: %s" % err))

	MiniGameSDK.screen_brightness_received.connect(func(value: float, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Screen Brightness", "Brightness: %.2f raw: %s" % [value, data_json.left(120)])
		else:
			_set_result("Screen Brightness", "Get brightness failed: %s" % err))

	MiniGameSDK.screen_brightness_set.connect(func(value: float, ok: bool, err: String) -> void:
		_set_result("Screen Brightness", "Set %.2f OK: %s, err: %s" % [value, ok, err]))

	MiniGameSDK.user_capture_screen.connect(func(data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Capture / Recording", "Capture: %s" % data_json.left(160))
		else:
			_set_result("Capture / Recording", "Capture listener failed: %s" % err))

	MiniGameSDK.screen_recording_state_received.connect(func(state: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Capture / Recording", "Recording: %s raw: %s" % [state, data_json.left(120)])
		else:
			_set_result("Capture / Recording", "Recording state failed: %s" % err))

	MiniGameSDK.screen_recording_state_changed.connect(func(state: String, data_json: String, err: String) -> void:
		if err.is_empty():
			_set_result("Capture / Recording", "Recording changed: %s raw: %s" % [state, data_json.left(120)])
		else:
			_set_result("Capture / Recording", "Recording listener failed: %s" % err))

	MiniGameSDK.visual_effect_on_capture_set.connect(func(effect: String, ok: bool, err: String) -> void:
		_set_result("Capture / Recording", "Visual effect %s OK: %s, err: %s" % [effect, ok, err]))

	MiniGameSDK.clipboard_received.connect(func(data: String, err: String) -> void:
		if err.is_empty():
			_set_result("Clipboard", "Pasted: %s" % data)
		else:
			_set_result("Clipboard", "Paste err: %s" % err))

	MiniGameSDK.modal_result.connect(func(confirmed: bool) -> void:
		_set_result("Screen / UI", "Modal confirmed: %s" % confirmed))

	MiniGameSDK.generic_api_result.connect(func(api_name: String, ok: bool, _data_json: String, err: String) -> void:
		if api_name != "showModal" or ok:
			return
		if str(MiniGameSDK.bridge_info.get("platform", "")) == "tiktok":
			_set_result("Screen / UI", "Modal unavailable on TikTok Native")
		else:
			_set_result("Screen / UI", "Modal failed: %s" % err))

	MiniGameSDK.app_shown.connect(func(opts: String) -> void:
		_set_result("Lifecycle", "onShow: %s" % opts.left(100)))

	MiniGameSDK.app_hidden.connect(func() -> void:
		_set_result("Lifecycle", "onHide"))

	MiniGameSDK.app_error.connect(func(msg: String) -> void:
		_set_result("Lifecycle", "onError: %s" % msg.left(100)))


# ── Test callbacks ─────────────────────────────────────────────────

# Storage
func _test_storage_save() -> void:
	MiniGameSDK.storage_set("test_key", "hello_%d" % randi_range(0, 999))
	_set_result("Storage", "Saved test_key")


func _test_storage_load() -> void:
	var val := MiniGameSDK.storage_get("test_key", "(empty)")
	_set_result("Storage", "test_key = %s" % val)


func _test_storage_remove() -> void:
	MiniGameSDK.storage_remove("test_key")
	_set_result("Storage", "Removed test_key")


func _test_storage_clear() -> void:
	MiniGameSDK.storage_clear()
	_set_result("Storage", "Storage cleared")


func _test_storage_info() -> void:
	var info := MiniGameSDK.storage_info()
	if not bool(info.get("supported", true)):
		var platform := str(MiniGameSDK.bridge_info.get("platform", ""))
		var platform_name := "TikTok Native" if platform == "tiktok" else "this platform"
		_set_result("Storage", "Info unavailable on %s" % platform_name)
		return
	_set_result("Storage", "keys=%d size=%s" % [
		(info.get("keys", []) as Array).size(),
		info.get("currentSize", info.get("size", "?")),
	])


# Auth
func _test_login() -> void:
	_set_result("Auth / Login", "Logging in...")
	MiniGameSDK.login()


func _test_check_session() -> void:
	MiniGameSDK.check_session()


func _test_user_info() -> void:
	_set_result("Auth / Login", "Getting user info...")
	MiniGameSDK.get_user_info()


# Privacy
func _test_privacy_setting() -> void:
	_set_result("Privacy", "Reading privacy setting...")
	MiniGameSDK.get_privacy_setting()


func _test_privacy_listen() -> void:
	_set_result("Privacy", "Registering privacy listener...")
	MiniGameSDK.start_privacy_authorization_listener()


func _test_privacy_require() -> void:
	_set_result("Privacy", "Requesting privacy authorization...")
	MiniGameSDK.require_privacy_authorize()


func _test_privacy_contract() -> void:
	_set_result("Privacy", "Opening privacy contract...")
	MiniGameSDK.open_privacy_contract()


func _test_privacy_expose() -> void:
	_set_result("Privacy Resolve", "Exposure resolved: %s" % MiniGameSDK.expose_privacy_authorization())


func _test_privacy_agree() -> void:
	_set_result("Privacy Resolve", "Agree resolved: %s" % MiniGameSDK.agree_privacy_authorization("agree-btn"))


func _test_privacy_reject() -> void:
	_set_result("Privacy Resolve", "Reject resolved: %s" % MiniGameSDK.disagree_privacy_authorization())


# Settings / account
func _test_get_setting() -> void:
	_set_result("Settings / Account", "Reading setting...")
	MiniGameSDK.get_setting(true)


func _test_open_setting() -> void:
	_set_result("Settings / Account", "Opening setting...")
	MiniGameSDK.open_setting(false)


func _test_authorize_record() -> void:
	_set_result("Settings / Account", "Authorizing scope.record...")
	MiniGameSDK.authorize("scope.record")


func _test_account_info() -> void:
	var info := MiniGameSDK.get_account_info()
	_set_result("Settings / Account", str(info).left(200))


# Native buttons
func _test_native_user_button() -> void:
	_set_result("Native Buttons", "Creating UserInfoButton...")
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


func _test_native_setting_button() -> void:
	_set_result("Native Buttons", "Creating OpenSettingButton...")
	MiniGameSDK.create_open_setting_button({
		"type": "text",
		"text": "Settings",
		"style": {
			"left": 24,
			"top": 148,
			"width": 180,
			"height": 44,
			"lineHeight": 44,
			"backgroundColor": "#576b95",
			"color": "#ffffff",
			"textAlign": "center",
			"fontSize": 16,
			"borderRadius": 4,
		},
	})


func _test_native_game_club_button() -> void:
	_set_result("Native Buttons", "Creating GameClubButton...")
	MiniGameSDK.create_game_club_button({
		"type": "image",
		"icon": "green",
		"style": {
			"left": 224,
			"top": 96,
			"width": 44,
			"height": 44,
		},
	})


func _test_native_user_show() -> void:
	_set_result("Native Buttons", "Showing UserInfoButton...")
	MiniGameSDK.show_native_button("userInfo")


func _test_native_user_hide() -> void:
	_set_result("Native Buttons", "Hiding UserInfoButton...")
	MiniGameSDK.hide_native_button("userInfo")


func _test_native_user_off() -> void:
	_set_result("Native Buttons", "Removing UserInfoButton tap listener...")
	MiniGameSDK.stop_native_button_tap_listener("userInfo")


func _test_native_user_destroy() -> void:
	_set_result("Native Buttons", "Destroying UserInfoButton...")
	MiniGameSDK.destroy_native_button("userInfo")


func _test_native_setting_destroy() -> void:
	_set_result("Native Buttons", "Destroying OpenSettingButton...")
	MiniGameSDK.destroy_native_button("openSetting")


func _test_native_game_club_destroy() -> void:
	_set_result("Native Buttons", "Destroying GameClubButton...")
	MiniGameSDK.destroy_native_button("gameClub")


# Debug logging
func _test_enable_debug() -> void:
	_set_result("Debug Logging", "Enabling debug output...")
	MiniGameSDK.set_enable_debug(true)


func _test_log_manager() -> void:
	_set_result("Debug Logging", "Getting LogManager...")
	MiniGameSDK.get_log_manager(1)


func _test_log_manager_debug() -> void:
	_set_result("Debug Logging", "Writing LogManager.debug...")
	MiniGameSDK.log_manager_debug(["godot-debug", {"score": score, "time": Time.get_unix_time_from_system()}])


func _test_log_manager_info() -> void:
	_set_result("Debug Logging", "Writing LogManager.info...")
	MiniGameSDK.log_manager_info(["godot-info", {"scene": "main"}])


func _test_log_manager_warn() -> void:
	_set_result("Debug Logging", "Writing LogManager.warn...")
	MiniGameSDK.log_manager_warn(["godot-warn", {"reason": "manual-test"}])


func _test_realtime_log_manager() -> void:
	_set_result("Debug Logging", "Getting RealtimeLogManager...")
	MiniGameSDK.get_realtime_log_manager()


func _test_realtime_log_tag() -> void:
	_set_result("Debug Logging", "Setting realtime log tag...")
	MiniGameSDK.realtime_log_tag("godot-demo")


func _test_realtime_log_info() -> void:
	_set_result("Debug Logging", "Writing RealtimeLogManager.info...")
	MiniGameSDK.realtime_log_info(["godot-realtime-info", {"score": score}])


func _test_realtime_log_warn() -> void:
	_set_result("Debug Logging", "Writing RealtimeLogManager.warn...")
	MiniGameSDK.realtime_log_warn(["godot-realtime-warn", {"reason": "manual-test"}])


func _test_realtime_log_error() -> void:
	_set_result("Debug Logging", "Writing RealtimeLogManager.error...")
	MiniGameSDK.realtime_log_error(["godot-realtime-error", {"code": 500}])


func _test_realtime_log_filter() -> void:
	_set_result("Debug Logging", "Setting realtime log filter...")
	MiniGameSDK.realtime_log_set_filter_msg("godot-session")


func _test_realtime_log_add_filter() -> void:
	_set_result("Debug Logging", "Adding realtime log filter...")
	MiniGameSDK.realtime_log_add_filter_msg("godot-player")


# Share
func _test_share() -> void:
	MiniGameSDK.share_app("Come play this game!", "", "from=share")
	_set_result("Share", "shareAppMessage called")


func _test_show_share_menu() -> void:
	MiniGameSDK.show_share_menu()
	_set_result("Share", "Share menu shown")


func _test_hide_share_menu() -> void:
	MiniGameSDK.hide_share_menu()
	_set_result("Share", "Share menu hidden")


# Rewarded Ad
func _test_create_rewarded_ad() -> void:
	_set_result("Rewarded Ad", "Creating... (DevTools may show framework errors with test IDs)")
	MiniGameSDK.create_rewarded_ad("adunit-test-rewarded-001")


func _test_show_rewarded_ad() -> void:
	_set_result("Rewarded Ad", "Showing...")
	MiniGameSDK.show_rewarded_ad()


# Banner Ad
func _test_create_banner_ad() -> void:
	_set_result("Banner Ad", "Creating... (DevTools may show framework errors with test IDs)")
	MiniGameSDK.create_banner_ad("adunit-test-banner-001")


func _test_show_banner_ad() -> void:
	MiniGameSDK.show_banner_ad()
	_set_result("Banner Ad", "Shown")


func _test_hide_banner_ad() -> void:
	MiniGameSDK.hide_banner_ad()
	_set_result("Banner Ad", "Hidden")


# Interstitial Ad
func _test_create_interstitial_ad() -> void:
	_set_result("Interstitial Ad", "Creating... (DevTools may show framework errors with test IDs)")
	MiniGameSDK.create_interstitial_ad("adunit-test-interstitial-001")


func _test_show_interstitial_ad() -> void:
	_set_result("Interstitial Ad", "Showing...")
	MiniGameSDK.show_interstitial_ad()


# Payment
func _test_payment() -> void:
	_set_result("Payment", "Requesting...")
	MiniGameSDK.request_payment({
		"mode": "game",
		"env": 0,
		"offerId": "test_offer_001",
		"currencyType": "CNY",
		"buyQuantity": 10,
	})


# Vibration
func _test_vibrate_short() -> void:
	MiniGameSDK.vibrate_short("light")
	_set_result("Vibration", "Short (light)")


func _test_vibrate_medium() -> void:
	MiniGameSDK.vibrate_short("medium")
	_set_result("Vibration", "Short (medium)")


func _test_vibrate_long() -> void:
	MiniGameSDK.vibrate_long()
	_set_result("Vibration", "Long")


# Keyboard
func _test_show_keyboard() -> void:
	MiniGameSDK.show_keyboard("Hello", 50)
	_set_result("Keyboard", "Keyboard opened")


func _test_hide_keyboard() -> void:
	MiniGameSDK.hide_keyboard()
	_set_result("Keyboard", "Keyboard closed")


# Clipboard
func _test_clipboard_set() -> void:
	MiniGameSDK.set_clipboard("Hello from Godot! %d" % randi_range(0, 999))
	_set_result("Clipboard", "Copied to clipboard")


func _test_clipboard_get() -> void:
	MiniGameSDK.get_clipboard()
	_set_result("Clipboard", "Reading clipboard...")


# Media
func _test_media_choose() -> void:
	_set_result("Media", "Choosing media...")
	MiniGameSDK.choose_media(1, ["image"], ["album"], 10, ["compressed"])


func _test_media_choose_image() -> void:
	_set_result("Media", "Choosing image with legacy API...")
	MiniGameSDK.choose_image(1, ["compressed"], ["album"])


func _test_media_preview() -> void:
	_set_result("Media", "Previewing image...")
	MiniGameSDK.preview_image(["images/logo.png"])


func _test_media_save() -> void:
	_set_result("Media", "Saving image...")
	MiniGameSDK.save_image_to_photos_album("wxfile://usr/result.png")


func _test_media_compress() -> void:
	_set_result("Media", "Compressing image...")
	MiniGameSDK.compress_image("wxfile://usr/result.jpg", 80, 720)


# Camera
func _test_camera_create() -> void:
	_set_result("Camera", "Creating camera...")
	MiniGameSDK.create_camera(0, 0, 320, 240, "back", "auto", "small")


func _test_camera_photo() -> void:
	_set_result("Camera", "Taking photo...")
	MiniGameSDK.camera_take_photo("normal")


func _test_camera_start_record() -> void:
	_set_result("Camera", "Starting record...")
	MiniGameSDK.camera_start_record()


func _test_camera_stop_record() -> void:
	_set_result("Camera", "Stopping record...")
	MiniGameSDK.camera_stop_record(true)


func _test_camera_zoom() -> void:
	_set_result("Camera", "Setting zoom...")
	MiniGameSDK.camera_set_zoom(1.5)


func _test_camera_frames() -> void:
	_set_result("Camera", "Listening for camera frames...")
	MiniGameSDK.camera_listen_frame_change(false)


func _test_camera_frames_stop() -> void:
	_set_result("Camera", "Closing frame listener...")
	MiniGameSDK.camera_close_frame_change()


func _test_camera_destroy() -> void:
	_set_result("Camera", "Destroying camera...")
	MiniGameSDK.camera_destroy()


# Video
func _test_video_create() -> void:
	_set_result("Video", "Creating video...")
	var window_info := MiniGameSDK.get_window_info()
	var host_width := float(window_info.get("windowWidth", 408.0))
	if host_width <= 0.0:
		host_width = 408.0
	var video_width := minf(360.0, maxf(1.0, host_width - 48.0))
	var video_height := video_width * 220.0 / 360.0
	MiniGameSDK.create_video({
		"x": 24,
		"y": 120,
		"width": roundi(video_width),
		"height": roundi(video_height),
		"src": "video/intro.mp4",
		"poster": "images/poster.png",
		"objectFit": "contain",
		"controls": true,
		"autoplay": false,
		"loop": false,
		"muted": true,
		"showCenterPlayBtn": true,
	})


func _test_video_state() -> void:
	_set_result("Video", "Reading video state...")
	MiniGameSDK.get_video_state()


func _test_video_play() -> void:
	_set_result("Video", "Playing video...")
	MiniGameSDK.video_play()


func _test_video_pause() -> void:
	_set_result("Video", "Pausing video...")
	MiniGameSDK.video_pause()


func _test_video_seek() -> void:
	_set_result("Video", "Seeking video...")
	MiniGameSDK.video_seek(3.0)


func _test_video_stop() -> void:
	_set_result("Video", "Stopping video...")
	MiniGameSDK.video_stop()


func _test_video_fullscreen() -> void:
	_set_result("Video", "Requesting fullscreen...")
	MiniGameSDK.video_request_full_screen(90)


func _test_video_exit_fullscreen() -> void:
	_set_result("Video", "Exiting fullscreen...")
	MiniGameSDK.video_exit_full_screen()


func _test_video_off() -> void:
	_set_result("Video", "Removing video listeners...")
	MiniGameSDK.stop_video_listener(["play", "pause", "ended", "timeUpdate", "error", "waiting", "progress"])


func _test_video_destroy() -> void:
	_set_result("Video", "Destroying video...")
	MiniGameSDK.video_destroy()


# Media Audio
func _test_available_audio_sources() -> void:
	_set_result("Media Audio", "Reading audio sources...")
	MiniGameSDK.get_available_audio_sources()


func _test_video_decoder_create() -> void:
	_set_result("Media Audio", "Creating video decoder...")
	MiniGameSDK.create_video_decoder()


func _test_video_decoder_listen() -> void:
	_set_result("Media Audio", "Listening for decoder events...")
	MiniGameSDK.start_video_decoder_listener(["start", "stop", "seek", "bufferchange", "ended"])


func _test_video_decoder_start() -> void:
	_set_result("Media Audio", "Starting video decoder...")
	MiniGameSDK.video_decoder_start({
		"source": "video/intro.mp4",
		"mode": 1,
		"abortAudio": false,
		"abortVideo": false,
	})


func _test_video_decoder_frame() -> void:
	_set_result("Media Audio", "Reading next decoded frame...")
	MiniGameSDK.video_decoder_get_frame_data()


func _test_video_decoder_seek() -> void:
	_set_result("Media Audio", "Seeking video decoder...")
	MiniGameSDK.video_decoder_seek(2.0)


func _test_video_decoder_stop() -> void:
	_set_result("Media Audio", "Stopping video decoder...")
	MiniGameSDK.video_decoder_stop()


func _test_video_decoder_off() -> void:
	_set_result("Media Audio", "Removing decoder listeners...")
	MiniGameSDK.stop_video_decoder_listener(["start", "stop", "seek", "bufferchange", "ended"])


func _test_video_decoder_remove() -> void:
	_set_result("Media Audio", "Removing video decoder...")
	MiniGameSDK.video_decoder_remove()


func _test_media_audio_create() -> void:
	_set_result("Media Audio", "Creating media audio player...")
	MiniGameSDK.create_media_audio_player(0.75)


func _test_media_audio_add() -> void:
	_set_result("Media Audio", "Adding active VideoDecoder as audio source...")
	MiniGameSDK.media_audio_add_video_decoder_source()


func _test_media_audio_start() -> void:
	_set_result("Media Audio", "Starting media audio player...")
	MiniGameSDK.media_audio_start()


func _test_media_audio_volume() -> void:
	_set_result("Media Audio", "Setting media audio volume...")
	MiniGameSDK.set_media_audio_volume(0.5)


func _test_media_audio_remove() -> void:
	_set_result("Media Audio", "Removing active VideoDecoder audio source...")
	MiniGameSDK.media_audio_remove_video_decoder_source()


func _test_media_audio_stop() -> void:
	_set_result("Media Audio", "Stopping media audio player...")
	MiniGameSDK.media_audio_stop()


func _test_media_audio_destroy() -> void:
	_set_result("Media Audio", "Destroying media audio player...")
	MiniGameSDK.media_audio_destroy()


# Recorder
func _test_recorder_get() -> void:
	_set_result("Recorder", "Getting recorder manager...")
	MiniGameSDK.get_recorder_manager()


func _test_recorder_start() -> void:
	_set_result("Recorder", "Starting audio recording...")
	MiniGameSDK.recorder_start({
		"duration": 10000,
		"sampleRate": 44100,
		"numberOfChannels": 1,
		"encodeBitRate": 192000,
		"format": "mp3",
		"frameSize": 50,
		"audioSource": "auto",
	})


func _test_recorder_pause() -> void:
	_set_result("Recorder", "Pausing audio recording...")
	MiniGameSDK.recorder_pause()


func _test_recorder_resume() -> void:
	_set_result("Recorder", "Resuming audio recording...")
	MiniGameSDK.recorder_resume()


func _test_recorder_stop() -> void:
	_set_result("Recorder", "Stopping audio recording...")
	MiniGameSDK.recorder_stop()


# Game recorder
func _test_game_recorder_get() -> void:
	_set_result("Game Recorder", "Getting recorder...")
	MiniGameSDK.get_game_recorder()


func _test_game_recorder_listen() -> void:
	_set_result("Game Recorder", "Listening for recorder events...")
	MiniGameSDK.start_game_recorder_listener(["start", "stop", "pause", "resume", "abort", "timeUpdate", "error"])


func _test_game_recorder_start() -> void:
	_set_result("Game Recorder", "Starting recording...")
	MiniGameSDK.game_recorder_start({
		"fps": 24,
		"duration": 60,
		"bitrate": 1000,
		"gop": 12,
		"hookBgm": true,
	})


func _test_game_recorder_pause() -> void:
	_set_result("Game Recorder", "Pausing recording...")
	MiniGameSDK.game_recorder_pause()


func _test_game_recorder_resume() -> void:
	_set_result("Game Recorder", "Resuming recording...")
	MiniGameSDK.game_recorder_resume()


func _test_game_recorder_stop() -> void:
	_set_result("Game Recorder", "Stopping recording...")
	MiniGameSDK.game_recorder_stop()


func _test_game_recorder_abort() -> void:
	_set_result("Game Recorder", "Aborting recording...")
	MiniGameSDK.game_recorder_abort()


func _test_game_recorder_share() -> void:
	_set_result("Game Recorder", "Sharing latest replay...")
	MiniGameSDK.operate_game_recorder_video({
		"title": "Godot Replay",
		"desc": "Shared from Godot",
		"query": "from=replay",
		"timeRange": [[0, 3000]],
		"volume": 1,
		"atempo": 1,
	})


func _test_game_recorder_button() -> void:
	_set_result("Game Recorder", "Creating replay share button...")
	MiniGameSDK.create_game_recorder_share_button(
		{
			"left": 24,
			"top": 96,
			"height": 44,
			"text": "Share Replay",
		},
		{
			"bgm": "audio/bgm.mp3",
			"timeRange": [[0, 3000]],
			"volume": 1,
		})


func _test_game_recorder_button_show() -> void:
	_set_result("Game Recorder", "Showing replay share button...")
	MiniGameSDK.show_game_recorder_share_button()


func _test_game_recorder_button_hide() -> void:
	_set_result("Game Recorder", "Hiding replay share button...")
	MiniGameSDK.hide_game_recorder_share_button()


# Inner audio
func _test_inner_audio_option() -> void:
	_set_result("Inner Audio", "Setting global audio option...")
	MiniGameSDK.set_inner_audio_option({
		"mixWithOther": true,
		"obeyMuteSwitch": false,
		"speakerOn": true,
	})


func _test_inner_audio_create() -> void:
	_set_result("Inner Audio", "Creating inner audio context...")
	MiniGameSDK.create_inner_audio_context(
		{"useWebAudioImplement": false},
		{
			"src": DEMO_INNER_AUDIO_SRC,
			"loop": false,
			"autoplay": false,
			"volume": 0.8,
			"playbackRate": 1.0,
		})


func _test_inner_audio_state() -> void:
	_set_result("Inner Audio", "Reading audio state...")
	MiniGameSDK.get_inner_audio_state()


func _test_inner_audio_play() -> void:
	_set_result("Inner Audio", "Playing audio...")
	MiniGameSDK.inner_audio_play()


func _test_inner_audio_pause() -> void:
	_set_result("Inner Audio", "Pausing audio...")
	MiniGameSDK.inner_audio_pause()


func _test_inner_audio_seek() -> void:
	_set_result("Inner Audio", "Seeking audio...")
	MiniGameSDK.inner_audio_seek(2.0)


func _test_inner_audio_stop() -> void:
	_set_result("Inner Audio", "Stopping audio...")
	MiniGameSDK.inner_audio_stop()


func _test_inner_audio_off() -> void:
	_set_result("Inner Audio", "Removing audio listeners...")
	MiniGameSDK.stop_inner_audio_listener(["play", "pause", "stop", "timeUpdate", "error", "seeking", "seeked"])


func _test_inner_audio_destroy() -> void:
	_set_result("Inner Audio", "Destroying audio context...")
	MiniGameSDK.inner_audio_destroy()


# Network
func _test_http_get() -> void:
	_set_result("Network", "Requesting...")
	MiniGameSDK.http_request("https://httpbin.org/get", "GET")


# File transfer
func _test_download_file() -> void:
	_set_result("File Transfer", "Downloading...")
	MiniGameSDK.download_file("https://example.com/test.bin", "wxfile://usr/test.bin")


func _test_upload_file() -> void:
	_set_result("File Transfer", "Uploading...")
	MiniGameSDK.upload_file(
		"https://example.com/upload",
		"wxfile://usr/test.bin",
		"file",
		{"from": "godot"})


# File system
func _test_file_system_write() -> void:
	_set_result("File System", "Writing...")
	MiniGameSDK.file_system_write_file(
		"wxfile://usr/godot_save.json",
		JSON.stringify({"score": score, "savedAt": Time.get_unix_time_from_system()}))


func _test_file_system_read() -> void:
	_set_result("File System", "Reading...")
	MiniGameSDK.file_system_read_file("wxfile://usr/godot_save.json")


func _test_file_system_mkdir() -> void:
	_set_result("File System", "Creating directory...")
	MiniGameSDK.file_system_mkdir("wxfile://usr/godot_demo", true)


func _test_file_system_list() -> void:
	_set_result("File System", "Listing...")
	MiniGameSDK.file_system_readdir("wxfile://usr")


func _test_file_system_stat() -> void:
	_set_result("File System", "Reading stat...")
	MiniGameSDK.file_system_stat("wxfile://usr/godot_save.json")


func _test_file_system_delete() -> void:
	_set_result("File System", "Deleting...")
	MiniGameSDK.file_system_unlink("wxfile://usr/godot_save.json")


# Subpackage
func _test_subpackage_load() -> void:
	_set_result("Subpackage", "Loading subpackage...")
	MiniGameSDK.load_subpackage("demo")


func _test_subpackage_preload() -> void:
	_set_result("Subpackage", "Pre-downloading subpackage...")
	MiniGameSDK.pre_download_subpackage("demo", "normal")


# Worker
func _test_worker_create() -> void:
	_set_result("Worker", "Creating worker...")
	MiniGameSDK.create_worker("js/worker/position_reporting.js")


func _test_worker_post() -> void:
	_set_result("Worker", "Posting worker message...")
	MiniGameSDK.worker_post_message({
		"type": "process",
		"inputLength": 1024,
		"currentTime": 0.2,
	})


func _test_worker_stop() -> void:
	_set_result("Worker", "Terminating worker...")
	MiniGameSDK.worker_terminate()


# WebSocket
func _test_socket_connect() -> void:
	_set_result("WebSocket", "Connecting...")
	MiniGameSDK.connect_socket("wss://echo.websocket.events", {}, [], true)


func _test_socket_send() -> void:
	_set_result("WebSocket", "Sending...")
	MiniGameSDK.send_socket_message("hello from godot")


func _test_socket_close() -> void:
	_set_result("WebSocket", "Closing...")
	MiniGameSDK.close_socket(1000, "demo close")


# Network status
func _test_network_type() -> void:
	_set_result("Network Status", "Reading network type...")
	MiniGameSDK.get_network_type()


func _test_network_listen() -> void:
	MiniGameSDK.start_network_status_listener()
	_set_result("Network Status", "Listening for network changes...")


func _test_network_stop() -> void:
	_set_result("Network Status", "Stopped: %s" % MiniGameSDK.stop_network_status_listener())


# Sensors
func _test_accelerometer_start() -> void:
	MiniGameSDK.start_accelerometer("game")
	_set_result("Sensors", "Starting accelerometer...")


func _test_accelerometer_stop() -> void:
	MiniGameSDK.stop_accelerometer()
	_set_result("Sensors", "Stopping accelerometer...")


func _test_gyroscope_start() -> void:
	MiniGameSDK.start_gyroscope("game")
	_set_result("Sensors", "Starting gyroscope...")


func _test_gyroscope_stop() -> void:
	MiniGameSDK.stop_gyroscope()
	_set_result("Sensors", "Stopping gyroscope...")


func _test_compass_start() -> void:
	MiniGameSDK.start_compass()
	_set_result("Sensors", "Starting compass...")


func _test_compass_stop() -> void:
	MiniGameSDK.stop_compass()
	_set_result("Sensors", "Stopping compass...")


func _test_device_motion_start() -> void:
	MiniGameSDK.start_device_motion_listening("game")
	_set_result("Device Motion", "Starting device motion...")


func _test_device_motion_stop() -> void:
	MiniGameSDK.stop_device_motion_listening()
	_set_result("Device Motion", "Stopping device motion...")


# Battery
func _test_battery_info() -> void:
	_set_result("Battery", "Reading battery info...")
	MiniGameSDK.get_battery_info()


func _test_battery_info_sync() -> void:
	var info := MiniGameSDK.get_battery_info_sync()
	if not bool(info.get("supported", true)):
		var platform := str(MiniGameSDK.bridge_info.get("platform", ""))
		var platform_name := "TikTok Native" if platform == "tiktok" else "this platform"
		_set_result("Battery", "Battery unavailable on %s" % platform_name)
		return
	_set_result("Battery", str(info).left(180))


# Audio interruption
func _test_audio_interruption_listen() -> void:
	_set_result("Audio Events", "Registering audio interruption listener...")
	MiniGameSDK.start_audio_interruption_listener()


func _test_audio_interruption_stop() -> void:
	_set_result("Audio Events", "Stopped: %s" % MiniGameSDK.stop_audio_interruption_listener())


# Theme / performance
func _test_theme_listen() -> void:
	_set_result("Theme / Performance", "Registering theme listener...")
	MiniGameSDK.start_theme_change_listener()


func _test_theme_stop() -> void:
	_set_result("Theme / Performance", "Theme stopped: %s" % MiniGameSDK.stop_theme_change_listener())


func _test_performance_entries() -> void:
	var entries := MiniGameSDK.get_performance_entries()
	_set_result("Theme / Performance", "Performance entries: %d %s" % [entries.size(), str(entries).left(160)])


func _test_report_performance() -> void:
	var ok := MiniGameSDK.report_performance(1101, 1.0, ["godot", "manual"])
	_set_result("Theme / Performance", "Report performance OK: %s" % ok)


# Mini Program navigation
func _test_navigate_to_mini_program() -> void:
	_set_result("Mini Program Nav", "Calling navigateToMiniProgram...")
	MiniGameSDK.navigate_to_mini_program("wx0000000000000000", "?from=godot", {"from": "godot"}, "release")


func _test_navigate_back_mini_program() -> void:
	_set_result("Mini Program Nav", "Calling navigateBackMiniProgram...")
	MiniGameSDK.navigate_back_mini_program({"from": "godot"})


func _test_exit_mini_program() -> void:
	_set_result("Mini Program Nav", "Calling exitMiniProgram...")
	MiniGameSDK.exit_mini_program()


func _test_restart_mini_program() -> void:
	_set_result("Mini Program Nav", "Calling restartMiniProgram...")
	MiniGameSDK.restart_mini_program("?from=restart")


# Cloud storage / open data
func _test_cloud_storage_set() -> void:
	_set_result("Cloud / Open Data", "Writing cloud score...")
	MiniGameSDK.set_user_cloud_storage({"score": randi_range(0, 9999), "season": "demo"})


func _test_cloud_storage_remove() -> void:
	_set_result("Cloud / Open Data", "Removing cloud score...")
	MiniGameSDK.remove_user_cloud_storage(["score", "season"])


func _test_cloud_storage_keys() -> void:
	_set_result("Cloud / Open Data", "Reading cloud keys...")
	MiniGameSDK.get_user_cloud_storage_keys()


func _test_cloud_storage_user() -> void:
	_set_result("Cloud / Open Data", "Reading user cloud data...")
	MiniGameSDK.get_user_cloud_storage(["score", "season"])


func _test_cloud_storage_friend() -> void:
	_set_result("Cloud / Open Data", "Reading friend cloud data...")
	MiniGameSDK.get_friend_cloud_storage(["score", "season"])


func _test_cloud_storage_group() -> void:
	_set_result("Cloud / Open Data", "Reading group cloud data...")
	MiniGameSDK.get_group_cloud_storage(["score", "season"])


func _test_open_data_post() -> void:
	var ok := MiniGameSDK.post_open_data_context_message({"type": "rank", "season": "demo"}, "offscreenCanvas")
	_set_result("Cloud / Open Data", "Posted to open data context: %s" % ok)


# Customer service / subscribe message
func _test_customer_service() -> void:
	_set_result("Service / Subscribe", "Opening customer service conversation...")
	MiniGameSDK.open_customer_service_conversation(
		"godot-demo",
		true,
		"Godot Mini Game",
		"?from=customer-service",
		"")


func _test_subscribe_message() -> void:
	_set_result("Service / Subscribe", "Requesting subscribe message...")
	MiniGameSDK.request_subscribe_message(["tmpl_demo_id"])


func _test_subscribe_system_message() -> void:
	_set_result("Service / Subscribe", "Requesting system subscribe message...")
	MiniGameSDK.request_subscribe_system_message(["SYS_MSG_TYPE_RANK"])


# Update manager
func _test_update_listen() -> void:
	_set_result("Update", "Registering update listener...")
	MiniGameSDK.start_update_listener()


func _test_update_apply() -> void:
	_set_result("Update", "Apply update called: %s" % MiniGameSDK.apply_update())


# Memory warning
func _test_memory_listen() -> void:
	_set_result("Memory", "Registering memory warning listener...")
	MiniGameSDK.start_memory_warning_listener()


func _test_memory_stop() -> void:
	_set_result("Memory", "Stopped: %s" % MiniGameSDK.stop_memory_warning_listener())


# Window / runtime errors
func _test_window_resize_listen() -> void:
	_set_result("Window / Errors", "Registering window resize listener...")
	MiniGameSDK.start_window_resize_listener()


func _test_window_resize_stop() -> void:
	_set_result("Window / Errors", "Resize stopped: %s" % MiniGameSDK.stop_window_resize_listener())


func _test_unhandled_rejection_listen() -> void:
	_set_result("Window / Errors", "Registering unhandled rejection listener...")
	MiniGameSDK.start_unhandled_rejection_listener()


func _test_unhandled_rejection_stop() -> void:
	_set_result("Window / Errors", "Reject stopped: %s" % MiniGameSDK.stop_unhandled_rejection_listener())


# Screen brightness
func _test_screen_brightness_get() -> void:
	_set_result("Screen Brightness", "Reading brightness...")
	MiniGameSDK.get_screen_brightness()


func _test_screen_brightness_set() -> void:
	_set_result("Screen Brightness", "Setting brightness to 0.5...")
	MiniGameSDK.set_screen_brightness(0.5)


func _test_screen_brightness_system() -> void:
	_set_result("Screen Brightness", "Setting Android brightness to follow system...")
	MiniGameSDK.set_screen_brightness(-1.0)


# Capture / recording
func _test_capture_listen() -> void:
	_set_result("Capture / Recording", "Registering capture listener...")
	MiniGameSDK.start_user_capture_screen_listener()


func _test_capture_stop() -> void:
	_set_result("Capture / Recording", "Capture stopped: %s" % MiniGameSDK.stop_user_capture_screen_listener())


func _test_recording_state() -> void:
	_set_result("Capture / Recording", "Reading recording state...")
	MiniGameSDK.get_screen_recording_state()


func _test_recording_listen() -> void:
	_set_result("Capture / Recording", "Registering recording listener...")
	MiniGameSDK.start_screen_recording_state_listener()


func _test_recording_stop() -> void:
	_set_result("Capture / Recording", "Recording stopped: %s" % MiniGameSDK.stop_screen_recording_state_listener())


func _test_visual_effect_hidden() -> void:
	_set_result("Capture / Recording", "Hiding capture/recording output...")
	MiniGameSDK.set_visual_effect_on_capture("hidden")


# System
func _test_can_i_use() -> void:
	_set_result("System", "getAppBaseInfo.return.SDKVersion: %s" % MiniGameSDK.can_i_use("getAppBaseInfo.return.SDKVersion"))


func _test_device_info() -> void:
	var info := MiniGameSDK.get_device_info()
	_set_result("System", "device=%s %s platform=%s system=%s" % [
		info.get("brand", "?"),
		info.get("model", "?"),
		info.get("platform", "?"),
		info.get("system", "?"),
	])


func _test_app_base_info() -> void:
	var info := MiniGameSDK.get_app_base_info()
	_set_result("System", "SDK=%s WeChat=%s lang=%s debug=%s" % [
		info.get("SDKVersion", "?"),
		info.get("version", "?"),
		info.get("language", "?"),
		info.get("enableDebug", "?"),
	])


func _test_system_setting() -> void:
	var info := MiniGameSDK.get_system_setting()
	_set_result("System", "wifi=%s bluetooth=%s location=%s orientation=%s" % [
		info.get("wifiEnabled", "?"),
		info.get("bluetoothEnabled", "?"),
		info.get("locationEnabled", "?"),
		info.get("deviceOrientation", "?"),
	])


func _test_app_authorize_setting() -> void:
	var info := MiniGameSDK.get_app_authorize_setting()
	_set_result("System", "camera=%s mic=%s location=%s album=%s" % [
		info.get("cameraAuthorized", "?"),
		info.get("microphoneAuthorized", "?"),
		info.get("locationAuthorized", "?"),
		info.get("albumAuthorized", "?"),
	])


func _test_system_info() -> void:
	var info := MiniGameSDK.get_system_info()
	_set_result("System", "brand=%s model=%s system=%s" % [
		info.get("brand", "?"), info.get("model", "?"), info.get("system", "?")])


func _test_launch_options() -> void:
	var opts := MiniGameSDK.get_launch_options()
	_set_result("System", str(opts).left(200))


func _test_window_info() -> void:
	var info := MiniGameSDK.get_window_info()
	_set_result("System", "%sx%s @%.1fx" % [
		info.get("windowWidth", 0), info.get("windowHeight", 0),
		float(info.get("pixelRatio", 1.0))])


func _test_menu_rect() -> void:
	var r := MiniGameSDK.get_menu_button_rect()
	_set_result("System", "Menu: x=%s y=%s w=%s h=%s" % [
		r.get("left", "?"), r.get("top", "?"), r.get("width", "?"), r.get("height", "?")])


# Screen / UI
func _test_keep_screen_on() -> void:
	MiniGameSDK.set_keep_screen_on(true)
	_set_result("Screen / UI", "Keep screen on: true")


func _test_toast() -> void:
	MiniGameSDK.show_toast("Hello from Godot!", "success", 2000)
	_set_result("Screen / UI", "Toast shown")


func _test_modal() -> void:
	_set_result("Screen / UI", "Modal shown, waiting...")
	MiniGameSDK.show_modal("Confirm", "Do you like Godot?")


func _test_show_loading() -> void:
	MiniGameSDK.show_loading("Loading...")
	_set_result("Screen / UI", "Loading overlay shown; hiding automatically...")
	await get_tree().create_timer(DEMO_LOADING_AUTO_HIDE_SECONDS).timeout
	MiniGameSDK.hide_loading()
	_set_result("Screen / UI", "Loading overlay hidden automatically")


func _test_hide_loading() -> void:
	MiniGameSDK.hide_loading()
	_set_result("Screen / UI", "Loading overlay hidden")
