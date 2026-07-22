@tool
extends RefCounted
## Core export logic:
##   1. Clean previous managed artifacts in the output directory
##   2. Export .pck via --export-pack (no Web template needed)
##   3. Obtain engine files (godot.js + godot.wasm) from:
##      a) exact-version custom files in addon dir  (highest priority)
##      b) exact-version template from local template store
##      c) exact-version bundled engine
##      d) installed Godot Web export template zip   (fallback, simulator only)
##   4. Copy JS runtime templates
##   5. Generate platform config files

const ADDON_ROOT := "res://addons/godot_mini_game/"
const TEMPLATES  := "res://addons/godot_mini_game/templates/"
const ENGINE_DIR := "res://addons/godot_mini_game/engine/"
const EXPORT_MARKER := ".godot-mini-game-export"
const EXPORT_MARKER_CONTENT := "godot-mini-game-export:v1\n"
const STANDARD_TEMPLATE_FILENAMES: PackedStringArray = [
	"web_nothreads_release.zip",
	"web_nothreads_debug.zip",
	"web_release.zip",
	"web_debug.zip",
]

## File / directory names this exporter owns inside the user's output dir.
## On every export we wipe these so re-exports never inherit stale artifacts
## from a failed run, a platform switch, or a downgraded engine template.
## Anything not in these lists (e.g. user-kept files) is left alone.
const MANAGED_FILES: PackedStringArray = [
	"adapter.js", "fetch.js", "game.js", "game.json",
	"project.config.json", "project.private.config.json",
]
const MANAGED_DIRS: PackedStringArray = ["audio", "engine", "images", "js", "subpacks"]

var log_callback: Callable


# ─── Template store ────────────────────────────────────────────────

static func get_godot_version_key() -> String:
	return _editor_version_string()


static func get_godot_legacy_version_key() -> String:
	var v := Engine.get_version_info()
	return "%d.%d" % [v.major, v.minor]


static func get_template_store_dir() -> String:
	return OS.get_config_dir().path_join("godot_mini_game/templates/" + get_godot_version_key())


static func get_template_store_dirs() -> PackedStringArray:
	var dirs := PackedStringArray([get_template_store_dir()])
	var legacy := OS.get_config_dir().path_join("godot_mini_game/templates/" + get_godot_legacy_version_key())
	if legacy != dirs[0]:
		dirs.append(legacy)
	return dirs


static func get_template_status() -> Dictionary:
	## Resolve JS and WASM as one unit. Selecting them independently can combine
	## two engine builds, which is just as unsafe as knowingly using a mismatched
	## template. Exact-version candidates always beat mismatched candidates.
	return _resolve_engine_template()


static func _resolve_engine_template() -> Dictionary:
	var editor_version := get_godot_version_key()
	var candidates: Array[Dictionary] = []

	# A manual override remains highest priority only when its version.txt proves
	# it belongs to the running editor. An unversioned override is surfaced as
	# incompatible instead of being silently trusted.
	candidates.append(_directory_template_candidate(
		"addon", ADDON_ROOT, _read_version_key_file(ADDON_ROOT + "version.txt"), editor_version))

	# User imports intentionally precede the bundled engine. This lets an exact
	# template imported for a newer editor replace an older bundled build.
	var store_dirs := get_template_store_dirs()
	for i in range(store_dirs.size()):
		var store_dir := store_dirs[i]
		var stored_version := _read_version_key_file(store_dir.path_join("version.txt"))
		candidates.append(_directory_template_candidate(
			"store" if i == 0 else "store_legacy",
			store_dir,
			stored_version,
			editor_version))

	candidates.append(_directory_template_candidate(
		"bundled", ENGINE_DIR, _read_version_key_file(ENGINE_DIR + "version.txt"), editor_version))

	# Official Web templates are an exact-version simulator/devtools fallback.
	# They are intentionally lower priority than mini-game compatible templates.
	var standard_zip := _find_standard_template_zip(editor_version)
	if not standard_zip.is_empty():
		var standard := _status("standard", true, true, editor_version, editor_version)
		standard["zip_path"] = standard_zip
		candidates.append(standard)

	var selected := _select_template_candidate(candidates, editor_version)
	if not selected.is_empty():
		return selected
	return {
		"source": "none",
		"has_js": false,
		"has_wasm": false,
		"ready": false,
		"editor_version": editor_version,
		"template_version": "",
		"version_match": false,
	}


static func _directory_template_candidate(
	source: String,
	directory: String,
	template_version: String,
	editor_version: String,
) -> Dictionary:
	var candidate := _status(
		source,
		FileAccess.file_exists(directory.path_join("godot.js")),
		FileAccess.file_exists(directory.path_join("godot.wasm.br")) \
			or FileAccess.file_exists(directory.path_join("godot.wasm")),
		template_version,
		editor_version,
	)
	candidate["base_dir"] = directory
	candidate["js_path"] = directory.path_join("godot.js")
	candidate["wasm_br_path"] = directory.path_join("godot.wasm.br")
	candidate["wasm_path"] = directory.path_join("godot.wasm")
	return candidate


## Pure selector kept separate from filesystem discovery so version precedence
## is regression-testable without mutating the user's template store.
static func _select_template_candidate(candidates: Array[Dictionary], editor_version: String) -> Dictionary:
	for candidate in candidates:
		if bool(candidate.get("ready", false)) \
				and str(candidate.get("template_version", "")) == editor_version:
			candidate["version_match"] = true
			return candidate
	# Return the first complete mismatch only for diagnostics. Export preflight
	# rejects it; callers can still explain which installed template is stale.
	for candidate in candidates:
		if bool(candidate.get("ready", false)):
			candidate["version_match"] = false
			return candidate
	return {}


## Godot uses the XDG data directory on Linux (`.../godot`) and historically
## used a capitalized `Godot` directory on macOS/Windows. Some installations
## also place templates under the config root, so search every convention.
## Parameters are injectable to keep platform path construction testable.
static func _standard_template_base_dirs(
	editor_version: String,
	data_dir: String = "",
	config_dir: String = "",
	platform_name: String = "",
) -> PackedStringArray:
	var data_root := OS.get_data_dir() if data_dir.is_empty() else data_dir
	var config_root := OS.get_config_dir() if config_dir.is_empty() else config_dir
	var platform := OS.get_name() if platform_name.is_empty() else platform_name
	var app_dirs: PackedStringArray = ["godot", "Godot"] \
		if platform == "Linux" else ["Godot", "godot"]
	var result := PackedStringArray()
	for root: String in [data_root, config_root]:
		if root.is_empty():
			continue
		for app_dir in app_dirs:
			var candidate: String = root.path_join(app_dir).path_join("export_templates").path_join(editor_version).simplify_path()
			if candidate not in result:
				result.append(candidate)
	return result


static func _standard_template_zip_paths(
	editor_version: String,
	data_dir: String = "",
	config_dir: String = "",
	platform_name: String = "",
) -> PackedStringArray:
	var result := PackedStringArray()
	for base_dir in _standard_template_base_dirs(editor_version, data_dir, config_dir, platform_name):
		for filename in STANDARD_TEMPLATE_FILENAMES:
			result.append(base_dir.path_join(filename))
	return result


