import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

const pluginConfig = read("addons/godot_mini_game/plugin.cfg");
const supportMatrix = JSON.parse(read("support-matrix.json"));
const engineTemplate = JSON.parse(read("addons/godot_mini_game/engine/template.json"));
const pluginVersion = pluginConfig.match(/^version="([^"]+)"$/m)?.[1];

assert.ok(pluginVersion, "plugin.cfg must declare a version");
assert.equal(
  supportMatrix.pluginVersion,
  pluginVersion,
  "support-matrix.json and plugin.cfg must describe the same release",
);
assert.equal(supportMatrix.requiresExactEngineTemplate, true);
assert.ok(Number.isInteger(supportMatrix.templateSchema) && supportMatrix.templateSchema > 0);
assert.ok(Number.isInteger(supportMatrix.outputManifestSchema) && supportMatrix.outputManifestSchema > 0);
assert.ok(Array.isArray(supportMatrix.certified) && supportMatrix.certified.length > 0);
const expectedPlatforms = ["douyin", "tiktok", "wechat"];
assert.deepEqual(
  Object.keys(supportMatrix.platformContracts || {}).sort(),
  expectedPlatforms,
  "support matrix must define exactly the three exported platforms",
);
const { wechat: wechatContract, douyin: douyinContract, tiktok: tiktokContract } = supportMatrix.platformContracts;
assert.equal(wechatContract.runtimeType, "native");
assert.equal(wechatContract.apiNamespace, "wx");
assert.equal(wechatContract.subpackageField, "subpackages");
assert.equal(douyinContract.runtimeType, "native");
assert.equal(douyinContract.apiNamespace, "tt");
assert.equal(douyinContract.subpackageField, "subPackages");
assert.equal(tiktokContract.runtimeType, "native");
assert.equal(tiktokContract.supportTier, "beta");
assert.equal(tiktokContract.apiNamespace, "TTMinis.game");
assert.equal(tiktokContract.subpackageField, "subpackages");
assert.equal(tiktokContract.devtool, "ttmg");
assert.equal(tiktokContract.devtoolVersion, "0.4.1-beta.wasm1");
assert.match(tiktokContract.minimumClientVersion, /^\d+\.\d+\.\d+$/);
assert.ok(
  tiktokContract.minimumClientVersion.localeCompare(
    "43.4.0", undefined, { numeric: true, sensitivity: "base" },
  ) >= 0,
  "TikTok native WebAssembly support requires client 43.4.0 or newer",
);
for (const target of supportMatrix.certified) {
  assert.match(target.godotVersion, /^\d+\.\d+\.\d+\.[A-Za-z0-9]+$/);
  assert.match(target.godotCommit, /^[0-9a-f]{40}$/i);
  assert.match(target.emscriptenVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(target.profile, "2d_full");
  assert.equal(target.target, "release");
  assert.deepEqual(
    Object.keys(target.platforms || {}).sort(),
    expectedPlatforms,
    "every certification row must classify all exported platforms",
  );
  assert.ok(target.template && ["bundled", "release"].includes(target.template.source));
  if (target.template.source === "release") {
    assert.match(target.template.releaseTag, /^[0-9A-Za-z._-]+$/);
    assert.match(target.template.asset, /^[0-9A-Za-z._-]+\.zip$/);
  }
}
assert.equal(
  supportMatrix.certified.filter((target) => target.template.source === "bundled").length,
  1,
  "exactly one certified template must be bundled with the plugin",
);
const bundledCertification = supportMatrix.certified.find(
  (target) => target.template.source === "bundled"
    && target.godotVersion === engineTemplate.godot.version
    && target.godotCommit === engineTemplate.godot.commit,
);
assert.ok(bundledCertification, "bundled engine identity must be certified");
assert.equal(engineTemplate.emscriptenVersion, bundledCertification.emscriptenVersion);
assert.equal(engineTemplate.revision, bundledCertification.templateRevision);
assert.equal(engineTemplate.profile, bundledCertification.profile);
assert.equal(engineTemplate.target, bundledCertification.target);

const runtimeSource = read("addons/godot_mini_game/templates/common/js/platform_runtime.js");
const sdkSource = read("addons/godot_mini_game/templates/common/js/libs/sdk.js");
const gdSdkSource = read("addons/godot_mini_game/MiniGameSDK.gd");
const templateBundleSource = read("addons/godot_mini_game/core/template_bundle.gd");
const outputGuardSource = read("addons/godot_mini_game/core/output_guard.gd");
const runtimeAbi = Number(runtimeSource.match(/const BRIDGE_ABI_VERSION = (\d+);/)?.[1]);
const gdAbi = Number(gdSdkSource.match(/const BRIDGE_ABI_VERSION := (\d+)/)?.[1]);
const templateAbi = Number(templateBundleSource.match(/const BRIDGE_ABI := (\d+)/)?.[1]);
const templateSchema = Number(templateBundleSource.match(/const SCHEMA_VERSION := (\d+)/)?.[1]);
const outputManifestSchema = Number(outputGuardSource.match(/const SCHEMA_VERSION := (\d+)/)?.[1]);
assert.ok(Number.isInteger(runtimeAbi) && runtimeAbi > 0, "runtime Bridge ABI must be explicit");
assert.equal(runtimeAbi, supportMatrix.bridgeAbi, "runtime and support matrix Bridge ABI must match");
assert.equal(gdAbi, runtimeAbi, "GDScript consumer and JavaScript Bridge ABI must match");
assert.equal(templateAbi, runtimeAbi, "template contract and runtime Bridge ABI must match");
assert.equal(engineTemplate.bridgeAbi, runtimeAbi, "bundled template and runtime Bridge ABI must match");
assert.equal(templateSchema, supportMatrix.templateSchema, "runtime and support matrix template schemas must match");
assert.equal(engineTemplate.schema, templateSchema, "bundled template schema must match the runtime contract");
assert.equal(outputManifestSchema, supportMatrix.outputManifestSchema, "runtime and support matrix output manifest schemas must match");
const expectedBridgeGlobal = `godotMiniGameBridgeV${runtimeAbi}`;
assert.equal(
  sdkSource.match(/const BRIDGE_GLOBAL_NAME = "([^"]+)";/)?.[1],
  expectedBridgeGlobal,
  "JavaScript Bridge namespace must carry its ABI major",
);
assert.equal(
  gdSdkSource.match(/const BRIDGE_GLOBAL_NAME := "([^"]+)"/)?.[1],
  expectedBridgeGlobal,
  "GDScript Bridge namespace must carry its ABI major",
);
assert.ok(gdSdkSource.includes("candidate.validateBridge("), "GDScript must perform an ABI handshake");
assert.ok(gdSdkSource.includes("bridge_initialization_failed.emit"));

