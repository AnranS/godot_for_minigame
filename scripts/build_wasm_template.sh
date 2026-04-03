#!/bin/bash
set -e

# Build a mini-game compatible Godot WASM template.
# Usage: ./build_wasm_template.sh [godot_version_tag]
# Example: ./build_wasm_template.sh 4.6.1-stable

GODOT_TAG="${1:-4.6.1-stable}"
EMSDK_VERSION="${2:-4.0.3}"
BUILD_DIR="${HOME}/Desktop/build_wasm"
OUTPUT_DIR="$(pwd)/build_wasm/output"

echo "============================================"
echo "Building mini-game WASM template"
echo "  Godot: ${GODOT_TAG}"
echo "  Emscripten: ${EMSDK_VERSION}"
echo "============================================"

# --- Step 1: Prerequisites ---
echo ""
echo "[1/6] Checking prerequisites..."

if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 not found. Install Python 3.x first."
    exit 1
fi

if ! command -v git &>/dev/null; then
    echo "ERROR: git not found."
    exit 1
fi

pip3 install scons --quiet 2>/dev/null || true

# --- Step 2: Set up Emscripten ---
echo ""
echo "[2/6] Setting up Emscripten ${EMSDK_VERSION}..."

mkdir -p "${BUILD_DIR}"

if [ ! -d "${BUILD_DIR}/emsdk" ]; then
    git clone https://github.com/emscripten-core/emsdk.git "${BUILD_DIR}/emsdk"
fi

cd "${BUILD_DIR}/emsdk"
./emsdk install "${EMSDK_VERSION}" 2>&1 | tail -3
./emsdk activate "${EMSDK_VERSION}" 2>&1 | tail -3
source ./emsdk_env.sh 2>/dev/null

echo "  emcc version: $(emcc --version | head -1)"

# --- Step 3: Clone Godot source ---
echo ""
echo "[3/6] Getting Godot source (${GODOT_TAG})..."

if [ ! -d "${BUILD_DIR}/godot" ]; then
    git clone --depth 1 --branch "${GODOT_TAG}" https://github.com/godotengine/godot.git "${BUILD_DIR}/godot"
else
    cd "${BUILD_DIR}/godot"
    git fetch --depth 1 origin "refs/tags/${GODOT_TAG}"
    git checkout FETCH_HEAD
fi

# --- Step 4: Build ---
echo ""
echo "[4/6] Building Godot WASM (this takes 30-60 minutes)..."

cd "${BUILD_DIR}/godot"

# Patch detect.py: change SUPPORT_LONGJMP from 'wasm' to 'emscripten'
# WASM longjmp generates a Tag section that WXWebAssembly does not support
DETECT_PY="platform/web/detect.py"
if grep -q "SUPPORT_LONGJMP='wasm'" "$DETECT_PY" 2>/dev/null; then
    sed -i.bak "s/SUPPORT_LONGJMP='wasm'/SUPPORT_LONGJMP='emscripten'/g" "$DETECT_PY"
    echo "  Patched $DETECT_PY: SUPPORT_LONGJMP='wasm' → 'emscripten'"
fi

scons platform=web target=template_release \
    arch=wasm32 \
    optimize=size \
    wasm_simd=no \
    threads=no \
    dlink_enabled=no \
    module_webrtc_enabled=no \
    module_webxr_enabled=no \
    module_openxr_enabled=no \
    -j$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)

# --- Step 5: Find artifacts ---
echo ""
echo "[5/6] Locating build artifacts..."

cd "${BUILD_DIR}/godot/bin"
JS_FILE=$(ls godot.web.template_release.wasm32.nothreads.js 2>/dev/null || ls godot.web.template_release.wasm32.js 2>/dev/null || ls *.js 2>/dev/null | head -1)
WASM_FILE=$(ls godot.web.template_release.wasm32.nothreads.wasm 2>/dev/null || ls godot.web.template_release.wasm32.wasm 2>/dev/null || ls *.wasm 2>/dev/null | head -1)

if [ -z "$JS_FILE" ] || [ -z "$WASM_FILE" ]; then
    echo "ERROR: Build artifacts not found in $(pwd)"
    ls -la
    exit 1
fi

echo "  JS:   ${JS_FILE} ($(du -h ${JS_FILE} | cut -f1))"
echo "  WASM: ${WASM_FILE} ($(du -h ${WASM_FILE} | cut -f1))"

# --- Step 6: Package ---
echo ""
echo "[6/6] Packaging template..."

mkdir -p "${OUTPUT_DIR}"
cp "${JS_FILE}" "${OUTPUT_DIR}/godot.js"
cp "${WASM_FILE}" "${OUTPUT_DIR}/godot.wasm"

if command -v brotli &>/dev/null; then
    echo "  Compressing with Brotli..."
    brotli --quality=11 --force --output="${OUTPUT_DIR}/godot.wasm.br" "${OUTPUT_DIR}/godot.wasm"
    WASM_SIZE=$(du -h "${OUTPUT_DIR}/godot.wasm" | cut -f1)
    BR_SIZE=$(du -h "${OUTPUT_DIR}/godot.wasm.br" | cut -f1)
    echo "  ${WASM_SIZE} → ${BR_SIZE}"
    rm "${OUTPUT_DIR}/godot.wasm"
else
    echo "  WARNING: brotli not found, skipping compression"
    echo "  Install: brew install brotli"
fi

echo "${GODOT_TAG}" > "${OUTPUT_DIR}/version.txt"

cd "${OUTPUT_DIR}"
zip -9 "../minigame_template_${GODOT_TAG}.zip" godot.js godot.wasm.br version.txt 2>/dev/null || \
zip -9 "../minigame_template_${GODOT_TAG}.zip" godot.js godot.wasm version.txt

echo ""
echo "============================================"
echo "Done! Template: ${BUILD_DIR}/minigame_template_${GODOT_TAG}.zip"
echo ""
echo "To use:"
echo "  1. Open Godot → Mini Game Export dock"
echo "  2. Click 'Import Engine Template'"
echo "  3. Select the zip file above"
echo "============================================"
