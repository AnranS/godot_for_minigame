# Release process

Godot Mini Game releases are built from immutable Git tags. The tag workflow
runs the complete JavaScript, GDScript, WeChat, and Douyin export matrix before
it is allowed to publish GitHub Release assets.

## 1. Choose and apply the version

Use a new semantic version. Never move or reuse an existing tag, including a
tag whose workflow failed.

Update the version in all release-facing sources:

- `addons/godot_mini_game/plugin.cfg`
- `support-matrix.json`
- `website/package.json`
- the root package version entries in `website/package-lock.json`
- the compatibility rows in `README.md` and `README_zh.md`

Then regenerate derived website data:

```bash
cd website
npm run generate:data
cd ..
```

`support-matrix.json` is authoritative for the project-validated Godot, Emscripten,
profile, target, revision, ABI, and schema tuple. Do not publish a version when
the bundled `addons/godot_mini_game/engine/template.json` disagrees with that
tuple.

## 2. Validate the exact release source

Run the project contracts and website checks:

```bash
node --test test/*.test.mjs

for test_file in test/*_test.gd; do
  godot --headless --path . --script "res://${test_file}"
done

NEXT_PUBLIC_BASE_PATH=/godot_for_minigame npm --prefix website test
./scripts/package_plugin.sh
```

When the engine template changes, also validate the original artifact produced
locally or by **Build Mini-Game WASM Template**:

```bash
./scripts/verify_wasm_template.sh /absolute/path/to/template-bundle.zip
```

The verifier accepts a ZIP or directory containing exactly `template.json`,
`version.txt`, `godot.js`, `godot.wasm.br`, and `GODOT_COPYRIGHT.txt`.

Commit the complete release source, push `main`, and wait for **Smoke Test
Export** and **Deploy Website to GitHub Pages** to succeed.

## 3. Create the immutable tag

With a clean working tree on the tested `main` commit, run:

```bash
./scripts/release_plugin.sh X.Y.Z
```

The script verifies version agreement, rebuilds the reproducible install ZIP,
refuses existing local or remote tags, and pushes `vX.Y.Z`. It does not upload
assets itself.

The tag-triggered **Release Plugin** workflow reruns the full export matrix,
verifies the ZIP and checksum, refuses an existing Release, and publishes:

- `godot_mini_game_vX.Y.Z.zip`
- `godot_mini_game_vX.Y.Z.zip.sha256`

## 4. Verify the published result

Confirm that the Release is neither a draft nor prerelease, both assets exist,
and the uploaded ZIP digest matches the local reproducible package. Finally,
open the public homepage and API reference to verify that they point to the new
release.

If a tag workflow fails before creating a Release, fix the cause on `main` and
publish a new patch version. Do not delete or retarget the failed tag.
