@tool
extends RefCounted
## Core export logic:
##   1. Clean previous managed artifacts in the output directory
##   2. Export .pck via --export-pack (no Web template needed)
##   3. Obtain engine files (godot.js + godot.wasm) from:
##      a) user-provided custom files in addon dir  (highest priority)
##      b) version-matched template from local template store
##      c) installed Godot Web export template zip   (fallback, simulator only)
##   4. Copy JS runtime templates
##   5. Generate platform config files

const ADDON_ROOT := "res://addons/godot_mini_game/"
const TEMPLATES  := "res://addons/godot_mini_game/templates/"
const ENGINE_DIR := "res://addons/godot_mini_game/engine/"

## File / directory names this exporter owns inside the user's output dir.
## On every export we wipe these so re-exports never inherit stale artifacts
## from a failed run, a platform switch, or a downgraded engine template.
## Anything not in these lists (e.g. user-kept files) is left alone.
const MANAGED_FILES: PackedStringArray = [
	"adapter.js", "fetch.js", "game.js", "game.json",
	"project.config.json", "project.private.config.json",
]
const MANAGED_DIRS: PackedStringArray = ["engine", "images", "js", "subpacks"]

var log_callback: Callable


# ─── Template store ────────────────────────────────────────────────

static func get_godot_version_key() -> String:
	var v := Engine.get_version_info()
	return "%d.%d" % [v.major, v.minor]

static func get_template_store_dir() -> String:
	return OS.get_config_dir().path_join("godot_mini_game/templates/" + get_godot_version_key())

static func get_template_status() -> Dictionary:
	## Returns { "source": String, "has_js": bool, "has_wasm": bool, "ready": bool }
	var result := { "source": "none", "has_js": false, "has_wasm": false, "ready": false }

	# Check user-provided in addon root (manual override)
	var addon_js := FileAccess.file_exists(ADDON_ROOT + "godot.js")
	var addon_wasm := FileAccess.file_exists(ADDON_ROOT + "godot.wasm.br") or FileAccess.file_exists(ADDON_ROOT + "godot.wasm")
	if addon_js and addon_wasm:
		result = { "source": "addon", "has_js": true, "has_wasm": true, "ready": true }
		return result

	# Check bundled engine in addon engine/ dir
	var bundled_js := FileAccess.file_exists(ENGINE_DIR + "godot.js")
	var bundled_wasm := FileAccess.file_exists(ENGINE_DIR + "godot.wasm.br") or FileAccess.file_exists(ENGINE_DIR + "godot.wasm")
	if bundled_js and bundled_wasm:
		result = { "source": "bundled", "has_js": true, "has_wasm": true, "ready": true }
		return result

	# Check template store
	var store := get_template_store_dir()
	var store_js := FileAccess.file_exists(store.path_join("godot.js"))
	var store_wasm := FileAccess.file_exists(store.path_join("godot.wasm.br")) or FileAccess.file_exists(store.path_join("godot.wasm"))
	if store_js and store_wasm:
		result = { "source": "store", "has_js": true, "has_wasm": true, "ready": true }
		return result

	# Check standard Godot web export template
	var v := Engine.get_version_info()
	var ver_str := "%d.%d.%d.%s" % [v.major, v.minor, v.patch, v.status]
	var template_base := OS.get_config_dir().path_join("Godot/export_templates/" + ver_str)
	for candidate in ["web_nothreads_release.zip", "web_nothreads_debug.zip", "web_release.zip", "web_debug.zip"]:
		if FileAccess.file_exists(template_base.path_join(candidate)):
			result = { "source": "standard", "has_js": true, "has_wasm": true, "ready": true }
			return result

	return result