static func _find_standard_template_zip(editor_version: String) -> String:
	for zip_path in _standard_template_zip_paths(editor_version):
		if FileAccess.file_exists(zip_path):
			return zip_path
	return ""


## Imports a mini-game compatible engine template zip into the per-version
## template store. A valid version.txt is required and the destination is keyed
## by that declared version, so a template can never be silently attributed to
## whichever editor happened to import it.
func import_template_zip(zip_path: String) -> Error:
	var reader := ZIPReader.new()
	var zip_open_err := reader.open(zip_path)
	if zip_open_err != OK:
		_log("[color=red]无法打开 ZIP: %s[/color]" % zip_path)
		return zip_open_err

	var found_js := ""
	var found_wasm_br := ""
	var found_wasm := ""
	var found_version_file := ""

	for f in reader.get_files():
		var basename := f.get_file()
		if basename == "godot.js" and found_js.is_empty():
			found_js = f
		elif basename == "godot.wasm.br" and found_wasm_br.is_empty():
			found_wasm_br = f
		elif basename == "godot.wasm" and not basename.ends_with(".br") and found_wasm.is_empty():
			found_wasm = f
		elif basename == "version.txt" and found_version_file.is_empty():
			found_version_file = f

	if found_js.is_empty():
		reader.close()
		_log("[color=red]ZIP 中未找到 godot.js[/color]")
		return ERR_FILE_NOT_FOUND

	if found_wasm_br.is_empty() and found_wasm.is_empty():
		reader.close()
		_log("[color=red]ZIP 中未找到 godot.wasm 或 godot.wasm.br[/color]")
		return ERR_FILE_NOT_FOUND

	if found_version_file.is_empty():
		reader.close()
		_log("[color=red]ZIP 中缺少 version.txt；无法证明模板与 Godot 版本兼容[/color]")
		return ERR_INVALID_DATA

	var zip_version := reader.read_file(found_version_file).get_string_from_utf8().strip_edges()

	var version_key := _version_key_from_string(zip_version)
	var editor_key := get_godot_version_key()
	if version_key.is_empty() \
			or version_key.contains("/") \
			or version_key.contains("\\") \
			or version_key.contains("..") \
			or version_key.validate_filename() != version_key:
		reader.close()
		_log("[color=red]version.txt 无效: %s[/color]" % zip_version)
		return ERR_INVALID_DATA
	if version_key != editor_key:
		_log("  [color=yellow]⚠ ZIP 版本 (%s) 与当前编辑器 (%s) 不匹配 — 按 ZIP 版本归档，需要切换编辑器版本才能使用[/color]" % [version_key, editor_key])

	var js_data := reader.read_file(found_js)
	var br_data := PackedByteArray()
	var wasm_data := PackedByteArray()
	if not found_wasm_br.is_empty():
		br_data = reader.read_file(found_wasm_br)
	elif not found_wasm.is_empty():
		wasm_data = reader.read_file(found_wasm)
	reader.close()
	if js_data.is_empty() or (br_data.is_empty() and wasm_data.is_empty()):
		_log("[color=red]ZIP 中的引擎文件为空或损坏[/color]")
		return ERR_FILE_CORRUPT

	# Build a complete template beside the live store. Nothing below this line
	# mutates the active version directory until _commit_template_store performs
	# the final same-filesystem rename.
	var templates_root := OS.get_config_dir().path_join("godot_mini_game/templates")
	var mkdir_err := DirAccess.make_dir_recursive_absolute(templates_root)
	if mkdir_err != OK:
		_log("[color=red]无法创建模板库目录: %s[/color]" % error_string(mkdir_err))
		return mkdir_err
	var token := "%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()]
	var staging_dir := templates_root.path_join(".import-%s-%s" % [version_key, token])
	var live_store := templates_root.path_join(version_key)
	mkdir_err = DirAccess.make_dir_recursive_absolute(staging_dir)
	if mkdir_err != OK:
		_log("[color=red]无法创建模板 staging 目录: %s[/color]" % error_string(mkdir_err))
		return mkdir_err

	var write_err := _write_buffer(staging_dir.path_join("godot.js"), js_data)
	if write_err != OK:
		_log("[color=red]写入 godot.js 失败: %s[/color]" % error_string(write_err))
		_discard_template_staging(staging_dir)
		return write_err
	_log("  提取 godot.js (%d bytes)" % js_data.size())

	if not br_data.is_empty():
		write_err = _write_buffer(staging_dir.path_join("godot.wasm.br"), br_data)
		if write_err != OK:
			_log("[color=red]写入 godot.wasm.br 失败: %s[/color]" % error_string(write_err))
			_discard_template_staging(staging_dir)
			return write_err
		_log("  提取 godot.wasm.br (%.1f MB)" % [br_data.size() / 1048576.0])
	else:
		var wasm_path := staging_dir.path_join("godot.wasm")
		write_err = _write_buffer(wasm_path, wasm_data)
		if write_err != OK:
			_log("[color=red]写入 godot.wasm 失败: %s[/color]" % error_string(write_err))
			_discard_template_staging(staging_dir)
			return write_err
		_log("  提取 godot.wasm (%.1f MB)" % [wasm_data.size() / 1048576.0])
		if not _brotli_compress(wasm_path, staging_dir.path_join("godot.wasm.br")):
			_log("[color=red]模板导入失败：无法生成 godot.wasm.br[/color]")
			_discard_template_staging(staging_dir)
			return ERR_CANT_CREATE

	write_err = _write_text(
		staging_dir.path_join("version.txt"),
		version_key + "\n")
	if write_err != OK:
		_log("[color=red]写入模板版本失败: %s[/color]" % error_string(write_err))
		_discard_template_staging(staging_dir)
		return write_err

	var staged_candidate := _directory_template_candidate(
		"staging", staging_dir, _read_version_key_file(staging_dir.path_join("version.txt")), version_key)
	if not bool(staged_candidate.get("ready", false)) \
			or not bool(staged_candidate.get("version_match", false)):
		_log("[color=red]staging 模板不完整或版本校验失败[/color]")
		_discard_template_staging(staging_dir)
		return ERR_FILE_CORRUPT
	var validation_err := _validate_engine_template_files(staged_candidate)
	if validation_err != OK:
		_discard_template_staging(staging_dir)
		return validation_err

	var commit_err := _commit_template_store(staging_dir, live_store, token)
	if commit_err != OK:
		_discard_template_staging(staging_dir)
		return commit_err

	_log("[color=green]模板已导入到: %s[/color]" % live_store)
	return OK


func _discard_template_staging(staging_dir: String) -> void:
	if not DirAccess.dir_exists_absolute(staging_dir):
		return
	var cleanup_err := _rm_rf(staging_dir)
	if cleanup_err != OK:
		_log("[color=yellow]⚠ 无法清理模板 staging: %s (%s)[/color]" % [
			staging_dir, error_string(cleanup_err)])


