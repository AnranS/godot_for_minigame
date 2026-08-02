import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("exports a complete static homepage", async () => {
  const html = await readFile(new URL("../dist/client/index.html", import.meta.url), "utf8");

  assert.match(html, /Godot Mini Game/);
  assert.match(html, /微信与抖音/);
  assert.match(html, /MiniGameSDK/);
  assert.match(html, /href="(?:\/godot_for_minigame)?\/api\/"/);
  assert.match(html, /og\.png/);
  assert.match(html, /id="architecture"/);
  assert.match(html, /exporter\.gd/);
  assert.match(html, /预检/);
  assert.match(html, /模板解析/);
  assert.match(html, /资源构建/);
  assert.match(html, /平台装配/);
  assert.match(html, /输出验证/);
  assert.match(html, /staging\//);
  assert.match(html, /transaction publish/);
  assert.doesNotMatch(html, /atomic publish|>CLI</);
  assert.match(html, /Plugin Core/);
  assert.match(html, /Engine Packs/);
  assert.match(html, /Bridge ABI/);
  assert.match(html, /v0\.2\.1/);
  assert.match(html, /godot_mini_game_v0\.2\.1\.zip/);
  assert.doesNotMatch(html, /v0\.1\.1|4\.3–4\.6/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("exports the complete searchable API reference", async () => {
  const html = await readFile(new URL("../dist/client/api/index.html", import.meta.url), "utf8");

  assert.match(html, /MiniGameSDK API 参考/);
  assert.match(html, /220/);
  assert.match(html, /搜索 MiniGameSDK API/);
  assert.match(html, /storage_get/);
  assert.match(html, /login_completed/);
  assert.match(html, /call_api/);
  assert.match(html, /is_mini_game/);
  assert.match(html, /bridge_initialization_failed/);
  assert.match(html, /找到 <strong>302<\/strong> 项/);
  assert.equal((html.match(/id="method-storage_set"/g) ?? []).length, 1);
  assert.equal((html.match(/id="signal-login_completed"/g) ?? []).length, 1);
  assert.ok(Buffer.byteLength(html) < 2_000_000, "API HTML should not duplicate entries across categories");
});

test("keeps required deployment and brand assets", async () => {
  await Promise.all([
    access(new URL(".openai/hosting.json", root)),
    access(new URL("public/godot.svg", root)),
    access(new URL("public/wechat.svg", root)),
    access(new URL("public/tiktok.svg", root)),
    access(new URL("public/og.png", root)),
  ]);
});
