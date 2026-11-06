@tool
extends RefCounted
## Finds and downloads the certified engine template for the running editor.
##
## certified_templates.json ships with the plugin and pins every release ZIP by
## SHA-256 (it is generated from support-matrix.json). A download reaches the
## importer only when its hash matches that pin; the importer then applies the
## same template.json identity checks as a manual import.

const TemplateBundle = preload("res://addons/godot_mini_game/core/template_bundle.gd")
const CATALOG_PATH := "res://addons/godot_mini_game/core/certified_templates.json"
const CATALOG_SCHEMA := 1
const DOWNLOAD_TIMEOUT_SECONDS := 600.0

## The in-flight request, exposed so the dock can show progress.
var request: HTTPRequest
## A short, user-facing reason for the last failed download.
var last_error := ""


static func load_catalog(path: String = CATALOG_PATH) -> Array[Dictionary]:
	var entries: Array[Dictionary] = []
	if not FileAccess.file_exists(path):
		return entries
	var json := JSON.new()
	if json.parse(FileAccess.get_file_as_string(path)) != OK:
		return entries
	var parsed: Variant = json.data
	if not parsed is Dictionary or int(parsed.get("schema", 0)) != CATALOG_SCHEMA:
		return entries
	var repository := str(parsed.get("repository", ""))
	var templates: Variant = parsed.get("templates", [])
	if not templates is Array:
		return entries
	for value in templates:
		if not value is Dictionary:
			continue
		var entry: Dictionary = (value as Dictionary).duplicate(true)
		entry["repository"] = repository
		if is_valid_entry(entry):
			entries.append(entry)
	return entries


static func is_valid_entry(entry: Dictionary) -> bool:
	if not _matches("^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$", str(entry.get("repository", ""))):
		return false
	if TemplateBundle.normalize_version(str(entry.get("godotVersion", ""))).is_empty():
		return false
	if not _is_full_commit(str(entry.get("godotCommit", ""))):
		return false
	var editor_commits: Variant = entry.get("editorCommits", [])
	if not editor_commits is Array:
		return false
	for commit in editor_commits:
		if not _is_full_commit(str(commit)):
			return false
	return (
		_matches("^[0-9A-Za-z._-]+$", str(entry.get("releaseTag", "")))
		and _matches("^[0-9A-Za-z._-]+\\.zip$", str(entry.get("asset", "")))
		and _matches("^[0-9a-f]{64}$", str(entry.get("sha256", "")))
	)


## Returns the catalog entry certified for this exact editor build, or an
## empty dictionary. Both the version and the commit must match, because the
## exporter rejects a template built for a different commit anyway.
static func find_for_editor(
	catalog: Array[Dictionary],
	editor_version: String,
	editor_commit: String,
) -> Dictionary:
	var version := TemplateBundle.normalize_version(editor_version)
	if version.is_empty():
		return {}
	for entry in catalog:
		if TemplateBundle.normalize_version(str(entry.godotVersion)) != version:
			continue
		var accepted := TemplateBundle.commits_match(str(entry.godotCommit), editor_commit)
		for listed in entry.get("editorCommits", []):
			accepted = accepted or TemplateBundle.commits_match(str(listed), editor_commit)
		if accepted:
			return entry
	return {}


static func download_url(entry: Dictionary) -> String:
	return "https://github.com/%s/releases/download/%s/%s" % [
		entry.repository, entry.releaseTag, entry.asset,
	]


static func release_url(entry: Dictionary) -> String:
	return "https://github.com/%s/releases/tag/%s" % [entry.repository, entry.releaseTag]


static func download_path(entry: Dictionary) -> String:
	return OS.get_cache_dir().path_join("godot_mini_game/downloads").path_join(str(entry.asset))


static func verify_sha256(path: String, expected: String) -> bool:
	if not FileAccess.file_exists(path):
		return false
	return FileAccess.get_sha256(path).to_lower() == expected.to_lower()


## Downloads `entry` to `destination` through an HTTPRequest parented to
## `host`. Returns OK only for a complete HTTP 200 body whose SHA-256 matches
## the pin; any other outcome deletes the partial file and sets last_error.
func download(host: Node, entry: Dictionary, destination: String) -> Error:
	last_error = ""
	if not host.is_inside_tree():
		last_error = "下载需要一个已加入场景树的节点"
		return ERR_UNCONFIGURED
	DirAccess.make_dir_recursive_absolute(destination.get_base_dir())
	_remove(destination)
	request = HTTPRequest.new()
	request.download_file = destination
	request.timeout = DOWNLOAD_TIMEOUT_SECONDS
	request.use_threads = true
	host.add_child(request)
	var error := request.request(download_url(entry))
	if error != OK:
		last_error = "无法发起下载请求（错误 %d）" % error
		_finish(destination, false)
		return error
	var response: Array = await request.request_completed
	var result: int = response[0]
	var status_code: int = response[1]
	if result != HTTPRequest.RESULT_SUCCESS:
		last_error = "网络请求失败（HTTPRequest 结果 %d）" % result
		_finish(destination, false)
		return ERR_CANT_CONNECT
	if status_code != 200:
		last_error = "服务器返回 HTTP %d" % status_code
		_finish(destination, false)
		return ERR_FILE_NOT_FOUND
	if not verify_sha256(destination, str(entry.sha256)):
		last_error = "下载文件的 SHA-256 与插件内置的校验值不一致"
		_finish(destination, false)
		return ERR_FILE_CORRUPT
	_finish(destination, true)
	return OK


## Bytes received so far and the expected total (-1 while unknown).
func progress() -> Vector2i:
	if not is_instance_valid(request):
		return Vector2i(0, -1)
	return Vector2i(request.get_downloaded_bytes(), request.get_body_size())


func _finish(destination: String, keep_file: bool) -> void:
	if is_instance_valid(request):
		request.queue_free()
	request = null
	if not keep_file:
		_remove(destination)


static func _remove(path: String) -> void:
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(path)


static func _is_full_commit(value: String) -> bool:
	return _matches("^[0-9a-f]{40}$", value)


static func _matches(pattern: String, value: String) -> bool:
	var regex := RegEx.new()
	return regex.compile(pattern) == OK and regex.search(value) != null