## Swap a fully validated staging directory into place. If installing the new
## directory fails after the old one was renamed, immediately restore the old
## store before returning an error.
func _commit_template_store(staging_dir: String, live_store: String, token: String = "") -> Error:
	if not DirAccess.dir_exists_absolute(staging_dir):
		return ERR_DOES_NOT_EXIST
	if FileAccess.file_exists(live_store):
		return ERR_ALREADY_EXISTS
	if token.is_empty():
		token = "%d-%d" % [OS.get_process_id(), Time.get_ticks_usec()]
	var backup_dir := live_store.get_base_dir().path_join(
		".backup-%s-%s" % [live_store.get_file(), token])
	var had_live := DirAccess.dir_exists_absolute(live_store)
	if had_live:
		var backup_err := DirAccess.rename_absolute(live_store, backup_dir)
		if backup_err != OK:
			_log("[color=red]无法备份现有模板库: %s[/color]" % error_string(backup_err))
			return backup_err

	var install_err := DirAccess.rename_absolute(staging_dir, live_store)
	if install_err != OK:
		if had_live:
			var rollback_err := DirAccess.rename_absolute(backup_dir, live_store)
			if rollback_err != OK:
				_log("[color=red]模板提交和回滚均失败；旧模板仍保存在: %s[/color]" % backup_dir)
				return rollback_err
		_log("[color=red]无法提交模板 staging: %s[/color]" % error_string(install_err))
		return install_err

	if had_live and DirAccess.dir_exists_absolute(backup_dir):
		var cleanup_err := _rm_rf(backup_dir)
		if cleanup_err != OK:
			_log("[color=yellow]⚠ 新模板已生效，但旧模板备份清理失败: %s[/color]" % backup_dir)
	return OK


## Extracts a normalized version key from strings like "4.6.1-stable" or "4.6.1.stable".
static func _version_key_from_string(s: String) -> String:
	if s.is_empty():
		return ""
	var parts := s.replace("-", ".").split(".")
	if parts.size() < 2:
		return ""
	if not parts[0].is_valid_int() or not parts[1].is_valid_int():
		return ""
	if parts.size() >= 4 and parts[2].is_valid_int() and not str(parts[3]).is_empty():
		return "%s.%s.%s.%s" % [parts[0], parts[1], parts[2], parts[3]]
	if parts.size() >= 3 and parts[2].is_valid_int():
		return "%s.%s.%s" % [parts[0], parts[1], parts[2]]
	return "%s.%s" % [parts[0], parts[1]]


static func _read_version_key_file(path: String) -> String:
	if not FileAccess.file_exists(path):
		return ""
	var f := FileAccess.open(path, FileAccess.READ)
	if not f:
		return ""
	var text := f.get_as_text().strip_edges()
	f.close()
	return _version_key_from_string(text)


static func _status(source: String, has_js: bool, has_wasm: bool, template_version: String, editor_version: String) -> Dictionary:
	var version_match := not template_version.is_empty() and template_version == editor_version
	return {
		"source": source,
		"has_js": has_js,
		"has_wasm": has_wasm,
		"ready": has_js and has_wasm,
		"editor_version": editor_version,
		"template_version": template_version,
		"version_match": version_match,
	}


static func _editor_version_string() -> String:
	var v := Engine.get_version_info()
	return "%d.%d.%d.%s" % [v.major, v.minor, v.patch, v.status]


# ─── Public entry point ────────────────────────────────────────────

func export_mini_game(
	platform: String,
	appid: String,
	orientation: String,
	preset_name: String,
	output_dir: String,
) -> Error:
	_log("平台: %s | AppID: %s | 方向: %s" % [platform, appid, orientation])
	_log("输出目录: %s" % output_dir)

	# Step 0: finish every non-destructive check before touching an existing
	# output. In particular, a stale bundled template must never cause the old
	# export to be deleted before we discover there is no compatible engine.
	var template := _resolve_engine_template()
	var err := _preflight_export(platform, appid, orientation, preset_name, output_dir, template)
	if err != OK:
		return err

	var output_info := validate_output_dir(output_dir)
	var global_output: String = output_info.get("path", "")
	err = _prepare_output_dir(global_output)
	if err != OK:
		return err

	err = _cleanup_managed_outputs(global_output)
	if err != OK:
		_log("[color=red]无法清理旧导出文件: %s[/color]" % error_string(err))
		return err

	for sub in ["audio", "engine", "js/libs", "js/worker", "images", "subpacks"]:
		err = DirAccess.make_dir_recursive_absolute(global_output.path_join(sub))
		if err != OK:
			_log("[color=red]无法创建输出子目录 %s: %s[/color]" % [sub, error_string(err)])
			return err

	# Step 1: Export .pck (lightweight, does not require export templates)
	_log("步骤 1/5: 导出资源包 (.pck) ...")
	err = await _export_pck(preset_name, global_output.path_join("engine/godot.zip"))
	if err != OK:
		_log("[color=red]导出 PCK 失败: %s[/color]" % error_string(err))
		return err

	# Step 2: Obtain engine files (godot.js + godot.wasm)
	_log("步骤 2/5: 获取引擎文件 (godot.js / godot.wasm) ...")
	err = _obtain_engine_files(global_output, template)
	if err != OK:
		return err

	# Step 3: Copy common JS runtime templates
	_log("步骤 3/5: 复制 JS 运行时模板 ...")
	err = _copy_common_templates(global_output)
	if err != OK:
		return err

	# Step 4: Copy platform-specific entry & configs
	_log("步骤 4/5: 生成平台配置 (%s) ..." % platform)
	err = _copy_platform_templates(platform, global_output, appid, orientation)
	if err != OK:
		return err

	# Step 5: Create placeholder files for the subpackage structure declared in game.json.
	# Both /engine and /subpacks are listed under "subpackages" in game.json; WeChat
	# expects every subpackage root to be a real (possibly empty) directory containing
	# at least one file, otherwise the bundler complains. A zero-byte game.js satisfies
	# that without bloating the package.
	_log("步骤 5/5: 创建占位文件 ...")
	err = _write_text(global_output.path_join("engine/game.js"), "")
	if err != OK:
		return err
	err = _write_text(global_output.path_join("subpacks/game.js"), "")
	if err != OK:
		return err

	err = _generate_placeholder_images(global_output)
	if err != OK:
		return err

	_log("[color=green]导出完成！[/color]")
	return OK


