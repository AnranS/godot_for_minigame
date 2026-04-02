@tool
extends EditorPlugin

const SDK_AUTOLOAD := "MiniGameSDK"
const SDK_PATH := "res://addons/godot_mini_game/MiniGameSDK.gd"

var dock: Control

func _enter_tree() -> void:
	dock = preload("res://addons/godot_mini_game/export_dock.tscn").instantiate()
	dock.editor_plugin = self
	add_control_to_dock(DOCK_SLOT_RIGHT_BL, dock)

	if not ProjectSettings.has_setting("autoload/" + SDK_AUTOLOAD):
		add_autoload_singleton(SDK_AUTOLOAD, SDK_PATH)

func _exit_tree() -> void:
	if dock:
		remove_control_from_docks(dock)
		dock.queue_free()
	remove_autoload_singleton(SDK_AUTOLOAD)
