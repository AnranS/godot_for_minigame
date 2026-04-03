extends Node
## Unified mini-game platform SDK (WeChat / Douyin).
##
## Add as an autoload (singleton) named "MiniGameSDK".
## All async results are delivered via signals.
## Synchronous methods (storage, vibration, etc.) return immediately.
## In non-mini-game environments every method is a safe no-op.

# ── Signals ────────────────────────────────────────────────────────

signal login_completed(code: String, error: String)
signal session_checked(valid: bool, error: String)
signal user_info_received(info_json: String, error: String)

signal ad_created(ad_type: String, success: bool, error: String)
signal rewarded_ad_result(is_ended: bool, error: String)
signal interstitial_ad_result(success: bool, error: String)

signal payment_result(success: bool, error: String)

signal keyboard_event(event_type: String, value: String)

signal http_response(status_code: int, data: String, error: String)

signal clipboard_received(data: String, error: String)

signal modal_result(confirmed: bool)

signal app_shown(options_json: String)
signal app_hidden()
signal app_error(message: String)

# ── State ──────────────────────────────────────────────────────────

var _sdk = null  # JavaScriptObject
var _cbs := {}   # prevent GC of JavaScriptBridge callbacks

## True when running inside a mini-game runtime with the JS SDK available.
var is_mini_game: bool:
	get: return _sdk != null


func _ready() -> void:
	if not OS.has_feature("web"):
		return
	_sdk = JavaScriptBridge.get_interface("godotSdk")
	if _sdk:
		_setup_lifecycle()


# ── Storage (synchronous) ─────────────────────────────────────────

func storage_set(key: String, value: String) -> void:
	if _sdk:
		_sdk.storageSet(key, value)


func storage_get(key: String, default_value: String = "") -> String:
	if not _sdk:
		return default_value
	var result = _sdk.storageGet(key, default_value)
	return str(result) if result != null else default_value


func storage_remove(key: String) -> void:
	if _sdk:
		_sdk.storageRemove(key)


func storage_clear() -> void:
	if _sdk:
		_sdk.storageClear()


## Returns JSON: {"keys":[], "size":0, "limit":0}
func storage_info() -> String:
	if not _sdk:
		return "{}"
	var result = _sdk.storageGetAll()
	return str(result) if result != null else "{}"


# ── Auth / Login ──────────────────────────────────────────────────

func login() -> void:
	if not _sdk:
		login_completed.emit("", "Not in mini-game environment")
		return
	var cb := JavaScriptBridge.create_callback(_on_login)
	_cbs["login"] = cb
	_sdk.login(cb)


func _on_login(args: Array) -> void:
	login_completed.emit(
		str(args[0]) if args.size() > 0 else "",
		str(args[1]) if args.size() > 1 else "")


func check_session() -> void:
	if not _sdk:
		session_checked.emit(false, "Not in mini-game environment")
		return
	var cb := JavaScriptBridge.create_callback(_on_check_session)
	_cbs["check_session"] = cb
	_sdk.checkSession(cb)


func _on_check_session(args: Array) -> void:
	session_checked.emit(
		bool(args[0]) if args.size() > 0 else false,
		str(args[1]) if args.size() > 1 else "")


func get_user_info() -> void:
	if not _sdk:
		user_info_received.emit("", "Not in mini-game environment")
		return
	var cb := JavaScriptBridge.create_callback(_on_user_info)
	_cbs["user_info"] = cb
	_sdk.getUserInfo(cb)


func _on_user_info(args: Array) -> void:
	user_info_received.emit(
		str(args[0]) if args.size() > 0 else "",
		str(args[1]) if args.size() > 1 else "")


# ── Share ─────────────────────────────────────────────────────────

func share_app(title: String, image_url: String = "", query: String = "") -> void:
	if _sdk:
		_sdk.shareApp(title, image_url, query)


func show_share_menu() -> void:
	if _sdk:
		_sdk.showShareMenu()


func hide_share_menu() -> void:
	if _sdk:
		_sdk.hideShareMenu()


# ── Rewarded Video Ad ─────────────────────────────────────────────

