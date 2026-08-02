import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

function read(relativePath) {
  return readFileSync(new URL(relativePath, root), "utf8");
}

function generatedArray(source, name) {
  const prefix = `export const ${name} = `;
  const start = source.indexOf(prefix);
  assert.notEqual(start, -1, `missing generated ${name}`);
  const valueStart = start + prefix.length;
  const end = source.indexOf(" as const;", valueStart);
  assert.notEqual(end, -1, `unterminated generated ${name}`);
  return JSON.parse(source.slice(valueStart, end));
}

function assertRelativeLinksExist(markdown, sourceName) {
  const references = [
    ...Array.from(markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g), (match) => match[1]),
    ...Array.from(markdown.matchAll(/(?:href|src)="([^"]+)"/g), (match) => match[1]),
  ];

  for (const reference of references) {
    if (/^(?:https?:|mailto:|#)/.test(reference)) continue;
    const relativePath = reference.split("#", 1)[0];
    assert.ok(
      existsSync(fileURLToPath(new URL(relativePath, root))),
      `${sourceName} links to missing ${reference}`,
    );
  }
}

const english = read("README.md");
const chinese = read("README_zh.md");
const banner = read("assets/banner.svg");
const sdkSource = read("addons/godot_mini_game/MiniGameSDK.gd");
const matrix = JSON.parse(read("support-matrix.json"));
const bundled = matrix.certified.find((target) => target.template.source === "bundled");
const generatedApi = read("website/app/api/api-data.generated.ts");
const methods = generatedArray(generatedApi, "apiMethods");
const signals = generatedArray(generatedApi, "apiSignals");

assert.ok(english.split("\n").length <= 220, "English homepage should stay concise");
assert.ok(chinese.split("\n").length <= 220, "Chinese homepage should stay concise");

for (const readme of [english, chinese]) {
  assert.match(readme, /assets\/banner\.svg/);
  assert.match(readme, /releases\/latest/);
  assert.match(readme, /smoke-test-export\.yml/);
  assert.match(readme, /```mermaid/);
  assert.match(readme, /docs\/ARCHITECTURE\.md/);
  assert.match(readme, /docs\/RELEASING\.md/);
  assert.match(readme, new RegExp(`v${matrix.pluginVersion.replaceAll(".", "\\.")}`));
  assert.match(readme, new RegExp(bundled.godotVersion.replaceAll(".", "\\.")));
  assert.match(readme, new RegExp(bundled.godotCommit.slice(0, 12)));
  assert.match(readme, new RegExp(bundled.emscriptenVersion.replaceAll(".", "\\.")));
  assert.ok(readme.includes(`\`${bundled.profile}\``));
  assert.ok(readme.includes(`\`${bundled.target}\``));
  assert.ok(readme.includes(`revision \`${bundled.templateRevision}\``));
  assert.ok(readme.includes(`Bridge ABI \`${matrix.bridgeAbi}\``));
  assert.ok(readme.includes(`template schema \`${matrix.templateSchema}\``));
  assert.ok(readme.includes(`output schema \`${matrix.outputManifestSchema}\``));
  assert.match(readme, /`wx`/);
  assert.match(readme, /`tt`/);
  assert.doesNotMatch(readme, /Certified|认证|Full API Reference|完整 API 参考|TikTok|Real-device ready|ready for submission/);
}

const sourceMethodCount = sdkSource.match(/^func\s+[a-z][A-Za-z0-9_]*\(/gm)?.length ?? 0;
const sourceSignalCount = sdkSource.match(/^signal\s+[A-Za-z0-9_]+\(/gm)?.length ?? 0;
assert.equal(methods.length, sourceMethodCount, "generated API method count must match MiniGameSDK.gd");
assert.equal(signals.length, sourceSignalCount, "generated API signal count must match MiniGameSDK.gd");
assert.ok(banner.includes(`Godot ${bundled.godotVersion.replace(/\.stable$/, "")}`));
assert.doesNotMatch(banner, /Godot 4\.x|TikTok/);
assert.match(english, new RegExp(`${methods.length} methods and ${signals.length} signals`));
assert.match(chinese, new RegExp(`${methods.length} 个方法、${signals.length} 个信号`));
assertRelativeLinksExist(english, "README.md");
assertRelativeLinksExist(chinese, "README_zh.md");

console.log("readme_homepage.test.mjs: ok");
