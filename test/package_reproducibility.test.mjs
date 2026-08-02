import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginConfig = fs.readFileSync(
  path.join(projectRoot, "addons/godot_mini_game/plugin.cfg"),
  "utf8",
);
const version = pluginConfig.match(/^version="([^\"]+)"$/m)?.[1];
assert.ok(version, "plugin.cfg must declare a version");

const archiveName = `godot_mini_game_v${version}.zip`;
const archivePath = path.join(projectRoot, "dist", archiveName);
const checksumPath = `${archivePath}.sha256`;

function packagePlugin() {
  const result = spawnSync("bash", ["scripts/package_plugin.sh"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `package_plugin.sh failed:\n${result.stdout}\n${result.stderr}`,
  );
  return createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex");
}

const firstHash = packagePlugin();
const secondHash = packagePlugin();
assert.equal(secondHash, firstHash, "identical source trees must produce byte-identical plugin ZIPs");

const checksum = fs.readFileSync(checksumPath, "utf8").trim();
assert.match(
  checksum,
  new RegExp(`^${secondHash}\\s+\\*?${archiveName.replaceAll(".", "\\.")}$`),
  "checksum must contain the archive basename and its actual SHA-256",
);
assert.ok(!checksum.includes(projectRoot), "checksum must not disclose the maintainer workspace path");
assert.ok(!checksum.includes("/home/runner/"), "checksum must not disclose the CI workspace path");

console.log("package_reproducibility.test.mjs: ok");