const loaderSource = read("addons/godot_mini_game/templates/common/js/loader.js");
assert.ok(loaderSource.includes("this._loadPromise = this._loadOnce()"));
assert.ok(loaderSource.includes("dispose()"));
assert.ok(!loaderSource.includes("_canvas.width = _window.innerWidth *"));
for (const [platform, expected] of [
  ["wechat", "wechat"],
  ["douyin", "douyin"],
  ["tiktok", "tiktok"],
]) {
  const entry = read(`addons/godot_mini_game/templates/${platform}/game.js`);
  assert.ok(
    entry.includes(`PlatformRuntime.requirePlatform("${expected}"`),
    `${platform} entrypoint must reject the wrong provider`,
  );
}

const buildWorkflow = read(".github/workflows/build-template.yml");
for (const requiredFlag of [
  "wasm_simd=no",
  "threads=no",
  "dlink_enabled=no",
  "javascript_eval=no",
]) {
  assert.ok(buildWorkflow.includes(requiredFlag), `template build must include ${requiredFlag}`);
}
assert.ok(!buildWorkflow.includes("use_exceptions=yes"), "unsupported pseudo-profile flags must not return");
assert.ok(
  read("scripts/verify_wasm_template.sh").includes("wasm-validate --disable-simd"),
  "the shared template verifier must reject SIMD",
);
assert.ok(
  !buildWorkflow.includes("--disable-threads") && !buildWorkflow.includes("--disable-exceptions"),
  "WABT keeps threads/exceptions disabled by default and has no disable flags for them",
);
assert.ok(
  buildWorkflow.includes("scripts/verify_wasm_template.sh"),
  "CI and local builds must use the same template verifier",
);
assert.ok(buildWorkflow.includes(".bridgeAbi"), "bridge ABI must come from support-matrix.json");
assert.ok(buildWorkflow.includes(".templateSchema"), "template schema must come from support-matrix.json");
assert.ok(buildWorkflow.includes("Template revision must be a positive integer"));
assert.ok(
  buildWorkflow.includes(
    "template-${GODOT_TAG}-emsdk-${EMSDK_VERSION}-2d-full-release-abi-${bridge_abi}-r${TEMPLATE_REVISION}",
  ),
  "immutable release tags must cover every independent build input",
);
assert.ok(buildWorkflow.includes("git ls-remote --tags origin"));
assert.ok(buildWorkflow.includes("GODOT_COPYRIGHT.txt"));
assert.ok(buildWorkflow.includes("touch -t 198001010000"));
assert.ok(buildWorkflow.includes("pip install scons==4.9.1"));
assert.ok(!buildWorkflow.includes("head -1"), "CI must reject ambiguous stale build artifacts");
assert.match(
  buildWorkflow,
  /template_revision:[\s\S]*?default: "2"/,
  "eval-free CI templates must default to a new immutable revision",
);

