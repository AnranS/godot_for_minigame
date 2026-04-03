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

var score := 0
var colors := [
	Color("#478cbf"), Color("#e74c3c"), Color("#2ecc71"),
	Color("#f39c12"), Color("#9b59b6"), Color("#1abc9c"),
]

var _result_labels := {}


func _ready() -> void:
	tap_button.pressed.connect(_on_tap)
	play_btn.pressed.connect(_on_play)
	pause_btn.pressed.connect(_on_pause)
	audio_player.finished.connect(func(): audio_label.text = "Audio: Stopped")
	score_label.text = "Score: 0"
	color_rect.color = colors[0]

	_build_sdk_tests()
	_connect_sdk_signals()
	_log("Ready — tap buttons to test SDK features")


# ── Basic interactions ─────────────────────────────────────────────

func _on_tap() -> void:
	score += 1
	score_label.text = "Score: %d" % score
	color_rect.color = colors[score % colors.size()]


func _on_play() -> void:
	if audio_player.stream_paused:
		audio_player.stream_paused = false
		audio_label.text = "Audio: Playing"
	elif not audio_player.playing:
		audio_player.play()
		audio_label.text = "Audio: Playing"


func _on_pause() -> void:
	if audio_player.playing and not audio_player.stream_paused:
		audio_player.stream_paused = true
		audio_label.text = "Audio: Paused"


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

	_add_section("Network", [
		["GET httpbin", _test_http_get],
	])

	_add_section("System", [
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
		["(auto)", func(): _set_result("Lifecycle", "Listening for onShow/onHide...")],
	])


func _add_section(title: String, buttons: Array, hint: String = "") -> void:
	var section := VBoxContainer.new()
	section.add_theme_constant_override("separation", 6)

	var header := Label.new()
	header.text = title if hint.is_empty() else "%s  (%s)" % [title, hint]
	header.add_theme_font_size_override("font_size", 18)
	header.add_theme_color_override("font_color", Color(0.3, 0.75, 1.0))
	section.add_child(header)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 8)
	for btn_def in buttons:
		var btn := Button.new()
		btn.text = btn_def[0]
		btn.custom_minimum_size = Vector2(0, 44)
		btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		btn.add_theme_font_size_override("font_size", 15)
		btn.pressed.connect(btn_def[1])
		hbox.add_child(btn)
	section.add_child(hbox)

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


func _get_sdk() -> Node:
	return get_node_or_null("/root/MiniGameSDK")


# ── SDK signal connections ─────────────────────────────────────────

func _connect_sdk_signals() -> void:
	var sdk := _get_sdk()
	if not sdk:
		_log("MiniGameSDK autoload not found")
		return

	sdk.login_completed.connect(func(code: String, err: String):
		if err.is_empty():
			_set_result("Auth / Login", "Login OK, code: %s" % code)
		else:
			_set_result("Auth / Login", "Login failed: %s" % err))

	sdk.session_checked.connect(func(valid: bool, err: String):
		_set_result("Auth / Login", "Session valid: %s %s" % [valid, err]))

	sdk.user_info_received.connect(func(info: String, err: String):
		if err.is_empty():
			_set_result("Auth / Login", "UserInfo: %s" % info.left(120))
		else:
			_set_result("Auth / Login", "UserInfo failed: %s" % err))

	sdk.ad_created.connect(func(ad_type: String, ok: bool, err: String):
		var names := {"rewarded": "Rewarded Ad", "banner": "Banner Ad", "interstitial": "Interstitial Ad"}
		var section: String = names.get(ad_type, ad_type)
		if ok:
			_set_result(section, "Created OK")
		else:
			_set_result(section, "Create failed: %s" % err))

	sdk.rewarded_ad_result.connect(func(ended: bool, err: String):
		_set_result("Rewarded Ad", "Ended: %s, err: %s" % [ended, err]))

	sdk.interstitial_ad_result.connect(func(ok: bool, err: String):
		_set_result("Interstitial Ad", "OK: %s, err: %s" % [ok, err]))

	sdk.payment_result.connect(func(ok: bool, err: String):
		_set_result("Payment", "OK: %s, err: %s" % [ok, err]))

	sdk.keyboard_event.connect(func(evt: String, val: String):
		_set_result("Keyboard", "[%s] %s" % [evt, val]))

	sdk.http_response.connect(func(status: int, data: String, err: String):
		if err.is_empty():
			_set_result("Network", "HTTP %d: %s" % [status, data.left(200)])
		else:
			_set_result("Network", "HTTP err: %s" % err))

	sdk.clipboard_received.connect(func(data: String, err: String):
		if err.is_empty():
			_set_result("Clipboard", "Pasted: %s" % data)
		else:
			_set_result("Clipboard", "Paste err: %s" % err))

	sdk.modal_result.connect(func(confirmed: bool):
		_set_result("Screen / UI", "Modal confirmed: %s" % confirmed))

	sdk.app_shown.connect(func(opts: String):
		_set_result("Lifecycle", "onShow: %s" % opts.left(100)))

	sdk.app_hidden.connect(func():
		_set_result("Lifecycle", "onHide"))

	sdk.app_error.connect(func(msg: String):
		_set_result("Lifecycle", "onError: %s" % msg.left(100)))


