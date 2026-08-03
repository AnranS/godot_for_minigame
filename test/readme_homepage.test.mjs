import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

function read(relativePath) {
  return readFileSync(new URL(relativePath, root), "utf8");
}

function readBinary(relativePath) {
  return readFileSync(new URL(relativePath, root));
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
    ...Array.from(markdown.matchAll(/(?:href|src|srcset)="([^"]+)"/g), (match) => match[1]),
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

function pngChunks(png, sourceName) {
  const chunks = [];
  let offset = 8;
  while (offset < png.length) {
    assert.ok(offset + 12 <= png.length, `${sourceName} has a truncated PNG chunk`);
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const next = offset + 12 + length;
    assert.ok(next <= png.length, `${sourceName} has an invalid ${type} chunk length`);
    chunks.push(type);
    offset = next;
    if (type === "IEND") break;
  }
  assert.equal(offset, png.length, `${sourceName} must end after IEND`);
  return chunks;
}

function assertSafePng(png, sourceName, expectedSize, expectedColorType, maxBytes = 600_000) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.subarray(0, 8).equals(signature), `${sourceName} must be a real PNG`);
  assert.ok(png.byteLength < maxBytes, `${sourceName} should stay below ${maxBytes} bytes`);
  assert.equal(png.toString("ascii", 12, 16), "IHDR");
  assert.equal(png.readUInt32BE(16), expectedSize.width);
  assert.equal(png.readUInt32BE(20), expectedSize.height);
  assert.equal(png[24], 8, `${sourceName} must use 8-bit channels`);
  assert.equal(png[25], expectedColorType, `${sourceName} has an unexpected PNG color type`);
  assert.equal(png[28], 0, `${sourceName} must be non-interlaced`);

  const chunks = pngChunks(png, sourceName);
  assert.equal(chunks[0], "IHDR");
  assert.ok(chunks.includes("IDAT"), `${sourceName} must contain image data`);
  assert.equal(chunks.at(-1), "IEND");
  for (const metadata of ["acTL", "eXIf", "tEXt", "zTXt", "iTXt"]) {
    assert.ok(!chunks.includes(metadata), `${sourceName} must not contain ${metadata} metadata`);
  }
}

const english = read("README.md");
const chinese = read("README_zh.md");
const bannerDark = readBinary("assets/banner-dark-v2.png");
const bannerLight = readBinary("assets/banner-light.png");
const architectureEnglish = readBinary("assets/export-architecture.png");
const architectureEnglishMobile = readBinary("assets/export-architecture-mobile.png");
const architectureChinese = readBinary("assets/export-architecture-zh.png");
const architectureChineseMobile = readBinary("assets/export-architecture-zh-mobile.png");
const sdkSource = read("addons/godot_mini_game/MiniGameSDK.gd");
const matrix = JSON.parse(read("support-matrix.json"));
const bundled = matrix.certified.find((target) => target.template.source === "bundled");
const generatedApi = read("website/app/api/api-data.generated.ts");
const methods = generatedArray(generatedApi, "apiMethods");
const signals = generatedArray(generatedApi, "apiSignals");

assert.ok(english.split("\n").length <= 220, "English homepage should stay concise");
assert.ok(chinese.split("\n").length <= 220, "Chinese homepage should stay concise");

for (const readme of [english, chinese]) {
  assert.match(readme, /assets\/banner-dark-v2\.png/);
  assert.match(readme, /assets\/banner-light\.png/);
  assert.doesNotMatch(readme, /assets\/banner(?:-light)?\.svg/);
  assert.match(readme, /releases\/latest/);
  assert.match(readme, /smoke-test-export\.yml/);
  assert.match(readme, /<h1 align="center">Godot Mini Game<\/h1>/);
  assert.doesNotMatch(readme, /```mermaid/);
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

assert.match(english, /<source media="\(max-width: 600px\)" srcset="assets\/export-architecture-mobile\.png"/);
assert.match(english, /<img src="assets\/export-architecture\.png" width="720"/);
assert.doesNotMatch(english, /assets\/export-architecture-zh(?:-mobile)?\.png/);
assert.match(chinese, /<source media="\(max-width: 600px\)" srcset="assets\/export-architecture-zh-mobile\.png"/);
assert.match(chinese, /<img src="assets\/export-architecture-zh\.png" width="720"/);
for (const readme of [english, chinese]) {
  assert.doesNotMatch(readme, /assets\/export-architecture(?:-zh)?\.svg/);
}

const sourceMethodCount = sdkSource.match(/^func\s+[a-z][A-Za-z0-9_]*\(/gm)?.length ?? 0;
const sourceSignalCount = sdkSource.match(/^signal\s+[A-Za-z0-9_]+\(/gm)?.length ?? 0;
assert.equal(methods.length, sourceMethodCount, "generated API method count must match MiniGameSDK.gd");
assert.equal(signals.length, sourceSignalCount, "generated API signal count must match MiniGameSDK.gd");
assertSafePng(bannerDark, "assets/banner-dark-v2.png", { width: 1440, height: 360 }, 6);
assertSafePng(bannerLight, "assets/banner-light.png", { width: 1440, height: 360 }, 2);
assertSafePng(architectureEnglish, "assets/export-architecture.png", { width: 1440, height: 960 }, 2, 1_350_000);
assertSafePng(architectureEnglishMobile, "assets/export-architecture-mobile.png", { width: 720, height: 1280 }, 2, 950_000);
assertSafePng(architectureChinese, "assets/export-architecture-zh.png", { width: 1440, height: 960 }, 2, 1_350_000);
assertSafePng(architectureChineseMobile, "assets/export-architecture-zh-mobile.png", { width: 720, height: 1280 }, 2, 950_000);
assert.match(english, /each transaction selects WeChat or Douyin/);
assert.match(english, /game\.js` selects exactly one `PlatformRuntime` provider/);
assert.match(english, /not a filesystem-wide crash-atomic primitive/);
assert.match(chinese, /每次事务只选择微信或抖音之一/);
assert.match(chinese, /game\.js` 只选择一个 `PlatformRuntime` Provider/);
assert.match(chinese, /不是跨文件系统的 crash-atomic/);
assert.match(english, new RegExp(`${methods.length} methods and ${signals.length} signals`));
assert.match(chinese, new RegExp(`${methods.length} 个方法、${signals.length} 个信号`));
assertRelativeLinksExist(english, "README.md");
assertRelativeLinksExist(chinese, "README_zh.md");

console.log("readme_homepage.test.mjs: ok");
