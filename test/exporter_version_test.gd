extends SceneTree

const Exporter = preload("res://addons/godot_mini_game/exporter.gd")

var _failed := false


func _assert_eq(actual: Variant, expected: Variant, message: String) -> void:
	if actual != expected:
		push_error("%s: expected %s, got %s" % [message, str(expected), str(actual)])
		_failed = true


func _candidate(source: String, version: String, ready: bool = true) -> Dictionary:
	return {
		"source": source,
		"template_version": version,
		"ready": ready,
		"version_match": false,
	}


func _init() -> void:
	_assert_eq(
		Exporter._version_key_from_string("4.6.1-stable"),
		"4.6.1.stable",
		"hyphenated template versions should keep patch and status"
	)
	_assert_eq(
		Exporter._version_key_from_string("4.6.3.stable"),
		"4.6.3.stable",
		"dot-separated template versions should keep patch and status"
	)
	_assert_eq(
		Exporter._version_key_from_string("4.6"),
		"4.6",
		"legacy major.minor template versions should still parse"
	)
	var standard_dirs := Array(Exporter._standard_template_base_dirs(
		"4.6.3.stable", "/xdg/data", "/xdg/config", "Linux"))
	_assert_eq(standard_dirs, [
		"/xdg/data/godot/export_templates/4.6.3.stable",
		"/xdg/data/Godot/export_templates/4.6.3.stable",
		"/xdg/config/godot/export_templates/4.6.3.stable",
		"/xdg/config/Godot/export_templates/4.6.3.stable",
	], "standard template discovery should cover Linux data and config/case fallbacks")
	var standard_zips := Exporter._standard_template_zip_paths(
		"4.6.3.stable", "/xdg/data", "/xdg/config", "Linux")
	_assert_eq(
		standard_zips[0],
		"/xdg/data/godot/export_templates/4.6.3.stable/web_nothreads_release.zip",
		"nothreads release template should remain the first standard fallback"
	)
	_assert_eq(
		Exporter._standard_template_base_dirs(
			"4.6.3.stable", "/data", "/config", "macOS")[0],
		"/data/Godot/export_templates/4.6.3.stable",
		"capitalized Godot directory should be preferred on macOS/Windows"
	)

	var candidates: Array[Dictionary] = [
		_candidate("bundled", "4.6.1.stable"),
		_candidate("standard", "4.6.3.stable"),
	]
	var selected := Exporter._select_template_candidate(candidates, "4.6.3.stable")
	_assert_eq(selected.get("source"), "standard", "exact standard template should beat stale bundled template")
	_assert_eq(selected.get("version_match"), true, "selected exact template should be marked compatible")

	candidates = [
		_candidate("store", "4.6.3.stable"),
		_candidate("bundled", "4.6.1.stable"),
		_candidate("standard", "4.6.3.stable"),
	]
	selected = Exporter._select_template_candidate(candidates, "4.6.3.stable")
	_assert_eq(selected.get("source"), "store", "imported exact template should take precedence")

	candidates = [_candidate("addon", "")]
	selected = Exporter._select_template_candidate(candidates, "4.6.3.stable")
	_assert_eq(selected.get("version_match"), false, "unversioned manual template must not be silently compatible")

	var escaped := Exporter._json_string_content("app\\id\"\nname")
	var parsed := JSON.parse_string('{"value":"%s"}' % escaped) as Dictionary
	_assert_eq(parsed.get("value"), "app\\id\"\nname", "template replacement should JSON-escape values")

	var status := Exporter.get_template_status()
	_assert_eq(status.get("version_match"), true, "local exact engine fallback should be discoverable")
	_assert_eq(status.get("template_version"), Exporter.get_godot_version_key(), "resolved template must match local Godot exactly")

	_assert_eq(
		Array(Exporter.get_web_export_preset_names()),
		["MiniGame"],
		"only the configured Web preset should be returned"
	)
	if _failed:
		quit(1)
		return
	print("exporter_version_test.gd: ok")
	quit(0)