# ── Test callbacks ─────────────────────────────────────────────────

# Storage
func _test_storage_save() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Storage", "SDK N/A"); return
	sdk.storage_set("test_key", "hello_%d" % randi_range(0, 999))
	_set_result("Storage", "Saved test_key")

func _test_storage_load() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Storage", "SDK N/A"); return
	var val: String = sdk.storage_get("test_key", "(empty)")
	_set_result("Storage", "test_key = %s" % val)

func _test_storage_remove() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Storage", "SDK N/A"); return
	sdk.storage_remove("test_key")
	_set_result("Storage", "Removed test_key")

func _test_storage_clear() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Storage", "SDK N/A"); return
	sdk.storage_clear()
	_set_result("Storage", "Storage cleared")

func _test_storage_info() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Storage", "SDK N/A"); return
	_set_result("Storage", sdk.storage_info())


# Auth
func _test_login() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Auth / Login", "SDK N/A"); return
	_set_result("Auth / Login", "Logging in...")
	sdk.login()

func _test_check_session() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Auth / Login", "SDK N/A"); return
	sdk.check_session()

func _test_user_info() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Auth / Login", "SDK N/A"); return
	_set_result("Auth / Login", "Getting user info...")
	sdk.get_user_info()


# Share
func _test_share() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Share", "SDK N/A"); return
	sdk.share_app("Come play this game!", "", "from=share")
	_set_result("Share", "shareAppMessage called")

func _test_show_share_menu() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Share", "SDK N/A"); return
	sdk.show_share_menu()
	_set_result("Share", "Share menu shown")

func _test_hide_share_menu() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Share", "SDK N/A"); return
	sdk.hide_share_menu()
	_set_result("Share", "Share menu hidden")


# Rewarded Ad
func _test_create_rewarded_ad() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Rewarded Ad", "SDK N/A"); return
	_set_result("Rewarded Ad", "Creating... (DevTools may show framework errors with test IDs)")
	sdk.create_rewarded_ad("adunit-test-rewarded-001")

func _test_show_rewarded_ad() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Rewarded Ad", "SDK N/A"); return
	_set_result("Rewarded Ad", "Showing...")
	sdk.show_rewarded_ad()


# Banner Ad
func _test_create_banner_ad() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Banner Ad", "SDK N/A"); return
	_set_result("Banner Ad", "Creating... (DevTools may show framework errors with test IDs)")
	sdk.create_banner_ad("adunit-test-banner-001")

func _test_show_banner_ad() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Banner Ad", "SDK N/A"); return
	sdk.show_banner_ad()
	_set_result("Banner Ad", "Shown")

func _test_hide_banner_ad() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Banner Ad", "SDK N/A"); return
	sdk.hide_banner_ad()
	_set_result("Banner Ad", "Hidden")


