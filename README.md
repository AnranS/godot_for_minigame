<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner.svg" />
    <img src="assets/banner-light.svg" width="720" alt="A Godot project exported through Godot Mini Game to WeChat and Douyin Mini Games" />
  </picture>
</p>

<h1 align="center">Godot Mini Game</h1>

<p align="center">
  <strong>Export Godot games to WeChat and Douyin Mini Games.</strong><br />
  CI-validated WASM engine · guarded export transaction · one versioned GDScript SDK
</p>

<p align="center">
  <a href="https://github.com/AnranS/godot_for_minigame/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/AnranS/godot_for_minigame?display_name=tag&style=flat-square" /></a>
  <a href="https://github.com/AnranS/godot_for_minigame/actions/workflows/smoke-test-export.yml"><img alt="Export tests" src="https://img.shields.io/github/actions/workflow/status/AnranS/godot_for_minigame/smoke-test-export.yml?branch=main&label=export%20tests&style=flat-square" /></a>
  <img alt="Godot 4.6.1" src="https://img.shields.io/badge/Godot-4.6.1-478CBF?logo=godot-engine&logoColor=white&style=flat-square" />
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/AnranS/godot_for_minigame?style=flat-square" /></a>
</p>

<p align="center">
  <strong><a href="https://github.com/AnranS/godot_for_minigame/releases/latest">Download latest →</a></strong> ·
  <a href="https://anrans.github.io/godot_for_minigame/">Website</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="https://anrans.github.io/godot_for_minigame/api/">API reference</a> ·
  <a href="README_zh.md">简体中文</a>
</p>

---

Godot Mini Game turns a normal Godot project into a platform-ready WeChat or
Douyin Mini Game package. Day-to-day export does not require Node.js, Brotli,
Emscripten, or a separate Godot Web template download.

## Why Godot Mini Game?

| | |
|---|---|
| **Editor-native workflow**<br />Build the PCK, assemble platform files, validate, and publish from one Dock. | **Exact template identity**<br />Godot source, Emscripten, profile, revision, schemas, features, and hashes stay aligned. |
| **One SDK, two providers**<br />`MiniGameSDK` exposes 220 methods and 82 signals over the shared `wx` / `tt` runtime contract. | **Guarded publishing**<br />Staging, ownership manifests, hashes, an output lock, backup, and rollback protect managed paths while preserving sidecars. |

## Architecture

<p align="center">
  <a href="assets/export-architecture.svg">
    <img src="assets/export-architecture.svg" width="720" alt="Architecture: one selected platform passes through preflight, exact template resolution, sibling staging, validation, locked managed-path publishing, then runs through PlatformRuntime and the versioned JavaScript-to-GDScript bridge" />
  </a>
</p>

<p align="center"><sub>Click the diagram to open it at full size.</sub></p>

- **Export control plane** — each transaction selects WeChat or Douyin, resolves one complete engine bundle, assembles outside the destination, validates every managed artifact, and publishes under a lock.
- **Exported package runtime** — `game.js` selects exactly one `PlatformRuntime` provider; the loader starts the patched engine and PCK, while `GodotSDK` and `MiniGameSDK` negotiate the Bridge ABI.

The publish step has in-process rollback and records recovery evidence, but is
not a filesystem-wide crash-atomic primitive. Full boundaries are documented in
[Architecture and versioning](docs/ARCHITECTURE.md).

## Validated compatibility

| Contract | Bundled value |
|---|---|
| Plugin release | `v0.2.1` |
| Godot | `4.6.1.stable` · commit `14d19694e0c8` |
| Emscripten | `4.0.3` |
| Build | `2d_full` · `release` · revision `1` |
| Runtime contract | Bridge ABI `1` · template schema `1` · output schema `1` |

- ✅ **WeChat Mini Game (`wx`)** — full export, manifest, WASM, and package checks.
- ✅ **Douyin Mini Game (`tt`)** — full export, manifest, WASM, and package checks.

> [!IMPORTANT]
> The bundled engine is validated by this project only for the exact identity
> above. Another Godot editor build requires a matching template pack.
> Automated checks do not replace final testing in platform DevTools and on
> target devices.

[`support-matrix.json`](support-matrix.json) is the release, CI, and website
source of truth for validated identities and platform status.

## Quick start

### 1 · Install the release asset

Open the [latest release](https://github.com/AnranS/godot_for_minigame/releases/latest),
download `godot_mini_game_vX.Y.Z.zip` from **Assets**, and extract it into the
root of your Godot project. Do not use GitHub's generated source archive.

```text
your_project/
└── addons/
    └── godot_mini_game/
```

<details>
<summary>Install from source for development</summary>

```bash
git clone https://github.com/AnranS/godot_for_minigame.git
mkdir -p your_project/addons
cp -R godot_for_minigame/addons/godot_mini_game your_project/addons/godot_mini_game
```

</details>

### 2 · Enable the plugin

Open **Project > Project Settings > Plugins** and enable
**Godot Mini Game Export**.

### 3 · Add a Web preset

Open **Project > Export** and add a **Web** preset. Its name is up to you; the
standard Web export templates do not need to be downloaded.

### 4 · Export

Open the **Mini Game Export** Dock, then select one platform, enter the App ID,
choose an orientation, Web preset, and dedicated output directory, and click
**Export**. Open the result in the matching platform DevTools.

## SDK in 60 seconds

`MiniGameSDK` is registered as an Autoload. Async calls return through signals;
methods remain safe to call while developing outside a mini-game runtime.

```gdscript
MiniGameSDK.login_completed.connect(func(code: String, error: String) -> void:
    if error.is_empty():
        print("login code: ", code)
)
MiniGameSDK.login()

MiniGameSDK.storage_set("level", "5")
var level := MiniGameSDK.storage_get("level", "1")
MiniGameSDK.show_toast("Level %s" % level, "success")
```

At startup the SDK verifies the bridge brand, global name, ABI, and required
methods before lifecycle binding. Inspect `bridge_info` and
`bridge_initialization_error` when diagnosing integration issues.

**[Browse all 220 methods and 82 signals →](https://anrans.github.io/godot_for_minigame/api/)**

## Documentation

| I want to… | Read |
|---|---|
| Install, configure, and export a game | [Usage guide](docs/USAGE.md) |
| Find an SDK method or signal | [Searchable API reference](https://anrans.github.io/godot_for_minigame/api/) |
| Understand transactions and versioning | [Architecture and versioning](docs/ARCHITECTURE.md) |
| Build or import another engine pack | [Custom template guide](docs/USAGE.md#12-building-a-custom-engine-template) |
| Publish a new plugin version | [Release process](docs/RELEASING.md) |
| Report a problem or request a feature | [GitHub Issues](https://github.com/AnranS/godot_for_minigame/issues) |

Chinese documentation: [使用指南](docs/USAGE_zh.md) · [中文首页](README_zh.md)

## Contributing

Issues and pull requests are welcome. Keep platform-specific behavior behind
the shared runtime and bridge contracts, and run the export test suite before
submitting a change. Maintainers should follow the immutable
[release process](docs/RELEASING.md).

## License

The plugin is available under the [MIT License](LICENSE). The bundled Godot
engine retains its upstream notices; see
[`GODOT_COPYRIGHT.txt`](addons/godot_mini_game/GODOT_COPYRIGHT.txt) and
[`THIRD_PARTY_NOTICES.md`](addons/godot_mini_game/THIRD_PARTY_NOTICES.md).