func _preflight_export(
	platform: String,
	appid: String,
	orientation: String,
	preset_name: String,
	output_dir: String,
	template: Dictionary,
) -> Error:
	if platform not in ["wechat", "douyin"]:
		_log("[color=red]不支持的平台: %s[/color]" % platform)
		return ERR_INVALID_PARAMETER
	if orientation not in ["portrait", "landscape"]:
		_log("[color=red]不支持的屏幕方向: %s[/color]" % orientation)
		return ERR_INVALID_PARAMETER

	var preset_err := _validate_export_preset(preset_name)
	if preset_err != OK:
		_log("[color=red]导出预设不存在或不是 Web 平台: %s[/color]" % preset_name)
		return preset_err

	var output_info := validate_output_dir(output_dir)
	var output_err: Error = output_info.get("error", FAILED)
	if output_err != OK:
		_log("[color=red]输出目录不安全: %s[/color]" % str(output_info.get("message", "未知错误")))
		return output_err

	if not bool(template.get("ready", false)):
		_log("[color=red]未找到完整的 Godot 引擎模板[/color]")
		return ERR_FILE_NOT_FOUND
	if not bool(template.get("version_match", false)):
		_log("[color=red]模板版本 %s 与当前 Godot %s 不匹配，已拒绝导出[/color]" % [
			str(template.get("template_version", "未知")), get_godot_version_key()])
		return ERR_INVALID_DATA
	var template_err := _validate_engine_template_files(template)
	if template_err != OK:
		return template_err

	var required := [
		TEMPLATES + "common/adapter.js",
		TEMPLATES + "common/audio/demo-tone.wav",
		TEMPLATES + "common/fetch.js",
		TEMPLATES + "common/js/libs/sdk.js",
		TEMPLATES + "common/js/image_loader.js",
		TEMPLATES + "common/js/loader.js",
		TEMPLATES + "common/js/worker/position_reporting.js",
		TEMPLATES + platform + "/game.js",
		TEMPLATES + platform + "/game.json.template",
		TEMPLATES + platform + "/project.config.json.template",
	]
	if platform == "wechat":
		required.append(TEMPLATES + platform + "/project.private.config.json.template")
	for path: String in required:
		var file := FileAccess.open(path, FileAccess.READ)
		if not file:
			_log("[color=red]缺少必要的运行时模板: %s[/color]" % path)
			return FileAccess.get_open_error()
		var content := file.get_as_text() if path.ends_with(".json.template") else ""
		var read_err := file.get_error()
		file.close()
		if read_err != OK:
			return read_err
		if path.ends_with(".json.template"):
			content = _replace_template_values(
				content,
				appid,
				orientation,
				str(ProjectSettings.get_setting("application/config/name", "MiniGame")),
			)
			var json := JSON.new()
			var parse_err := json.parse(content)
			if parse_err != OK:
				_log("[color=red]运行时 JSON 模板无效 (%s:%d): %s[/color]" % [
					path, json.get_error_line(), json.get_error_message()])
				return parse_err
	return OK


func _validate_engine_template_files(template: Dictionary) -> Error:
	if str(template.get("source", "")) == "standard":
		var zip_path := str(template.get("zip_path", ""))
		var reader := ZIPReader.new()
		var open_err := reader.open(zip_path)
		if open_err != OK:
			_log("[color=red]无法打开标准 Web 模板: %s[/color]" % zip_path)
			return open_err
		var js_size := 0
		var wasm_size := 0
		for filename in reader.get_files():
			if filename.get_file() == "godot.js":
				js_size = reader.read_file(filename).size()
			elif filename.get_file() == "godot.wasm":
				wasm_size = reader.read_file(filename).size()
		reader.close()
		if js_size <= 0 or wasm_size <= 0:
			_log("[color=red]标准 Web 模板缺少非空 godot.js 或 godot.wasm: %s[/color]" % zip_path)
			return ERR_FILE_CORRUPT
		return OK

	var paths: PackedStringArray = [str(template.get("js_path", ""))]
	var br_path := str(template.get("wasm_br_path", ""))
	var wasm_path := str(template.get("wasm_path", ""))
	paths.append(br_path if FileAccess.file_exists(br_path) else wasm_path)
	for path in paths:
		var file := FileAccess.open(path, FileAccess.READ)
		if not file:
			_log("[color=red]引擎模板不可读: %s[/color]" % path)
			return FileAccess.get_open_error()
		var file_size := file.get_length()
		file.close()
		if file_size <= 0:
			_log("[color=red]引擎模板文件为空: %s[/color]" % path)
			return ERR_FILE_CORRUPT
		if path.ends_with(".br"):
			var brotli_err := _validate_brotli_file(path)
			if brotli_err != OK:
				return brotli_err
	return OK


## Validate pre-compressed imports without modifying them. Node and the
## brotli CLI are optional; when neither exists, size/readability validation
## above still applies and deep stream validation is explicitly skipped.
func _validate_brotli_file(path: String) -> Error:
	var global_path := ProjectSettings.globalize_path(path)
	var output: Array = []
	var node_bin := _find_executable("node")
	if not node_bin.is_empty():
		var js_code := (
			"const fs=require('fs'),zlib=require('zlib');"
			+ "try{zlib.brotliDecompressSync(fs.readFileSync(process.argv[1]))}"
			+ "catch(e){console.error(e.message);process.exit(1)}"
		)
		if OS.execute(node_bin, ["-e", js_code, global_path], output, true) != 0:
			_log("[color=red]godot.wasm.br 不是有效的 Brotli 数据: %s[/color]" % path)
			return ERR_FILE_CORRUPT
		return OK

	var brotli_bin := _find_executable("brotli")
	if not brotli_bin.is_empty():
		if OS.execute(brotli_bin, ["--test", global_path], output, true) != 0:
			_log("[color=red]godot.wasm.br 未通过 Brotli 校验: %s[/color]" % path)
			return ERR_FILE_CORRUPT
		return OK

	_log("[color=yellow]⚠ 未找到 Node.js/brotli，跳过 .wasm.br 深度流校验[/color]")
	return OK


## Only an empty directory or a directory carrying our exact marker may be
## reused. This makes a mistaken FileDialog selection fail closed.
static func validate_output_dir(output_dir: String) -> Dictionary:
	var raw := output_dir.strip_edges()
	if raw.is_empty():
		return _output_validation(FAILED, "路径为空")

	var global_path := ProjectSettings.globalize_path(raw).simplify_path()
	if not global_path.is_absolute_path():
		return _output_validation(ERR_INVALID_PARAMETER, "必须使用绝对路径")
	var resolved_info := _resolve_path_with_symlinks(global_path)
	var resolve_err: Error = resolved_info.get("error", FAILED)
	if resolve_err != OK:
		return _output_validation(resolve_err, str(resolved_info.get("message", "无法解析输出路径")))
	global_path = str(resolved_info.get("path", ""))
	if global_path == "/" or global_path.get_base_dir() == global_path:
		return _output_validation(ERR_INVALID_PARAMETER, "不能导出到文件系统根目录")

	var project_info := _resolve_path_with_symlinks(
		ProjectSettings.globalize_path("res://").simplify_path())
	if project_info.get("error", FAILED) != OK:
		return _output_validation(ERR_CANT_RESOLVE, "无法解析项目目录")
	var project_path := str(project_info.get("path", ""))
	if _paths_equal(global_path, project_path) \
			or _path_contains(global_path, project_path) \
			or _path_contains(project_path, global_path):
		return _output_validation(ERR_INVALID_PARAMETER, "不能导出到项目目录内部、项目根目录或其祖先目录")

	var dangerous: PackedStringArray = [
		OS.get_environment("HOME"),
		OS.get_environment("USERPROFILE"),
		OS.get_config_dir(),
		OS.get_data_dir(),
		OS.get_cache_dir(),
		OS.get_executable_path().get_base_dir(),
	]
	for path in dangerous:
		if path.is_empty():
			continue
		var dangerous_info := _resolve_path_with_symlinks(path.simplify_path())
		var dangerous_path := str(dangerous_info.get("path", path.simplify_path()))
		if _paths_equal(global_path, dangerous_path):
			return _output_validation(ERR_INVALID_PARAMETER, "不能导出到用户或应用的关键目录")

	if FileAccess.file_exists(global_path):
		return _output_validation(ERR_INVALID_PARAMETER, "目标路径是文件")
	if not DirAccess.dir_exists_absolute(global_path):
		return _output_validation(OK, "", global_path)

	var dir := DirAccess.open(global_path)
	if not dir:
		return _output_validation(ERR_CANT_OPEN, "无法读取目标目录")

	dir.list_dir_begin()
	var first_entry := dir.get_next()
	dir.list_dir_end()
	if first_entry.is_empty():
		return _output_validation(OK, "", global_path)

	if dir.is_link(EXPORT_MARKER) or not FileAccess.file_exists(global_path.path_join(EXPORT_MARKER)):
		return _output_validation(ERR_ALREADY_EXISTS, "目录非空且不是本插件创建的导出目录")
	var marker := FileAccess.open(global_path.path_join(EXPORT_MARKER), FileAccess.READ)
	if not marker:
		return _output_validation(ERR_CANT_OPEN, "无法读取导出目录标记")
	var marker_content := marker.get_as_text()
	marker.close()
	if marker_content != EXPORT_MARKER_CONTENT:
		return _output_validation(ERR_INVALID_DATA, "导出目录标记无效")
	return _output_validation(OK, "", global_path)


