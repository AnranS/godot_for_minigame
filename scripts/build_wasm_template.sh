#!/usr/bin/env bash
set -euo pipefail

# Build one immutable, exact-version mini-game WASM template bundle.
#
# Usage:
#   scripts/build_wasm_template.sh [godot_tag] [emsdk_version] [output_dir]
#
# Optional environment variables:
#   GODOT_MINIGAME_BUILD_DIR  Persistent compiler/source cache.
#   TEMPLATE_REVISION         Bundle revision (default: 2).

export TZ=UTC

GODOT_TAG="${1:-4.6.1-stable}"
EMSDK_VERSION="${2:-4.0.3}"
TEMPLATE_REVISION="${TEMPLATE_REVISION:-2}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SUPPORT_MATRIX="${PROJECT_DIR}/support-matrix.json"
BUILD_ROOT="${GODOT_MINIGAME_BUILD_DIR:-${PROJECT_DIR}/build_wasm}"
SOURCE_DIR="${BUILD_ROOT}/godot-${GODOT_TAG}"
EMSDK_DIR="${BUILD_ROOT}/emsdk"
CANONICAL_VERSION="${GODOT_TAG//-/.}"

if ! [[ "$GODOT_TAG" =~ ^[0-9]+\.[0-9]+\.[0-9]+-[0-9A-Za-z]+$ ]]; then
    echo "Godot tag must be exact, for example 4.6.1-stable: $GODOT_TAG" >&2
    exit 1
