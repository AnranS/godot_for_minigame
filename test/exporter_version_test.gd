extends SceneTree

const Exporter = preload("res://addons/godot_mini_game/exporter.gd")

var _failed := false


func _assert_eq(actual: Variant, expected: Variant, message: String) -> void:
	if actual != expected:
		push_error("%s: expected %s, got %s" % [message, str(expected), str(actual)])
		_failed = true


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
	if _failed:
		quit(1)
		return
	print("exporter_version_test.gd: ok")
	quit(0)