# Interstitial Ad
func _test_create_interstitial_ad() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Interstitial Ad", "SDK N/A"); return
	_set_result("Interstitial Ad", "Creating... (DevTools may show framework errors with test IDs)")
	sdk.create_interstitial_ad("adunit-test-interstitial-001")

func _test_show_interstitial_ad() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Interstitial Ad", "SDK N/A"); return
	_set_result("Interstitial Ad", "Showing...")
	sdk.show_interstitial_ad()


# Payment
func _test_payment() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Payment", "SDK N/A"); return
	_set_result("Payment", "Requesting...")
	sdk.request_payment({
		"mode": "game",
		"env": 0,
		"offerId": "test_offer_001",
		"currencyType": "CNY",
		"buyQuantity": 10,
	})


# Vibration
func _test_vibrate_short() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Vibration", "SDK N/A"); return
	sdk.vibrate_short("light")
	_set_result("Vibration", "Short (light)")

func _test_vibrate_medium() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Vibration", "SDK N/A"); return
	sdk.vibrate_short("medium")
	_set_result("Vibration", "Short (medium)")

func _test_vibrate_long() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Vibration", "SDK N/A"); return
	sdk.vibrate_long()
	_set_result("Vibration", "Long")


# Keyboard
func _test_show_keyboard() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Keyboard", "SDK N/A"); return
	sdk.show_keyboard("Hello", 50)
	_set_result("Keyboard", "Keyboard opened")

func _test_hide_keyboard() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Keyboard", "SDK N/A"); return
	sdk.hide_keyboard()
	_set_result("Keyboard", "Keyboard closed")


# Clipboard
func _test_clipboard_set() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Clipboard", "SDK N/A"); return
	sdk.set_clipboard("Hello from Godot! %d" % randi_range(0, 999))
	_set_result("Clipboard", "Copied to clipboard")

func _test_clipboard_get() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Clipboard", "SDK N/A"); return
	sdk.get_clipboard()
	_set_result("Clipboard", "Reading clipboard...")


# Network
func _test_http_get() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Network", "SDK N/A"); return
	_set_result("Network", "Requesting...")
	sdk.http_request("https://httpbin.org/get", "GET")


# System
func _test_system_info() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("System", "SDK N/A"); return
	var info: Dictionary = sdk.get_system_info()
	var summary := "brand=%s model=%s system=%s" % [
		info.get("brand", "?"), info.get("model", "?"), info.get("system", "?")]
	_set_result("System", summary)

func _test_launch_options() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("System", "SDK N/A"); return
	var opts: Dictionary = sdk.get_launch_options()
	_set_result("System", str(opts).left(200))

func _test_window_info() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("System", "SDK N/A"); return
	var info: Dictionary = sdk.get_window_info()
	_set_result("System", "%dx%d @%.1fx" % [
		info.get("windowWidth", 0), info.get("windowHeight", 0), info.get("pixelRatio", 1)])

func _test_menu_rect() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("System", "SDK N/A"); return
	var r: Dictionary = sdk.get_menu_button_rect()
	_set_result("System", "Menu: x=%s y=%s w=%s h=%s" % [
		r.get("left", "?"), r.get("top", "?"), r.get("width", "?"), r.get("height", "?")])


# Screen / UI
func _test_keep_screen_on() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Screen / UI", "SDK N/A"); return
	sdk.set_keep_screen_on(true)
	_set_result("Screen / UI", "Keep screen on: true")

func _test_toast() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Screen / UI", "SDK N/A"); return
	sdk.show_toast("Hello from Godot!", "success", 2000)
	_set_result("Screen / UI", "Toast shown")

func _test_modal() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Screen / UI", "SDK N/A"); return
	sdk.show_modal("Confirm", "Do you like Godot?")
	_set_result("Screen / UI", "Modal shown, waiting...")

func _test_show_loading() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Screen / UI", "SDK N/A"); return
	sdk.show_loading("Loading...")
	_set_result("Screen / UI", "Loading overlay shown")

func _test_hide_loading() -> void:
	var sdk := _get_sdk()
	if not sdk: _set_result("Screen / UI", "SDK N/A"); return
	sdk.hide_loading()
	_set_result("Screen / UI", "Loading overlay hidden")