fi
if ! [[ "$EMSDK_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z][0-9A-Za-z.-]*)?$ ]]; then
    echo "Emscripten SDK version must be exact, for example 4.0.3: $EMSDK_VERSION" >&2
    exit 1
fi
if ! [[ "$TEMPLATE_REVISION" =~ ^[1-9][0-9]*$ ]]; then
    echo "TEMPLATE_REVISION must be a positive integer" >&2
    exit 1
fi

for command_name in git python3 scons brotli jq node zip unzip wasm-validate xxd; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Missing required command: $command_name" >&2
        exit 1
    fi
done

if [ ! -s "$SUPPORT_MATRIX" ]; then
    echo "Missing support matrix: $SUPPORT_MATRIX" >&2
    exit 1
fi
BRIDGE_ABI="$(jq -er '.bridgeAbi | select(type == "number" and . > 0 and (. % 1 == 0))' "$SUPPORT_MATRIX")"
TEMPLATE_SCHEMA="$(jq -er '.templateSchema | select(type == "number" and . > 0 and (. % 1 == 0))' "$SUPPORT_MATRIX")"
OUTPUT_DIR="${3:-${BUILD_ROOT}/output/${GODOT_TAG}/emsdk-${EMSDK_VERSION}/2d_full/release/abi-${BRIDGE_ABI}/r${TEMPLATE_REVISION}}"

mkdir -p "$BUILD_ROOT" "$OUTPUT_DIR"

if [ ! -d "$EMSDK_DIR/.git" ]; then
    git clone https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
fi
"${EMSDK_DIR}/emsdk" install "$EMSDK_VERSION"
"${EMSDK_DIR}/emsdk" activate "$EMSDK_VERSION"
source "${EMSDK_DIR}/emsdk_env.sh" >/dev/null

if [ ! -d "$SOURCE_DIR/.git" ]; then
    git clone --depth 1 --branch "$GODOT_TAG" https://github.com/godotengine/godot.git "$SOURCE_DIR"
fi

ACTUAL_TAG="$(git -C "$SOURCE_DIR" describe --tags --exact-match 2>/dev/null || true)"
if [ "$ACTUAL_TAG" != "$GODOT_TAG" ]; then
    echo "Cached source is not the requested exact tag: ${ACTUAL_TAG:-unknown}" >&2
    echo "Choose a new GODOT_MINIGAME_BUILD_DIR instead of reusing the wrong source." >&2
    exit 1
fi
SOURCE_STATUS="$(git -C "$SOURCE_DIR" status --porcelain --untracked-files=all)"
if [ -n "$SOURCE_STATUS" ]; then
    echo "Cached Godot source contains local changes or untracked files:" >&2
    printf '%s\n' "$SOURCE_STATUS" >&2
    echo "Choose a clean GODOT_MINIGAME_BUILD_DIR; the build will not guess which files are safe." >&2
    exit 1
fi
GODOT_COMMIT="$(git -C "$SOURCE_DIR" rev-parse HEAD)"

DETECT_PY="${SOURCE_DIR}/platform/web/detect.py"
DETECT_BACKUP=""
PACKAGE_DIR=""
cleanup() {
    status=$?
    if [ -n "$DETECT_BACKUP" ] && [ -f "$DETECT_BACKUP" ]; then
        cp "$DETECT_BACKUP" "$DETECT_PY"
        rm -f "$DETECT_BACKUP"
    fi
    if [ -n "$PACKAGE_DIR" ] && [ -d "$PACKAGE_DIR" ]; then
        rm -rf "$PACKAGE_DIR"
    fi
    exit "$status"
}
trap cleanup EXIT

DETECT_BACKUP="$(mktemp "${BUILD_ROOT}/detect.py.XXXXXX")"
cp "$DETECT_PY" "$DETECT_BACKUP"
if grep -q "SUPPORT_LONGJMP='emscripten'" "$DETECT_PY"; then
    EXPECTED_SOURCE_CHANGE=""
elif grep -q "SUPPORT_LONGJMP='wasm'" "$DETECT_PY"; then
    PATCHED_DETECT="$(mktemp "${BUILD_ROOT}/detect-patched.py.XXXXXX")"
    sed "s/SUPPORT_LONGJMP='wasm'/SUPPORT_LONGJMP='emscripten'/g" "$DETECT_PY" > "$PATCHED_DETECT"
    cp "$PATCHED_DETECT" "$DETECT_PY"
    rm -f "$PATCHED_DETECT"
    EXPECTED_SOURCE_CHANGE="platform/web/detect.py"
else
    echo "Godot source has an unknown SUPPORT_LONGJMP configuration" >&2
    exit 1
fi
if ! grep -q "SUPPORT_LONGJMP='emscripten'" "$DETECT_PY"; then
    echo "Unable to enforce Emscripten longjmp mode" >&2
    exit 1
fi
CHANGED_FILES="$(git -C "$SOURCE_DIR" diff --name-only)"
if [ "$CHANGED_FILES" != "$EXPECTED_SOURCE_CHANGE" ]; then
    echo "Unexpected tracked source changes after applying the build patch:" >&2
    printf '%s\n' "${CHANGED_FILES:-<none>}" >&2
    exit 1
fi

(
    cd "$SOURCE_DIR"
    scons platform=web target=template_release \
        arch=wasm32 \
        optimize=size \
        wasm_simd=no \
        threads=no \
        dlink_enabled=no \
        javascript_eval=no \
        module_webrtc_enabled=no \
        module_webxr_enabled=no \
        module_openxr_enabled=no \
        -j"$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)"
)

shopt -s nullglob
JS_CANDIDATES=("${SOURCE_DIR}"/bin/godot.web.template_release.wasm32*.js)
WASM_CANDIDATES=("${SOURCE_DIR}"/bin/godot.web.template_release.wasm32*.wasm)
shopt -u nullglob
if [ "${#JS_CANDIDATES[@]}" -ne 1 ] || [ "${#WASM_CANDIDATES[@]}" -ne 1 ]; then
    echo "Expected exactly one JavaScript artifact and one WASM artifact." >&2
    printf 'JavaScript candidates (%s):\n' "${#JS_CANDIDATES[@]}" >&2
    printf '  %s\n' "${JS_CANDIDATES[@]:-<none>}" >&2
    printf 'WASM candidates (%s):\n' "${#WASM_CANDIDATES[@]}" >&2
    printf '  %s\n' "${WASM_CANDIDATES[@]:-<none>}" >&2
    echo "Remove stale build outputs or use a clean GODOT_MINIGAME_BUILD_DIR." >&2
    exit 1
fi
JS_FILE="${JS_CANDIDATES[0]}"
WASM_FILE="${WASM_CANDIDATES[0]}"
if [ ! -s "$JS_FILE" ] || [ ! -s "$WASM_FILE" ]; then
    echo "Godot build did not produce non-empty JavaScript and WASM artifacts" >&2
    exit 1
fi
if [ "${JS_FILE%.js}" != "${WASM_FILE%.wasm}" ]; then
    echo "JavaScript and WASM artifact stems do not match:" >&2
    echo "  $JS_FILE" >&2
    echo "  $WASM_FILE" >&2
    exit 1
fi

PACKAGE_DIR="$(mktemp -d "${BUILD_ROOT}/template-package.XXXXXX")"
cp "$JS_FILE" "${PACKAGE_DIR}/godot.js"
cp "${SOURCE_DIR}/COPYRIGHT.txt" "${PACKAGE_DIR}/GODOT_COPYRIGHT.txt"
brotli --quality=11 --force --output="${PACKAGE_DIR}/godot.wasm.br" "$WASM_FILE"
printf '%s\n' "$CANONICAL_VERSION" > "${PACKAGE_DIR}/version.txt"

sha256_file() {
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" | cut -d' ' -f1
    else
        sha256sum "$1" | cut -d' ' -f1
    fi
}

write_sha256() {
    file_path="$1"
    file_dir="$(dirname "$file_path")"
    file_name="$(basename "$file_path")"
    (
        cd "$file_dir"
        if command -v shasum >/dev/null 2>&1; then
            shasum -a 256 "$file_name"
        else
            sha256sum "$file_name"
        fi
    ) > "${file_path}.sha256"
}

JS_SHA="$(sha256_file "${PACKAGE_DIR}/godot.js")"
WASM_SHA="$(sha256_file "${PACKAGE_DIR}/godot.wasm.br")"

jq -n \
    --arg version "$CANONICAL_VERSION" \
    --arg commit "$GODOT_COMMIT" \
    --arg emscripten "$EMSDK_VERSION" \
    --arg js_sha "$JS_SHA" \
    --arg wasm_sha "$WASM_SHA" \
    --argjson schema "$TEMPLATE_SCHEMA" \
    --argjson revision "$TEMPLATE_REVISION" \
    --argjson bridge_abi "$BRIDGE_ABI" \
    '{
      schema: $schema,
      godot: {version: $version, commit: $commit},
      emscriptenVersion: $emscripten,
      profile: "2d_full",
      target: "release",
      revision: $revision,
      bridgeAbi: $bridge_abi,
      features: {simd: false, threads: false, wasmExceptions: false},
      artifacts: {
        "godot.js": {sha256: $js_sha},
        "godot.wasm.br": {sha256: $wasm_sha}
      }
    }' > "${PACKAGE_DIR}/template.json"

# Normalize ZIP entry timestamps and keep the member order fixed so rebuilds
# of identical artifacts produce identical bundle bytes.
find "$PACKAGE_DIR" -type f -exec chmod 0644 {} +
find "$PACKAGE_DIR" -type f -exec touch -t 198001010000 {} +
BUNDLE_NAME="godot_minigame_template_${GODOT_TAG}_emsdk-${EMSDK_VERSION}_2d-full_release_abi-${BRIDGE_ABI}_r${TEMPLATE_REVISION}.zip"
BUNDLE_PATH="${OUTPUT_DIR}/${BUNDLE_NAME}"
rm -f "$BUNDLE_PATH" "${BUNDLE_PATH}.sha256"
(
    cd "$PACKAGE_DIR"
    zip -X -9 "$BUNDLE_PATH" godot.js godot.wasm.br version.txt template.json GODOT_COPYRIGHT.txt
)

write_sha256 "$BUNDLE_PATH"
"${SCRIPT_DIR}/verify_wasm_template.sh" "$BUNDLE_PATH"
(
    cd "$OUTPUT_DIR"
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 -c "${BUNDLE_NAME}.sha256"
    else
        sha256sum -c "${BUNDLE_NAME}.sha256"
    fi
)

echo "Validated template bundle: $BUNDLE_PATH"
echo "Godot source commit: $GODOT_COMMIT"
