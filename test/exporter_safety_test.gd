extends SceneTree

const Exporter = preload("res://addons/godot_mini_game/exporter.gd")

var _failed := false
var _test_root := "/tmp/godot_mini_game_exporter_safety_%d" % OS.get_process_id()


func _assert_eq(actual: Variant, expected: Variant, message: String) -> void:
	if actual != expected:
		push_error("%s: expected %s, got %s" % [message, str(expected), str(actual)])
		_failed = true


func _write(path: String, content: String) -> Error:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if not file:
		return FileAccess.get_open_error()
	file.store_string(content)
	var err := file.get_error()
	file.close()
	return err


func _remove_tree(path: String) -> void:
	var dir := DirAccess.open(path)
	if not dir:
		return
	dir.list_dir_begin()
	var entry := dir.get_next()
	while not entry.is_empty():
		if dir.current_is_dir() and not dir.is_link(entry):
			_remove_tree(path.path_join(entry))
		else:
			dir.remove(entry)
		entry = dir.get_next()
	dir.list_dir_end()
	DirAccess.remove_absolute(path)


func _make_zip_without_version(path: String) -> Error:
	var packer := ZIPPacker.new()
	var err := packer.open(path)
	if err != OK:
		return err
	err = packer.start_file("godot.js")
	if err == OK:
		err = packer.write_file("fake-js".to_utf8_buffer())
	if err == OK:
		err = packer.close_file()
	if err == OK:
		err = packer.start_file("godot.wasm.br")
	if err == OK:
		err = packer.write_file("fake-br".to_utf8_buffer())
	if err == OK:
		err = packer.close_file()
	packer.close()
	return err


func _make_empty_standard_zip(path: String) -> Error:
	var packer := ZIPPacker.new()
	var err := packer.open(path)
	if err == OK:
		err = packer.start_file("godot.js")
	if err == OK:
		err = packer.close_file()
	if err == OK:
		err = packer.start_file("godot.wasm")
	if err == OK:
		err = packer.close_file()
	packer.close()
	return err