## Resolves every symlink whose parent currently exists, then appends any
## genuinely non-existent suffix. This catches `/safe/link-to-project/new`
## without rejecting normal system aliases such as macOS `/tmp -> /private/tmp`.
static func _resolve_path_with_symlinks(path: String, depth: int = 0) -> Dictionary:
	if depth > 32:
		return _output_validation(ERR_CYCLIC_LINK, "符号链接层级过深或存在循环")
	var normalized := path.simplify_path()
	if not normalized.is_absolute_path():
		return _output_validation(ERR_INVALID_PARAMETER, "路径不是绝对路径")

	var components: Array[String] = []
	var root := "/"
	var suffix := ""
	if normalized.begins_with("//"):
		var unc_parts := normalized.trim_prefix("//").split("/", false)
		if unc_parts.size() < 2:
			return _output_validation(ERR_INVALID_PARAMETER, "UNC 路径缺少服务器或共享名")
		root = "//%s/%s" % [unc_parts[0], unc_parts[1]]
		for index in range(2, unc_parts.size()):
			components.append(unc_parts[index])
	elif normalized.length() >= 3 and normalized.substr(1, 2) == ":/":
		root = normalized.substr(0, 3)
		suffix = normalized.substr(3)
	else:
		suffix = normalized.trim_prefix("/")
	if not suffix.is_empty():
		for component in suffix.split("/", false):
			components.append(component)

	var resolved := root
	for index in range(components.size()):
		if FileAccess.file_exists(resolved):
			return _output_validation(ERR_INVALID_PARAMETER, "路径祖先是文件: %s" % resolved)
		if DirAccess.dir_exists_absolute(resolved):
			var parent := DirAccess.open(resolved)
			if not parent:
				return _output_validation(ERR_CANT_OPEN, "无法读取路径祖先: %s" % resolved)
			var component := components[index]
			if parent.is_link(component):
				var target := parent.read_link(component)
				if target.is_empty():
					return _output_validation(ERR_CANT_RESOLVE, "无法读取符号链接: %s" % resolved.path_join(component))
				var combined := target if target.is_absolute_path() else resolved.path_join(target)
				for remaining in range(index + 1, components.size()):
					combined = combined.path_join(components[remaining])
				return _resolve_path_with_symlinks(combined.simplify_path(), depth + 1)
		resolved = resolved.path_join(components[index]).simplify_path()
	return _output_validation(OK, "", resolved)


static func _output_validation(error: Error, message: String, path: String = "") -> Dictionary:
	return {"error": error, "message": message, "path": path}


static func _comparison_path(path: String) -> String:
	var normalized := path.simplify_path()
	if normalized.length() > 1:
		normalized = normalized.trim_suffix("/")
	if OS.get_name() in ["Windows", "macOS"]:
		normalized = normalized.to_lower()
	return normalized


static func _paths_equal(a: String, b: String) -> bool:
	return _comparison_path(a) == _comparison_path(b)


## True when `container` is an ancestor of `child` (not equal).
static func _path_contains(container: String, child: String) -> bool:
	var parent_path := _comparison_path(container)
	var child_path := _comparison_path(child)
	return child_path.begins_with(parent_path + "/")


func _prepare_output_dir(output_dir: String) -> Error:
	var err := DirAccess.make_dir_recursive_absolute(output_dir)
	if err != OK:
		_log("[color=red]无法创建输出目录: %s[/color]" % error_string(err))
		return err
	err = _write_text(output_dir.path_join(EXPORT_MARKER), EXPORT_MARKER_CONTENT)
	if err != OK:
		_log("[color=red]输出目录不可写: %s[/color]" % error_string(err))
	return err


## Wipes only the files / directories we own. The marker is deliberately not
## removed, so a failed retry remains recognisable and recoverable.
func _cleanup_managed_outputs(output_dir: String) -> Error:
	for f in MANAGED_FILES:
		var p := output_dir.path_join(f)
		if FileAccess.file_exists(p):
			var err := DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
			if err != OK:
				return err
	for d in MANAGED_DIRS:
		var p := output_dir.path_join(d)
		var global := ProjectSettings.globalize_path(p)
		if DirAccess.dir_exists_absolute(global):
			var err := _rm_rf(global)
			if err != OK:
				return err
	return OK


## Recursive directory delete. Stays inside the directory we were given —
## DirAccess refuses to escape, so this can't accidentally walk up.
func _rm_rf(global_path: String) -> Error:
	var da := DirAccess.open(global_path)
	if not da:
		return ERR_CANT_OPEN
	da.list_dir_begin()
	var entry := da.get_next()
	while entry != "":
		var child := global_path.path_join(entry)
		var err := OK
		if da.is_link(entry):
			err = da.remove(entry)
		elif da.current_is_dir():
			err = _rm_rf(child)
		else:
			err = da.remove(entry)
		if err != OK:
			da.list_dir_end()
			return err
		entry = da.get_next()
	da.list_dir_end()
	return DirAccess.remove_absolute(global_path)


# ─── Step 1: Export PCK ────────────────────────────────────────────

## Spawns a separate headless Godot process to write the `.pck` and awaits
## its completion without freezing the editor.
##
## Previous implementation called `OS.execute(..., true)` which blocks the
## main thread; large projects pinned the editor for tens of seconds at a
## time. `OS.create_process` returns immediately and we poll via SceneTree
## timer, yielding to the editor so the dock stays responsive.
##
## Trade-off: `OS.create_process` does not capture stdout/stderr, so the
## sub-process Godot's warnings are lost. In return we get a non-blocking
## UI and a heartbeat log every second. If a deeper failure investigation
## is needed, run the command from a terminal manually — the log line
## "执行: <cmd>" prints the full invocation.
func _export_pck(preset_name: String, pck_path: String) -> Error:
	var godot_path := OS.get_executable_path()
	var project_path := ProjectSettings.globalize_path("res://")
	var global_pck := ProjectSettings.globalize_path(pck_path)

	var args: PackedStringArray = [
		"--headless",
		"--path", project_path,
		"--export-pack", preset_name,
		global_pck,
	]

	_log("  执行: %s %s" % [godot_path, " ".join(args)])

	var pid := OS.create_process(godot_path, args)
	if pid <= 0:
		_log("  [color=red]无法启动 Godot 子进程[/color]")
		return ERR_CANT_FORK

	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	var elapsed_ms: int = 0
	var POLL_MS := 250
	while OS.is_process_running(pid):
		if tree:
			await tree.create_timer(POLL_MS / 1000.0).timeout
		else:
			OS.delay_msec(POLL_MS)
		elapsed_ms += POLL_MS
		if elapsed_ms % 4000 == 0:
			_log("  ...导出中 (%ds)" % (elapsed_ms / 1000))

	var exit_code := OS.get_process_exit_code(pid)
	if exit_code != 0:
		_log("  [color=red]导出 PCK 失败 (exit=%d)，请在终端手动重跑命令查看详细错误[/color]" % exit_code)
		return ERR_COMPILATION_FAILED

	if not FileAccess.file_exists(pck_path):
		_log("  [color=red]PCK 文件未生成[/color]")
		return ERR_FILE_NOT_FOUND

	_log("  PCK 已导出 → engine/godot.zip (耗时 %.1fs)" % (elapsed_ms / 1000.0))
	return OK


