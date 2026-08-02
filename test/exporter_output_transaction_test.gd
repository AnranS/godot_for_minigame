extends SceneTree

const Exporter = preload("res://addons/godot_mini_game/exporter.gd")
const OutputGuard = preload("res://addons/godot_mini_game/core/output_guard.gd")
const TemplateBundle = preload("res://addons/godot_mini_game/core/template_bundle.gd")

var _failed := false
var _root := OS.get_temp_dir().path_join(
	"godot-mini-game-output-transaction-%d-%d" % [
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


func _read(path: String) -> String:
	var file := FileAccess.open(path, FileAccess.READ)
	if not file:
		return ""
	var value := file.get_as_text()
	file.close()
	return value


func _ownership_manifest(root: String, platform: String) -> String:
	var required: Array = []
	var artifacts := {}
	for relative_path in Exporter._required_output_files(platform):
		required.append(relative_path)
		if relative_path != Exporter.OUTPUT_MANIFEST:
			artifacts[relative_path] = Exporter._file_metadata(
				root.path_join(relative_path))
	var source_js: Dictionary = artifacts.get("js/libs/godot.js", {})
	var source_wasm: Dictionary = artifacts.get("engine/godot.wasm.br", {})
	return JSON.stringify({
		"schema_version": OutputGuard.SCHEMA_VERSION,
		"tool": "godot_mini_game",
		"ownership": "managed-output",
		"platform": platform,
		"orientation": "portrait",
		"generated_at": "2026-08-02T12:00:00Z",
		"template": {
			"source": "fixture",
			"godot_version": "4.6.1.stable",
			"godot_commit": "abcdef1234567890abcdef1234567890abcdef12",
			"emscripten_version": "4.0.3",
			"bridge_abi": TemplateBundle.BRIDGE_ABI,
			"revision": 1,
			"profile": TemplateBundle.PROFILE,
			"target": TemplateBundle.TARGET,
			"source_artifacts": {
				"godot.js": {"sha256": source_js.get("sha256", "")},
				"godot.wasm.br": {"sha256": source_wasm.get("sha256", "")},
			},
		},
		"required_files": required,
		"output_artifacts": artifacts,
	}) + "\n"


func _make_valid_stage(path: String, platform: String) -> void:
	for relative_path in Exporter._required_output_files(platform):
		if relative_path == Exporter.OUTPUT_MANIFEST:
			continue
		var content := "new\n"
		if relative_path == "engine/game.js" or relative_path == "subpacks/game.js":
			content = ""
		elif relative_path.ends_with(".json"):
			content = "{\"fixture\":true}\n"
		_write(path.path_join(relative_path), content)
	_write(path.path_join(Exporter.OUTPUT_MANIFEST), _ownership_manifest(path, platform))


func _init() -> void:
	var exporter := Exporter.new()
	DirAccess.make_dir_recursive_absolute(_root)
	var project_root := ProjectSettings.globalize_path("res://")

	var check := OutputGuard.inspect(
		"/", project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(not bool(check.ok), "filesystem root must be rejected")
	check = OutputGuard.inspect(
		project_root, project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(not bool(check.ok), "project root must be rejected")
	check = OutputGuard.inspect(
		project_root.path_join("build"), project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(not bool(check.ok), "a project child directory must be rejected")
	check = OutputGuard.inspect(
		project_root.get_base_dir(), project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(not bool(check.ok), "a project parent directory must be rejected")

	var nonempty_unowned := _root.path_join("nonempty-unowned")
	_write(nonempty_unowned.path_join("keep.txt"), "keep\n")
	check = OutputGuard.inspect(
		nonempty_unowned, project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(not bool(check.ok), "a non-empty unowned directory must be rejected")

	var collision := _root.path_join("unmanaged-collision")
	DirAccess.make_dir_recursive_absolute(collision.path_join("js"))
	check = OutputGuard.inspect(
		collision, project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(not bool(check.ok), "an unmanaged managed-directory collision must be rejected")
	var forged_owner := _root.path_join("forged-owner")
	_write(forged_owner.path_join(Exporter.OUTPUT_MANIFEST), "{}\n")
	check = OutputGuard.inspect(
		forged_owner, project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(not bool(check.ok), "an invalid ownership sentinel must not authorize replacement")
	var minimal_owner := _root.path_join("minimal-forged-owner")
	_write(minimal_owner.path_join(Exporter.OUTPUT_MANIFEST), JSON.stringify({
		"schema_version": OutputGuard.SCHEMA_VERSION,
		"tool": "godot_mini_game",
		"ownership": "managed-output",
	}) + "\n")
	check = OutputGuard.inspect(
		minimal_owner, project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(
		not bool(check.ok),
		"a minimal forged sentinel must not authorize managed-path replacement",
	)

	var nested_unlisted := _root.path_join("nested-unlisted")
	_make_valid_stage(nested_unlisted, "douyin")
	_write(nested_unlisted.path_join("js/custom.js"), "user file\n")
	check = OutputGuard.inspect(
		nested_unlisted, project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(
		not bool(check.ok),
		"an unlisted file inside a managed directory must invalidate ownership",
	)
	var nested_directory := _root.path_join("nested-unlisted-directory")
	_make_valid_stage(nested_directory, "douyin")
	DirAccess.make_dir_recursive_absolute(nested_directory.path_join("js/custom-dir"))
	check = OutputGuard.inspect(
		nested_directory, project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(
		not bool(check.ok),
		"an unlisted directory inside a managed directory must invalidate ownership",
	)

	var unsafe_manifest_output := _root.path_join("unsafe-manifest-path")
	_make_valid_stage(unsafe_manifest_output, "douyin")
	var unsafe_manifest_value: Variant = JSON.parse_string(
		_read(unsafe_manifest_output.path_join(Exporter.OUTPUT_MANIFEST)))
	if unsafe_manifest_value is Dictionary:
		var unsafe_manifest: Dictionary = unsafe_manifest_value
		var unsafe_required: Array = unsafe_manifest.required_files
		unsafe_required.append("../outside.txt")
		var unsafe_artifacts: Dictionary = unsafe_manifest.output_artifacts
		unsafe_artifacts["../outside.txt"] = {
			"size": 1,
			"sha256": "0".repeat(64),
		}
		_write(
			unsafe_manifest_output.path_join(Exporter.OUTPUT_MANIFEST),
			JSON.stringify(unsafe_manifest) + "\n",
		)
	check = OutputGuard.inspect(
		unsafe_manifest_output,
		project_root,
		Exporter.MANAGED_FILES,
		Exporter.MANAGED_DIRS,
	)
	_assert_true(
		not bool(check.ok),
		"ownership manifests must reject unsafe relative paths",
	)

	var tampered_output := _root.path_join("tampered-owned-output")
	_make_valid_stage(tampered_output, "douyin")
	var tampered_before := OutputGuard.inspect(
		tampered_output, project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(bool(tampered_before.ok), "a complete manifest should establish ownership")
	_write(tampered_output.path_join("game.js"), "changed after preflight\n")
	var tampered_after := OutputGuard.inspect(
		tampered_output, project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(
		not bool(tampered_after.ok),
		"managed artifact changes must invalidate the ownership snapshot",
	)
	var tampered_stage := _root.path_join("tampered-stage")
	_make_valid_stage(tampered_stage, "douyin")
	var tampered_publish_err := exporter._publish_staging(
		tampered_stage,
		tampered_output,
		"douyin",
		str(tampered_before.state_token),
	)
	_assert_true(
		tampered_publish_err == ERR_BUSY,
		"publish must reject managed artifact changes after preflight",
	)
	_assert_true(
		_read(tampered_output.path_join("game.js")) == "changed after preflight\n",
		"state revalidation must preserve the tampered output",
	)

	var failed_output := _root.path_join("failed-output")
	var incomplete_stage := _root.path_join("incomplete-stage")
	_write(failed_output.path_join("game.js"), "old-game\n")
	_write(failed_output.path_join("keep.txt"), "keep\n")
	DirAccess.make_dir_recursive_absolute(incomplete_stage)
	var err := exporter._publish_staging(
		incomplete_stage, failed_output, "wechat", "validation-fails-first")
	_assert_true(err != OK, "an incomplete staged export must fail")
	_assert_true(_read(failed_output.path_join("game.js")) == "old-game\n", "failed publish must preserve old managed files")
	_assert_true(_read(failed_output.path_join("keep.txt")) == "keep\n", "failed publish must preserve unrelated files")

	var output := _root.path_join("successful-output")
	var stage := _root.path_join("valid-stage")
	_make_valid_stage(output, "wechat")
	_write(output.path_join("game.js"), "old-game\n")
	_write(output.path_join("project.private.config.json"), "{\"stale\":true}\n")
	_write(output.path_join("keep.txt"), "keep\n")
	_write(output.path_join(Exporter.OUTPUT_MANIFEST), _ownership_manifest(output, "wechat"))
	var owned_check := OutputGuard.inspect(
		output, project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	_assert_true(bool(owned_check.ok), "fixture output should have valid ownership")
	_make_valid_stage(stage, "douyin")
	err = exporter._publish_staging(
		stage, output, "douyin", str(owned_check.state_token))
	_assert_true(err == OK, "a complete staged export should publish")
	_assert_true(_read(output.path_join("game.js")) == "new\n", "successful publish should replace managed files")
	_assert_true(not FileAccess.file_exists(output.path_join("project.private.config.json")), "platform switch should remove stale WeChat config")
	_assert_true(_read(output.path_join("keep.txt")) == "keep\n", "successful publish should preserve unrelated files")
	_assert_true(not DirAccess.dir_exists_absolute(stage), "successful publish should remove staging directory")
	_assert_true(
		not DirAccess.dir_exists_absolute(Exporter._output_lock_path(output)),
		"successful publish should remove its lock and recovery journal",
	)

	var missing_token_stage := _root.path_join("missing-token-stage")
	_make_valid_stage(missing_token_stage, "douyin")
	err = exporter._publish_staging(
		missing_token_stage, _root.path_join("missing-token-output"), "douyin", "")
	_assert_true(err == ERR_INVALID_PARAMETER, "publish must reject a missing state token")
	_assert_true(
		DirAccess.dir_exists_absolute(missing_token_stage),
		"a rejected state token must not consume staging",
	)

	var changed_output := _root.path_join("changed-output")
	DirAccess.make_dir_recursive_absolute(changed_output)
	var empty_check := OutputGuard.inspect(
		changed_output, project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	var changed_stage := _root.path_join("changed-stage")
	_make_valid_stage(changed_stage, "douyin")
	_write(changed_output.path_join("keep.txt"), "appeared-during-export\n")
	err = exporter._publish_staging(
		changed_stage, changed_output, "douyin", str(empty_check.state_token))
	_assert_true(err == ERR_BUSY, "publish must reject output changed after preflight")
	_assert_true(
		_read(changed_output.path_join("keep.txt")) == "appeared-during-export\n",
		"state-token rejection must preserve the changed output",
	)
	_assert_true(
		not DirAccess.dir_exists_absolute(Exporter._output_lock_path(changed_output)),
		"an ordinary state mismatch must release the publish lock",
	)

	var locked_output := _root.path_join("locked-output")
	var locked_check := OutputGuard.inspect(
		locked_output, project_root, Exporter.MANAGED_FILES, Exporter.MANAGED_DIRS)
	var locked_stage := _root.path_join("locked-stage")
	_make_valid_stage(locked_stage, "douyin")
	var held_lock := Exporter._output_lock_path(locked_output)
	DirAccess.make_dir_recursive_absolute(held_lock)
	_write(held_lock.path_join(Exporter.PUBLISH_JOURNAL), JSON.stringify({
		"schema_version": Exporter.PUBLISH_JOURNAL_SCHEMA_VERSION,
		"tool": "godot_mini_game",
		"phase": "publishing",
		"output_dir": locked_output,
		"staging_dir": locked_stage,
		"backup_dir": "",
	}) + "\n")
	err = exporter._publish_staging(
		locked_stage, locked_output, "douyin", str(locked_check.state_token))
	_assert_true(err != OK, "an existing publish lock must block another publisher")
	_assert_true(
		FileAccess.file_exists(held_lock.path_join(Exporter.PUBLISH_JOURNAL)),
		"a blocked publisher must preserve the existing recovery journal",
	)

	var rollback_output := _root.path_join("rollback-output")
	var rollback_backup := _root.path_join("rollback-backup")
	_write(rollback_output.path_join("js/blocker.txt"), "new\n")
	_write(rollback_backup.path_join("js/original.txt"), "old\n")
	var rollback_old: Array[String] = ["js"]
	var rollback_new: Array[String] = []
	err = exporter._rollback_publish(
		rollback_output, rollback_backup, rollback_old, rollback_new, true)
	_assert_true(err != OK, "a failed restore must surface a rollback error")
	_assert_true(
		DirAccess.dir_exists_absolute(rollback_backup.path_join("js")),
		"a failed restore must preserve the recovery backup",
	)

	exporter._rm_rf(_root)
	if _failed:
		quit(1)
		return
	print("exporter_output_transaction_test.gd: ok")
	quit(0)
