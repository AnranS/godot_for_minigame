extends SceneTree

const Exporter = preload("res://addons/godot_mini_game/exporter.gd")


func _init() -> void:
	_run.call_deferred()


func _find_web_preset() -> String:
	var config := ConfigFile.new()
	if config.load("res://export_presets.cfg") != OK:
		return ""
	for section in config.get_sections():
		if (
			section.begins_with("preset.")
			and str(config.get_value(section, "platform", "")) == "Web"
		):
			return str(config.get_value(section, "name", ""))
	return ""


func _run() -> void:
	var exporter := Exporter.new()
	var preset_name := _find_web_preset()
	if preset_name.is_empty():
		push_error("exporter smoke test requires a Web export preset")
		quit(1)
		return
	var root := OS.get_temp_dir().path_join(
		"godot-mini-game-smoke-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()]
	)
	var output := root.path_join("shared-output")
	for platform in Exporter.SUPPORTED_PLATFORMS:
		var err := await exporter.export_mini_game(
			platform, "test-app", "portrait", preset_name, output)
		var game_config := Exporter._read_json_dictionary(
			output.path_join("game.json"))
		var expected_subpackage_field := str(
			Exporter.PLATFORM_CONTRACTS[platform].subpackage_field)
		var engine_js := Exporter._read_text(
			output.path_join("js/libs/godot.js"))
		var valid := (
			err == OK
			and FileAccess.file_exists(output.path_join(Exporter.OUTPUT_MANIFEST))
			and FileAccess.file_exists(output.path_join("js/platform_runtime.js"))
			and FileAccess.file_exists(output.path_join("engine/godot.zip"))
			and game_config.get(expected_subpackage_field, null) is Array
			and engine_js.contains('Module["copyFSToAdapter"]=')
			and engine_js.contains('Module["ensureFSDirectory"]=')
			and (platform != "tiktok" or not engine_js.contains("eval("))
			and (
				platform != "tiktok"
				or (
					Exporter._is_nonempty_file(
						output.path_join("engine/game.js"))
					and Exporter._is_nonempty_file(
						output.path_join("subpacks/game.js"))
				)
			)
			and (
				FileAccess.file_exists(output.path_join("project.private.config.json"))
				if bool(Exporter.PLATFORM_CONTRACTS[platform].requires_private_config)
				else not FileAccess.file_exists(output.path_join("project.private.config.json"))
			)
		)
		if not valid:
			exporter._rm_rf(root)
			push_error("%s exporter smoke test failed: %s" % [platform, error_string(err)])
			quit(1)
			return
	exporter._rm_rf(root)
	print("exporter_smoke_test.gd: ok")
	quit(0)
