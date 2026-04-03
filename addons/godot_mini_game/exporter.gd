@tool
extends RefCounted
## Core export logic:
##   1. Export .pck via --export-pack (no Web template needed)
##   2. Obtain engine files (godot.js + godot.wasm) from:
##      a) user-provided custom files in addon dir  (highest priority)
##      b) version-matched template from local template store
##      c) installed Godot Web export template zip   (fallback, simulator only)
##   3. Copy JS runtime templates
##   4. Generate platform config files

const ADDON_ROOT := "res://addons/godot_mini_game/"
const TEMPLATES  := "res://addons/godot_mini_game/templates/"
const ENGINE_DIR := "res://addons/godot_mini_game/engine/"

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


func import_template_zip(zip_path: String) -> Error:
	var reader := ZIPReader.new()
	if reader.open(zip_path) != OK:
		_log("[color=red]无法打开 ZIP: %s[/color]" % zip_path)
		return ERR_CANT_OPEN

	var found_js := ""
	var found_wasm_br := ""
	var found_wasm := ""

	for f in reader.get_files():
		var basename := f.get_file()
		if basename == "godot.js" and found_js.is_empty():
			found_js = f
		elif basename == "godot.wasm.br" and found_wasm_br.is_empty():
			found_wasm_br = f
		elif basename == "godot.wasm" and not basename.ends_with(".br") and found_wasm.is_empty():
			found_wasm = f

	if found_js.is_empty():
		reader.close()
		_log("[color=red]ZIP 中未找到 godot.js[/color]")
		return ERR_FILE_NOT_FOUND

	if found_wasm_br.is_empty() and found_wasm.is_empty():
		reader.close()
		_log("[color=red]ZIP 中未找到 godot.wasm 或 godot.wasm.br[/color]")
		return ERR_FILE_NOT_FOUND

	var store_dir := get_template_store_dir()
	var global_store := ProjectSettings.globalize_path(store_dir) if store_dir.begins_with("res://") else store_dir
	DirAccess.make_dir_recursive_absolute(global_store)

	# Extract godot.js
	var js_data := reader.read_file(found_js)
	var js_path := global_store.path_join("godot.js")
	var js_file := FileAccess.open(js_path, FileAccess.WRITE)
	if js_file:
		js_file.store_buffer(js_data)
		js_file.close()
	_log("  提取 godot.js (%d bytes)" % js_data.size())

	# Extract wasm
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
		_brotli_compress(wasm_path, global_store.path_join("godot.wasm.br"))

	reader.close()

	# Write version marker
	var ver_file := FileAccess.open(global_store.path_join("version.txt"), FileAccess.WRITE)
	if ver_file:
		var v := Engine.get_version_info()
		ver_file.store_string("%d.%d.%d.%s" % [v.major, v.minor, v.patch, v.status])
		ver_file.close()

	_log("[color=green]模板已导入到: %s[/color]" % global_store)
	return OK


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

	for sub in ["engine", "js/libs", "images", "subpacks"]:
		DirAccess.make_dir_recursive_absolute(output_dir.path_join(sub))

	# Step 1: Export .pck (lightweight, does not require export templates)
	_log("步骤 1/5: 导出资源包 (.pck) ...")
	var err := _export_pck(preset_name, output_dir.path_join("engine/godot.zip"))
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

	# Step 5: Create placeholder files for subpackage structure & images
	_log("步骤 5/5: 创建占位文件 ...")
	_write_text(output_dir.path_join("engine/game.js"), "")
	_write_text(output_dir.path_join("subpacks/game.js"), "")

	# Copy audio worklet files (Godot's audio system loads these via audioWorklet.addModule)
	_copy_file(TEMPLATES + "common/engine/godot.audio.worklet.js",
		output_dir.path_join("engine/godot.audio.worklet.js"))
	_copy_file(TEMPLATES + "common/engine/godot.audio.position.worklet.js",
		output_dir.path_join("engine/godot.audio.position.worklet.js"))
	_generate_placeholder_images(output_dir)

	_log("[color=green]导出完成！[/color]")
	return OK