func create_rewarded_ad(ad_unit_id: String) -> void:
	if not _sdk:
		ad_created.emit("rewarded", false, "Not in mini-game environment")
		return
	var cb := JavaScriptBridge.create_callback(func(args: Array):
		ad_created.emit("rewarded",
			bool(args[0]) if args.size() > 0 else false,
			str(args[1]) if args.size() > 1 else ""))
	_cbs["create_rewarded"] = cb
	_sdk.createRewardedAd(ad_unit_id, cb)


func show_rewarded_ad() -> void:
	if not _sdk:
		rewarded_ad_result.emit(false, "Not in mini-game environment")
		return
	var cb := JavaScriptBridge.create_callback(_on_rewarded_ad)
	_cbs["rewarded_ad"] = cb
	_sdk.showRewardedAd(cb)


func _on_rewarded_ad(args: Array) -> void:
	rewarded_ad_result.emit(
		bool(args[0]) if args.size() > 0 else false,
		str(args[1]) if args.size() > 1 else "")


# ── Banner Ad ─────────────────────────────────────────────────────

func create_banner_ad(ad_unit_id: String) -> void:
	if not _sdk:
		ad_created.emit("banner", false, "Not in mini-game environment")
		return
	var cb := JavaScriptBridge.create_callback(func(args: Array):
		ad_created.emit("banner",
			bool(args[0]) if args.size() > 0 else false,
			str(args[1]) if args.size() > 1 else ""))
	_cbs["create_banner"] = cb
	_sdk.createBannerAd(ad_unit_id, cb)


func show_banner_ad() -> void:
	if _sdk:
		_sdk.showBannerAd()


func hide_banner_ad() -> void:
	if _sdk:
		_sdk.hideBannerAd()


func destroy_banner_ad() -> void:
	if _sdk:
		_sdk.destroyBannerAd()


# ── Interstitial Ad ───────────────────────────────────────────────

func create_interstitial_ad(ad_unit_id: String) -> void:
	if not _sdk:
		ad_created.emit("interstitial", false, "Not in mini-game environment")
		return
	var cb := JavaScriptBridge.create_callback(func(args: Array):
		ad_created.emit("interstitial",
			bool(args[0]) if args.size() > 0 else false,
			str(args[1]) if args.size() > 1 else ""))
	_cbs["create_interstitial"] = cb
	_sdk.createInterstitialAd(ad_unit_id, cb)


func show_interstitial_ad() -> void:
	if not _sdk:
		interstitial_ad_result.emit(false, "Not in mini-game environment")
		return
	var cb := JavaScriptBridge.create_callback(_on_interstitial_ad)
	_cbs["interstitial_ad"] = cb
	_sdk.showInterstitialAd(cb)


func _on_interstitial_ad(args: Array) -> void:
	interstitial_ad_result.emit(
		bool(args[0]) if args.size() > 0 else false,
		str(args[1]) if args.size() > 1 else "")


# ── Payment ───────────────────────────────────────────────────────

func request_payment(params: Dictionary) -> void:
	if not _sdk:
		payment_result.emit(false, "Not in mini-game environment")
		return
	var cb := JavaScriptBridge.create_callback(_on_payment)
	_cbs["payment"] = cb
	_sdk.requestPayment(JSON.stringify(params), cb)


func _on_payment(args: Array) -> void:
	payment_result.emit(
		bool(args[0]) if args.size() > 0 else false,
		str(args[1]) if args.size() > 1 else "")


# ── Vibration ─────────────────────────────────────────────────────

## type: "heavy" | "medium" | "light"
func vibrate_short(type: String = "medium") -> void:
	if _sdk:
		_sdk.vibrateShort(type)


func vibrate_long() -> void:
	if _sdk:
		_sdk.vibrateLong()


# ── Keyboard ──────────────────────────────────────────────────────

func show_keyboard(default_value: String = "", max_length: int = 140, multiple: bool = false) -> void:
	if not _sdk:
		return
	var cb := JavaScriptBridge.create_callback(_on_keyboard)
	_cbs["keyboard"] = cb
	_sdk.showKeyboard(default_value, max_length, multiple, cb)


func _on_keyboard(args: Array) -> void:
	keyboard_event.emit(
		str(args[0]) if args.size() > 0 else "",
		str(args[1]) if args.size() > 1 else "")


func hide_keyboard() -> void:
	if _sdk:
		_sdk.hideKeyboard()


