extends Node
## Unified mini-game platform SDK (WeChat / Douyin).
##
## Add as an autoload (singleton) named "MiniGameSDK".
## All async results are delivered via signals.
## Synchronous methods (storage, vibration, etc.) return immediately.
## Outside a mini-game runtime every method is a safe fallback (no crash,
## signal emitted with an error string, getters return defaults).

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

const NOT_IN_RUNTIME := "Not in mini-game environment"

var _sdk: JavaScriptObject = null

# Callbacks must be kept alive on the GDScript side, otherwise the
# JavaScriptBridge garbage-collects them and the JS side fires into
# nothing. We give each callback a unique id and store it in `_cbs`.
# One-shot callbacks (login, payment, ad, modal, ...) erase themselves
# from `_cbs` after first invocation, so concurrent calls don't overwrite
# each other and we don't leak forever. Persistent callbacks (lifecycle
# events: onAppShow / onAppHide / onAppError) stay for the SDK's lifetime.
var _cbs: Dictionary = {}
var _cb_counter: int = 0

## True when running inside a mini-game runtime with the JS SDK available.
var is_mini_game: bool:
	get: return _sdk != null


func _ready() -> void:
	if not OS.has_feature("web"):
		return
	_sdk = JavaScriptBridge.get_interface("godotSdk")
	if _sdk:
		_setup_lifecycle()


# ── Internal helpers ──────────────────────────────────────────────

## Wraps `handler` so that JS can invoke it exactly once. The wrapper
## removes itself from `_cbs` after firing, which is what lets the
## JavaScriptBridge eventually release it.
func _track_oneshot(handler: Callable) -> JavaScriptObject:
	var id := _cb_counter
	_cb_counter += 1
	var cb := JavaScriptBridge.create_callback(func(args: Array) -> void:
		_cbs.erase(id)
		handler.call(args))
	_cbs[id] = cb
	return cb


## Wraps a long-lived `handler` (e.g. lifecycle hooks fired many times).
## Kept alive for the SDK's lifetime.
func _track_persistent(handler: Callable) -> JavaScriptObject:
	var id := _cb_counter
	_cb_counter += 1
	var cb := JavaScriptBridge.create_callback(handler)
	_cbs[id] = cb
	return cb


## str() but null-safe. `str(null)` returns "<null>" in GDScript 4,
## which downstream `error.is_empty()` checks would misread as a
## non-empty error message.
static func _s(v: Variant) -> String:
	return "" if v == null else str(v)


## bool() but null-safe.
static func _b(v: Variant) -> bool:
	return false if v == null else bool(v)


## int() but null-safe.
static func _i(v: Variant) -> int:
	if v == null:
		return 0
	if v is int or v is float or v is bool:
		return int(v)
	var s := str(v)
	return s.to_int() if s.is_valid_int() else 0


# ── Storage (synchronous) ─────────────────────────────────────────

func storage_set(key: String, value: String) -> void:
	if _sdk:
		_sdk.storageSet(key, value)


func storage_get(key: String, default_value: String = "") -> String:
	if not _sdk:
		return default_value
	var result: Variant = _sdk.storageGet(key, default_value)
	if result == null:
		return default_value
	var s := str(result)
	# Defensive: JS bridges occasionally surface JS `undefined` as the
	# literal string "undefined". Treat it as missing.
	if s == "undefined" or s == "<null>":
		return default_value
	return s


func storage_remove(key: String) -> void:
	if _sdk:
		_sdk.storageRemove(key)


func storage_clear() -> void:
	if _sdk:
		_sdk.storageClear()


## Returns { "keys": Array[String], "size": int, "limit": int }
## or an empty Dictionary outside the mini-game runtime.
func storage_info() -> Dictionary:
	if not _sdk:
		return {}
	var json_str: Variant = _sdk.storageGetAll()
	if json_str == null:
		return {}
	var parsed: Variant = JSON.parse_string(str(json_str))
	return parsed if parsed is Dictionary else {}


# ── Auth / Login ──────────────────────────────────────────────────

func login() -> void:
	if not _sdk:
		login_completed.emit("", NOT_IN_RUNTIME)
		return
	_sdk.login(_track_oneshot(_on_login))


func _on_login(args: Array) -> void:
	login_completed.emit(
		_s(args[0]) if args.size() > 0 else "",
		_s(args[1]) if args.size() > 1 else "")


func check_session() -> void:
	if not _sdk:
		session_checked.emit(false, NOT_IN_RUNTIME)
		return
	_sdk.checkSession(_track_oneshot(_on_check_session))


func _on_check_session(args: Array) -> void:
	session_checked.emit(
		_b(args[0]) if args.size() > 0 else false,
		_s(args[1]) if args.size() > 1 else "")


func get_user_info() -> void:
	if not _sdk:
		user_info_received.emit("", NOT_IN_RUNTIME)
		return
	_sdk.getUserInfo(_track_oneshot(_on_user_info))


func _on_user_info(args: Array) -> void:
	user_info_received.emit(
		_s(args[0]) if args.size() > 0 else "",
		_s(args[1]) if args.size() > 1 else "")


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
		ad_created.emit("rewarded", false, NOT_IN_RUNTIME)
		return
	_sdk.createRewardedAd(ad_unit_id, _track_oneshot(_on_ad_created.bind("rewarded")))


func show_rewarded_ad() -> void:
	if not _sdk:
		rewarded_ad_result.emit(false, NOT_IN_RUNTIME)
		return
	_sdk.showRewardedAd(_track_oneshot(_on_rewarded_ad))


