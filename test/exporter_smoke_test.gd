extends SceneTree

const Exporter = preload("res://addons/godot_mini_game/exporter.gd")


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var exporter := Exporter.new()
	var root := OS.get_temp_dir().path_join(
		"godot-mini-game-smoke-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()]
	)
	var output := root.path_join("shared-output")
	for platform in ["wechat", "douyin"]:
		var err := await exporter.export_mini_game(
			platform, "test-app", "portrait", "Web", output)
		var valid := (
			err == OK
			and FileAccess.file_exists(output.path_join(Exporter.OUTPUT_MANIFEST))
			and FileAccess.file_exists(output.path_join("js/platform_runtime.js"))
			and FileAccess.file_exists(output.path_join("engine/godot.zip"))
			and (
				FileAccess.file_exists(output.path_join("project.private.config.json"))
				if platform == "wechat"
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
