import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

// The catalog the plugin downloads from must be regenerated whenever a
// certified release row changes.
execFileSync(process.execPath, ["scripts/sync_certified_templates.mjs", "--check"], {
  cwd: new URL(".", root),
  stdio: "pipe",
});

const matrix = JSON.parse(read("support-matrix.json"));
const catalog = JSON.parse(read("addons/godot_mini_game/core/certified_templates.json"));
const releaseRows = matrix.certified.filter((row) => row.template.source === "release");

assert.equal(catalog.schema, 1);
assert.equal(catalog.repository, "AnranS/godot_for_minigame");
assert.equal(catalog.templates.length, releaseRows.length, "every release row is downloadable");
for (const row of releaseRows) {
  assert.match(row.template.sha256, /^[0-9a-f]{64}$/, `${row.godotVersion} pins its ZIP`);
}
const bundled = matrix.certified.find((row) => row.template.source === "bundled");
assert.ok(bundled, "one certified row ships with the plugin");
assert.ok(
  !catalog.templates.some((entry) => entry.godotVersion === bundled.godotVersion),
  "the bundled template is never downloaded",
);

const smoke = read(".github/workflows/smoke-test-export.yml");
assert.ok(smoke.includes("TEMPLATE_SHA256"), "CI must pass the pinned hash to the template download");
assert.ok(smoke.includes("sha256sum -c -"), "CI must verify the pinned template hash");

const dock = read("addons/godot_mini_game/export_dock.gd");
assert.ok(dock.includes("TemplateDownload.find_for_editor"), "the dock offers certified downloads");
assert.ok(read("addons/godot_mini_game/export_dock.tscn").includes('name="DownloadBtn"'));

console.log("certified_templates.test.mjs: ok");