func _init() -> void:
	_remove_tree(_test_root)
	_assert_eq(DirAccess.make_dir_recursive_absolute(_test_root), OK, "test output directory should be created")

	var validation := Exporter.validate_output_dir(_test_root)
	_assert_eq(validation.get("error"), OK, "empty output directory should be accepted")

	_assert_eq(_write(_test_root.path_join("unrelated.txt"), "keep"), OK, "unrelated test file should be written")
	validation = Exporter.validate_output_dir(_test_root)
	_assert_eq(validation.get("error"), ERR_ALREADY_EXISTS, "unmarked non-empty directory should be rejected")
	var exporter := Exporter.new()
	var export_err: Error = await exporter.export_mini_game(
		"wechat", "wxtest", "portrait", "MiniGame", _test_root)
	_assert_eq(export_err, ERR_ALREADY_EXISTS, "public export entry point must return unsafe-output failure")

	_assert_eq(
		_write(_test_root.path_join(Exporter.EXPORT_MARKER), Exporter.EXPORT_MARKER_CONTENT),
		OK,
		"valid marker should be written"
	)
	validation = Exporter.validate_output_dir(_test_root)
	_assert_eq(validation.get("error"), OK, "marked output directory should be reusable")

	_assert_eq(
		Exporter.validate_output_dir(ProjectSettings.globalize_path("res://")).get("error"),
		ERR_INVALID_PARAMETER,
		"project root must be rejected"
	)
	_assert_eq(
		Exporter.validate_output_dir(ProjectSettings.globalize_path("res://test/export")).get("error"),
		ERR_INVALID_PARAMETER,
		"directory inside project must be rejected"
	)
	_assert_eq(
		Exporter.validate_output_dir(ProjectSettings.globalize_path("res://").get_base_dir()).get("error"),
		ERR_INVALID_PARAMETER,
		"project ancestor must be rejected"
	)
	if OS.get_name() != "Windows":
		var project_link := _test_root.path_join("project-link")
		var link_output: Array = []
		var link_exit := OS.execute("ln", ["-s", ProjectSettings.globalize_path("res://"), project_link], link_output, true)
		_assert_eq(link_exit, 0, "project symlink fixture should be created")
		if link_exit == 0:
			_assert_eq(
				Exporter.validate_output_dir(project_link.path_join("future-output")).get("error"),
				ERR_INVALID_PARAMETER,
				"non-existent output below a symlink into the project must be rejected"
			)

	var template_path := _test_root.path_join("config.json.template")
	var output_path := _test_root.path_join("config.json")
	_assert_eq(
		_write(template_path, '{"appid":"{{APPID}}","name":"{{NAME}}","orientation":"{{ORIENTATION}}"}'),
		OK,
		"JSON test template should be written"
	)
	_assert_eq(
		exporter._copy_template(template_path, output_path, "id\\\"\n", "portrait", "A\\B\"\nC"),
		OK,
		"escaped JSON template should be generated"
	)
	var generated := FileAccess.get_file_as_string(output_path)
	var parsed := JSON.parse_string(generated) as Dictionary
	_assert_eq(parsed.get("appid"), "id\\\"\n", "appid should round-trip through JSON")
	_assert_eq(parsed.get("name"), "A\\B\"\nC", "project name should round-trip through JSON")
	_assert_eq(
		exporter._copy_template(_test_root.path_join("missing.template"), output_path, "", "portrait", ""),
		ERR_FILE_NOT_FOUND,
		"missing required template should return an error"
	)

	var no_version_zip := _test_root.path_join("no-version.zip")
	_assert_eq(_make_zip_without_version(no_version_zip), OK, "versionless template ZIP fixture should be created")
	_assert_eq(
		exporter.import_template_zip(no_version_zip),
		ERR_INVALID_DATA,
		"template ZIP without version.txt must be rejected"
	)
	var empty_standard_zip := _test_root.path_join("empty-standard.zip")
	_assert_eq(_make_empty_standard_zip(empty_standard_zip), OK, "empty standard ZIP fixture should be created")
	_assert_eq(
		exporter._validate_engine_template_files({
			"source": "standard",
			"zip_path": empty_standard_zip,
		}),
		ERR_FILE_CORRUPT,
		"standard ZIP entries must contain data"
	)
	var empty_engine_dir := _test_root.path_join("empty-engine")
	_assert_eq(DirAccess.make_dir_recursive_absolute(empty_engine_dir), OK, "empty engine fixture should be created")
	_assert_eq(_write(empty_engine_dir.path_join("godot.js"), ""), OK, "empty JS fixture should be written")
	_assert_eq(_write(empty_engine_dir.path_join("godot.wasm.br"), ""), OK, "empty WASM fixture should be written")
	var empty_candidate := Exporter._directory_template_candidate(
		"test", empty_engine_dir, Exporter.get_godot_version_key(), Exporter.get_godot_version_key())
	_assert_eq(
		exporter._validate_engine_template_files(empty_candidate),
		ERR_FILE_CORRUPT,
		"directory engine templates must reject zero-byte files"
	)
	_assert_eq(
		exporter._validate_brotli_file("res://addons/godot_mini_game/engine/godot.wasm.br"),
		OK,
		"bundled Brotli engine should pass non-destructive stream validation"
	)

	var live_store := _test_root.path_join("store-live")
	var staging_store := _test_root.path_join("store-stage")
	_assert_eq(DirAccess.make_dir_recursive_absolute(live_store), OK, "live store fixture should be created")
	_assert_eq(DirAccess.make_dir_recursive_absolute(staging_store), OK, "staging store fixture should be created")
	_assert_eq(_write(live_store.path_join("identity.txt"), "old"), OK, "old store fixture should be written")
	_assert_eq(_write(staging_store.path_join("identity.txt"), "new"), OK, "new store fixture should be written")
	var collision_backup := _test_root.path_join(".backup-store-live-collision")
	_assert_eq(_write(collision_backup, "block"), OK, "backup collision fixture should be created")
	var failed_commit := exporter._commit_template_store(staging_store, live_store, "collision")
	_assert_eq(failed_commit != OK, true, "failed staged commit should report the rename error")
	_assert_eq(
		FileAccess.get_file_as_string(live_store.path_join("identity.txt")),
		"old",
		"failed staged commit must preserve the old live store"
	)
	DirAccess.remove_absolute(collision_backup)
	_assert_eq(exporter._commit_template_store(staging_store, live_store, "success"), OK, "validated staging should replace live store")
	_assert_eq(
		FileAccess.get_file_as_string(live_store.path_join("identity.txt")),
		"new",
		"successful staged commit should install only the new store"
	)

	_remove_tree(_test_root)
	if _failed:
		quit(1)
		return
	print("exporter_safety_test.gd: ok")
	quit(0)
