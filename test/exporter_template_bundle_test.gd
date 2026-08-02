extends SceneTree

const TemplateBundle = preload("res://addons/godot_mini_game/core/template_bundle.gd")
const Exporter = preload("res://addons/godot_mini_game/exporter.gd")
const COMMIT_A := "abcdef1234567890abcdef1234567890abcdef12"
const COMMIT_B := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
const EMSCRIPTEN_A := "4.0.3"

var _failed := false
var _root := OS.get_temp_dir().path_join(
	"godot-mini-game-template-bundle-%d-%d" % [
		OS.get_process_id(), Time.get_ticks_usec(),
	]
)


func _assert_true(value: bool, message: String) -> void:
	if value:
		return
	push_error(message)
	_failed = true


func _write(path: String, text: String) -> void:
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var file := FileAccess.open(path, FileAccess.WRITE)
	if not file:
		push_error("Cannot write test fixture: %s" % path)
		_failed = true
		return
	file.store_string(text)
	file.close()


func _read_bytes(path: String) -> PackedByteArray:
	var file := FileAccess.open(path, FileAccess.READ)
	if not file:
		push_error("Cannot read test fixture: %s" % path)
		_failed = true
		return PackedByteArray()
	var data := file.get_buffer(file.get_length())
	file.close()
	return data


func _pack_bundle(zip_path: String, bundle_root: String) -> void:
	_write(
		bundle_root.path_join(TemplateBundle.COPYRIGHT_FILE),
		"Godot Engine test copyright fixture\n",
	)
	var packer := ZIPPacker.new()
	var err := packer.open(zip_path)
	_assert_true(err == OK, "fixture ZIP should open for writing")
	if err != OK:
		return
	for file_name in [
		TemplateBundle.MANIFEST_FILE,
		"version.txt",
		"godot.js",
		"godot.wasm.br",
		TemplateBundle.COPYRIGHT_FILE,
	]:
		err = packer.start_file(file_name)
		_assert_true(err == OK, "fixture ZIP entry should start: %s" % file_name)
		if err == OK:
			err = packer.write_file(_read_bytes(bundle_root.path_join(file_name)))
			_assert_true(err == OK, "fixture ZIP entry should be writable: %s" % file_name)
			var close_file_err := packer.close_file()
			_assert_true(
				close_file_err == OK,
				"fixture ZIP entry should close: %s" % file_name,
			)
	var close_err := packer.close()
	_assert_true(close_err == OK, "fixture ZIP should close")


func _make_bundle(
	path: String,
	version: String,
	commit: String,
	emscripten_version: String = EMSCRIPTEN_A,
) -> Dictionary:
	_assert_true(not path.is_empty(), "bundle fixture path must not be empty")
	if path.is_empty():
		return {}
	DirAccess.make_dir_recursive_absolute(path)
	_write(path.path_join("godot.js"), "var Engine = {};\n")
	_write(path.path_join("godot.wasm.br"), "brotli-fixture\n")
	_write(path.path_join("version.txt"), TemplateBundle.normalize_version(version) + "\n")
	var manifest := TemplateBundle.build_manifest(
		path, version, commit, emscripten_version)
	var err := TemplateBundle.write_manifest(
		path.path_join(TemplateBundle.MANIFEST_FILE), manifest)
	_assert_true(err == OK, "fixture template.json should be writable")
	return manifest


func _make_output_fixture(path: String, platform: String) -> void:
	for relative_path in Exporter._required_output_files(platform):
		if relative_path == Exporter.OUTPUT_MANIFEST:
			continue
		var content := "fixture\n"
		if relative_path == "engine/godot.wasm.br":
			content = "brotli-fixture\n"
		elif relative_path in ["engine/game.js", "subpacks/game.js"]:
			content = ""
		elif relative_path.ends_with(".json"):
			content = "{\"fixture\":true}\n"
		_write(path.path_join(relative_path), content)


