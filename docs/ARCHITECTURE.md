# Architecture and versioning / 架构与多版本策略

Godot Mini Game 0.2 treats an export as a validated transaction and an engine
template as an immutable bundle. This document describes the contracts that
must stay aligned when the plugin, Godot, or a mini-game host evolves.

Godot Mini Game 0.2 把一次导出视为“经过验证的事务”，把引擎模板视为“不可拆分的
版本包”。本文说明插件、Godot 与小游戏宿主升级时必须保持一致的契约。

## Components / 组件边界

```text
Godot Dock / headless test
           │
           ▼
       exporter.gd
           │
    ┌──────┼──────────────┐
    ▼      ▼              ▼
preflight  TemplateBundle  platform templates
OutputGuard  engine pack   PlatformRuntime + GodotSDK bridge
    │            │              │
    └────────────┴──────────────┘
                 │
              staging
                 │ validate hashes + ownership + lock
                 ▼
          transactional publish
```

- `exporter.gd` is the orchestration boundary. It owns one export operation,
  logs, staging, validation, locking, publish, and rollback.
- `core/template_bundle.gd` accepts only one complete engine source. JavaScript
  and WASM can no longer be selected from different directories.
- `core/output_guard.gd` canonicalizes paths, keeps output outside the project,
  and only accepts an empty directory or one with a valid ownership manifest.
- `templates/common/js/platform_runtime.js` normalizes `wx` and `tt`, owns
  provider identity, and exposes host capabilities.
- `templates/common/js/libs/sdk.js` and `MiniGameSDK.gd` own the versioned
  JavaScript/GDScript Bridge ABI handshake. Lifecycle binding starts only after
  brand, global name, ABI, and required methods match.
- Platform directories contain configuration and entry points, not copies of
  business APIs. Shared host behavior belongs in the runtime or SDK bridge.

## Export transaction / 导出事务

Preflight runs before the seven numbered stages: PCK build, engine-bundle copy,
common runtime copy, platform assembly, required placeholder creation, output
manifest validation, and transactional publish. All generated files are
written to a sibling staging directory first. The
manifest records the platform, template identity, and the size and SHA-256 of
every owned artifact. Immediately before publish, the exporter acquires a
sibling lock and rechecks that the destination state is unchanged.

预检通过后才进入七个编号阶段：PCK 构建、引擎包复制、公共运行时复制、平台
装配、必需占位文件、输出 manifest 验证、事务发布。所有文件先写入输出目录旁边
的 staging；manifest 记录
平台、模板身份，以及每个受管产物的大小和 SHA-256。发布前再获取同级锁并复核
目标目录状态没有变化。

Exporter-owned top-level paths are replaced one by one under a lock, with the
old versions first moved to a sibling backup. The ownership guard verifies every
listed hash and rejects extra files, directories, or links inside the managed
directories before anything moves. Other top-level names are sidecars and are
preserved. That swap plus in-process rollback is transactional, but it is not a
filesystem-wide crash-atomic primitive. A process or power failure can leave a
lock, staging directory, or backup beside the output; their paths are reported
and publishing stops so an operator can archive and compare them safely.

插件在锁内逐个替换导出器拥有的顶层路径：旧产物先移入同级 backup。所有权守卫会
复核每个 manifest 哈希，并在移动前拒绝受管目录内额外的文件、目录或链接；其它顶层
名称属于旁路文件并原样保留。这种 swap 加进程内回滚属于事务语义，但不是跨文件系统
的 crash-atomic 原语。进程或系统突然中断时，输出目录旁可能保留 lock、staging 或
backup；插件会报告路径并停止发布，由操作者先归档、比对，再决定清理。

## Engine bundle identity / 引擎模板身份

`template.json` is mandatory and pins all compatibility axes:

- schema version;
- exact four-part Godot version such as `4.6.1.stable`;
- full 40-character Godot source commit;
- exact Emscripten toolchain version;
- profile (`2d_full`) and target (`release`);
- positive template revision;
- Bridge ABI;
- incompatible WASM features (`simd`, `threads`, `wasmExceptions`);
- SHA-256 for both `godot.js` and `godot.wasm.br`.

Missing manifests, partial bundles, shortened versions, mismatched commits, and
the standard Godot Web template fail closed. The exporter never generates a
manifest from untrusted files.

`template.json` 是强制契约，锁定 schema、四段式精确 Godot 版本、40 位源码提交、
精确 Emscripten 工具链、profile、target、正整数 revision、Bridge ABI、WASM 特性，以及两个引擎文件的
SHA-256。缺 manifest、缺文件、缩写版本、提交不匹配和官方标准 Web 模板都会直接
失败；导出器不会再替来源不明的文件自动生成 manifest。