## The Dock and exporter deliberately share this parser so only Web presets
## are offered and the user's selected resource filter remains untouched.
static func get_web_export_preset_names() -> PackedStringArray:
	var result := PackedStringArray()
	var cfg := ConfigFile.new()
	if cfg.load("res://export_presets.cfg") != OK:
		return result
	for section in cfg.get_sections():
		if not section.begins_with("preset.") or section.ends_with(".options"):
			continue
		if str(cfg.get_value(section, "platform", "")) != "Web":
			continue
		var preset_name := str(cfg.get_value(section, "name", ""))
		if not preset_name.is_empty():
			result.append(preset_name)
	return result


static func _validate_export_preset(preset_name: String) -> Error:
	if preset_name.is_empty():
		return ERR_INVALID_PARAMETER
	return OK if preset_name in get_web_export_preset_names() else ERR_DOES_NOT_EXIST


# ─── Step 2: Obtain engine files ──────────────────────────────────

func _obtain_engine_files(output_dir: String, template: Dictionary) -> Error:
	if not bool(template.get("ready", false)) or not bool(template.get("version_match", false)):
		return ERR_INVALID_DATA

	var js_dst := output_dir.path_join("js/libs/godot.js")
	var wasm_dst := output_dir.path_join("engine/godot.wasm")
	var br_dst := output_dir.path_join("engine/godot.wasm.br")
	var source := str(template.get("source", "none"))
	var err := OK

	if source == "standard":
		var zip_path := str(template.get("zip_path", ""))
		var js_data := _read_from_template_zip(".js", zip_path)
		var wasm_data := _read_from_template_zip(".wasm", zip_path)
		if js_data.is_empty() or wasm_data.is_empty():
			_log("[color=red]标准 Web 模板中缺少 godot.js 或 godot.wasm[/color]")
			return ERR_FILE_CORRUPT
		err = _write_buffer(js_dst, js_data)
		if err != OK:
			return err
		err = _write_buffer(wasm_dst, wasm_data)
		if err != OK:
			return err
		_log("  从标准 Web 模板提取 Godot %s 引擎" % str(template.get("template_version", "")))
		_log("[color=yellow]  ⚠ 标准模板仅作为开发者工具回退；真机请导入小游戏兼容模板。[/color]")
		err = _patch_godot_js(js_dst)
		if err != OK:
			return err
		return OK if _brotli_compress(wasm_dst, br_dst) else ERR_CANT_CREATE

	var js_src := str(template.get("js_path", ""))
	var br_src := str(template.get("wasm_br_path", ""))
	var wasm_src := str(template.get("wasm_path", ""))
	err = _copy_file(js_src, js_dst)
	if err != OK:
		_log("[color=red]复制 godot.js 失败: %s[/color]" % error_string(err))
		return err
	err = _patch_godot_js(js_dst)
	if err != OK:
		return err

	if FileAccess.file_exists(br_src):
		err = _copy_file(br_src, br_dst)
	elif FileAccess.file_exists(wasm_src):
		err = _copy_file(wasm_src, wasm_dst)
		if err == OK and not _brotli_compress(wasm_dst, br_dst):
			err = ERR_CANT_CREATE
	else:
		err = ERR_FILE_NOT_FOUND
	if err != OK:
		_log("[color=red]复制 godot.wasm 失败: %s[/color]" % error_string(err))
		return err
	_log("  已使用 %s 引擎模板 (Godot %s)" % [source, str(template.get("template_version", ""))])
	return OK


func _patch_godot_js(path: String) -> Error:
	var f := FileAccess.open(path, FileAccess.READ)
	if not f:
		return FileAccess.get_open_error()
	var content := f.get_as_text()
	var read_err := f.get_error()
	f.close()
	if read_err != OK:
		return read_err

	# Prepend scope-level vars so bare `document`/`window` inside the Emscripten
	# IIFE resolve to our adapter polyfills instead of the devtools' native objects.
	var preamble := "if(typeof GameGlobal!==\"undefined\"&&GameGlobal.__adapter){var document=GameGlobal.__adapter.document;var window=GameGlobal.__adapter.window||GameGlobal;var navigator=GameGlobal.__adapter.navigator;}\n"

	var postamble := "\nif(typeof Engine!==\"undefined\")GameGlobal.Engine=Engine;if(typeof Godot!==\"undefined\")GameGlobal.Godot=Godot;\n"

	var modified := false
	if not content.begins_with("if(typeof GameGlobal"):
		content = preamble + content
		modified = true
	if content.find("GameGlobal.Engine=Engine") == -1:
		content = content + postamble
		modified = true

	# Mini-game canvas parentElement is a non-configurable native getter
	# returning null. Patch direct accesses to use a safe fallback.
	var _pe := "GodotConfig.canvas.parentElement.appendChild("
	if content.find(_pe) != -1:
		content = content.replace(
			_pe,
			"(GodotConfig.canvas.parentElement||document.body).appendChild(")
		modified = true

	# Replace GL.createContext to handle mini-game quirks:
	# 1) canvas may be null if findCanvasEventTarget fails (no DOM IDs)
	# 2) getContext may fail on second call (context limit)
	# 3) Fall back to cached context or GameGlobal.canvas
	var _gl_create_old := "createContext:(canvas,webGLContextAttributes)=>{if(webGLContextAttributes.renderViaOffscreenBackBuffer)webGLContextAttributes[\"preserveDrawingBuffer\"]=true;var ctx=webGLContextAttributes.majorVersion>1?canvas.getContext(\"webgl2\",webGLContextAttributes):canvas.getContext(\"webgl\",webGLContextAttributes);if(!ctx)return 0;var handle=GL.registerContext(ctx,webGLContextAttributes);return handle}"
	if content.find(_gl_create_old) != -1:
		var _gl_create_new := "createContext:(canvas,webGLContextAttributes)=>{if(!canvas&&typeof GameGlobal!==\"undefined\")canvas=GameGlobal.canvas;if(!canvas){console.error(\"[GL] no canvas\");return 0}var type=webGLContextAttributes.majorVersion>1?\"webgl2\":\"webgl\";console.log(\"[GL.createContext] type=\"+type);var ctx=canvas.getContext(type,webGLContextAttributes);if(!ctx)ctx=canvas.getContext(type);if(!ctx&&canvas.__glctx)ctx=canvas.__glctx;if(!ctx&&typeof GameGlobal!==\"undefined\"&&GameGlobal.canvas&&GameGlobal.canvas!==canvas){ctx=GameGlobal.canvas.getContext(type,webGLContextAttributes)||GameGlobal.canvas.getContext(type);canvas=GameGlobal.canvas}if(!ctx){console.error(\"[GL] getContext failed\");return 0}canvas.__glctx=ctx;console.log(\"[GL.createContext] OK\");var handle=GL.registerContext(ctx,webGLContextAttributes);return handle}"
		content = content.replace(_gl_create_old, _gl_create_new)
		modified = true
	else:
		_log("  [color=yellow]⚠ 未找到 GL.createContext 模式，跳过补丁[/color]")

	# Neutralize connectPositionWorklet — the position-reporting AudioWorkletNode
	# cannot be connected to real native AudioNodes in mini-game runtimes.
	# Audio playback still works; only per-sample position tracking is lost.
	var _cpw_old := "async connectPositionWorklet(start){await GodotAudio.audioPositionWorkletPromise;if(this.isCanceled){return}this._source.connect(this.getPositionWorklet());if(start){this.start()}}"
	if content.find(_cpw_old) != -1:
		content = content.replace(
			_cpw_old,
			"async connectPositionWorklet(start){if(start){this.start()}}")
		modified = true

	# Also patch isWebGLAvailable to always report true for WebGL2
	# (the actual context works, but the test canvas may fail due to context limits)
	var _webgl_check := "return !!document.createElement('canvas').getContext(['webgl', 'webgl2'][majorVersion - 1]);"
	if content.find(_webgl_check) != -1:
		content = content.replace(
			_webgl_check,
			"try{var _c=document.createElement('canvas');var _r=_c.getContext(['webgl','webgl2'][majorVersion-1]);console.log('[isWebGLAvailable] v='+majorVersion+' r='+!!_r);return !!_r}catch(e){return true;}")
		modified = true

	if modified:
		var out := FileAccess.open(path, FileAccess.WRITE)
		if not out:
			return FileAccess.get_open_error()
		out.store_string(content)
		var write_err := out.get_error()
		out.close()
		if write_err != OK:
			return write_err
		_log("  已注入 mini-game 兼容补丁到 godot.js")
	return OK