## Imports a mini-game compatible engine template zip into the per-version
## template store. The destination directory is keyed by the ZIP's *own*
## version.txt when present, so users can install a 4.6 template from a 4.3
## editor without it being misfiled under `templates/4.3/`.
func import_template_zip(zip_path: String) -> Error:
	var reader := ZIPReader.new()
	if reader.open(zip_path) != OK:
		_log("[color=red]无法打开 ZIP: %s[/color]" % zip_path)
		return ERR_CANT_OPEN

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

	var zip_version := ""
	if not found_version_file.is_empty():
		zip_version = reader.read_file(found_version_file).get_string_from_utf8().strip_edges()

	var version_key := _version_key_from_string(zip_version)
	var editor_key := get_godot_version_key()
	if version_key.is_empty():
		version_key = editor_key
		_log("  [color=yellow]⚠ ZIP 内无 version.txt，按当前编辑器版本 (%s) 归档[/color]" % editor_key)
	elif version_key != editor_key:
		_log("  [color=yellow]⚠ ZIP 版本 (%s) 与当前编辑器 (%s) 不匹配 — 按 ZIP 版本归档，需要切换编辑器版本才能使用[/color]" % [version_key, editor_key])

	var store_dir := OS.get_config_dir().path_join("godot_mini_game/templates/" + version_key)
	var global_store := ProjectSettings.globalize_path(store_dir) if store_dir.begins_with("res://") else store_dir
	DirAccess.make_dir_recursive_absolute(global_store)

	var js_data := reader.read_file(found_js)
	var js_path := global_store.path_join("godot.js")
	var js_file := FileAccess.open(js_path, FileAccess.WRITE)
	if js_file:
		js_file.store_buffer(js_data)
		js_file.close()
	_log("  提取 godot.js (%d bytes)" % js_data.size())

	var compress_ok := true
	if not found_wasm_br.is_empty():
		var br_data := reader.read_file(found_wasm_br)
		var br_file := FileAccess.open(global_store.path_join("godot.wasm.br"), FileAccess.WRITE)
		if br_file:
			br_file.store_buffer(br_data)
			br_file.close()
		_log("  提取 godot.wasm.br (%.1f MB)" % [br_data.size() / 1048576.0])
	elif not found_wasm.is_empty():
		var wasm_data := reader.read_file(found_wasm)
		var wasm_path := global_store.path_join("godot.wasm")
		var wasm_file := FileAccess.open(wasm_path, FileAccess.WRITE)
		if wasm_file:
			wasm_file.store_buffer(wasm_data)
			wasm_file.close()
		_log("  提取 godot.wasm (%.1f MB)" % [wasm_data.size() / 1048576.0])
		compress_ok = _brotli_compress(wasm_path, global_store.path_join("godot.wasm.br"))

	reader.close()

	var ver_file := FileAccess.open(global_store.path_join("version.txt"), FileAccess.WRITE)
	if ver_file:
		ver_file.store_string(zip_version if not zip_version.is_empty() else _editor_version_string())
		ver_file.close()

	if not compress_ok:
		_log("[color=yellow]模板已导入但缺少 .wasm.br；后续导出会失败，请先安装 Node.js 或 brotli CLI[/color]")
	_log("[color=green]模板已导入到: %s[/color]" % global_store)
	return OK


