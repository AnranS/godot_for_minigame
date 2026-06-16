extends SceneTree


func _fail(message: String) -> void:
	push_error(message)
	quit(1)


func _init() -> void:
	var scene_file := FileAccess.open("res://scenes/main.tscn", FileAccess.READ)
	if scene_file == null:
		_fail("Unable to read scenes/main.tscn")
		return

	var scene_text := scene_file.get_as_text()
	scene_file.close()

	var audio_node_pos := scene_text.find("[node name=\"AudioPlayer\"")
	if audio_node_pos == -1:
		_fail("Demo scene should contain an AudioPlayer node")
		return

	var audio_node_text := scene_text.substr(audio_node_pos)
	if audio_node_text.find("stream = ") == -1:
		_fail("Demo AudioPlayer should declare a stream so the Play button is audible")
		return

	var main_file := FileAccess.open("res://scripts/main.gd", FileAccess.READ)
	if main_file == null:
		_fail("Unable to read scripts/main.gd")
		return
	var main_text := main_file.get_as_text()
	main_file.close()

	if main_text.find("audio/demo-tone.wav") == -1:
		_fail("Demo inner audio tests should reference the bundled demo tone")
		return
	if not FileAccess.file_exists("res://addons/godot_mini_game/templates/common/audio/demo-tone.wav"):
		_fail("Bundled demo tone is missing from the common export templates")
		return

	var exporter_file := FileAccess.open("res://addons/godot_mini_game/exporter.gd", FileAccess.READ)
	if exporter_file == null:
		_fail("Unable to read exporter.gd")
		return
	var exporter_text := exporter_file.get_as_text()
	exporter_file.close()
	if exporter_text.find("\"audio/demo-tone.wav\"") == -1:
		_fail("Exporter should copy the bundled demo tone into mini-game output")
		return

	print("demo_audio_test.gd: ok")
	quit(0)