## Returns true only when `dst_path` exists and is a valid Brotli stream.
## Previous behaviour returned silently on failure, leaving callers to think
## the wasm was compressed when in fact only the raw .wasm survived.
func _brotli_compress(src_path: String, dst_path: String) -> bool:
	var global_src := ProjectSettings.globalize_path(src_path)
	var global_dst := ProjectSettings.globalize_path(dst_path)

	if not FileAccess.file_exists(src_path):
		_log("  [color=yellow]⚠ 源文件不存在: %s[/color]" % src_path)
		return false

	_log("  正在 Brotli 压缩 godot.wasm ...")

	if _brotli_via_node(global_src, global_dst):
		return _finish_brotli(src_path, dst_path, "Node.js zlib")

	if _brotli_via_cli(global_src, global_dst):
		return _finish_brotli(src_path, dst_path, "brotli CLI")

	_log("  [color=red]✗ 未找到可用的 Brotli 压缩后端，无法生成 .wasm.br[/color]")
	_log("  [color=yellow]  推荐: 安装 Node.js (https://nodejs.org) 即可自动使用内置 Brotli[/color]")
	_log("  [color=yellow]  或者: brew install brotli (macOS) / apt install brotli (Linux)[/color]")
	return false


func _brotli_via_node(src: String, dst: String) -> bool:
	var node_bin := _find_executable("node")
	if node_bin.is_empty():
		return false
	var js_code := (
		"const fs=require('fs'),zlib=require('zlib');"
		+ "try{const d=fs.readFileSync(process.argv[1]);"
		+ "const c=zlib.brotliCompressSync(d,"
		+ "{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11}});"
		+ "fs.writeFileSync(process.argv[2],c)}"
		+ "catch(e){console.error(e.message);process.exit(1)}"
	)
	var output: Array = []
	var exit_code := OS.execute(node_bin, ["-e", js_code, src, dst], output, true)
	if exit_code != 0:
		for line in output:
			_log("    node: %s" % str(line).strip_edges())
	return exit_code == 0 and FileAccess.file_exists(dst)


func _brotli_via_cli(src: String, dst: String) -> bool:
	var bin := _find_executable("brotli")
	if bin.is_empty():
		return false
	var output: Array = []
	var exit_code := OS.execute(bin, [
		"--quality=11", "--force", "--output=%s" % dst, src
	], output, true)
	return exit_code == 0 and FileAccess.file_exists(dst)


func _finish_brotli(src_path: String, dst_path: String, backend: String) -> bool:
	var src_file := FileAccess.open(src_path, FileAccess.READ)
	var dst_file := FileAccess.open(dst_path, FileAccess.READ)
	if not src_file or not dst_file:
		if src_file:
			src_file.close()
		if dst_file:
			dst_file.close()
		return false
	var src_size := src_file.get_length()
	var dst_size := dst_file.get_length()
	src_file.close()
	dst_file.close()
	var ratio := dst_size * 100.0 / src_size if src_size > 0 else 0.0
	_log("  Brotli 压缩完成 [%s]: %.1f MB → %.1f MB (%.0f%%)" % [
		backend, src_size / 1048576.0, dst_size / 1048576.0, ratio])
	var remove_err := DirAccess.remove_absolute(ProjectSettings.globalize_path(src_path))
	if remove_err != OK:
		_log("  [color=red]无法删除原始 godot.wasm: %s[/color]" % error_string(remove_err))
		return false
	_log("  已删除原始 .wasm，仅保留 .wasm.br")
	return true


## Searches well-known install paths first, then falls back to `which` / `where`.
## Hardcoded paths are a perf optimisation (avoids spawning a subprocess on the
## happy path) and a reliability boost for Godot run from Finder/Explorer where
## PATH is often empty.
func _find_executable(name: String) -> String:
	var known_paths: Dictionary = {
		"node": [
			"/usr/local/bin/node",
			"/opt/homebrew/bin/node",
			"/usr/bin/node",
			"C:/Program Files/nodejs/node.exe",
			"C:/Program Files (x86)/nodejs/node.exe",
		],
		"brotli": [
			"/opt/homebrew/bin/brotli",
			"/usr/local/bin/brotli",
			"/usr/bin/brotli",
			"C:/Program Files/brotli/brotli.exe",
		],
	}
	if known_paths.has(name):
		for p: String in known_paths[name]:
			if FileAccess.file_exists(p):
				return p
	# nvm-windows / scoop / fnm install into per-user paths; fall back to PATH lookup.
	var which_cmd := "where" if OS.get_name() == "Windows" else "which"
	var output: Array = []
	if OS.execute(which_cmd, [name], output, true) == 0 and output.size() > 0:
		var result := str(output[0]).strip_edges()
		if not result.is_empty():
			return result.split("\n")[0].strip_edges()
	return ""


