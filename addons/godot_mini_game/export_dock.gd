@tool
extends VBoxContainer

const Exporter = preload("res://addons/godot_mini_game/exporter.gd")

var editor_plugin: EditorPlugin

@onready var platform_option: OptionButton = $PlatformOption
@onready var appid_input: LineEdit = $AppIdInput
@onready var orientation_option: OptionButton = $OrientationOption
@onready var preset_option: OptionButton = $PresetOption
@onready var output_path: LineEdit = $OutputRow/OutputPath
@onready var browse_btn: Button = $OutputRow/BrowseBtn
@onready var export_btn: Button = $ExportBtn
@onready var status_label: RichTextLabel = $StatusLabel
@onready var folder_dialog: FileDialog = $FolderDialog


func _ready() -> void:
	platform_option.clear()
	platform_option.add_item("微信小游戏", 0)
	platform_option.add_item("抖音小游戏", 1)

	orientation_option.clear()
	orientation_option.add_item("竖屏 (portrait)", 0)
	orientation_option.add_item("横屏 (landscape)", 1)

	_refresh_presets()

	browse_btn.pressed.connect(_on_browse)
	export_btn.pressed.connect(_on_export)
	folder_dialog.dir_selected.connect(_on_dir_selected)

	_log("[b]小游戏导出插件已就绪[/b]")


func _refresh_presets() -> void:
	preset_option.clear()
	var cfg := ConfigFile.new()
	var err := cfg.load("res://export_presets.cfg")
	if err != OK:
		preset_option.add_item("(未找到导出预设)", 0)
		return
	var idx := 0
	for section in cfg.get_sections():
		if section.begins_with("preset."):
			var preset_name: String = cfg.get_value(section, "name", "")
			if preset_name != "":
				preset_option.add_item(preset_name, idx)
				idx += 1


func _on_browse() -> void:
	folder_dialog.popup_centered()


func _on_dir_selected(dir: String) -> void:
	output_path.text = dir


func _on_export() -> void:
	var platform_idx := platform_option.selected
	var platform: String = "wechat" if platform_idx == 0 else "douyin"
	var appid: String = appid_input.text.strip_edges()
	var orientation: String = "portrait" if orientation_option.selected == 0 else "landscape"
	var output_dir: String = output_path.text.strip_edges()
	var preset_name: String = preset_option.get_item_text(preset_option.selected)

	if output_dir.is_empty():
		_log("[color=red]请选择输出目录[/color]")
		return
	if preset_name.is_empty() or preset_name.begins_with("("):
		_log("[color=red]请先在 Godot 中创建一个 Web 导出预设[/color]")
		return

	export_btn.disabled = true
	_log("[color=cyan]开始导出 %s ...[/color]" % ("微信小游戏" if platform == "wechat" else "抖音小游戏"))

	var exporter := Exporter.new()
	exporter.log_callback = _log

	var err := await exporter.export_mini_game(
		platform,
		appid,
		orientation,
		preset_name,
		output_dir,
	)

	if err == OK:
		_log("[color=green][b]导出成功！[/b] → %s[/color]" % output_dir)
		_show_toast("导出成功！", "小游戏已导出到:\n%s" % output_dir)
	else:
		_log("[color=red][b]导出失败[/b][/color]")

	export_btn.disabled = false


func _show_toast(title: String, message: String) -> void:
	var dialog := AcceptDialog.new()
	dialog.title = title
	dialog.dialog_text = message
	dialog.min_size = Vector2i(320, 0)
	add_child(dialog)
	dialog.popup_centered()
	dialog.confirmed.connect(dialog.queue_free)
	dialog.canceled.connect(dialog.queue_free)


func _log(msg: String) -> void:
	if status_label:
		status_label.append_text(msg + "\n")