## Extracts the `major.minor` key from strings like "4.6.1-stable" or "4.6.1.stable".
static func _version_key_from_string(s: String) -> String:
	if s.is_empty():
		return ""
	var parts := s.replace("-", ".").split(".")
	if parts.size() < 2:
		return ""
	if not parts[0].is_valid_int() or not parts[1].is_valid_int():
		return ""
	return "%s.%s" % [parts[0], parts[1]]


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

	# Step 0: wipe stale managed artifacts so we never inherit a half-failed run.
	_cleanup_managed_outputs(output_dir)

	for sub in ["engine", "js/libs", "js/worker", "images", "subpacks"]:
		DirAccess.make_dir_recursive_absolute(output_dir.path_join(sub))

	# Step 1: Export .pck (lightweight, does not require export templates)
	_log("步骤 1/5: 导出资源包 (.pck) ...")
	var err := await _export_pck(preset_name, output_dir.path_join("engine/godot.zip"))
	if err != OK:
		_log("[color=red]导出 PCK 失败: %s[/color]" % error_string(err))
		return err

	# Step 2: Obtain engine files (godot.js + godot.wasm)
	_log("步骤 2/5: 获取引擎文件 (godot.js / godot.wasm) ...")
	err = _obtain_engine_files(output_dir)
	if err != OK:
		return err

	# Step 3: Copy common JS runtime templates
	_log("步骤 3/5: 复制 JS 运行时模板 ...")
	_copy_common_templates(output_dir)

	# Step 4: Copy platform-specific entry & configs
	_log("步骤 4/5: 生成平台配置 (%s) ..." % platform)
	_copy_platform_templates(platform, output_dir, appid, orientation)

	# Step 5: Create placeholder files for the subpackage structure declared in game.json.
	# Both /engine and /subpacks are listed under "subpackages" in game.json; WeChat
	# expects every subpackage root to be a real (possibly empty) directory containing
	# at least one file, otherwise the bundler complains. A zero-byte game.js satisfies
	# that without bloating the package.
	_log("步骤 5/5: 创建占位文件 ...")
	_write_text(output_dir.path_join("engine/game.js"), "")
	_write_text(output_dir.path_join("subpacks/game.js"), "")

	_generate_placeholder_images(output_dir)

	_log("[color=green]导出完成！[/color]")
	return OK


## Wipes only the files / directories we own. Anything else the user dropped
## into `output_dir` (scripts, notes, custom assets) is left untouched.
func _cleanup_managed_outputs(output_dir: String) -> void:
	for f in MANAGED_FILES:
		var p := output_dir.path_join(f)
		if FileAccess.file_exists(p):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
	for d in MANAGED_DIRS:
		var p := output_dir.path_join(d)
		var global := ProjectSettings.globalize_path(p)
		if DirAccess.dir_exists_absolute(global):
			_rm_rf(global)


## Recursive directory delete. Stays inside the directory we were given —
## DirAccess refuses to escape, so this can't accidentally walk up.
func _rm_rf(global_path: String) -> void:
	var da := DirAccess.open(global_path)
	if not da:
		return
	da.list_dir_begin()
	var entry := da.get_next()
	while entry != "":
		var child := global_path.path_join(entry)
		if da.current_is_dir():
			_rm_rf(child)
		else:
			DirAccess.remove_absolute(child)
		entry = da.get_next()
	da.list_dir_end()
	DirAccess.remove_absolute(global_path)


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

	_ensure_preset_exports_all(preset_name)

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


## Forces the chosen preset to ship every resource.
##
## SIDE EFFECT: this modifies the user's `export_presets.cfg` in place.
## We only rewrite it when the values actually need to change, and we always
## leave a `export_presets.cfg.bak` next to the original so the user can
## diff/revert. The previous behaviour silently dirtied the file on every
## single export — that broke version control.
func _ensure_preset_exports_all(preset_name: String) -> void:
	const PRESETS_PATH := "res://export_presets.cfg"
	const BACKUP_PATH := "res://export_presets.cfg.bak"

	var cfg := ConfigFile.new()
	if cfg.load(PRESETS_PATH) != OK:
		return

	for section in cfg.get_sections():
		if not section.begins_with("preset."):
			continue
		var name: String = cfg.get_value(section, "name", "")
		if name != preset_name:
			continue

		var current_filter: String = cfg.get_value(section, "export_filter", "")
		var has_files: bool = cfg.has_section_key(section, "export_files")
		if current_filter == "all_resources" and not has_files:
			return

		var backup_src := FileAccess.open(PRESETS_PATH, FileAccess.READ)
		if backup_src:
			var backup_dst := FileAccess.open(BACKUP_PATH, FileAccess.WRITE)
			if backup_dst:
				backup_dst.store_buffer(backup_src.get_buffer(backup_src.get_length()))
				backup_dst.close()
			backup_src.close()

		cfg.set_value(section, "export_filter", "all_resources")
		if has_files:
			cfg.erase_section_key(section, "export_files")
		cfg.save(PRESETS_PATH)

		_log("  [color=yellow]⚠ 已修改预设 \"%s\" 的 export_filter=all_resources（备份: export_presets.cfg.bak）[/color]" % preset_name)
		return