const smokeWorkflow = read(".github/workflows/smoke-test-export.yml");
assert.ok(smokeWorkflow.includes("js/libs/godot.js"));
assert.ok(!smokeWorkflow.includes("engine/godot.js"));
assert.ok(smokeWorkflow.includes("test/*.test.mjs"), "CI must execute every JavaScript test file");
assert.ok(smokeWorkflow.includes("test/*_test.gd"), "CI must execute every GDScript test file");
assert.ok(smokeWorkflow.includes("wasm-validate --disable-simd"));
assert.ok(smokeWorkflow.includes("fromJSON(needs.matrix.outputs.export_matrix)"));
assert.ok(smokeWorkflow.includes(".certified[] as $target"));
assert.ok(smokeWorkflow.includes("Install certified release template"));
for (const identityField of [
  "godotCommit",
  "emscriptenVersion",
  "templateRevision",
  "bridgeAbi",
  "templateSchema",
  "outputManifestSchema",
  "devtoolVersion",
]) {
  assert.ok(smokeWorkflow.includes(identityField), `smoke matrix must carry ${identityField}`);
}
assert.ok(smokeWorkflow.includes("Verify selected certified template identity"));
assert.ok(
  smokeWorkflow.includes("res://test/ci_verify_template_identity.gd"),
  "CI must run the checked-in template identity verifier",
);
assert.ok(smokeWorkflow.includes("Verify exported certified identity"));
assert.ok(smokeWorkflow.includes("ttmg-pack"), "TikTok exports must run the pinned DevTool package checks");
assert.ok(smokeWorkflow.includes('actual_pack_version" = "0.4.8"'));
assert.ok(smokeWorkflow.includes("level === 'error'"));
assert.ok(
  smokeWorkflow.includes('".github/workflows/*.yml"'),
  "changes to any release workflow must exercise the smoke suite",
);

const deployWorkflow = read(".github/workflows/deploy-pages.yml");
assert.ok(deployWorkflow.includes("pull_request:"), "website changes must be tested on pull requests");
assert.ok(deployWorkflow.includes('"addons/godot_mini_game/MiniGameSDK.gd"'));
assert.ok(deployWorkflow.includes('"addons/godot_mini_game/plugin.cfg"'));
assert.ok(deployWorkflow.includes('"support-matrix.json"'));
assert.ok(deployWorkflow.includes("run: npm test"), "rendered website assertions must gate deployment");
assert.ok(
  deployWorkflow.includes("if: github.event_name != 'pull_request'"),
  "pull requests may validate but must not deploy Pages",
);

