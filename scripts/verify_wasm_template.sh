#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: scripts/verify_wasm_template.sh <template.zip|template-directory>" >&2
    exit 1
fi

for command_name in brotli jq node unzip wasm-validate xxd; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Missing required validation command: $command_name" >&2
        exit 1
    fi
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SUPPORT_MATRIX="${PROJECT_DIR}/support-matrix.json"
if [ ! -s "$SUPPORT_MATRIX" ]; then
    echo "Missing support matrix: $SUPPORT_MATRIX" >&2
    exit 1
fi
EXPECTED_BRIDGE_ABI="$(jq -er '.bridgeAbi | select(type == "number" and . > 0 and (. % 1 == 0))' "$SUPPORT_MATRIX")"
EXPECTED_TEMPLATE_SCHEMA="$(jq -er '.templateSchema | select(type == "number" and . > 0 and (. % 1 == 0))' "$SUPPORT_MATRIX")"

INPUT_PATH="$1"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

if [ -d "$INPUT_PATH" ]; then
    PACKAGE_DIR="$INPUT_PATH"
else
    unzip -q "$INPUT_PATH" -d "$TEMP_DIR/package"
    PACKAGE_DIR="$TEMP_DIR/package"
fi

if [ -n "$(find "$PACKAGE_DIR" -type l -print -quit)" ]; then
    echo "Template bundle must not contain symbolic links" >&2
    exit 1
fi
EXPECTED_FILES="$(printf '%s\n' \
    GODOT_COPYRIGHT.txt godot.js godot.wasm.br template.json version.txt | LC_ALL=C sort)"
ACTUAL_FILES="$(
    cd "$PACKAGE_DIR"
    find . -type f -print | sed 's#^\./##' | LC_ALL=C sort
)"
if [ "$ACTUAL_FILES" != "$EXPECTED_FILES" ]; then
    echo "Template bundle must contain exactly the five contract files" >&2
    echo "Expected:" >&2
    printf '%s\n' "$EXPECTED_FILES" >&2
    echo "Actual:" >&2
    printf '%s\n' "${ACTUAL_FILES:-<none>}" >&2
    exit 1
fi

for required in template.json version.txt godot.js godot.wasm.br GODOT_COPYRIGHT.txt; do
    if [ ! -s "${PACKAGE_DIR}/${required}" ]; then
        echo "Template bundle is missing or has an empty $required" >&2
        exit 1
    fi
done

jq -e \
    --argjson expected_schema "$EXPECTED_TEMPLATE_SCHEMA" \
    --argjson expected_bridge_abi "$EXPECTED_BRIDGE_ABI" \
    '
      (.schema == $expected_schema) and
      (.godot.version | type == "string" and test("^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9A-Za-z]+$")) and
      (.godot.commit | type == "string" and test("^[0-9a-fA-F]{40}$")) and
      (.emscriptenVersion | type == "string" and test("^[0-9]+\\.[0-9]+\\.[0-9]+([.-][0-9A-Za-z][0-9A-Za-z.-]*)?$")) and
      (.revision | type == "number" and . > 0 and (. % 1 == 0)) and
      (.bridgeAbi == $expected_bridge_abi) and
      (.profile == "2d_full") and
      (.target == "release") and
      (.features.simd == false) and
      (.features.threads == false) and
      (.features.wasmExceptions == false) and
      (.artifacts["godot.js"].sha256 | type == "string" and test("^[0-9a-fA-F]{64}$")) and
      (.artifacts["godot.wasm.br"].sha256 | type == "string" and test("^[0-9a-fA-F]{64}$"))
    ' "${PACKAGE_DIR}/template.json" >/dev/null

MANIFEST_VERSION="$(jq -r '.godot.version' "${PACKAGE_DIR}/template.json")"
FILE_VERSION="$(
    tr '-' '.' < "${PACKAGE_DIR}/version.txt" \
        | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
)"
if [ "$MANIFEST_VERSION" != "$FILE_VERSION" ]; then
    echo "template.json and version.txt disagree" >&2
    exit 1
fi

sha256_file() {
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" | cut -d' ' -f1
    else
        sha256sum "$1" | cut -d' ' -f1
    fi
}

for artifact in godot.js godot.wasm.br; do
    expected="$(jq -r --arg artifact "$artifact" '.artifacts[$artifact].sha256' "${PACKAGE_DIR}/template.json")"
    actual="$(sha256_file "${PACKAGE_DIR}/${artifact}")"
    if [ "$expected" != "$actual" ]; then
        echo "Checksum mismatch for $artifact" >&2
        exit 1
    fi
done

node --check "${PACKAGE_DIR}/godot.js"
brotli --decompress --force --output="${TEMP_DIR}/godot.wasm" "${PACKAGE_DIR}/godot.wasm.br"
if [ "$(xxd -p -l 4 "${TEMP_DIR}/godot.wasm")" != "0061736d" ]; then
    echo "Decompressed artifact is not a WebAssembly module" >&2
    exit 1
fi
# WABT disables threads and exception handling by default. Explicitly disable
# SIMD so the complete mini-game feature contract is enforced.
wasm-validate --disable-simd "${TEMP_DIR}/godot.wasm"

echo "Template bundle is valid: Godot $MANIFEST_VERSION, bridge ABI $EXPECTED_BRIDGE_ABI"