# ─── Step 2: Obtain engine files ──────────────────────────────────

func _obtain_engine_files(output_dir: String) -> Error:
	var got_js := _obtain_godot_js(output_dir)
	var got_wasm := _obtain_godot_wasm(output_dir)

	if got_js and got_wasm:
		return OK

	if not got_js:
		_log("[color=red]缺少 godot.js (Emscripten 胶水代码)[/color]")
	if not got_wasm:
		_log("[color=red]缺少 godot.wasm[/color]")
	_log("[color=yellow]请执行以下操作之一：[/color]")
	_log("[color=yellow]  1. 在导出面板中点击「导入引擎模板」导入兼容的 .zip 模板[/color]")
	_log("[color=yellow]  2. 手动将 godot.js 和 godot.wasm(.br) 放入 addons/godot_mini_game/ 目录[/color]")
	_log("[color=yellow]  3. 安装 Web 导出模板 (仅模拟器可用): Godot → Editor → Manage Export Templates[/color]")
	return ERR_FILE_NOT_FOUND


func _obtain_godot_js(output_dir: String) -> bool:
	var dst := output_dir.path_join("js/libs/godot.js")

	# Priority 1: user-provided custom godot.js in addon root
	var custom := ADDON_ROOT + "godot.js"
	if FileAccess.file_exists(custom):
		_copy_file(custom, dst)
		_log("  已使用自定义 godot.js (来自插件目录)")
		_patch_godot_js(dst)
		return true

	# Priority 2: bundled engine in addon engine/ dir
	var bundled := ENGINE_DIR + "godot.js"
	if FileAccess.file_exists(bundled):
		_copy_file(bundled, dst)
		_log("  已使用内置 godot.js (engine/)")
		_patch_godot_js(dst)
		return true

	# Priority 3: version-matched template from local store
	var store_js := get_template_store_dir().path_join("godot.js")
	if FileAccess.file_exists(store_js):
		_copy_file(store_js, dst)
		_log("  已使用模板库 godot.js (Godot %s)" % get_godot_version_key())
		_patch_godot_js(dst)
		return true

	# Priority 4 (fallback): extract from installed Web export template zip
	var data := _read_from_template_zip(".js")
	if data.size() > 0:
		_write_buffer(dst, data)
		_log("  从标准 Web 导出模板提取 godot.js")
		_log("[color=yellow]  ⚠ 标准模板使用 wasm-eh，真机可能不兼容。建议导入小游戏兼容模板。[/color]")
		_patch_godot_js(dst)
		return true

	return false


func _patch_godot_js(path: String) -> void:
	var f := FileAccess.open(path, FileAccess.READ)
	if not f:
		return
	var content := f.get_as_text()
	f.close()

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
		if out:
			out.store_string(content)
			out.close()
		_log("  已注入 mini-game 兼容补丁到 godot.js")


