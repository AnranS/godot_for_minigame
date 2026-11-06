import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const { pluginVersion } = JSON.parse(await readFile(new URL("../../support-matrix.json", import.meta.url), "utf8"));
const versionPattern = pluginVersion.replaceAll(".", "\\.");

test("exports a complete static homepage", async () => {
  const html = await readFile(new URL("../dist/client/index.html", import.meta.url), "utf8");

  assert.match(html, /Godot Mini Game/);
  assert.match(html, /微信、抖音与 TikTok/);
  assert.match(html, />TikTok<\/span>/);
  assert.doesNotMatch(html, /TikTok Native|TTMinis\.game|TTWebAssembly|ttmg init|support tier is beta/);
  assert.match(html, /subPackages/);
  assert.match(html, /subpackages/);
  assert.match(html, /MiniGameSDK/);
  assert.match(html, /href="(?:\/godot_for_minigame)?\/api\/"/);
  assert.match(html, /og\.png/);
  assert.match(html, /douyin\.svg/);
  assert.match(html, /tiktok\.svg/);
  assert.match(html, /id="video"/);
  assert.match(html, /<video[^>]*preload="none"/);
  assert.match(html, /video\/promo-zh\.mp4/);
  assert.match(html, /promo-video-1/);
  assert.match(html, /id="architecture"/);
  assert.match(html, /<figure class="architecture-diagram/);
  assert.match(html, /<ol class="architecture-path"/);
  assert.match(html, /<article class="architecture-exporter"/);
  assert.match(html, /<ul class="architecture-runtime-list"/);
  assert.match(html, /Godot 4\.x 项目/);
  assert.match(html, /Godot Mini Game Exporter/);
  assert.match(html, /exporter\.gd/);
  assert.match(html, /游戏资源包/);
  assert.match(html, /认证引擎模板/);
  assert.match(html, /共享浏览器适配与平台桥/);
  assert.match(html, /engine\/godot\.zip/);
  assert.match(html, /godot\.wasm\.br/);
  assert.match(html, /adapter\.js \+ PlatformRuntime/);
  assert.match(html, /微信小游戏/);
  assert.match(html, /抖音小游戏/);
  assert.match(html, /TikTok Mini Game/);
  assert.doesNotMatch(html, /architecture-stage-head|transaction publish|atomic publish|>CLI</);
  assert.match(html, new RegExp(`v${versionPattern}`));
  assert.match(html, /godot_mini_game_vX\.Y\.Z\.zip/);
  assert.doesNotMatch(html, /v0\.1\.1|v0\.2\.1|4\.3–4\.6/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("exports the complete searchable API reference", async () => {
  const html = await readFile(new URL("../dist/client/api/index.html", import.meta.url), "utf8");

  assert.match(html, /MiniGameSDK API 参考/);
  assert.match(html, /225/);
  assert.match(html, /http_request_with_id/);
  assert.match(html, /http_request_completed/);
  assert.match(html, /搜索 MiniGameSDK API/);
  assert.match(html, /storage_get/);
  assert.match(html, /login_completed/);
  assert.match(html, /call_api/);
  assert.match(html, /add_shortcut/);
  assert.match(html, /tiktok_mission_result/);
  assert.match(html, /is_mini_game/);
  assert.match(html, /bridge_initialization_failed/);
  assert.doesNotMatch(html, /TikTok Native|TikTok 使用 Native runtime/);
  assert.match(html, /跨宿主同名/);
  assert.match(html, /按平台映射/);
  assert.match(html, /找到 <strong>309<\/strong> 项/);
  assert.equal((html.match(/id="method-storage_set"/g) ?? []).length, 1);
  assert.equal((html.match(/id="signal-login_completed"/g) ?? []).length, 1);
  assert.ok(Buffer.byteLength(html) < 2_000_000, "API HTML should not duplicate entries across categories");
});

test("exports the quick start with real screenshots", async () => {
  const html = await readFile(new URL("../dist/client/quick-start/index.html", import.meta.url), "utf8");

  assert.match(html, /快速开始/);
  assert.match(html, new RegExp(`godot_mini_game_v${versionPattern}\\.zip`));
  for (const id of ["prepare", "install", "enable", "preset", "dock", "export", "run", "sdk", "troubleshoot"]) {
    assert.match(html, new RegExp(`id="${id}"`), `quick start section ${id}`);
  }
  for (const shot of ["godot-plugins", "godot-export-preset", "godot-editor-dock", "godot-dock-exported", "wechat-simulator", "wechat-console"]) {
    assert.match(html, new RegExp(`screenshots/${shot}\\.webp`), `screenshot ${shot}`);
  }
  assert.match(html, /ttmg init/);
  assert.match(html, /加载完成，游戏已启动/);
  assert.match(html, /4\.6\.1\.stable/);
});

test("exports the integration guide with the compatibility overview", async () => {
  const html = await readFile(new URL("../dist/client/guide/index.html", import.meta.url), "utf8");

  assert.match(html, /接入指引/);
  for (const id of ["overview", "prepare", "engine", "compatibility", "capabilities", "testing", "release"]) {
    assert.match(html, new RegExp(`id="${id}"`), `guide section ${id}`);
  }
  for (const row of ["WebGL 2\\.0", "GDExtension", "多线程", "user:// 存档", "WebRTC", "屏幕像素比"]) {
    assert.match(html, new RegExp(row), `compatibility row ${row}`);
  }
  assert.match(html, /14d19694e0c88a3f9e82d899a0400f27a24c176e/);
  assert.match(html, /43\.4\.0/);
});

test("keeps required deployment and brand assets", async () => {
  await Promise.all([
    access(new URL(".openai/hosting.json", root)),
    access(new URL("public/godot.svg", root)),
    access(new URL("public/wechat.svg", root)),
    access(new URL("public/douyin.svg", root)),
    access(new URL("public/tiktok.svg", root)),
    access(new URL("public/og.png", root)),
    access(new URL("public/screenshots/wechat-simulator.webp", root)),
    access(new URL("public/screenshots/godot-editor-dock.webp", root)),
  ]);
});
