import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("exports a complete static homepage", async () => {
  const html = await readFile(new URL("../dist/client/index.html", import.meta.url), "utf8");

  assert.match(html, /Godot Mini Game/);
  assert.match(html, /微信与抖音/);
  assert.match(html, /MiniGameSDK/);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
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
