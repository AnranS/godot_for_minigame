extends SceneTree

const MiniGameSDKScript = preload("res://addons/godot_mini_game/MiniGameSDK.gd")

var _failed := false


func _assert_eq(actual: Variant, expected: Variant, message: String) -> void:
	if actual != expected:
		push_error("%s: expected %s, got %s" % [message, str(expected), str(actual)])
		_failed = true


func _init() -> void:
	var sdk := MiniGameSDKScript.new()
	_assert_eq(MiniGameSDKScript.BRIDGE_ABI_VERSION, 1, "Bridge ABI contract")
	_assert_eq(
		MiniGameSDKScript.BRIDGE_GLOBAL_NAME,
		"godotMiniGameBridgeV1",
		"Versioned Bridge global")
	_assert_eq(sdk.bridge_initialization_error, "", "Bridge error should start empty")
	var valid_bridge_info := {
		"brand": MiniGameSDKScript.BRIDGE_BRAND,
		"globalName": MiniGameSDKScript.BRIDGE_GLOBAL_NAME,
		"abiVersion": MiniGameSDKScript.BRIDGE_ABI_VERSION,
	}
	_assert_eq(
		MiniGameSDKScript._bridge_validation_error(
			{"ok": true, "error": ""}, valid_bridge_info),
		"",
		"A matching Bridge identity should validate",
	)
	var identity_error := MiniGameSDKScript._bridge_validation_error(
		{"ok": true, "error": ""},
		{
			"brand": "wrong-brand",
			"globalName": MiniGameSDKScript.BRIDGE_GLOBAL_NAME,
			"abiVersion": MiniGameSDKScript.BRIDGE_ABI_VERSION,
		},
	)
	_assert_eq(
		identity_error.begins_with("Bridge identity is incompatible:"),
		true,
		"Identity mismatches must produce a diagnostic error",
	)
	_assert_eq(
		MiniGameSDKScript._bridge_validation_error(
			{"ok": false, "error": "missing method"}, valid_bridge_info),
		"missing method",
		"Bridge validation errors should be preserved",
	)
	var holder := {
		"generic": [],
		"privacy_setting": [],
		"privacy_authorize": [],
		"privacy_contract": [],
		"privacy_needed": [],
		"setting": [],
		"setting_opened": [],
		"authorization": [],
		"native_button_operation": [],
		"native_button_tap": [],
		"debug_operation": [],
		"network_type": [],
		"network_status": [],
		"sensor_started": [],
		"sensor_stopped": [],
		"accelerometer": [],
		"gyroscope": [],
		"compass": [],
		"device_motion": [],
		"battery": [],
		"audio_interruption": [],
		"theme_changed": [],
		"mini_program_navigation": [],
		"cloud_storage": [],
		"file_transfer": [],
		"socket_operation": [],
		"socket_open": [],
		"socket_message": [],
		"socket_close": [],
		"socket_error": [],
		"file_system": [],
		"subpackage": [],
		"subpackage_progress": [],
		"worker_operation": [],
		"worker_message": [],
		"worker_error": [],
		"worker_process_killed": [],
		"media": [],
		"camera_operation": [],
		"camera_frame": [],
		"camera_event": [],
		"video_operation": [],
		"video_event": [],
		"recorder_operation": [],
		"recorder_event": [],
		"available_audio_sources": [],
		"video_decoder_operation": [],
		"video_decoder_event": [],
		"media_audio_operation": [],
		"game_recorder_operation": [],
		"game_recorder_event": [],
		"inner_audio_operation": [],
		"inner_audio_event": [],
		"customer_service": [],
		"subscribe_message": [],
		"update_checked": [],
		"update_ready": [],
		"update_failed": [],
		"memory_warning": [],
		"window_resized": [],
		"unhandled_rejection": [],
		"screen_brightness": [],
		"screen_brightness_set": [],
		"user_capture_screen": [],
		"screen_recording_state": [],
		"screen_recording_changed": [],
		"visual_effect": [],
		"modal_result": [],
	}
	sdk.generic_api_result.connect(func(api_name: String, success: bool, data_json: String, error: String) -> void:
		holder["generic"] = [api_name, success, data_json, error]
	)
	sdk.privacy_setting_received.connect(func(need_authorization: bool, privacy_contract_name: String, data_json: String, error: String) -> void:
		holder["privacy_setting"] = [need_authorization, privacy_contract_name, data_json, error]
	)
	sdk.privacy_authorize_result.connect(func(success: bool, error: String) -> void:
		holder["privacy_authorize"] = [success, error]
	)
	sdk.privacy_contract_opened.connect(func(success: bool, error: String) -> void:
		holder["privacy_contract"] = [success, error]
	)
	sdk.privacy_authorization_needed.connect(func(event_info_json: String, error: String) -> void:
		holder["privacy_needed"] = [event_info_json, error]
	)
	sdk.setting_received.connect(func(settings_json: String, error: String) -> void:
		holder["setting"] = [settings_json, error]
	)
	sdk.setting_opened.connect(func(settings_json: String, error: String) -> void:
		holder["setting_opened"] = [settings_json, error]
	)
	sdk.authorization_result.connect(func(scope: String, success: bool, error: String) -> void:
		holder["authorization"] = [scope, success, error]
	)
	sdk.native_button_operation_result.connect(func(button_type: String, action: String, success: bool, data_json: String, error: String) -> void:
		holder["native_button_operation"] = [button_type, action, success, data_json, error]
	)
	sdk.native_button_tapped.connect(func(button_type: String, data_json: String, error: String) -> void:
		holder["native_button_tap"] = [button_type, data_json, error]
	)
	sdk.debug_operation_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["debug_operation"] = [action, success, data_json, error]
	)
	sdk.network_type_received.connect(func(network_type: String, data_json: String, error: String) -> void:
		holder["network_type"] = [network_type, data_json, error]
	)
	sdk.network_status_changed.connect(func(is_connected: bool, network_type: String, data_json: String) -> void:
		holder["network_status"] = [is_connected, network_type, data_json]
	)
	sdk.sensor_started.connect(func(sensor: String, success: bool, error: String) -> void:
		holder["sensor_started"] = [sensor, success, error]
	)
	sdk.sensor_stopped.connect(func(sensor: String, success: bool, error: String) -> void:
		holder["sensor_stopped"] = [sensor, success, error]
	)
	sdk.accelerometer_changed.connect(func(x: float, y: float, z: float, data_json: String) -> void:
		holder["accelerometer"] = [x, y, z, data_json]
	)
	sdk.gyroscope_changed.connect(func(x: float, y: float, z: float, data_json: String) -> void:
		holder["gyroscope"] = [x, y, z, data_json]
	)
	sdk.compass_changed.connect(func(direction: float, accuracy: Variant, data_json: String) -> void:
		holder["compass"] = [direction, accuracy, data_json]
	)
	sdk.device_motion_changed.connect(func(alpha: float, beta: float, gamma: float, data_json: String) -> void:
		holder["device_motion"] = [alpha, beta, gamma, data_json]
	)
	sdk.battery_info_received.connect(func(level: int, is_charging: bool, data_json: String, error: String) -> void:
		holder["battery"] = [level, is_charging, data_json, error]
	)
	sdk.audio_interruption.connect(func(event_type: String, data_json: String, error: String) -> void:
		holder["audio_interruption"] = [event_type, data_json, error]
	)
	sdk.theme_changed.connect(func(theme: String, data_json: String, error: String) -> void:
		holder["theme_changed"] = [theme, data_json, error]
	)
	sdk.mini_program_navigation_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["mini_program_navigation"] = [action, success, data_json, error]
	)
	sdk.cloud_storage_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["cloud_storage"] = [action, success, data_json, error]
	)
	sdk.file_transfer_result.connect(func(action: String, success: bool, status_code: int, data_json: String, error: String) -> void:
		holder["file_transfer"] = [action, success, status_code, data_json, error]
	)
	sdk.socket_operation_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["socket_operation"] = [action, success, data_json, error]
	)
	sdk.socket_opened.connect(func(data_json: String, error: String) -> void:
		holder["socket_open"] = [data_json, error]
	)
	sdk.socket_message_received.connect(func(data: String, data_json: String, error: String) -> void:
		holder["socket_message"] = [data, data_json, error]
	)
	sdk.socket_closed.connect(func(code: int, reason: String, data_json: String, error: String) -> void:
		holder["socket_close"] = [code, reason, data_json, error]
	)
	sdk.socket_error.connect(func(data_json: String, error: String) -> void:
		holder["socket_error"] = [data_json, error]
	)
	sdk.file_system_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["file_system"] = [action, success, data_json, error]
	)
	sdk.subpackage_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["subpackage"] = [action, success, data_json, error]
	)
	sdk.subpackage_progress.connect(func(action: String, progress: int, total_bytes_written: int, total_bytes_expected: int, data_json: String) -> void:
		holder["subpackage_progress"] = [action, progress, total_bytes_written, total_bytes_expected, data_json]
	)
	sdk.worker_operation_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["worker_operation"] = [action, success, data_json, error]
	)
	sdk.worker_message.connect(func(data_json: String, error: String) -> void:
		holder["worker_message"] = [data_json, error]
	)
	sdk.worker_error.connect(func(data_json: String, error: String) -> void:
		holder["worker_error"] = [data_json, error]
	)
	sdk.worker_process_killed.connect(func(data_json: String, error: String) -> void:
		holder["worker_process_killed"] = [data_json, error]
	)
	sdk.media_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["media"] = [action, success, data_json, error]
	)
	sdk.camera_operation_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["camera_operation"] = [action, success, data_json, error]
	)
	sdk.camera_frame.connect(func(data_json: String, error: String) -> void:
		holder["camera_frame"] = [data_json, error]
	)
	sdk.camera_event.connect(func(event_type: String, data_json: String, error: String) -> void:
		holder["camera_event"] = [event_type, data_json, error]
	)
	sdk.video_operation_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["video_operation"] = [action, success, data_json, error]
	)
	sdk.video_event.connect(func(event_type: String, data_json: String, error: String) -> void:
		holder["video_event"] = [event_type, data_json, error]
	)
	sdk.recorder_operation_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["recorder_operation"] = [action, success, data_json, error]
	)
	sdk.recorder_event.connect(func(event_type: String, data_json: String, error: String) -> void:
		holder["recorder_event"] = [event_type, data_json, error]
	)
	sdk.available_audio_sources_received.connect(func(sources_json: String, data_json: String, error: String) -> void:
		holder["available_audio_sources"] = [sources_json, data_json, error]
	)
	sdk.video_decoder_operation_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["video_decoder_operation"] = [action, success, data_json, error]
	)
	sdk.video_decoder_event.connect(func(event_type: String, data_json: String, error: String) -> void:
		holder["video_decoder_event"] = [event_type, data_json, error]
	)
	sdk.media_audio_operation_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["media_audio_operation"] = [action, success, data_json, error]
	)
	sdk.game_recorder_operation_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["game_recorder_operation"] = [action, success, data_json, error]
	)
	sdk.game_recorder_event.connect(func(event_type: String, data_json: String, error: String) -> void:
		holder["game_recorder_event"] = [event_type, data_json, error]
	)
	sdk.inner_audio_operation_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["inner_audio_operation"] = [action, success, data_json, error]
	)
	sdk.inner_audio_event.connect(func(event_type: String, data_json: String, error: String) -> void:
		holder["inner_audio_event"] = [event_type, data_json, error]
	)
	sdk.customer_service_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["customer_service"] = [action, success, data_json, error]
	)
	sdk.subscribe_message_result.connect(func(action: String, success: bool, data_json: String, error: String) -> void:
		holder["subscribe_message"] = [action, success, data_json, error]
	)
	sdk.update_checked.connect(func(has_update: bool, data_json: String, error: String) -> void:
		holder["update_checked"] = [has_update, data_json, error]
	)
	sdk.update_ready.connect(func(error: String) -> void:
		holder["update_ready"] = [error]
	)
	sdk.update_failed.connect(func(error: String) -> void:
		holder["update_failed"] = [error]
	)
	sdk.memory_warning.connect(func(level: int, data_json: String, error: String) -> void:
		holder["memory_warning"] = [level, data_json, error]
	)
	sdk.window_resized.connect(func(width: int, height: int, data_json: String, error: String) -> void:
		holder["window_resized"] = [width, height, data_json, error]
	)
	sdk.unhandled_rejection.connect(func(reason: String, data_json: String, error: String) -> void:
		holder["unhandled_rejection"] = [reason, data_json, error]
	)
	sdk.screen_brightness_received.connect(func(value: float, data_json: String, error: String) -> void:
		holder["screen_brightness"] = [value, data_json, error]
	)
	sdk.screen_brightness_set.connect(func(value: float, success: bool, error: String) -> void:
		holder["screen_brightness_set"] = [value, success, error]
	)
	sdk.user_capture_screen.connect(func(data_json: String, error: String) -> void:
		holder["user_capture_screen"] = [data_json, error]
	)
	sdk.screen_recording_state_received.connect(func(state: String, data_json: String, error: String) -> void:
		holder["screen_recording_state"] = [state, data_json, error]
	)
	sdk.screen_recording_state_changed.connect(func(state: String, data_json: String, error: String) -> void:
		holder["screen_recording_changed"] = [state, data_json, error]
	)
	sdk.visual_effect_on_capture_set.connect(func(effect: String, success: bool, error: String) -> void:
		holder["visual_effect"] = [effect, success, error]
	)
	sdk.modal_result.connect(func(confirmed: bool) -> void:
		holder["modal_result"] = [confirmed]
	)

	sdk.show_modal("Confirm", "Continue?")
	_assert_eq(holder["modal_result"], [false], "show_modal fallback result")
	_assert_eq(
		holder["generic"],
		["showModal", false, "", MiniGameSDKScript.NOT_IN_RUNTIME],
		"show_modal fallback error",
	)
	sdk._on_modal([true, false, ""])
	_assert_eq(holder["modal_result"], [true], "modal success callback conversion")
	sdk._on_modal([false, false, "showModal unavailable"])
	_assert_eq(holder["modal_result"], [false], "modal error result conversion")
	_assert_eq(
		holder["generic"],
		["showModal", false, "", "showModal unavailable"],
		"modal error callback conversion",
	)

	sdk.call_api("setClipboardData", {"data": "hello"})

	var received: Array = holder["generic"]
	_assert_eq(received.size(), 4, "call_api should emit exactly one fallback result")
	if received.size() == 4:
		_assert_eq(received[0], "setClipboardData", "fallback api name")
		_assert_eq(received[1], false, "fallback success")
		_assert_eq(received[2], "", "fallback data")
		_assert_eq(received[3], MiniGameSDKScript.NOT_IN_RUNTIME, "fallback error")

	sdk.get_privacy_setting()
	var privacy_setting: Array = holder["privacy_setting"]
	_assert_eq(privacy_setting.size(), 4, "get_privacy_setting should emit fallback")
	if privacy_setting.size() == 4:
		_assert_eq(privacy_setting[0], false, "privacy fallback need_authorization")
		_assert_eq(privacy_setting[1], "", "privacy fallback contract name")
		_assert_eq(privacy_setting[2], "", "privacy fallback data")
		_assert_eq(privacy_setting[3], MiniGameSDKScript.NOT_IN_RUNTIME, "privacy fallback error")

	sdk.require_privacy_authorize()
	var privacy_authorize: Array = holder["privacy_authorize"]
	_assert_eq(privacy_authorize, [false, MiniGameSDKScript.NOT_IN_RUNTIME], "require_privacy_authorize fallback")

	sdk.open_privacy_contract()
	var privacy_contract: Array = holder["privacy_contract"]
	_assert_eq(privacy_contract, [false, MiniGameSDKScript.NOT_IN_RUNTIME], "open_privacy_contract fallback")

	sdk.start_privacy_authorization_listener()
	var privacy_needed: Array = holder["privacy_needed"]
	_assert_eq(privacy_needed, ["{}", MiniGameSDKScript.NOT_IN_RUNTIME], "privacy listener fallback")
	_assert_eq(sdk.resolve_privacy_authorization("agree", "agree-btn"), false, "privacy resolve fallback")

	sdk.get_setting(true)
	_assert_eq(holder["setting"], ["", MiniGameSDKScript.NOT_IN_RUNTIME], "get_setting fallback")

	sdk.open_setting(false)
	_assert_eq(holder["setting_opened"], ["", MiniGameSDKScript.NOT_IN_RUNTIME], "open_setting fallback")

	sdk.authorize("scope.record")
	_assert_eq(holder["authorization"], ["scope.record", false, MiniGameSDKScript.NOT_IN_RUNTIME], "authorize fallback")
	sdk.create_user_info_button({"type": "text", "text": "Profile", "style": {"left": 10, "top": 20, "width": 160, "height": 44}, "withCredentials": false, "lang": "zh_CN"})
	_assert_eq(holder["native_button_operation"], ["userInfo", "createUserInfoButton", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "create_user_info_button fallback")
	sdk.create_open_setting_button({"type": "text", "text": "Settings", "style": {"left": 10, "top": 70, "width": 160, "height": 44}})
	_assert_eq(holder["native_button_operation"], ["openSetting", "createOpenSettingButton", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "create_open_setting_button fallback")
	sdk.create_game_club_button({"type": "image", "icon": "green", "style": {"left": 320, "top": 16, "width": 40, "height": 40}, "openlink": "Lv-XO1OgAuqztP4pRyKfZnY2aJKe9aE1", "hasRedDot": false})
	_assert_eq(holder["native_button_operation"], ["gameClub", "createGameClubButton", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "create_game_club_button fallback")
	sdk.show_native_button("userInfo")
	_assert_eq(holder["native_button_operation"], ["userInfo", "UserInfoButton.show", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "show_native_button fallback")
	sdk.hide_native_button("openSetting")
	_assert_eq(holder["native_button_operation"], ["openSetting", "OpenSettingButton.hide", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "hide_native_button fallback")
	sdk.stop_native_button_tap_listener("gameClub")
	_assert_eq(holder["native_button_operation"], ["gameClub", "GameClubButton.offTap", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "stop_native_button_tap_listener fallback")
	sdk.destroy_native_button("gameClub")
	_assert_eq(holder["native_button_operation"], ["gameClub", "GameClubButton.destroy", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "destroy_native_button fallback")
	sdk.set_enable_debug(false)
	_assert_eq(holder["debug_operation"], ["setEnableDebug", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "set_enable_debug fallback")
	sdk.get_log_manager(1)
	_assert_eq(holder["debug_operation"], ["getLogManager", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_log_manager fallback")
	sdk.log_manager_info(["boot", {"fps": 60}])
	_assert_eq(holder["debug_operation"], ["LogManager.info", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "log_manager_info fallback")
	sdk.log_manager_warn(["warn"])
	_assert_eq(holder["debug_operation"], ["LogManager.warn", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "log_manager_warn fallback")
	sdk.get_realtime_log_manager()
	_assert_eq(holder["debug_operation"], ["getRealtimeLogManager", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_realtime_log_manager fallback")
	sdk.realtime_log_info(["scene", {"name": "main"}])
	_assert_eq(holder["debug_operation"], ["RealtimeLogManager.info", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "realtime_log_info fallback")
	sdk.realtime_log_error(["crash", {"code": 500}])
	_assert_eq(holder["debug_operation"], ["RealtimeLogManager.error", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "realtime_log_error fallback")
	sdk.realtime_log_set_filter_msg("session-123")
	_assert_eq(holder["debug_operation"], ["RealtimeLogManager.setFilterMsg", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "realtime_log_set_filter_msg fallback")
	sdk.realtime_log_add_filter_msg("player-42")
	_assert_eq(holder["debug_operation"], ["RealtimeLogManager.addFilterMsg", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "realtime_log_add_filter_msg fallback")
	sdk.realtime_log_tag("plugin-log1")
	_assert_eq(holder["debug_operation"], ["RealtimeLogManager.tag", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "realtime_log_tag fallback")
	_assert_eq(sdk.get_account_info(), {}, "get_account_info fallback")
	_assert_eq(sdk.can_i_use("getAppBaseInfo.return.SDKVersion"), false, "can_i_use fallback")
	_assert_eq(sdk.get_device_info(), {}, "get_device_info fallback")
	_assert_eq(sdk.get_app_base_info(), {}, "get_app_base_info fallback")
	_assert_eq(sdk.get_system_setting(), {}, "get_system_setting fallback")
	_assert_eq(sdk.get_app_authorize_setting(), {}, "get_app_authorize_setting fallback")

	sdk.get_network_type()
	_assert_eq(holder["network_type"], ["", "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_network_type fallback")
	sdk.start_network_status_listener()
	_assert_eq(holder["network_status"], [false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "network listener fallback")
	_assert_eq(sdk.stop_network_status_listener(), false, "stop network listener fallback")

	sdk.start_accelerometer("game")
	_assert_eq(holder["sensor_started"], ["accelerometer", false, MiniGameSDKScript.NOT_IN_RUNTIME], "start_accelerometer fallback")
	sdk.stop_accelerometer()
	_assert_eq(holder["sensor_stopped"], ["accelerometer", false, MiniGameSDKScript.NOT_IN_RUNTIME], "stop_accelerometer fallback")

	sdk.start_gyroscope("ui")
	_assert_eq(holder["sensor_started"], ["gyroscope", false, MiniGameSDKScript.NOT_IN_RUNTIME], "start_gyroscope fallback")
	sdk.stop_gyroscope()
	_assert_eq(holder["sensor_stopped"], ["gyroscope", false, MiniGameSDKScript.NOT_IN_RUNTIME], "stop_gyroscope fallback")

	sdk.start_compass()
	_assert_eq(holder["sensor_started"], ["compass", false, MiniGameSDKScript.NOT_IN_RUNTIME], "start_compass fallback")
	sdk.stop_compass()
	_assert_eq(holder["sensor_stopped"], ["compass", false, MiniGameSDKScript.NOT_IN_RUNTIME], "stop_compass fallback")

	sdk.start_device_motion_listening("game")
	_assert_eq(holder["sensor_started"], ["deviceMotion", false, MiniGameSDKScript.NOT_IN_RUNTIME], "start_device_motion_listening fallback")
	sdk.stop_device_motion_listening()
	_assert_eq(holder["sensor_stopped"], ["deviceMotion", false, MiniGameSDKScript.NOT_IN_RUNTIME], "stop_device_motion_listening fallback")

	sdk.get_battery_info()
	_assert_eq(holder["battery"], [0, false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_battery_info fallback")
	_assert_eq(sdk.get_battery_info_sync(), {}, "get_battery_info_sync fallback")

	sdk.start_audio_interruption_listener()
	_assert_eq(holder["audio_interruption"], ["begin", "{}", MiniGameSDKScript.NOT_IN_RUNTIME], "start_audio_interruption_listener fallback")
	_assert_eq(sdk.stop_audio_interruption_listener(), false, "stop_audio_interruption_listener fallback")

	sdk.start_theme_change_listener()
	_assert_eq(holder["theme_changed"], ["", "{}", MiniGameSDKScript.NOT_IN_RUNTIME], "start_theme_change_listener fallback")
	_assert_eq(sdk.stop_theme_change_listener(), false, "stop_theme_change_listener fallback")
	_assert_eq(sdk.get_performance_entries(), [], "get_performance_entries fallback")
	_assert_eq(sdk.get_performance_entries("render"), [], "get_performance_entries by type fallback")
	_assert_eq(sdk.report_performance(1101, 680), false, "report_performance fallback")

	sdk.navigate_to_mini_program("wx-target", "?from=godot", {"score": 9}, "trial")
	_assert_eq(holder["mini_program_navigation"], ["navigateToMiniProgram", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "navigate_to_mini_program fallback")
	sdk.navigate_back_mini_program({"finished": true})
	_assert_eq(holder["mini_program_navigation"], ["navigateBackMiniProgram", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "navigate_back_mini_program fallback")
	sdk.exit_mini_program()
	_assert_eq(holder["mini_program_navigation"], ["exitMiniProgram", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "exit_mini_program fallback")
	sdk.restart_mini_program("pages/index/index")
	_assert_eq(holder["mini_program_navigation"], ["restartMiniProgram", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "restart_mini_program fallback")

	sdk.set_user_cloud_storage({"score": 9})
	_assert_eq(holder["cloud_storage"], ["setUserCloudStorage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "set_user_cloud_storage fallback")
	sdk.remove_user_cloud_storage(["score"])
	_assert_eq(holder["cloud_storage"], ["removeUserCloudStorage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "remove_user_cloud_storage fallback")
	sdk.get_user_cloud_storage_keys()
	_assert_eq(holder["cloud_storage"], ["getUserCloudStorageKeys", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_user_cloud_storage_keys fallback")
	sdk.get_user_cloud_storage(["score"])
	_assert_eq(holder["cloud_storage"], ["getUserCloudStorage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_user_cloud_storage fallback")
	sdk.get_friend_cloud_storage(["score"])
	_assert_eq(holder["cloud_storage"], ["getFriendCloudStorage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_friend_cloud_storage fallback")
	sdk.get_group_cloud_storage(["score"], "ticket", "gid")
	_assert_eq(holder["cloud_storage"], ["getGroupCloudStorage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_group_cloud_storage fallback")
	_assert_eq(sdk.post_open_data_context_message({"type": "rank"}), false, "post_open_data_context_message fallback")

	sdk.download_file("https://cdn.example.com/a.bin")
	_assert_eq(holder["file_transfer"], ["downloadFile", false, 0, "", MiniGameSDKScript.NOT_IN_RUNTIME], "download_file fallback")
	sdk.upload_file("https://api.example.com/upload", "wxfile://usr/a.bin", "asset")
	_assert_eq(holder["file_transfer"], ["uploadFile", false, 0, "", MiniGameSDKScript.NOT_IN_RUNTIME], "upload_file fallback")

	sdk.connect_socket("wss://socket.example.com/room")
	_assert_eq(holder["socket_operation"], ["connectSocket", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "connect_socket fallback")
	sdk.send_socket_message("hello")
	_assert_eq(holder["socket_operation"], ["sendSocketMessage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "send_socket_message fallback")
	sdk.close_socket(1000, "normal")
	_assert_eq(holder["socket_operation"], ["closeSocket", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "close_socket fallback")

	sdk.call_file_system("access", {"path": "wxfile://usr/save.json"})
	_assert_eq(holder["file_system"], ["access", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "call_file_system fallback")
	sdk.file_system_write_file("wxfile://usr/save.json", "{\"score\":9}")
	_assert_eq(holder["file_system"], ["writeFile", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "file_system_write_file fallback")
	sdk.file_system_read_file("wxfile://usr/save.json")
	_assert_eq(holder["file_system"], ["readFile", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "file_system_read_file fallback")
	sdk.file_system_save_file("wxfile://tmp/save.json", "wxfile://usr/save.json")
	_assert_eq(holder["file_system"], ["saveFile", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "file_system_save_file fallback")

	sdk.load_subpackage("levels")
	_assert_eq(holder["subpackage"], ["loadSubpackage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "load_subpackage fallback")
	sdk.pre_download_subpackage("levels", "normal")
	_assert_eq(holder["subpackage"], ["preDownloadSubpackage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "pre_download_subpackage fallback")

	sdk.create_worker("workers/index.js", true)
	_assert_eq(holder["worker_operation"], ["createWorker", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "create_worker fallback")
	sdk.worker_post_message({"type": "ping"})
	_assert_eq(holder["worker_operation"], ["Worker.postMessage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "worker_post_message fallback")
	sdk.worker_terminate()
	_assert_eq(holder["worker_operation"], ["Worker.terminate", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "worker_terminate fallback")

	sdk.choose_media(2, ["image"], ["album"], 30, ["compressed"], "front")
	_assert_eq(holder["media"], ["chooseMedia", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "choose_media fallback")
	sdk.choose_image(1, ["compressed"], ["album"])
	_assert_eq(holder["media"], ["chooseImage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "choose_image fallback")
	sdk.preview_image(["wxfile://tmp/a.png"], "", true, "no-referrer")
	_assert_eq(holder["media"], ["previewImage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "preview_image fallback")
	sdk.save_image_to_photos_album("wxfile://usr/a.png")
	_assert_eq(holder["media"], ["saveImageToPhotosAlbum", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "save_image_to_photos_album fallback")
	sdk.compress_image("wxfile://usr/a.jpg", 80, 0, 0)
	_assert_eq(holder["media"], ["compressImage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "compress_image fallback")

	sdk.create_camera(0, 0, 300, 150, "back", "auto", "small")
	_assert_eq(holder["camera_operation"], ["createCamera", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "create_camera fallback")
	sdk.camera_take_photo("normal")
	_assert_eq(holder["camera_operation"], ["Camera.takePhoto", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "camera_take_photo fallback")
	sdk.camera_start_record()
	_assert_eq(holder["camera_operation"], ["Camera.startRecord", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "camera_start_record fallback")
	sdk.camera_stop_record(true)
	_assert_eq(holder["camera_operation"], ["Camera.stopRecord", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "camera_stop_record fallback")
	sdk.camera_set_zoom(1.5)
	_assert_eq(holder["camera_operation"], ["Camera.setZoom", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "camera_set_zoom fallback")
	sdk.camera_listen_frame_change(false)
	_assert_eq(holder["camera_operation"], ["Camera.listenFrameChange", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "camera_listen_frame_change fallback")
	sdk.camera_close_frame_change()
	_assert_eq(holder["camera_operation"], ["Camera.closeFrameChange", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "camera_close_frame_change fallback")
	sdk.camera_destroy()
	_assert_eq(holder["camera_operation"], ["Camera.destroy", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "camera_destroy fallback")

	sdk.create_video({"src": "video/intro.mp4", "x": 0, "y": 0, "width": 300, "height": 150})
	_assert_eq(holder["video_operation"], ["createVideo", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "create_video fallback")
	sdk.set_video_properties({"muted": true})
	_assert_eq(holder["video_operation"], ["Video.setProperties", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "set_video_properties fallback")
	sdk.get_video_state()
	_assert_eq(holder["video_operation"], ["Video.getState", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_video_state fallback")
	sdk.video_play()
	_assert_eq(holder["video_operation"], ["Video.play", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "video_play fallback")
	sdk.video_pause()
	_assert_eq(holder["video_operation"], ["Video.pause", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "video_pause fallback")
	sdk.video_stop()
	_assert_eq(holder["video_operation"], ["Video.stop", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "video_stop fallback")
	sdk.video_seek(1.25)
	_assert_eq(holder["video_operation"], ["Video.seek", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "video_seek fallback")
	sdk.video_request_full_screen(90)
	_assert_eq(holder["video_operation"], ["Video.requestFullScreen", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "video_request_full_screen fallback")
	sdk.video_exit_full_screen()
	_assert_eq(holder["video_operation"], ["Video.exitFullScreen", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "video_exit_full_screen fallback")
	sdk.stop_video_listener(["play", "pause"])
	_assert_eq(holder["video_operation"], ["Video.off", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "stop_video_listener fallback")
	sdk.video_destroy()
	_assert_eq(holder["video_operation"], ["Video.destroy", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "video_destroy fallback")

	sdk.get_recorder_manager()
	_assert_eq(holder["recorder_operation"], ["getRecorderManager", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_recorder_manager fallback")
	sdk.recorder_start({"duration": 1000, "format": "mp3"})
	_assert_eq(holder["recorder_operation"], ["RecorderManager.start", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "recorder_start fallback")
	sdk.recorder_pause()
	_assert_eq(holder["recorder_operation"], ["RecorderManager.pause", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "recorder_pause fallback")
	sdk.recorder_resume()
	_assert_eq(holder["recorder_operation"], ["RecorderManager.resume", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "recorder_resume fallback")
	sdk.recorder_stop()
	_assert_eq(holder["recorder_operation"], ["RecorderManager.stop", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "recorder_stop fallback")

	sdk.get_available_audio_sources()
	_assert_eq(holder["available_audio_sources"], ["[]", "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_available_audio_sources fallback")
	sdk.create_video_decoder()
	_assert_eq(holder["video_decoder_operation"], ["createVideoDecoder", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "create_video_decoder fallback")
	sdk.start_video_decoder_listener(["start", "ended"])
	_assert_eq(holder["video_decoder_operation"], ["VideoDecoder.on", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "start_video_decoder_listener fallback")
	sdk.video_decoder_start({"source": "video/clip.mp4", "mode": 1})
	_assert_eq(holder["video_decoder_operation"], ["VideoDecoder.start", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "video_decoder_start fallback")
	sdk.video_decoder_get_frame_data()
	_assert_eq(holder["video_decoder_operation"], ["VideoDecoder.getFrameData", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "video_decoder_get_frame_data fallback")
	sdk.video_decoder_seek(1.5)
	_assert_eq(holder["video_decoder_operation"], ["VideoDecoder.seek", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "video_decoder_seek fallback")
	sdk.video_decoder_stop()
	_assert_eq(holder["video_decoder_operation"], ["VideoDecoder.stop", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "video_decoder_stop fallback")
	sdk.stop_video_decoder_listener(["start"])
	_assert_eq(holder["video_decoder_operation"], ["VideoDecoder.off", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "stop_video_decoder_listener fallback")
	sdk.video_decoder_remove()
	_assert_eq(holder["video_decoder_operation"], ["VideoDecoder.remove", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "video_decoder_remove fallback")
	sdk.create_media_audio_player(0.75)
	_assert_eq(holder["media_audio_operation"], ["createMediaAudioPlayer", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "create_media_audio_player fallback")
	sdk.media_audio_add_video_decoder_source()
	_assert_eq(holder["media_audio_operation"], ["MediaAudioPlayer.addAudioSource", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "media_audio_add_video_decoder_source fallback")
	sdk.media_audio_start()
	_assert_eq(holder["media_audio_operation"], ["MediaAudioPlayer.start", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "media_audio_start fallback")
	sdk.set_media_audio_volume(0.5)
	_assert_eq(holder["media_audio_operation"], ["MediaAudioPlayer.setVolume", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "set_media_audio_volume fallback")
	sdk.media_audio_remove_video_decoder_source()
	_assert_eq(holder["media_audio_operation"], ["MediaAudioPlayer.removeAudioSource", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "media_audio_remove_video_decoder_source fallback")
	sdk.media_audio_stop()
	_assert_eq(holder["media_audio_operation"], ["MediaAudioPlayer.stop", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "media_audio_stop fallback")
	sdk.media_audio_destroy()
	_assert_eq(holder["media_audio_operation"], ["MediaAudioPlayer.destroy", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "media_audio_destroy fallback")

	sdk.get_game_recorder()
	_assert_eq(holder["game_recorder_operation"], ["getGameRecorder", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_game_recorder fallback")
	sdk.start_game_recorder_listener(["start", "stop"])
	_assert_eq(holder["game_recorder_operation"], ["GameRecorder.on", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "start_game_recorder_listener fallback")
	sdk.game_recorder_start({"duration": 10})
	_assert_eq(holder["game_recorder_operation"], ["GameRecorder.start", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "game_recorder_start fallback")
	sdk.game_recorder_pause()
	_assert_eq(holder["game_recorder_operation"], ["GameRecorder.pause", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "game_recorder_pause fallback")
	sdk.game_recorder_resume()
	_assert_eq(holder["game_recorder_operation"], ["GameRecorder.resume", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "game_recorder_resume fallback")
	sdk.game_recorder_stop()
	_assert_eq(holder["game_recorder_operation"], ["GameRecorder.stop", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "game_recorder_stop fallback")
	sdk.game_recorder_abort()
	_assert_eq(holder["game_recorder_operation"], ["GameRecorder.abort", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "game_recorder_abort fallback")
	sdk.stop_game_recorder_listener(["start", "stop"])
	_assert_eq(holder["game_recorder_operation"], ["GameRecorder.off", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "stop_game_recorder_listener fallback")
	sdk.operate_game_recorder_video({"title": "Replay"})
	_assert_eq(holder["game_recorder_operation"], ["operateGameRecorderVideo", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "operate_game_recorder_video fallback")
	sdk.create_game_recorder_share_button({"left": 0, "top": 0}, {"bgm": "audio/bgm.mp3", "timeRange": [[0, 3000]]})
	_assert_eq(holder["game_recorder_operation"], ["createGameRecorderShareButton", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "create_game_recorder_share_button fallback")
	sdk.show_game_recorder_share_button()
	_assert_eq(holder["game_recorder_operation"], ["GameRecorderShareButton.show", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "show_game_recorder_share_button fallback")
	sdk.hide_game_recorder_share_button()
	_assert_eq(holder["game_recorder_operation"], ["GameRecorderShareButton.hide", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "hide_game_recorder_share_button fallback")
	sdk.off_game_recorder_share_button_tap()
	_assert_eq(holder["game_recorder_operation"], ["GameRecorderShareButton.offTap", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "off_game_recorder_share_button_tap fallback")

	sdk.set_inner_audio_option({"mixWithOther": false, "obeyMuteSwitch": false, "speakerOn": true})
	_assert_eq(holder["inner_audio_operation"], ["setInnerAudioOption", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "set_inner_audio_option fallback")
	sdk.create_inner_audio_context({"useWebAudioImplement": true}, {"src": "audio/bgm.mp3", "loop": true})
	_assert_eq(holder["inner_audio_operation"], ["createInnerAudioContext", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "create_inner_audio_context fallback")
	sdk.set_inner_audio_properties({"volume": 0.5})
	_assert_eq(holder["inner_audio_operation"], ["InnerAudioContext.setProperties", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "set_inner_audio_properties fallback")
	sdk.get_inner_audio_state()
	_assert_eq(holder["inner_audio_operation"], ["InnerAudioContext.getState", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_inner_audio_state fallback")
	sdk.inner_audio_play()
	_assert_eq(holder["inner_audio_operation"], ["InnerAudioContext.play", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "inner_audio_play fallback")
	sdk.inner_audio_pause()
	_assert_eq(holder["inner_audio_operation"], ["InnerAudioContext.pause", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "inner_audio_pause fallback")
	sdk.inner_audio_stop()
	_assert_eq(holder["inner_audio_operation"], ["InnerAudioContext.stop", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "inner_audio_stop fallback")
	sdk.inner_audio_seek(2.25)
	_assert_eq(holder["inner_audio_operation"], ["InnerAudioContext.seek", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "inner_audio_seek fallback")
	sdk.stop_inner_audio_listener(["play", "pause"])
	_assert_eq(holder["inner_audio_operation"], ["InnerAudioContext.off", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "stop_inner_audio_listener fallback")
	sdk.inner_audio_destroy()
	_assert_eq(holder["inner_audio_operation"], ["InnerAudioContext.destroy", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "inner_audio_destroy fallback")

	sdk.open_customer_service_conversation("from-godot", true, "Help", "pages/help/index", "images/help.png")
	_assert_eq(holder["customer_service"], ["openCustomerServiceConversation", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "open_customer_service_conversation fallback")
	sdk.request_subscribe_message(["tmpl_a", "tmpl_b"])
	_assert_eq(holder["subscribe_message"], ["requestSubscribeMessage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "request_subscribe_message fallback")
	sdk.request_subscribe_system_message(["SYS_MSG_TYPE_RANK"])
	_assert_eq(holder["subscribe_message"], ["requestSubscribeSystemMessage", false, "", MiniGameSDKScript.NOT_IN_RUNTIME], "request_subscribe_system_message fallback")

	sdk.start_update_listener()
	_assert_eq(holder["update_checked"], [false, "{}", MiniGameSDKScript.NOT_IN_RUNTIME], "start_update_listener fallback")
	_assert_eq(sdk.apply_update(), false, "apply_update fallback")

	sdk.start_memory_warning_listener()
	_assert_eq(holder["memory_warning"], [0, "{}", MiniGameSDKScript.NOT_IN_RUNTIME], "start_memory_warning_listener fallback")
	_assert_eq(sdk.stop_memory_warning_listener(), false, "stop_memory_warning_listener fallback")

	sdk.start_window_resize_listener()
	_assert_eq(holder["window_resized"], [0, 0, "{}", MiniGameSDKScript.NOT_IN_RUNTIME], "start_window_resize_listener fallback")
	_assert_eq(sdk.stop_window_resize_listener(), false, "stop_window_resize_listener fallback")

	sdk.start_unhandled_rejection_listener()
	_assert_eq(holder["unhandled_rejection"], ["", "{}", MiniGameSDKScript.NOT_IN_RUNTIME], "start_unhandled_rejection_listener fallback")
	_assert_eq(sdk.stop_unhandled_rejection_listener(), false, "stop_unhandled_rejection_listener fallback")

	sdk.get_screen_brightness()
	_assert_eq(holder["screen_brightness"], [0.0, "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_screen_brightness fallback")
	sdk.set_screen_brightness(0.5)
	_assert_eq(holder["screen_brightness_set"], [0.5, false, MiniGameSDKScript.NOT_IN_RUNTIME], "set_screen_brightness fallback")
	sdk.start_user_capture_screen_listener()
	_assert_eq(holder["user_capture_screen"], ["{}", MiniGameSDKScript.NOT_IN_RUNTIME], "start_user_capture_screen_listener fallback")
	_assert_eq(sdk.stop_user_capture_screen_listener(), false, "stop_user_capture_screen_listener fallback")
	sdk.get_screen_recording_state()
	_assert_eq(holder["screen_recording_state"], ["", "", MiniGameSDKScript.NOT_IN_RUNTIME], "get_screen_recording_state fallback")
	sdk.start_screen_recording_state_listener()
	_assert_eq(holder["screen_recording_changed"], ["", "{}", MiniGameSDKScript.NOT_IN_RUNTIME], "start_screen_recording_state_listener fallback")
	_assert_eq(sdk.stop_screen_recording_state_listener(), false, "stop_screen_recording_state_listener fallback")
	sdk.set_visual_effect_on_capture("hidden")
	_assert_eq(holder["visual_effect"], ["hidden", false, MiniGameSDKScript.NOT_IN_RUNTIME], "set_visual_effect_on_capture fallback")

	sdk._on_accelerometer_changed([1, "2", -3.0, "{\"x\":1,\"y\":2,\"z\":-3}"])
	_assert_eq(holder["accelerometer"], [1.0, 2.0, -3.0, "{\"x\":1,\"y\":2,\"z\":-3}"], "accelerometer callback conversion")
	sdk._on_gyroscope_changed(["4", 5, 6.0, "{\"x\":4,\"y\":5,\"z\":6}"])
	_assert_eq(holder["gyroscope"], [4.0, 5.0, 6.0, "{\"x\":4,\"y\":5,\"z\":6}"], "gyroscope callback conversion")
	sdk._on_compass_changed([123, "high", "{\"direction\":123,\"accuracy\":\"high\"}"])
	_assert_eq(holder["compass"], [123.0, "high", "{\"direction\":123,\"accuracy\":\"high\"}"], "compass callback conversion")
	sdk._on_device_motion_changed([0.1, "-0.2", 0.3, "{\"alpha\":0.1,\"beta\":-0.2,\"gamma\":0.3}"])
	_assert_eq(holder["device_motion"], [0.1, -0.2, 0.3, "{\"alpha\":0.1,\"beta\":-0.2,\"gamma\":0.3}"], "device motion callback conversion")
	sdk._on_battery_info([88, true, "{\"level\":88,\"isCharging\":true}", ""])
	_assert_eq(holder["battery"], [88, true, "{\"level\":88,\"isCharging\":true}", ""], "battery callback conversion")
	sdk._on_audio_interruption(["end", "{\"reason\":\"resume\"}", ""])
	_assert_eq(holder["audio_interruption"], ["end", "{\"reason\":\"resume\"}", ""], "audio interruption callback conversion")
	sdk._on_theme_changed(["dark", "{\"theme\":\"dark\"}", ""])
	_assert_eq(holder["theme_changed"], ["dark", "{\"theme\":\"dark\"}", ""], "theme callback conversion")
	sdk._on_mini_program_navigation_result(["navigateToMiniProgram", true, "{\"errMsg\":\"ok\"}", ""])
	_assert_eq(holder["mini_program_navigation"], ["navigateToMiniProgram", true, "{\"errMsg\":\"ok\"}", ""], "mini program navigation callback conversion")
	sdk._on_cloud_storage_result(["getUserCloudStorage", true, "{\"KVDataList\":[]}", ""])
	_assert_eq(holder["cloud_storage"], ["getUserCloudStorage", true, "{\"KVDataList\":[]}", ""], "cloud storage callback conversion")
	sdk._on_file_transfer_result(["downloadFile", true, 200, "{\"tempFilePath\":\"wxfile://tmp/a.bin\"}", ""])
	_assert_eq(holder["file_transfer"], ["downloadFile", true, 200, "{\"tempFilePath\":\"wxfile://tmp/a.bin\"}", ""], "file transfer callback conversion")
	sdk._on_socket_operation(["sendSocketMessage", true, "{\"errMsg\":\"ok\"}", ""])
	_assert_eq(holder["socket_operation"], ["sendSocketMessage", true, "{\"errMsg\":\"ok\"}", ""], "socket operation callback conversion")
	sdk._on_socket_event(["open", "", "{\"header\":{}}", ""])
	_assert_eq(holder["socket_open"], ["{\"header\":{}}", ""], "socket open callback conversion")
	sdk._on_socket_event(["message", "hello", "{\"dataType\":\"string\",\"data\":\"hello\"}", ""])
	_assert_eq(holder["socket_message"], ["hello", "{\"dataType\":\"string\",\"data\":\"hello\"}", ""], "socket message callback conversion")
	sdk._on_socket_event(["close", "", "{\"code\":1000,\"reason\":\"normal\"}", ""])
	_assert_eq(holder["socket_close"], [1000, "normal", "{\"code\":1000,\"reason\":\"normal\"}", ""], "socket close callback conversion")
	sdk._on_socket_event(["error", "", "{\"errMsg\":\"socket broken\"}", "socket broken"])
	_assert_eq(holder["socket_error"], ["{\"errMsg\":\"socket broken\"}", "socket broken"], "socket error callback conversion")
	sdk._on_file_system_result(["readFile", true, "{\"data\":\"hello\"}", ""])
	_assert_eq(holder["file_system"], ["readFile", true, "{\"data\":\"hello\"}", ""], "file system callback conversion")
	sdk._on_subpackage_result(["loadSubpackage", true, "{\"errMsg\":\"ok\"}", ""])
	_assert_eq(holder["subpackage"], ["loadSubpackage", true, "{\"errMsg\":\"ok\"}", ""], "subpackage callback conversion")
	sdk._on_subpackage_progress(["loadSubpackage", 80, 800, 1000, "{\"progress\":80}"])
	_assert_eq(holder["subpackage_progress"], ["loadSubpackage", 80, 800, 1000, "{\"progress\":80}"], "subpackage progress callback conversion")
	sdk._on_worker_operation(["Worker.postMessage", true, "{\"message\":{\"type\":\"ping\"}}", ""])
	_assert_eq(holder["worker_operation"], ["Worker.postMessage", true, "{\"message\":{\"type\":\"ping\"}}", ""], "worker operation callback conversion")
	sdk._on_worker_event(["message", "{\"type\":\"pong\"}", ""])
	_assert_eq(holder["worker_message"], ["{\"type\":\"pong\"}", ""], "worker message callback conversion")
	sdk._on_worker_event(["error", "{\"error\":{\"message\":\"boom\"}}", "boom"])
	_assert_eq(holder["worker_error"], ["{\"error\":{\"message\":\"boom\"}}", "boom"], "worker error callback conversion")
	sdk._on_worker_event(["processKilled", "{\"reason\":\"memory\"}", ""])
	_assert_eq(holder["worker_process_killed"], ["{\"reason\":\"memory\"}", ""], "worker process killed callback conversion")
	sdk._on_media_result(["chooseMedia", true, "{\"tempFiles\":[]}", ""])
	_assert_eq(holder["media"], ["chooseMedia", true, "{\"tempFiles\":[]}", ""], "media callback conversion")
	sdk._on_camera_operation(["Camera.takePhoto", true, "{\"tempImagePath\":\"wxfile://tmp/photo.jpg\"}", ""])
	_assert_eq(holder["camera_operation"], ["Camera.takePhoto", true, "{\"tempImagePath\":\"wxfile://tmp/photo.jpg\"}", ""], "camera operation callback conversion")
	sdk._on_camera_event(["frame", "{\"width\":2,\"height\":1}", ""])
	_assert_eq(holder["camera_frame"], ["{\"width\":2,\"height\":1}", ""], "camera frame callback conversion")
	sdk._on_camera_event(["authCancel", "{}", ""])
	_assert_eq(holder["camera_event"], ["authCancel", "{}", ""], "camera auth cancel callback conversion")
	sdk._on_video_operation(["Video.play", true, "{\"src\":\"video/intro.mp4\"}", ""])
	_assert_eq(holder["video_operation"], ["Video.play", true, "{\"src\":\"video/intro.mp4\"}", ""], "video operation callback conversion")
	sdk._on_video_event(["timeUpdate", "{\"currentTime\":5}", ""])
	_assert_eq(holder["video_event"], ["timeUpdate", "{\"currentTime\":5}", ""], "video event callback conversion")
	sdk._on_recorder_operation(["RecorderManager.stop", true, "{\"duration\":2300}", ""])
	_assert_eq(holder["recorder_operation"], ["RecorderManager.stop", true, "{\"duration\":2300}", ""], "recorder operation callback conversion")
	sdk._on_recorder_event(["frameRecorded", "{\"isLastFrame\":false}", ""])
	_assert_eq(holder["recorder_event"], ["frameRecorded", "{\"isLastFrame\":false}", ""], "recorder event callback conversion")
	sdk._on_available_audio_sources(["[\"auto\",\"mic\"]", "{\"audioSources\":[\"auto\",\"mic\"]}", ""])
	_assert_eq(holder["available_audio_sources"], ["[\"auto\",\"mic\"]", "{\"audioSources\":[\"auto\",\"mic\"]}", ""], "available audio sources callback conversion")
	sdk._on_video_decoder_operation(["VideoDecoder.getFrameData", true, "{\"width\":2}", ""])
	_assert_eq(holder["video_decoder_operation"], ["VideoDecoder.getFrameData", true, "{\"width\":2}", ""], "video decoder operation callback conversion")
	sdk._on_video_decoder_event(["start", "{\"width\":640,\"height\":360}", ""])
	_assert_eq(holder["video_decoder_event"], ["start", "{\"width\":640,\"height\":360}", ""], "video decoder event callback conversion")
	sdk._on_media_audio_operation(["MediaAudioPlayer.start", true, "{\"volume\":0.5}", ""])
	_assert_eq(holder["media_audio_operation"], ["MediaAudioPlayer.start", true, "{\"volume\":0.5}", ""], "media audio operation callback conversion")
	sdk._on_game_recorder_operation(["GameRecorder.stop", true, "{\"duration\":2300}", ""])
	_assert_eq(holder["game_recorder_operation"], ["GameRecorder.stop", true, "{\"duration\":2300}", ""], "game recorder operation callback conversion")
	sdk._on_game_recorder_event(["timeUpdate", "{\"currentTime\":3.5}", ""])
	_assert_eq(holder["game_recorder_event"], ["timeUpdate", "{\"currentTime\":3.5}", ""], "game recorder event callback conversion")
	sdk._on_inner_audio_operation(["InnerAudioContext.play", true, "{\"currentTime\":2.25}", ""])
	_assert_eq(holder["inner_audio_operation"], ["InnerAudioContext.play", true, "{\"currentTime\":2.25}", ""], "inner audio operation callback conversion")
	sdk._on_inner_audio_event(["timeUpdate", "{\"currentTime\":2.25}", ""])
	_assert_eq(holder["inner_audio_event"], ["timeUpdate", "{\"currentTime\":2.25}", ""], "inner audio event callback conversion")
	sdk._on_native_button_operation(["userInfo", "UserInfoButton.show", true, "{}", ""])
	_assert_eq(holder["native_button_operation"], ["userInfo", "UserInfoButton.show", true, "{}", ""], "native button operation callback conversion")
	sdk._on_native_button_tap(["userInfo", "{\"userInfo\":{\"nickName\":\"Ada\"}}", ""])
	_assert_eq(holder["native_button_tap"], ["userInfo", "{\"userInfo\":{\"nickName\":\"Ada\"}}", ""], "native button tap callback conversion")
	sdk._on_debug_operation(["RealtimeLogManager.info", true, "{\"args\":[\"scene\"]}", ""])
	_assert_eq(holder["debug_operation"], ["RealtimeLogManager.info", true, "{\"args\":[\"scene\"]}", ""], "debug operation callback conversion")
	sdk._on_customer_service_result(["openCustomerServiceConversation", true, "{\"path\":\"pages/support\"}", ""])
	_assert_eq(holder["customer_service"], ["openCustomerServiceConversation", true, "{\"path\":\"pages/support\"}", ""], "customer service callback conversion")
	sdk._on_subscribe_message_result(["requestSubscribeMessage", true, "{\"tmpl_a\":\"accept\"}", ""])
	_assert_eq(holder["subscribe_message"], ["requestSubscribeMessage", true, "{\"tmpl_a\":\"accept\"}", ""], "subscribe message callback conversion")
	sdk._on_update_event(["check", true, "{\"hasUpdate\":true}", ""])
	_assert_eq(holder["update_checked"], [true, "{\"hasUpdate\":true}", ""], "update check callback conversion")
	sdk._on_update_event(["ready", true, "{}", ""])
	_assert_eq(holder["update_ready"], [""], "update ready callback conversion")
	sdk._on_update_event(["failed", false, "{}", "network"])
	_assert_eq(holder["update_failed"], ["network"], "update failed callback conversion")
	sdk._on_memory_warning([10, "{\"level\":10}", ""])
	_assert_eq(holder["memory_warning"], [10, "{\"level\":10}", ""], "memory warning callback conversion")
	sdk._on_window_resized([375, 667, "{\"size\":{\"windowWidth\":375,\"windowHeight\":667}}", ""])
	_assert_eq(holder["window_resized"], [375, 667, "{\"size\":{\"windowWidth\":375,\"windowHeight\":667}}", ""], "window resize callback conversion")
	sdk._on_unhandled_rejection(["boom", "{\"reason\":\"boom\"}", ""])
	_assert_eq(holder["unhandled_rejection"], ["boom", "{\"reason\":\"boom\"}", ""], "unhandled rejection callback conversion")
	sdk._on_screen_brightness([0.42, "{\"value\":0.42}", ""])
	_assert_eq(holder["screen_brightness"], [0.42, "{\"value\":0.42}", ""], "screen brightness callback conversion")
	sdk._on_screen_brightness_set([-1, true, ""])
	_assert_eq(holder["screen_brightness_set"], [-1.0, true, ""], "screen brightness set callback conversion")
	sdk._on_user_capture_screen(["{\"query\":\"from=capture\"}", ""])
	_assert_eq(holder["user_capture_screen"], ["{\"query\":\"from=capture\"}", ""], "user capture screen callback conversion")
	sdk._on_screen_recording_state(["on", "{\"state\":\"on\"}", ""])
	_assert_eq(holder["screen_recording_state"], ["on", "{\"state\":\"on\"}", ""], "screen recording state callback conversion")
	sdk._on_screen_recording_state_changed(["start", "{\"state\":\"start\"}", ""])
	_assert_eq(holder["screen_recording_changed"], ["start", "{\"state\":\"start\"}", ""], "screen recording changed callback conversion")
	sdk._on_visual_effect_on_capture_set(["hidden", true, ""])
	_assert_eq(holder["visual_effect"], ["hidden", true, ""], "visual effect callback conversion")

	sdk.free()
	if _failed:
		quit(1)
		return
	print("minigame_sdk_test.gd: ok")
	quit(0)
