#!/usr/bin/env node
// Writes the catalog of certified release templates that the editor plugin
// can download with one click. support-matrix.json stays the source of truth:
// run this after adding or changing a certified release row, and use --check
// (as the tests do) to fail when the shipped catalog is stale.
//
// Usage:
//   node scripts/sync_certified_templates.mjs          # rewrite the catalog
//   node scripts/sync_certified_templates.mjs --check  # verify it is current
import { readFile, writeFile } from "node:fs/promises";

const REPOSITORY = "AnranS/godot_for_minigame";
const root = new URL("../", import.meta.url);
const outputUrl = new URL("addons/godot_mini_game/core/certified_templates.json", root);
const matrix = JSON.parse(await readFile(new URL("support-matrix.json", root), "utf8"));

const templates = matrix.certified
  .filter((row) => row.template.source === "release")
  .map((row) => {
    if (!/^[0-9a-f]{64}$/.test(row.template.sha256 ?? "")) {
      throw new Error(`${row.godotVersion}: release templates must pin a lowercase sha256`);
    }
    return {
      godotVersion: row.godotVersion,
      godotCommit: row.godotCommit,
      editorCommits: row.godotEditorCommits ?? [],
      emscriptenVersion: row.emscriptenVersion,
      profile: row.profile,
      target: row.target,
      templateRevision: row.templateRevision,
      releaseTag: row.template.releaseTag,
      asset: row.template.asset,
      sha256: row.template.sha256,
    };
  });

const catalog = `${JSON.stringify({
  schema: 1,
  repository: REPOSITORY,
  bridgeAbi: matrix.bridgeAbi,
  templates,
}, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(outputUrl, "utf8").catch(() => "");
  if (current !== catalog) {
    console.error("certified_templates.json is stale; run node scripts/sync_certified_templates.mjs");
    process.exit(1);
  }
  console.log(`certified_templates.json is current (${templates.length} release templates).`);
} else {
  await writeFile(outputUrl, catalog, "utf8");
  console.log(`Wrote ${templates.length} release templates to certified_templates.json.`);
}
