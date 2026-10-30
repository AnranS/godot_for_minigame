import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// MiniGameSDK.gd and sdk.js are maintained by hand. The runtime handshake only
// checks REQUIRED_BRIDGE_METHODS, so every other GDScript call must be proven
// to exist on GodotSDK here instead of failing on a player's device.
const projectRoot = path.resolve(import.meta.dirname, "..");
const addonRoot = path.join(projectRoot, "addons/godot_mini_game");
const gdSource = fs.readFileSync(path.join(addonRoot, "MiniGameSDK.gd"), "utf8");
const sdkSource = fs.readFileSync(path.join(addonRoot, "templates/common/js/libs/sdk.js"), "utf8");
const runtimeSource = fs.readFileSync(path.join(addonRoot, "templates/common/js/platform_runtime.js"), "utf8");

const moduleUrl = (source) => `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}#${Math.random()}`;

for (const name of ["wx", "tt", "TTMinis", "GameGlobal", "PlatformRuntime", "__godotMiniGamePlatformRuntime"]) {
  delete globalThis[name];
}
const { GodotSDK } = await import(moduleUrl(
  sdkSource.replace('"../platform_runtime"', JSON.stringify(moduleUrl(runtimeSource))),
));

const called = new Set([...gdSource.matchAll(/\b(?:_sdk|candidate)\.([A-Za-z_$][\w$]*)\s*\(/g)]
  .map((match) => match[1]));
const requiredBlock = gdSource.match(/const REQUIRED_BRIDGE_METHODS := \[([\s\S]*?)\]/);
assert.ok(requiredBlock, "MiniGameSDK.gd must declare REQUIRED_BRIDGE_METHODS");
for (const match of requiredBlock[1].matchAll(/"([^"]+)"/g)) called.add(match[1]);

// Guard against the extraction silently matching nothing after a refactor.
assert.ok(called.size >= 150, `expected the full bridge surface, found ${called.size} methods`);

const missing = [...called].filter((name) => typeof GodotSDK.prototype[name] !== "function").sort();
assert.deepEqual(missing, [], `MiniGameSDK.gd calls bridge methods that sdk.js does not define: ${missing.join(", ")}`);

console.log(`bridge_surface.test.mjs: ok (${called.size} methods)`);
