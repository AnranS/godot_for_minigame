extends SceneTree

const Exporter = preload("res://addons/godot_mini_game/exporter.gd")
const TemplateBundle = preload("res://addons/godot_mini_game/core/template_bundle.gd")


func _init() -> void:
	var status: Dictionary = Exporter.get_template_status()
	var expected_source: String = (
		"bundled"
		if OS.get_environment("EXPECTED_SOURCE") == "bundled"
		else "store"
	)
	var valid: bool = (
		bool(status.get("ready", false))
		and str(status.get("source", "")) == expected_source
		and str(status.get("template_version", ""))
			== OS.get_environment("EXPECTED_GODOT_VERSION")
		and str(status.get("template_commit", ""))
			== OS.get_environment("EXPECTED_GODOT_COMMIT")
		and str(status.get("emscripten_version", ""))
			== OS.get_environment("EXPECTED_EMSCRIPTEN_VERSION")
		and str(status.get("profile", "")) == OS.get_environment("EXPECTED_PROFILE")
		and str(status.get("target", "")) == OS.get_environment("EXPECTED_TARGET")
		and int(status.get("template_revision", 0))
			== int(OS.get_environment("EXPECTED_REVISION"))
		and int(status.get("bridge_abi", 0))
			== int(OS.get_environment("EXPECTED_BRIDGE_ABI"))
		and TemplateBundle.SCHEMA_VERSION
			== int(OS.get_environment("EXPECTED_TEMPLATE_SCHEMA"))
	)
	print(JSON.stringify(status))
	if not valid:
		push_error("Selected template does not match the certified identity")
	quit(0 if valid else 1)