## Multi-version store / 多版本模板库

Imported bundles use a schema-versioned path:

```text
{Godot config}/godot_mini_game/templates/
└── v1/
    └── 4.6.1.stable/
        └── 14d19694e0c88a3f9e82d899a0400f27a24c176e/
            └── emsdk-4.0.3/
                └── 2d_full/
                    └── release/
                        └── abi-1/
                            └── r1/
                                ├── template.json
                                ├── version.txt
                                ├── godot.js
                                ├── godot.wasm.br
                                └── GODOT_COPYRIGHT.txt
```

Resolution order is:

1. a complete project/add-on override;
2. an imported exact-version bundle, highest revision first; equal revisions
   choose the numerically newest Emscripten release, then a stable path order;
3. the certified bundled engine pack;
4. old exact-version or major/minor store locations, read-only and only when a
   complete manifest still proves exact compatibility.

This lets multiple Godot versions, source rebuilds, Emscripten toolchains,
profiles, targets, Bridge ABIs, and template revisions coexist without
overwriting one another. A future template
manifest change gets a new store schema (`v2`) instead of silently reinterpreting
`v1` data.

该目录把“Godot 版本、源码提交、Emscripten、能力 profile、构建 target、Bridge
ABI、模板 revision”分别编码，因此多个版本可以并存。解析时先选最高 revision；
revision 相同则选数值上更新的 Emscripten 版本，最后按稳定路径排序。未来 manifest 语义变化时新增 `v2` 目录，不会静默
重解释已有的 `v1` 数据。

## Version policy / 版本策略

The project has four independent version numbers:

| Axis | Changes when | Compatibility rule |
|---|---|---|
| Plugin SemVer | editor UX or exporter behavior changes | while pre-1.0, breaking behavior increments minor; after 1.0 it increments major |
| Template schema | `template.json` meaning changes | unsupported schema fails closed |
| Bridge ABI | JS/GDScript contract changes | handshake must match exactly |
| Output manifest schema | ownership or artifact metadata changes | only a recognized manifest owns a directory |

Godot compatibility is data in `support-matrix.json`, not a broad `4.x` claim.
Each certified row records an exact tag, source commit, Emscripten version,
profile, ABI, revision, and per-platform automation status. Adding Godot 4.7, for example, means building
and verifying a new bundle, importing it beside 4.6.1, extending the matrix,
and running both WeChat and Douyin smoke exports. It does not require replacing
the 4.6.1 bundle.

Exactly one row uses `template.source: bundled`. Additional rows use a pinned
template Release tag and asset. CI expands every `automated` platform entry into
an exact Godot-version export job and installs that row's release bundle before
testing, so adding a row also adds the corresponding test jobs.

插件 SemVer、模板 schema、Bridge ABI、输出 manifest schema 是四条独立版本轴。
Godot 支持范围只由 `support-matrix.json` 的精确记录定义；新增 4.7 时，应新增并验证
一份并存模板、扩展矩阵并跑双平台冒烟，而不是覆盖 4.6.1。
其中恰好一行使用 `template.source: bundled`；其它版本引用固定的模板 Release tag 与
asset。CI 会把每个 `automated` 平台项展开为对应 Godot 精确版本的导出任务。

## Breaking changes in 0.2 / 0.2 破坏性变更

- Legacy ZIPs without `template.json` can no longer be imported.
- `4.6` or `4.6.1` is not considered equal to `4.6.1.stable`.
- The standard Web export template is no longer a fallback.
- Existing non-empty output folders without a valid ownership manifest are not
  adopted automatically. Export to a new empty folder once, then keep using
  that managed folder.
- Exporter-owned top-level directories are closed sets. Move custom files out
  of `audio/`, `engine/`, `images/`, `js/`, and `subpacks/`; otherwise preflight
  rejects the next export.
- Export presets are read, not rewritten; the user's export filter remains in
  effect.

- 不再接受缺少 `template.json` 的旧 ZIP。
- `4.6`、`4.6.1` 不等于 `4.6.1.stable`。
- 官方标准 Web 模板不再作为回退。
- 不再自动接管没有有效所有权 manifest 的非空输出目录。首次请导出到新空目录，
  后续持续使用该受管目录。
- `audio/`、`engine/`、`images/`、`js/`、`subpacks/` 是封闭的受管目录；自定义文件
  必须移到其它顶层名称，否则下一次导出会在预检阶段拒绝。
- 插件只读取导出预设，不再改写用户的资源过滤配置。
