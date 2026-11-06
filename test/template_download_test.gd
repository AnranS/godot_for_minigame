extends SceneTree

const TemplateDownload = preload("res://addons/godot_mini_game/core/template_download.gd")
const Exporter = preload("res://addons/godot_mini_game/exporter.gd")
const DockScene = preload("res://addons/godot_mini_game/export_dock.tscn")

const COMMIT_472 := "ed1daf0bf001b61586d9930840f2f1394092c079"
const COMMIT_463_TAG := "35e80b3a8822a9df9be390814b62f44c0a9c69e8"
const COMMIT_463_OFFICIAL := "7d41c59c457bd5a245092b4e7eb2d833e3b3f8c3"

var _failed := false
var _root := OS.get_temp_dir().path_join(
	"godot-mini-game-download-%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()]
)


func _assert_true(value: bool, message: String) -> void:
	if value:
		return
	push_error(message)
	_failed = true


func _write(path: String, content: String) -> void:
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_string(content)
	file.close()


func _init() -> void:
	DirAccess.make_dir_recursive_absolute(_root)
	_test_catalog()
	_test_matching()
	_test_rejects_malformed_catalogs()
	_test_sha256()
	await _test_dock()
	Exporter.new()._rm_rf(_root)
	if _failed:
		quit(1)
		return
	print("template_download_test.gd: ok")
	quit(0)


func _test_catalog() -> void:
	var catalog := TemplateDownload.load_catalog()
	_assert_true(catalog.size() >= 2, "the shipped catalog must list the release templates")
	for entry in catalog:
		_assert_true(TemplateDownload.is_valid_entry(entry), "catalog entry must validate")
		_assert_true(str(entry.repository) == "AnranS/godot_for_minigame", "catalog repository")
		var url := TemplateDownload.download_url(entry)
		_assert_true(
			url == "https://github.com/AnranS/godot_for_minigame/releases/download/%s/%s"
			% [entry.releaseTag, entry.asset],
			"download URL must point at the pinned release asset",
		)


func _test_matching() -> void:
	var catalog := TemplateDownload.load_catalog()
	var latest := TemplateDownload.find_for_editor(catalog, "4.7.2.stable", COMMIT_472)
	_assert_true(str(latest.get("godotVersion", "")) == "4.7.2.stable", "4.7.2 must match")
	var official := TemplateDownload.find_for_editor(
		catalog, "4.6.3.stable", COMMIT_463_OFFICIAL)
	_assert_true(
		str(official.get("godotVersion", "")) == "4.6.3.stable",
		"official 4.6.3 editors match through editorCommits",
	)
	_assert_true(
		not TemplateDownload.find_for_editor(catalog, "4.6.3.stable", COMMIT_463_TAG).is_empty(),
		"the 4.6.3 tag commit also matches",
	)
	_assert_true(
		TemplateDownload.find_for_editor(catalog, "4.7.2.stable", COMMIT_463_TAG).is_empty(),
		"a custom 4.7.2 build with another commit must not match",
	)
	_assert_true(
		TemplateDownload.find_for_editor(catalog, "4.7.2.stable", "").is_empty(),
		"an editor without a commit hash must not match",
	)
	_assert_true(
		TemplateDownload.find_for_editor(catalog, "4.6.1.stable", COMMIT_472).is_empty(),
		"the bundled 4.6.1 template is not a download",
	)


func _test_rejects_malformed_catalogs() -> void:
	var broken := _root.path_join("broken.json")
	_write(broken, "{not json")
	_assert_true(TemplateDownload.load_catalog(broken).is_empty(), "invalid JSON loads nothing")
	var wrong_schema := _root.path_join("schema.json")
	_write(wrong_schema, JSON.stringify({"schema": 2, "repository": "a/b", "templates": []}))
	_assert_true(TemplateDownload.load_catalog(wrong_schema).is_empty(), "unknown schema loads nothing")
	var entry := {
		"godotVersion": "4.7.2.stable",
		"godotCommit": COMMIT_472,
		"editorCommits": [],
		"releaseTag": "template-x",
		"asset": "template.zip",
		"sha256": "0".repeat(64),
	}
	var bad_hash := entry.duplicate()
	bad_hash.sha256 = "not-a-hash"
	var traversal := entry.duplicate()
	traversal.asset = "../evil.zip"
	var short_commit := entry.duplicate()
	short_commit.godotCommit = "ed1daf0"
	var mixed := _root.path_join("mixed.json")
	_write(mixed, JSON.stringify({
		"schema": 1,
		"repository": "AnranS/godot_for_minigame",
		"templates": [entry, bad_hash, traversal, short_commit, "nope"],
	}))
	var loaded := TemplateDownload.load_catalog(mixed)
	_assert_true(loaded.size() == 1, "only the well-formed entry may load")
	var bad_repository := _root.path_join("repository.json")
	_write(bad_repository, JSON.stringify({
		"schema": 1, "repository": "https://evil.example", "templates": [entry],
	}))
	_assert_true(
		TemplateDownload.load_catalog(bad_repository).is_empty(),
		"the repository must be an owner/name pair",
	)


func _test_sha256() -> void:
	var path := _root.path_join("abc.bin")
	_write(path, "abc")
	var abc := "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
	_assert_true(TemplateDownload.verify_sha256(path, abc), "matching SHA-256 verifies")
	_assert_true(TemplateDownload.verify_sha256(path, abc.to_upper()), "hash comparison ignores case")
	_assert_true(not TemplateDownload.verify_sha256(path, "0".repeat(64)), "other hashes fail")
	_assert_true(
		not TemplateDownload.verify_sha256(_root.path_join("missing.zip"), abc),
		"a missing download fails",
	)


func _test_dock() -> void:
	var dock: Node = DockScene.instantiate()
	root.add_child(dock)
	await process_frame
	var button: Button = dock.get_node("TemplateRow/DownloadBtn")
	var status := Exporter.get_template_status()
	if bool(status.get("ready", false)):
		_assert_true(not button.visible, "no download button while a template is ready")
	else:
		var expected := TemplateDownload.find_for_editor(
			TemplateDownload.load_catalog(),
			str(status.editor_version),
			str(status.editor_commit),
		)
		_assert_true(
			button.visible == not expected.is_empty(),
			"the download button follows the catalog match",
		)
	dock.queue_free()
	await process_frame