# ── Network / HTTP ────────────────────────────────────────────────

func http_request(url: String, method: String = "GET", data: String = "", headers: Dictionary = {}) -> void:
	if not _sdk:
		http_response.emit(0, "", "Not in mini-game environment")
		return
	var cb := JavaScriptBridge.create_callback(_on_http_response)
	_cbs["http"] = cb
	_sdk.httpRequest(url, method, data, JSON.stringify(headers), cb)


func _on_http_response(args: Array) -> void:
	http_response.emit(
		int(args[0]) if args.size() > 0 else 0,
		str(args[1]) if args.size() > 1 else "",
		str(args[2]) if args.size() > 2 else "")


# ── System Info ───────────────────────────────────────────────────

func get_system_info() -> Dictionary:
	if not _sdk:
		return {}
	var json_str = _sdk.getSystemInfo()
	var result = JSON.parse_string(str(json_str))
	return result if result is Dictionary else {}


func get_launch_options() -> Dictionary:
	if not _sdk:
		return {}
	var json_str = _sdk.getLaunchOptions()
	var result = JSON.parse_string(str(json_str))
	return result if result is Dictionary else {}


func get_window_info() -> Dictionary:
	if not _sdk:
		return {}
	var json_str = _sdk.getWindowInfo()
	var result = JSON.parse_string(str(json_str))
	return result if result is Dictionary else {}


func get_menu_button_rect() -> Dictionary:
	if not _sdk:
		return {}
	var json_str = _sdk.getMenuButtonRect()
	var result = JSON.parse_string(str(json_str))
	return result if result is Dictionary else {}


# ── Lifecycle ─────────────────────────────────────────────────────

func _setup_lifecycle() -> void:
	var show_cb := JavaScriptBridge.create_callback(_on_app_show)
	var hide_cb := JavaScriptBridge.create_callback(_on_app_hide)
	var err_cb := JavaScriptBridge.create_callback(_on_app_error)
	_cbs["app_show"] = show_cb
	_cbs["app_hide"] = hide_cb
	_cbs["app_error"] = err_cb
	_sdk.onAppShow(show_cb)
	_sdk.onAppHide(hide_cb)
	_sdk.onAppError(err_cb)


func _on_app_show(args: Array) -> void:
	app_shown.emit(str(args[0]) if args.size() > 0 else "{}")


func _on_app_hide(_args: Array) -> void:
	app_hidden.emit()


func _on_app_error(args: Array) -> void:
	app_error.emit(str(args[0]) if args.size() > 0 else "")


# ── Clipboard ─────────────────────────────────────────────────────

func set_clipboard(data: String) -> void:
	if _sdk:
		_sdk.setClipboard(data)


func get_clipboard() -> void:
	if not _sdk:
		clipboard_received.emit("", "Not in mini-game environment")
		return
	var cb := JavaScriptBridge.create_callback(_on_clipboard)
	_cbs["clipboard"] = cb
	_sdk.getClipboard(cb)


func _on_clipboard(args: Array) -> void:
	clipboard_received.emit(
		str(args[0]) if args.size() > 0 else "",
		str(args[1]) if args.size() > 1 else "")


# ── Screen ────────────────────────────────────────────────────────

func set_keep_screen_on(keep_on: bool) -> void:
	if _sdk:
		_sdk.setKeepScreenOn(keep_on)


# ── Toast / Modal (platform native UI) ────────────────────────────

## icon: "success" | "error" | "loading" | "none"
func show_toast(title: String, icon: String = "none", duration_ms: int = 1500) -> void:
	if _sdk:
		_sdk.showToast(title, icon, duration_ms)


func show_modal(title: String, content: String) -> void:
	if not _sdk:
		modal_result.emit(false)
		return
	var cb := JavaScriptBridge.create_callback(_on_modal)
	_cbs["modal"] = cb
	_sdk.showModal(title, content, cb)


func _on_modal(args: Array) -> void:
	modal_result.emit(bool(args[0]) if args.size() > 0 else false)


func show_loading(title: String = "Loading...") -> void:
	if _sdk:
		_sdk.showLoading(title)


func hide_loading() -> void:
	if _sdk:
		_sdk.hideLoading()