func _on_rewarded_ad(args: Array) -> void:
	rewarded_ad_result.emit(
		_b(args[0]) if args.size() > 0 else false,
		_s(args[1]) if args.size() > 1 else "")


# ── Banner Ad ─────────────────────────────────────────────────────

func create_banner_ad(ad_unit_id: String) -> void:
	if not _sdk:
		ad_created.emit("banner", false, NOT_IN_RUNTIME)
		return
	_sdk.createBannerAd(ad_unit_id, _track_oneshot(_on_ad_created.bind("banner")))


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
		ad_created.emit("interstitial", false, NOT_IN_RUNTIME)
		return
	_sdk.createInterstitialAd(ad_unit_id, _track_oneshot(_on_ad_created.bind("interstitial")))


func show_interstitial_ad() -> void:
	if not _sdk:
		interstitial_ad_result.emit(false, NOT_IN_RUNTIME)
		return
	_sdk.showInterstitialAd(_track_oneshot(_on_interstitial_ad))


func _on_interstitial_ad(args: Array) -> void:
	interstitial_ad_result.emit(
		_b(args[0]) if args.size() > 0 else false,
		_s(args[1]) if args.size() > 1 else "")


## Shared handler for the three ad-create flows. `ad_type` is bound
## by the caller so we can route to a single ad_created signal.
func _on_ad_created(args: Array, ad_type: String) -> void:
	ad_created.emit(
		ad_type,
		_b(args[0]) if args.size() > 0 else false,
		_s(args[1]) if args.size() > 1 else "")


# ── Payment ───────────────────────────────────────────────────────

func request_payment(params: Dictionary) -> void:
	if not _sdk:
		payment_result.emit(false, NOT_IN_RUNTIME)
		return
	_sdk.requestPayment(JSON.stringify(params), _track_oneshot(_on_payment))


func _on_payment(args: Array) -> void:
	payment_result.emit(
		_b(args[0]) if args.size() > 0 else false,
		_s(args[1]) if args.size() > 1 else "")


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
	# Keyboard fires multiple events (input/confirm/complete) so it is
	# tracked as persistent — the JS side decides when to stop emitting.
	_sdk.showKeyboard(default_value, max_length, multiple, _track_persistent(_on_keyboard))


func _on_keyboard(args: Array) -> void:
	keyboard_event.emit(
		_s(args[0]) if args.size() > 0 else "",
		_s(args[1]) if args.size() > 1 else "")


func hide_keyboard() -> void:
	if _sdk:
		_sdk.hideKeyboard()


# ── Network / HTTP ────────────────────────────────────────────────

func http_request(url: String, method: String = "GET", data: String = "", headers: Dictionary = {}) -> void:
	if not _sdk:
		http_response.emit(0, "", NOT_IN_RUNTIME)
		return
	_sdk.httpRequest(url, method, data, JSON.stringify(headers), _track_oneshot(_on_http_response))


func _on_http_response(args: Array) -> void:
	http_response.emit(
		_i(args[0]) if args.size() > 0 else 0,
		_s(args[1]) if args.size() > 1 else "",
		_s(args[2]) if args.size() > 2 else "")


# ── System Info ───────────────────────────────────────────────────

func get_system_info() -> Dictionary:
	return _parse_json_object(_sdk.getSystemInfo() if _sdk else null)


func get_launch_options() -> Dictionary:
	return _parse_json_object(_sdk.getLaunchOptions() if _sdk else null)


func get_window_info() -> Dictionary:
	return _parse_json_object(_sdk.getWindowInfo() if _sdk else null)


func get_menu_button_rect() -> Dictionary:
	return _parse_json_object(_sdk.getMenuButtonRect() if _sdk else null)


static func _parse_json_object(json_str: Variant) -> Dictionary:
	if json_str == null:
		return {}
	var parsed: Variant = JSON.parse_string(str(json_str))
	return parsed if parsed is Dictionary else {}


# ── Lifecycle ─────────────────────────────────────────────────────

func _setup_lifecycle() -> void:
	_sdk.onAppShow(_track_persistent(_on_app_show))
	_sdk.onAppHide(_track_persistent(_on_app_hide))
	_sdk.onAppError(_track_persistent(_on_app_error))


func _on_app_show(args: Array) -> void:
	app_shown.emit(_s(args[0]) if args.size() > 0 else "{}")


func _on_app_hide(_args: Array) -> void:
	app_hidden.emit()


func _on_app_error(args: Array) -> void:
	app_error.emit(_s(args[0]) if args.size() > 0 else "")


# ── Clipboard ─────────────────────────────────────────────────────

func set_clipboard(data: String) -> void:
	if _sdk:
		_sdk.setClipboard(data)


func get_clipboard() -> void:
	if not _sdk:
		clipboard_received.emit("", NOT_IN_RUNTIME)
		return
	_sdk.getClipboard(_track_oneshot(_on_clipboard))


func _on_clipboard(args: Array) -> void:
	clipboard_received.emit(
		_s(args[0]) if args.size() > 0 else "",
		_s(args[1]) if args.size() > 1 else "")


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
	_sdk.showModal(title, content, _track_oneshot(_on_modal))


func _on_modal(args: Array) -> void:
	modal_result.emit(_b(args[0]) if args.size() > 0 else false)


func show_loading(title: String = "Loading...") -> void:
	if _sdk:
		_sdk.showLoading(title)


func hide_loading() -> void:
	if _sdk:
		_sdk.hideLoading()
