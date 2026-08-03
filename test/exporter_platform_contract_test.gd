extends SceneTree

const Exporter = preload("res://addons/godot_mini_game/exporter.gd")

var _failed := false
var _root := OS.get_temp_dir().path_join(
	"godot-mini-game-platform-contract-%d-%d" % [
		OS.get_process_id(), Time.get_ticks_usec(),
	]
)


func _assert_true(value: bool, message: String) -> void:
	if value:
		return
	push_error(message)
	_failed = true


func _write(path: String, content: String) -> void:
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var file := FileAccess.open(path, FileAccess.WRITE)
	if not file:
		_assert_true(false, "cannot write fixture: %s" % path)
		return
	file.store_string(content)
	file.close()


func _copy(src: String, dst: String) -> void:
	DirAccess.make_dir_recursive_absolute(dst.get_base_dir())
	var input := FileAccess.open(src, FileAccess.READ)
	if not input:
		_assert_true(false, "cannot read fixture source: %s" % src)
		return
	var data := input.get_buffer(input.get_length())
	input.close()
	var output := FileAccess.open(dst, FileAccess.WRITE)
	if not output:
		_assert_true(false, "cannot copy fixture: %s" % dst)
		return
	output.store_buffer(data)
	output.close()


func _read(path: String) -> String:
	var file := FileAccess.open(path, FileAccess.READ)
	if not file:
		return ""
	var content := file.get_as_text()
	file.close()
	return content


func _read_json(path: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(_read(path))
	return parsed if parsed is Dictionary else {}


func _init() -> void:
	var exporter := Exporter.new()
	DirAccess.make_dir_recursive_absolute(_root)
	_assert_true(
		Array(Exporter.SUPPORTED_PLATFORMS) == ["wechat", "douyin", "tiktok"],
		"the exporter must expose all three native platforms",
	)
	var expected_contracts := {
		"wechat": {"api_namespace": "wx", "subpackage_field": "subpackages"},
		"douyin": {"api_namespace": "tt", "subpackage_field": "subPackages"},
		"tiktok": {
			"api_namespace": "TTMinis.game",
			"subpackage_field": "subpackages",
		},
	}

	for platform in Exporter.SUPPORTED_PLATFORMS:
		var output := _root.path_join("templates-" + platform)
		var error := exporter._copy_platform_templates(
			platform, output, "test-client-key", "landscape")
		_assert_true(error == OK, "%s templates should render" % platform)
		var contract: Dictionary = Exporter.PLATFORM_CONTRACTS[platform]
		var expected_contract: Dictionary = expected_contracts[platform]
		_assert_true(
			str(contract.runtime_type) == "native"
			and str(contract.api_namespace) == str(expected_contract.api_namespace)
			and str(contract.subpackage_field)
			== str(expected_contract.subpackage_field),
			"%s exporter contract must match the certified provider" % platform,
		)
		var entry := _read(output.path_join("game.js"))
		_assert_true(
			entry.contains('PlatformRuntime.requirePlatform("%s"' % platform),
			"%s entrypoint must require its own provider" % platform,
		)
		var game_config := _read_json(output.path_join("game.json"))
		var expected_field := str(contract.subpackage_field)
		var forbidden_field := (
			"subPackages" if expected_field == "subpackages" else "subpackages")
		_assert_true(
			game_config.get(expected_field, null) is Array,
			"%s must use %s" % [platform, expected_field],
		)
		_assert_true(
			not game_config.has(forbidden_field),
			"%s must reject the other subpackage field casing" % platform,
		)
		var project_config := _read_json(output.path_join("project.config.json"))
		_assert_true(
			str(project_config.get("appid", "")) == "test-client-key",
			"%s project config must carry App ID / Client Key" % platform,
		)
		_assert_true(
			FileAccess.file_exists(output.path_join("project.private.config.json"))
			== bool(contract.requires_private_config),
			"%s private config requirement must match its contract" % platform,
		)
		_write(output.path_join("js/libs/godot.js"), "safe engine wrapper\n")
		_assert_true(
			exporter._validate_platform_configuration(output, platform) == OK,
			"%s rendered configuration should validate" % platform,
		)

	var wrong_case := _root.path_join("templates-tiktok/game.json")
	var wrong_config := _read_json(wrong_case)
	wrong_config["subPackages"] = wrong_config.get("subpackages", [])
	wrong_config.erase("subpackages")
	_write(wrong_case, JSON.stringify(wrong_config) + "\n")
	_assert_true(
		exporter._validate_platform_configuration(
			_root.path_join("templates-tiktok"), "tiktok") == ERR_INVALID_DATA,
		"TikTok must fail closed on camel-case subPackages",
	)

	var engine_source := "res://addons/godot_mini_game/engine/godot.js"
	var tiktok_engine := _root.path_join("patched-tiktok.js")
	_copy(engine_source, tiktok_engine)
	var patch_error := exporter._patch_godot_js(tiktok_engine, "tiktok")
	_assert_true(patch_error == OK, "certified godot.js should patch for TikTok")
	var patched := _read(tiktok_engine)
	_assert_true(
		not patched.contains("eval("),
		"TikTok engine output must not contain an eval( token",
	)
	for marker in [
		'Module["copyFSToAdapter"]=',
		'Module["ensureFSDirectory"]=',
		"copyFSToAdapter: function (adapter, roots)",
		"ensureFSDirectory: function (path)",
		"Engine.prototype['copyFSToAdapter']",
		"Engine.prototype['ensureFSDirectory']",
		"var instantiateOperation=Module[\"instantiateWasm\"]",
		"return operation;",
		"godot_js_eval:_godot_js_disabled",
	]:
		_assert_true(patched.contains(marker), "patched engine missing: %s" % marker)
	var syntax_output: Array = []
	var syntax_exit := OS.execute(
		"node", ["--check", tiktok_engine], syntax_output, true)
	_assert_true(
		syntax_exit == 0,
		"patched TikTok engine must remain valid JavaScript: %s"
		% "\n".join(syntax_output),
	)
	_assert_true(
		exporter._patch_godot_js(tiktok_engine, "tiktok") == OK,
		"godot.js patching must be idempotent",
	)

	var wechat_engine := _root.path_join("patched-wechat.js")
	_copy(engine_source, wechat_engine)
	_assert_true(
		exporter._patch_godot_js(wechat_engine, "wechat") == OK,
		"certified godot.js should patch for WeChat",
	)
	_assert_true(
		_read(wechat_engine).contains("eval("),
		"the TikTok eval restriction must not silently change other platforms",
	)

	var unknown_engine := _root.path_join("unknown-engine.js")
	_write(unknown_engine, "var Engine = {};\n")
	_assert_true(
		exporter._patch_godot_js(unknown_engine, "tiktok") == ERR_FILE_CORRUPT,
		"unknown engine wrappers must fail closed instead of skipping patches",
	)

	exporter._rm_rf(_root)
	if _failed:
		quit(1)
		return
	print("exporter_platform_contract_test.gd: ok")
	quit(0)