# ─── Step 1: Export PCK ────────────────────────────────────────────

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

	var output := []
	var exit_code := OS.execute(godot_path, args, output, true)

	if exit_code != 0:
		for line in output:
			_log("  [color=yellow]%s[/color]" % str(line))
		return ERR_COMPILATION_FAILED

	if not FileAccess.file_exists(pck_path):
		_log("  [color=red]PCK 文件未生成[/color]")
		return ERR_FILE_NOT_FOUND

	_log("  PCK 已导出 → engine/godot.zip")
	return OK


func _ensure_preset_exports_all(preset_name: String) -> void:
	var cfg := ConfigFile.new()
	if cfg.load("res://export_presets.cfg") != OK:
		return
	for section in cfg.get_sections():
		if not section.begins_with("preset."):
			continue
		var name: String = cfg.get_value(section, "name", "")
		if name == preset_name:
			cfg.set_value(section, "export_filter", "all_resources")
			if cfg.has_section_key(section, "export_files"):
				cfg.erase_section_key(section, "export_files")
			cfg.save("res://export_presets.cfg")
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
		_brotli_compress(wasm_path, br_path)
		return true

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
		_brotli_compress(wasm_path, br_path)
		return true

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
		_brotli_compress(wasm_path, br_path)
		return true

	# Priority 4 (fallback): extract from installed Web export template zip → compress
	var data := _read_from_template_zip(".wasm")
	if data.size() > 0:
		_write_buffer(wasm_path, data)
		_log("  从标准 Web 导出模板提取 godot.wasm (%.1f MB)" % [data.size() / 1048576.0])
		_log("[color=yellow]  ⚠ 标准 WASM 使用 wasm-eh 异常处理，真机上 WXWebAssembly 可能报 CompileError。[/color]")
		_log("[color=yellow]  ⚠ 建议通过导出面板「导入引擎模板」导入兼容真机的模板。[/color]")
		_brotli_compress(wasm_path, br_path)
		return true

	return false


func _brotli_compress(src_path: String, dst_path: String) -> void:
	var global_src := ProjectSettings.globalize_path(src_path)
	var global_dst := ProjectSettings.globalize_path(dst_path)

	# Try to find brotli binary
	var brotli_bin := _find_brotli()
	if brotli_bin.is_empty():
		_log("  [color=yellow]⚠ 未找到 brotli 命令，跳过压缩 (将使用未压缩的 .wasm)[/color]")
		_log("  [color=yellow]  安装方法: brew install brotli (macOS) / apt install brotli (Linux)[/color]")
		return

	_log("  正在 Brotli 压缩 godot.wasm ...")
	var output := []
	var exit_code := OS.execute(brotli_bin, [
		"--quality=11", "--force", "--output=%s" % global_dst, global_src
	], output, true)

	if exit_code == 0 and FileAccess.file_exists(dst_path):
		var src_size := FileAccess.open(src_path, FileAccess.READ).get_length()
		var dst_size := FileAccess.open(dst_path, FileAccess.READ).get_length()
		var ratio := dst_size * 100.0 / src_size if src_size > 0 else 0.0
		_log("  Brotli 压缩完成: %.1f MB → %.1f MB (%.0f%%)" % [
			src_size / 1048576.0, dst_size / 1048576.0, ratio])
		DirAccess.remove_absolute(global_src)
		_log("  已删除原始 .wasm，仅保留 .wasm.br")
	else:
		_log("  [color=yellow]⚠ Brotli 压缩失败 (exit=%d)，保留未压缩的 .wasm[/color]" % exit_code)
		for line in output:
			_log("    %s" % str(line))


func _find_brotli() -> String:
	# Common locations for brotli binary
	var candidates := [
		"/opt/homebrew/bin/brotli",
		"/usr/local/bin/brotli",
		"/usr/bin/brotli",
	]
	for path in candidates:
		if FileAccess.file_exists(path):
			return path
	# Try PATH via `which`
	var output := []
	if OS.execute("which", ["brotli"], output, true) == 0:
		var result := str(output[0]).strip_edges()
		if not result.is_empty():
			return result
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
