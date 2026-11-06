extends SceneTree

const Exporter = preload("res://addons/godot_mini_game/exporter.gd")

const FONT_SETTING := "gui/theme/custom_font"
const THEME_SETTING := "gui/theme/custom"

var _failed := false


func _assert_true(value: bool, message: String) -> void:
	if value:
		return
	push_error(message)
	_failed = true


func _init() -> void:
	var saved_font: Variant = ProjectSettings.get_setting(FONT_SETTING, "")
	var saved_theme: Variant = ProjectSettings.get_setting(THEME_SETTING, "")
	var theme_path := "user://font_hint_test_theme.tres"

	ProjectSettings.set_setting(FONT_SETTING, "")
	ProjectSettings.set_setting(THEME_SETTING, "")
	_assert_true(
		not Exporter.project_default_font_configured(),
		"a project without its own font must be reported",
	)
	var messages: Array[String] = []
	var exporter := Exporter.new()
	exporter.log_callback = func(message: String) -> void: messages.append(message)
	exporter._warn_if_no_project_font()
	_assert_true(
		messages.size() == 1 and messages[0].contains("自定义字体"),
		"the export log must explain how to set a font",
	)

	ProjectSettings.set_setting(FONT_SETTING, "res://fonts/NotoSansSC-subset.ttf")
	_assert_true(
		Exporter.project_default_font_configured(),
		"a project-wide custom font counts as configured",
	)
	messages.clear()
	exporter._warn_if_no_project_font()
	_assert_true(messages.is_empty(), "no hint once a font is configured")

	ProjectSettings.set_setting(FONT_SETTING, "")
	var theme := Theme.new()
	ResourceSaver.save(theme, theme_path)
	ProjectSettings.set_setting(THEME_SETTING, theme_path)
	_assert_true(
		not Exporter.project_default_font_configured(),
		"a custom theme without a default font still needs the hint",
	)
	theme.default_font = SystemFont.new()
	ResourceSaver.save(theme, theme_path)
	_assert_true(
		Exporter.project_default_font_configured(),
		"a custom theme with a default font counts as configured",
	)

	ProjectSettings.set_setting(FONT_SETTING, saved_font)
	ProjectSettings.set_setting(THEME_SETTING, saved_theme)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(theme_path))
	if _failed:
		quit(1)
		return
	print("exporter_font_hint_test.gd: ok")
	quit(0)