func _read_from_template_zip(extension: String, selected_zip: String = "") -> PackedByteArray:
	var zip_paths := PackedStringArray()
	if not selected_zip.is_empty():
		zip_paths.append(selected_zip)
	else:
		zip_paths = _standard_template_zip_paths(get_godot_version_key())

	for zip_path in zip_paths:
		if not FileAccess.file_exists(zip_path):
			continue

		var reader := ZIPReader.new()
		if reader.open(zip_path) != OK:
			continue

		var result := PackedByteArray()
		var target_name := "godot.js" if extension == ".js" else "godot.wasm"
		for f in reader.get_files():
			if f.get_file() == target_name:
				result = reader.read_file(f)
				_log("  模板文件: %s → %s" % [zip_path.get_file(), f])
				break
		reader.close()

		if result.size() > 0:
			return result

	return PackedByteArray()


# ─── Step 3: Copy common JS templates ─────────────────────────────

func _copy_common_templates(output_dir: String) -> Error:
	var common := TEMPLATES + "common/"
	var mappings := {
		"adapter.js":                       "adapter.js",
		"audio/demo-tone.wav":              "audio/demo-tone.wav",
		"fetch.js":                         "fetch.js",
		"js/libs/sdk.js":                   "js/libs/sdk.js",
		"js/image_loader.js":               "js/image_loader.js",
		"js/loader.js":                     "js/loader.js",
		"js/worker/position_reporting.js":  "js/worker/position_reporting.js",
	}
	for src_rel in mappings:
		var src_path: String = common + src_rel
		var dst_path: String = output_dir.path_join(mappings[src_rel])
		var err := _copy_file(src_path, dst_path)
		if err != OK:
			_log("[color=red]复制运行时模板失败: %s → %s (%s)[/color]" % [
				src_path, dst_path, error_string(err)])
			return err
	return OK


# ─── Step 4: Platform-specific templates ──────────────────────────

func _copy_platform_templates(
	platform: String,
	output_dir: String,
	appid: String,
	orientation: String,
) -> Error:
	var plat_dir := TEMPLATES + platform + "/"
	var project_name := str(ProjectSettings.get_setting("application/config/name", "MiniGame"))

	var err := _copy_file(plat_dir + "game.js", output_dir.path_join("game.js"))
	if err != OK:
		return err

	err = _copy_template(
		plat_dir + "game.json.template",
		output_dir.path_join("game.json"),
		appid, orientation, project_name,
	)
	if err != OK:
		return err

	err = _copy_template(
		plat_dir + "project.config.json.template",
		output_dir.path_join("project.config.json"),
		appid, orientation, project_name,
	)
	if err != OK:
		return err

	if platform == "wechat":
		err = _copy_template(
			plat_dir + "project.private.config.json.template",
			output_dir.path_join("project.private.config.json"),
			appid, orientation, project_name,
		)
		if err != OK:
			return err
	return OK


# ─── File utilities ────────────────────────────────────────────────

func _copy_file(src: String, dst: String) -> Error:
	var file := FileAccess.open(src, FileAccess.READ)
	if not file:
		var open_err := FileAccess.get_open_error()
		_log("  [color=red]读取失败: %s (%s)[/color]" % [src, error_string(open_err)])
		return open_err
	var content := file.get_buffer(file.get_length())
	var read_err := file.get_error()
	file.close()
	if read_err != OK:
		return read_err

	var dir := ProjectSettings.globalize_path(dst.get_base_dir())
	var mkdir_err := DirAccess.make_dir_recursive_absolute(dir)
	if mkdir_err != OK:
		return mkdir_err

	var out := FileAccess.open(dst, FileAccess.WRITE)
	if not out:
		return FileAccess.get_open_error()
	out.store_buffer(content)
	var write_err := out.get_error()
	out.close()
	return write_err


func _copy_template(
	src: String,
	dst: String,
	appid: String,
	orientation: String,
	project_name: String,
) -> Error:
	var file := FileAccess.open(src, FileAccess.READ)
	if not file:
		var open_err := FileAccess.get_open_error()
		_log("  [color=red]模板读取失败: %s (%s)[/color]" % [src, error_string(open_err)])
		return open_err
	var text := file.get_as_text()
	var read_err := file.get_error()
	file.close()
	if read_err != OK:
		return read_err

	text = _replace_template_values(text, appid, orientation, project_name)

	var json := JSON.new()
	var parse_err := json.parse(text)
	if parse_err != OK:
		_log("[color=red]生成的 JSON 无效 (%s:%d): %s[/color]" % [
			src, json.get_error_line(), json.get_error_message()])
		return parse_err
	return _write_text(dst, text)


static func _json_string_content(value: String) -> String:
	var encoded := JSON.stringify(value)
	return encoded.substr(1, encoded.length() - 2)


static func _replace_template_values(
	text: String,
	appid: String,
	orientation: String,
	project_name: String,
) -> String:
	return text \
		.replace("{{APPID}}", _json_string_content(appid)) \
		.replace("{{ORIENTATION}}", _json_string_content(orientation)) \
		.replace("{{NAME}}", _json_string_content(project_name))


func _write_text(path: String, text: String) -> Error:
	var dir := ProjectSettings.globalize_path(path.get_base_dir())
	var mkdir_err := DirAccess.make_dir_recursive_absolute(dir)
	if mkdir_err != OK:
		return mkdir_err
	var f := FileAccess.open(path, FileAccess.WRITE)
	if not f:
		return FileAccess.get_open_error()
	f.store_string(text)
	var write_err := f.get_error()
	f.close()
	return write_err


func _generate_placeholder_images(output_dir: String) -> Error:
	var images_dir := output_dir.path_join("images")
	var err := DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(images_dir))
	if err != OK:
		return err

	var logo_dst := images_dir.path_join("logo.png")
	if not FileAccess.file_exists(logo_dst):
		var bundled := TEMPLATES + "common/images/logo.png"
		if FileAccess.file_exists(bundled):
			err = _copy_file(bundled, logo_dst)
			if err != OK:
				return err
			_log("  已复制 Godot 图标 → logo.png")
		else:
			var img := Image.create(128, 128, false, Image.FORMAT_RGBA8)
			img.fill(Color(0.278, 0.549, 0.749))
			err = img.save_png(ProjectSettings.globalize_path(logo_dst))
			if err != OK:
				return err
			_log("  生成占位 logo.png")

	var bg_dst := images_dir.path_join("background.png")
	if not FileAccess.file_exists(bg_dst):
		var img := Image.create(128, 128, false, Image.FORMAT_RGBA8)
		img.fill(Color(0.157, 0.173, 0.204))
		err = img.save_png(ProjectSettings.globalize_path(bg_dst))
		if err != OK:
			return err
		_log("  生成占位 background.png")
	return OK


func _write_buffer(path: String, data: PackedByteArray) -> Error:
	var dir := ProjectSettings.globalize_path(path.get_base_dir())
	var mkdir_err := DirAccess.make_dir_recursive_absolute(dir)
	if mkdir_err != OK:
		return mkdir_err
	var f := FileAccess.open(path, FileAccess.WRITE)
	if not f:
		return FileAccess.get_open_error()
	f.store_buffer(data)
	var write_err := f.get_error()
	f.close()
	return write_err


func _log(msg: String) -> void:
	if log_callback.is_valid():
		log_callback.call(msg)
	else:
		print("[MiniGame] ", msg)
