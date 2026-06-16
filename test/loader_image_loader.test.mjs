import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const helperPath = path.join(projectRoot, "addons/godot_mini_game/templates/common/js/image_loader.js");
const helperSource = fs.readFileSync(helperPath, "utf8");
const { waitForImage } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(helperSource)}`);

async function testAlreadyCompletedImageResolvesImmediately() {
  const image = { complete: true };
  await waitForImage(image);
  assert.equal(image.onload, undefined);
  assert.equal(image.onerror, undefined);
}

async function testPendingImageResolvesOnLoad() {
  const image = { complete: false };
  let resolved = false;
  const pending = waitForImage(image).then(() => { resolved = true; });

  await Promise.resolve();
  assert.equal(resolved, false);
  assert.equal(typeof image.onload, "function");
  assert.equal(typeof image.onerror, "function");

  image.onload();
  await pending;
  assert.equal(resolved, true);
}

async function testMissingImageIsSafe() {
  await waitForImage(null);
}

await testAlreadyCompletedImageResolvesImmediately();
await testPendingImageResolvesOnLoad();
await testMissingImageIsSafe();

console.log("loader_image_loader.test.mjs: ok");