const releaseScript = read("scripts/release_plugin.sh");
assert.ok(!releaseScript.includes("--clobber"), "published release assets must be immutable");
assert.ok(!releaseScript.includes("gh release upload"), "the tag workflow must be the only release publisher");
assert.ok(releaseScript.includes('git rev-parse --verify "refs/tags/$TAG"'));
assert.ok(releaseScript.includes("git ls-remote --tags origin"));
assert.ok(releaseScript.includes(".pluginVersion"), "release script must validate support-matrix.json before tagging");

const templateBuildScript = read("scripts/build_wasm_template.sh");
assert.ok(
  templateBuildScript.includes("javascript_eval=no"),
  "future local template builds must disable JavaScript eval",
);
assert.ok(!templateBuildScript.includes("javascript_eval=yes"));
assert.ok(
  templateBuildScript.includes('TEMPLATE_REVISION="${TEMPLATE_REVISION:-2}"'),
  "eval-free local templates must default to revision 2",
);
assert.ok(templateBuildScript.includes("Bundle revision (default: 2)"));

const releaseWorkflow = read(".github/workflows/release-plugin.yml");
assert.ok(releaseWorkflow.includes("GODOT_COPYRIGHT.txt"));
assert.ok(releaseWorkflow.includes("sha256sum -c"), "release CI must verify its published checksum");
assert.ok(releaseWorkflow.includes("gh api"));
assert.ok(releaseWorkflow.includes("HTTP 404"), "release existence checks must fail closed on network/auth errors");

const packageScript = read("scripts/package_plugin.sh");
assert.ok(packageScript.includes("THIRD_PARTY_NOTICES.md"));
assert.ok(packageScript.includes("LICENSE"));
assert.ok(packageScript.includes("GODOT_COPYRIGHT.txt"));
assert.ok(packageScript.includes("touch -t 198001010000"));
assert.ok(packageScript.includes('OUTPUT_BASENAME="$(basename "$OUTPUT_ZIP")"'));
assert.ok(
  !packageScript.includes('shasum -a 256 "$OUTPUT_ZIP"'),
  "published checksum files must not expose an absolute build path",
);

const localBuildScript = read("scripts/build_wasm_template.sh");
assert.ok(localBuildScript.includes("status --porcelain --untracked-files=all"));
assert.ok(localBuildScript.includes("Expected exactly one JavaScript artifact"));
assert.ok(localBuildScript.includes("GODOT_COPYRIGHT.txt"));
assert.ok(!localBuildScript.includes("head -1"), "local builds must reject stale ambiguous artifacts");

const verifier = read("scripts/verify_wasm_template.sh");
for (const requiredContract of [
  "EXPECTED_BRIDGE_ABI",
  "EXPECTED_TEMPLATE_SCHEMA",
  ".emscriptenVersion",
  ".revision",
  "GODOT_COPYRIGHT.txt",
]) {
  assert.ok(verifier.includes(requiredContract), `shared verifier must enforce ${requiredContract}`);
}

const identityVerifier = read("test/ci_verify_template_identity.gd");
for (const requiredIdentity of [
  "EXPECTED_GODOT_VERSION",
  "EXPECTED_GODOT_COMMIT",
  "EXPECTED_EMSCRIPTEN_VERSION",
  "EXPECTED_PROFILE",
  "EXPECTED_TARGET",
  "EXPECTED_REVISION",
  "EXPECTED_BRIDGE_ABI",
  "EXPECTED_TEMPLATE_SCHEMA",
]) {
  assert.ok(
    identityVerifier.includes(requiredIdentity),
    `selected-template verifier must enforce ${requiredIdentity}`,
  );
}

assert.match(read(".gitignore"), /^\.cursor\/$/m, "local Cursor state must never block a release");

console.log("release_contract.test.mjs: ok");
