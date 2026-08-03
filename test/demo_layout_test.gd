extends SceneTree


func _fail(message: String) -> void:
	push_error(message)
	quit(1)


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var packed_scene := load("res://scenes/main.tscn") as PackedScene
	if packed_scene == null:
		_fail("Unable to load scenes/main.tscn")
		return

	var main := packed_scene.instantiate() as Control
	if main == null:
		_fail("Demo main scene should instantiate as a Control")
		return
	root.add_child(main)

	# The project uses a 720 px logical width and keep_width stretching. Let two
	# layout passes settle after the runtime-created SDK controls are added.
	await process_frame
	await process_frame

	var scroll := main.get_node("Scroll") as ScrollContainer
	var content := main.get_node("Scroll/Content") as Control
	if scroll == null or content == null:
		_fail("Demo scroll hierarchy is missing")
		return
	if scroll.horizontal_scroll_mode != ScrollContainer.SCROLL_MODE_DISABLED:
		_fail("Demo must not expose horizontal scrolling on phone viewports")
		return
	if content.size.x > scroll.size.x + 0.5:
		_fail("Demo content overflows horizontally: %.1f > %.1f" % [
			content.size.x, scroll.size.x,
		])
		return
	if content.get_combined_minimum_size().x > content.size.x + 0.5:
		_fail("Demo children still demand more width than the visible content")
		return

	var scroll_rect := scroll.get_global_rect()
	for path in ["ScoreLabel", "TapButton"]:
		var control := main.get_node("Scroll/Content/" + path) as Control
		var rect := control.get_global_rect()
		if rect.position.x < scroll_rect.position.x - 0.5 or rect.end.x > scroll_rect.end.x + 0.5:
			_fail("%s is outside the visible scroll width" % path)
			return

	var sdk_tests := main.get_node("Scroll/Content/SDKTests") as VBoxContainer
	var media_audio_wrapped := false
	for section in sdk_tests.get_children():
		if section.get_child_count() < 2 or not section.get_child(1) is HFlowContainer:
			_fail("Every SDK section must use a wrapping button flow")
			return
		var header := section.get_child(0) as Label
		var flow := section.get_child(1) as HFlowContainer
		if header.text.begins_with("Media Audio"):
			media_audio_wrapped = flow.size.y > 44.5
	if not media_audio_wrapped:
		_fail("The widest SDK button group should wrap to multiple rows")
		return

	var result_labels: Dictionary = main.get("_result_labels")
	var screen_ui_result := result_labels.get("Screen / UI") as Label
	if screen_ui_result == null:
		_fail("Screen / UI demo result label is missing")
		return

	var mini_game_sdk := root.get_node_or_null("MiniGameSDK")
	if mini_game_sdk == null:
		_fail("MiniGameSDK autoload is missing")
		return
	var original_bridge_info := (mini_game_sdk.get("bridge_info") as Dictionary).duplicate(true)
	mini_game_sdk.set("bridge_info", {"platform": "tiktok"})
	mini_game_sdk.call("_on_modal", [false, false, "TTMinis.game.showModal is not supported"])
	if screen_ui_result.text != "Modal unavailable on TikTok Native":
		_fail("TikTok modal failure must render an unavailable result")
		return
	mini_game_sdk.set("bridge_info", original_bridge_info)

	main.call("_test_show_loading")
	if screen_ui_result.text != "Loading overlay shown; hiding automatically...":
		_fail("Loading demo must advertise its automatic recovery")
		return
	await create_timer(1.2).timeout
	if screen_ui_result.text != "Loading overlay hidden automatically":
		_fail("Loading demo must hide the masked overlay without another button press")
		return

	print("demo_layout_test.gd: ok")
	quit(0)