func _init() -> void:
	var exporter := Exporter.new()
	DirAccess.make_dir_recursive_absolute(_root)
	var current_status := Exporter.get_template_status()
	_assert_true(bool(current_status.ready), "repository engine/template.json should validate for the current editor")
	_assert_true(str(current_status.template_version) == Exporter.get_godot_version_key(), "bundled template version should exactly match the editor")
	_assert_true(
		str(current_status.emscripten_version) == EMSCRIPTEN_A,
		"template status should expose the selected Emscripten identity",
	)
	_assert_true(
		int(current_status.bridge_abi) == TemplateBundle.BRIDGE_ABI
		and str(current_status.profile) == TemplateBundle.PROFILE
		and str(current_status.target) == TemplateBundle.TARGET,
		"template status should expose the complete runtime identity",
	)

	var mismatched := _root.path_join("mismatched-bundled")
	var exact_store := _root.path_join("exact-store")
	_make_bundle(mismatched, "4.6.0.stable", COMMIT_A)
	_make_bundle(exact_store, "4.6.1.stable", COMMIT_A)
	var selected = TemplateBundle.select([
		{"source": "bundled", "root": mismatched, "priority": 400},
		{"source": "store", "root": exact_store, "priority": 300},
	], "4.6.1.stable", "abcdef123")
	_assert_true(selected != null, "an exact template candidate should be selected")
	if selected:
		_assert_true(selected.source == "store", "mismatched high-priority bundle must not shadow exact store")
		_assert_true(selected.javascript_path.get_base_dir() == selected.wasm_path.get_base_dir(), "JS and WASM must resolve from one bundle root")

	var js_only := _root.path_join("js-only")
	var wasm_only := _root.path_join("wasm-only")
	DirAccess.make_dir_recursive_absolute(js_only)
	DirAccess.make_dir_recursive_absolute(wasm_only)
	_write(js_only.path_join("godot.js"), "js")
	_write(js_only.path_join("version.txt"), "4.6.1.stable\n")
	_write(wasm_only.path_join("godot.wasm.br"), "wasm")
	_write(wasm_only.path_join("version.txt"), "4.6.1.stable\n")
	selected = TemplateBundle.select([
		{"source": "js", "root": js_only, "priority": 20},
		{"source": "wasm", "root": wasm_only, "priority": 10},
	], "4.6.1.stable", "abcdef123")
	_assert_true(selected == null, "separate JS-only and WASM-only roots must never be mixed")

	var commit_bundle := _root.path_join("commit")
	_make_bundle(commit_bundle, "4.6.1.stable", COMMIT_A)
	var rejected = TemplateBundle.load_from_directory(
		"commit", commit_bundle, "4.6.1.stable", COMMIT_B.substr(0, 9))
	_assert_true(not rejected.valid, "a different editor commit must reject the template")
	var accepted = TemplateBundle.load_from_directory(
		"commit", commit_bundle, "4.6.1.stable", "abcdef123")
	_assert_true(accepted.valid and accepted.commit_verified, "matching commit prefixes should validate")
	var missing_editor_commit = TemplateBundle.load_from_directory(
		"commit", commit_bundle, "4.6.1.stable", "")
	_assert_true(not missing_editor_commit.valid, "an editor without a verifiable commit must be rejected")

	var missing_emscripten := _root.path_join("missing-emscripten")
	var missing_emscripten_manifest := _make_bundle(
		missing_emscripten, "4.6.1.stable", COMMIT_A)
	missing_emscripten_manifest.erase("emscriptenVersion")
	TemplateBundle.write_manifest(
		missing_emscripten.path_join(TemplateBundle.MANIFEST_FILE),
		missing_emscripten_manifest,
	)
	var missing_emscripten_bundle = TemplateBundle.load_from_directory(
		"missing-emscripten", missing_emscripten, "4.6.1.stable", "abcdef123")
	_assert_true(
		not missing_emscripten_bundle.valid,
		"emscriptenVersion must be a required template identity",
	)
	for invalid_version in ["4.0", " 4.0.3 ", "4.0.3/../../other"]:
		_assert_true(
			TemplateBundle.normalize_emscripten_version(invalid_version).is_empty(),
			"invalid Emscripten identity must be rejected: %s" % invalid_version,
		)
	_assert_true(
		TemplateBundle.normalize_emscripten_version("4.0.3-dev.1") == "4.0.3-dev.1",
		"a path-safe release suffix should remain supported",
	)
	_write(commit_bundle.path_join("godot.js"), "tampered-after-validation\n")
	var copy_err := exporter._obtain_engine_files(
		_root.path_join("tampered-copy"), accepted)
	_assert_true(
		copy_err == ERR_FILE_CORRUPT,
		"engine files changed after bundle validation must be rejected during copy",
	)

	var uppercase_dir := _root.path_join("uppercase-hashes")
	var uppercase_manifest := _make_bundle(
		uppercase_dir, "4.6.1.stable", COMMIT_A)
	var uppercase_artifacts: Dictionary = uppercase_manifest.artifacts
	for artifact_name in ["godot.js", "godot.wasm.br"]:
		var artifact: Dictionary = uppercase_artifacts[artifact_name]
		artifact.sha256 = str(artifact.sha256).to_upper()
	var manifest_err := TemplateBundle.write_manifest(
		uppercase_dir.path_join(TemplateBundle.MANIFEST_FILE), uppercase_manifest)
	_assert_true(manifest_err == OK, "uppercase hash manifest should be writable")
	var uppercase_bundle = TemplateBundle.load_from_directory(
		"uppercase", uppercase_dir, "4.6.1.stable", "abcdef123")
	_assert_true(uppercase_bundle.valid, "SHA-256 hex case must not affect bundle validity")
	var uppercase_output := _root.path_join("uppercase-output")
	_make_output_fixture(uppercase_output, "douyin")
	var output_manifest_err := exporter._write_output_manifest(
		uppercase_output, "douyin", "portrait", uppercase_bundle)
	_assert_true(
		output_manifest_err == OK,
		"uppercase source hashes must not make output manifest generation fail",
	)
	_assert_true(
		exporter._validate_output_manifest(uppercase_output, "douyin") == OK,
		"a generated output manifest should validate its complete template identity",
	)
	var output_manifest := exporter._read_json_dictionary(
		uppercase_output.path_join(Exporter.OUTPUT_MANIFEST))
	var output_template: Dictionary = output_manifest.get("template", {})
	_assert_true(
		str(output_template.get("emscripten_version", "")) == EMSCRIPTEN_A,
		"output provenance should record the Emscripten version",
	)
	_assert_true(
		int(output_template.get("bridge_abi", 0)) == TemplateBundle.BRIDGE_ABI,
		"output provenance should record the bridge ABI",
	)
	output_template.emscripten_version = "4.0"
	output_manifest.template = output_template
	_write(
		uppercase_output.path_join(Exporter.OUTPUT_MANIFEST),
		JSON.stringify(output_manifest) + "\n",
	)
	_assert_true(
		exporter._validate_output_manifest(uppercase_output, "douyin") == ERR_INVALID_DATA,
		"output validation should reject an invalid Emscripten identity",
	)

	var no_manifest := _root.path_join("no-manifest")
	DirAccess.make_dir_recursive_absolute(no_manifest)
	_write(no_manifest.path_join("godot.js"), "js")
	_write(no_manifest.path_join("godot.wasm.br"), "wasm")
	_write(no_manifest.path_join("version.txt"), "4.6.1.stable\n")
	var custom = TemplateBundle.load_from_directory(
		"addon", no_manifest, "4.6.1.stable", "abcdef123")
	_assert_true(not custom.valid, "custom templates must include template.json")

	# Import two otherwise identical bundles with different Emscripten versions.
	# Their store identities must not overwrite one another.
	var store_root := _root.path_join("isolated-store/v1")
	var import_version := "4.6.1.stable"
	var import_paths: Array[String] = []
	for emscripten_version in ["3.1.50", EMSCRIPTEN_A]:
		var source_dir := _root.path_join(
			"import-source-" + emscripten_version)
		_make_bundle(source_dir, import_version, COMMIT_A, emscripten_version)
		var zip_path := _root.path_join(
			"template-emsdk-%s.zip" % emscripten_version)
		_pack_bundle(zip_path, source_dir)
		var import_err := exporter._import_template_zip_to_store(
			zip_path, store_root)
		_assert_true(import_err == OK, "valid versioned template ZIP should import")
		var imported_path := Exporter._template_store_destination(
			store_root,
			import_version,
			COMMIT_A,
			emscripten_version,
			TemplateBundle.PROFILE,
			TemplateBundle.TARGET,
			TemplateBundle.BRIDGE_ABI,
			1,
		)
		import_paths.append(imported_path)
		_assert_true(
			FileAccess.file_exists(
				imported_path.path_join(TemplateBundle.MANIFEST_FILE)),
			"imported template should use its complete versioned store path",
		)
		_assert_true(
			FileAccess.file_exists(
				imported_path.path_join(TemplateBundle.COPYRIGHT_FILE)),
			"template import must preserve the Godot copyright notice",
		)
	_assert_true(
		import_paths.size() == 2 and import_paths[0] != import_paths[1],
		"different Emscripten toolchains must never collide in the store",
	)
	var invalid_import_source := _root.path_join("import-source-invalid-emsdk")
	_make_bundle(invalid_import_source, import_version, COMMIT_B, "")
	var invalid_import_zip := _root.path_join("template-invalid-emsdk.zip")
	_pack_bundle(invalid_import_zip, invalid_import_source)
	_assert_true(
		exporter._import_template_zip_to_store(
			invalid_import_zip, store_root) == ERR_INVALID_DATA,
		"template import must reject a missing Emscripten identity",
	)
	var abi_two_path := Exporter._template_store_destination(
		store_root,
		import_version,
		COMMIT_A,
		EMSCRIPTEN_A,
		TemplateBundle.PROFILE,
		TemplateBundle.TARGET,
		2,
		1,
	)
	_assert_true(
		abi_two_path != import_paths[1] and abi_two_path.contains("/abi-2/"),
		"different bridge ABIs must resolve to different store identities",
	)

	var store_candidates := Exporter._versioned_store_candidates(
		store_root.path_join(import_version))
	_assert_true(
		store_candidates.size() == 2,
		"resolver should discover both Emscripten-specific store entries",
	)
	var resolved_store = TemplateBundle.select(
		store_candidates, import_version, COMMIT_A.substr(0, 10))
	_assert_true(
		resolved_store != null
		and resolved_store.valid
		and resolved_store.emscripten_version == EMSCRIPTEN_A,
		"equal revisions should deterministically select the newest Emscripten identity",
	)
	_assert_true(
		TemplateBundle.compare_emscripten_versions("4.0.10", "4.0.9") > 0
		and TemplateBundle.compare_emscripten_versions("4.0.3", "4.0.3-dev.1") > 0,
		"Emscripten selection should use numeric release ordering",
	)

	# A manually misplaced manifest must not inherit the identity encoded by its
	# directory name during resolution.
	var misplaced_path := Exporter._template_store_destination(
		store_root,
		import_version,
		COMMIT_B,
		"3.1.50",
		TemplateBundle.PROFILE,
		TemplateBundle.TARGET,
		TemplateBundle.BRIDGE_ABI,
		1,
	)
	_assert_true(not misplaced_path.is_empty(), "misplaced fixture path should be valid")
	_make_bundle(misplaced_path, import_version, COMMIT_B, EMSCRIPTEN_A)
	var misplaced_candidates := Exporter._versioned_store_candidates(
		store_root.path_join(import_version))
	var misplaced_resolution = TemplateBundle.select(
		misplaced_candidates, import_version, COMMIT_B.substr(0, 10))
	_assert_true(
		misplaced_resolution == null,
		"resolver must reject a manifest whose Emscripten identity disagrees with its path",
	)

	exporter._rm_rf(_root)
	if _failed:
		quit(1)
		return
	print("exporter_template_bundle_test.gd: ok")
	quit(0)