func _obtain_godot_wasm(output_dir: String) -> bool:
	var wasm_path := output_dir.path_join("engine/godot.wasm")
	var br_path := output_dir.path_join("engine/godot.wasm.br")

	# Priority 1: user-provided in addon root (manual override)
	var custom_br := ADDON_ROOT + "godot.wasm.br"
	if FileAccess.file_exists(custom_br):
		_copy_file(custom_br, br_path)
		_log("  已使用自定义 godot.wasm.br (来自插件目录)")
		return true
	var custom_raw := ADDON_ROOT + "godot.wasm"
	if FileAccess.file_exists(custom_raw):
		_copy_file(custom_raw, wasm_path)
		_log("  已使用自定义 godot.wasm (来自插件目录)")
		return _brotli_compress(wasm_path, br_path)

	# Priority 2: bundled engine in addon engine/ dir
	var bundled_br := ENGINE_DIR + "godot.wasm.br"
	if FileAccess.file_exists(bundled_br):
		_copy_file(bundled_br, br_path)
		_log("  已使用内置 godot.wasm.br (engine/)")
		return true
	var bundled_raw := ENGINE_DIR + "godot.wasm"
	if FileAccess.file_exists(bundled_raw):
		_copy_file(bundled_raw, wasm_path)
		_log("  已使用内置 godot.wasm (engine/)")
		return _brotli_compress(wasm_path, br_path)

	# Priority 3: version-matched template from local store
	var store_dir := get_template_store_dir()
	var store_br := store_dir.path_join("godot.wasm.br")
	var store_raw := store_dir.path_join("godot.wasm")
	if FileAccess.file_exists(store_br):
		_copy_file(store_br, br_path)
		_log("  已使用模板库 godot.wasm.br (Godot %s)" % get_godot_version_key())
		return true
	if FileAccess.file_exists(store_raw):
		_copy_file(store_raw, wasm_path)
		_log("  已使用模板库 godot.wasm (Godot %s)" % get_godot_version_key())
		return _brotli_compress(wasm_path, br_path)

	# Priority 4 (fallback): extract from installed Web export template zip → compress
	var data := _read_from_template_zip(".wasm")
	if data.size() > 0:
		_write_buffer(wasm_path, data)
		_log("  从标准 Web 导出模板提取 godot.wasm (%.1f MB)" % [data.size() / 1048576.0])
		_log("[color=yellow]  ⚠ 标准 WASM 使用 wasm-eh 异常处理，真机上 WXWebAssembly 可能报 CompileError。[/color]")
		_log("[color=yellow]  ⚠ 建议通过导出面板「导入引擎模板」导入兼容真机的模板。[/color]")
		return _brotli_compress(wasm_path, br_path)

	return false


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
		_finish_brotli(src_path, dst_path, "Node.js zlib")
		return true

	if _brotli_via_cli(global_src, global_dst):
		_finish_brotli(src_path, dst_path, "brotli CLI")
		return true

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


func _finish_brotli(src_path: String, dst_path: String, backend: String) -> void:
	var src_file := FileAccess.open(src_path, FileAccess.READ)
	var dst_file := FileAccess.open(dst_path, FileAccess.READ)
	if src_file and dst_file:
		var src_size := src_file.get_length()
		var dst_size := dst_file.get_length()
		var ratio := dst_size * 100.0 / src_size if src_size > 0 else 0.0
		_log("  Brotli 压缩完成 [%s]: %.1f MB → %.1f MB (%.0f%%)" % [
			backend, src_size / 1048576.0, dst_size / 1048576.0, ratio])
	DirAccess.remove_absolute(ProjectSettings.globalize_path(src_path))
	_log("  已删除原始 .wasm，仅保留 .wasm.br")


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


func _read_from_template_zip(extension: String) -> PackedByteArray:
	var v := Engine.get_version_info()
	var ver_str := "%d.%d.%d.%s" % [v.major, v.minor, v.patch, v.status]
	var template_base := OS.get_config_dir().path_join("Godot/export_templates/" + ver_str)

	# Try multiple template zip names (nothreads preferred for mini games)
	var candidates := [
		"web_nothreads_release.zip",
		"web_nothreads_debug.zip",
		"web_release.zip",
		"web_debug.zip",
	]

	for candidate in candidates:
		var zip_path := template_base.path_join(candidate)
		if not FileAccess.file_exists(zip_path):
			continue

		var reader := ZIPReader.new()
		if reader.open(zip_path) != OK:
			continue

		var result := PackedByteArray()
		for f in reader.get_files():
			if f.ends_with(extension) \
					and not f.ends_with(".worker.js") \
					and not f.ends_with(".audio.worklet.js"):
				result = reader.read_file(f)
				_log("  模板文件: %s → %s" % [candidate, f])
				break
		reader.close()

		if result.size() > 0:
			return result

	return PackedByteArray()


# ─── Step 3: Copy common JS templates ─────────────────────────────

func _copy_common_templates(output_dir: String) -> void:
	var common := TEMPLATES + "common/"
	var mappings := {
		"adapter.js":                       "adapter.js",
		"fetch.js":                         "fetch.js",
		"js/libs/sdk.js":                   "js/libs/sdk.js",
		"js/loader.js":                     "js/loader.js",
		"js/worker/position_reporting.js":  "js/worker/position_reporting.js",
	}
	for src_rel in mappings:
		var src_path: String = common + src_rel
		var dst_path: String = output_dir.path_join(mappings[src_rel])
		_copy_file(src_path, dst_path)


# ─── Step 4: Platform-specific templates ──────────────────────────

func _copy_platform_templates(
	platform: String,
	output_dir: String,
	appid: String,
	orientation: String,
) -> void:
	var plat_dir := TEMPLATES + platform + "/"
	var project_name := ProjectSettings.get_setting("application/config/name", "MiniGame")

	_copy_file(plat_dir + "game.js", output_dir.path_join("game.js"))

	_copy_template(
		plat_dir + "game.json.template",
		output_dir.path_join("game.json"),
		appid, orientation, project_name,
	)

	_copy_template(
		plat_dir + "project.config.json.template",
		output_dir.path_join("project.config.json"),
		appid, orientation, project_name,
	)

	if platform == "wechat":
		_copy_template(
			plat_dir + "project.private.config.json.template",
			output_dir.path_join("project.private.config.json"),
			appid, orientation, project_name,
		)


# ─── File utilities ────────────────────────────────────────────────

func _copy_file(src: String, dst: String) -> void:
	var file := FileAccess.open(src, FileAccess.READ)
	if not file:
		_log("  [color=yellow]跳过 (未找到): %s[/color]" % src)
		return
	var content := file.get_buffer(file.get_length())
	file.close()

	var dir := dst.get_base_dir()
	DirAccess.make_dir_recursive_absolute(dir)

	var out := FileAccess.open(dst, FileAccess.WRITE)
	if out:
		out.store_buffer(content)
		out.close()


func _copy_template(
	src: String,
	dst: String,
	appid: String,
	orientation: String,
	project_name: String,
) -> void:
	var file := FileAccess.open(src, FileAccess.READ)
	if not file:
		_log("  [color=yellow]跳过模板 (未找到): %s[/color]" % src)
		return
	var text := file.get_as_text()
	file.close()

	text = text.replace("{{APPID}}", appid)
	text = text.replace("{{ORIENTATION}}", orientation)
	text = text.replace("{{NAME}}", project_name)

	_write_text(dst, text)


func _write_text(path: String, text: String) -> void:
	var dir := path.get_base_dir()
	DirAccess.make_dir_recursive_absolute(dir)
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f:
		f.store_string(text)
		f.close()


func _generate_placeholder_images(output_dir: String) -> void:
	var images_dir := output_dir.path_join("images")
	DirAccess.make_dir_recursive_absolute(images_dir)

	var logo_dst := images_dir.path_join("logo.png")
	if not FileAccess.file_exists(logo_dst):
		var bundled := TEMPLATES + "common/images/logo.png"
		if FileAccess.file_exists(bundled):
			_copy_file(bundled, logo_dst)
			_log("  已复制 Godot 图标 → logo.png")
		else:
			var img := Image.create(128, 128, false, Image.FORMAT_RGBA8)
			img.fill(Color(0.278, 0.549, 0.749))
			img.save_png(ProjectSettings.globalize_path(logo_dst))
			_log("  生成占位 logo.png")

	var bg_dst := images_dir.path_join("background.png")
	if not FileAccess.file_exists(bg_dst):
		var img := Image.create(128, 128, false, Image.FORMAT_RGBA8)
		img.fill(Color(0.157, 0.173, 0.204))
		img.save_png(ProjectSettings.globalize_path(bg_dst))
		_log("  生成占位 background.png")


func _write_buffer(path: String, data: PackedByteArray) -> void:
	var dir := path.get_base_dir()
	DirAccess.make_dir_recursive_absolute(dir)
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f:
		f.store_buffer(data)
		f.close()


func _log(msg: String) -> void:
	if log_callback.is_valid():
		log_callback.call(msg)
	else:
		print("[MiniGame] ", msg)
