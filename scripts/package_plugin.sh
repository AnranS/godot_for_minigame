#!/usr/bin/env bash
set -euo pipefail

# Package the plugin into a distributable zip for Godot users.
# Output: godot_mini_game_v{VERSION}.zip
#
# The zip preserves the addons/ directory structure so users can
# extract it directly into their Godot project root.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
export TZ=UTC

# Read and validate version from plugin.cfg.
VERSION=$(grep 'version=' "$PROJECT_DIR/addons/godot_mini_game/plugin.cfg" | head -1 | cut -d'"' -f2)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
    echo "Invalid or missing plugin version in plugin.cfg: ${VERSION:-<empty>}" >&2
    exit 1
fi

OUTPUT_NAME="godot_mini_game_v${VERSION}"
OUTPUT_ZIP="${PROJECT_DIR}/dist/${OUTPUT_NAME}.zip"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "${TEMP_DIR}"' EXIT

echo "Packaging Godot Mini Game Plugin v${VERSION}"
echo "============================================"

# Create the directory structure that matches a Godot project
mkdir -p "${TEMP_DIR}/addons"
cp -r "$PROJECT_DIR/addons/godot_mini_game" "${TEMP_DIR}/addons/"
cp "$PROJECT_DIR/LICENSE" "${TEMP_DIR}/addons/godot_mini_game/LICENSE"

for required in \
    "${TEMP_DIR}/addons/godot_mini_game/LICENSE" \
    "${TEMP_DIR}/addons/godot_mini_game/GODOT_COPYRIGHT.txt" \
    "${TEMP_DIR}/addons/godot_mini_game/THIRD_PARTY_NOTICES.md" \
    "${TEMP_DIR}/addons/godot_mini_game/engine/template.json" \
    "${TEMP_DIR}/addons/godot_mini_game/plugin.cfg"; do
    if [ ! -s "$required" ]; then
        echo "Required package file is missing or empty: $required" >&2
        exit 1
    fi
done

# Remove editor-generated files that aren't needed in distribution
find "${TEMP_DIR}" -name "*.uid" -delete
find "${TEMP_DIR}" -name ".DS_Store" -delete
find "${TEMP_DIR}" -name "*.import" -delete

# ZIP stores DOS timestamps in every entry. Normalize them so rebuilding the
# same source tree produces the same archive bytes and checksum across hosts.
find "${TEMP_DIR}/addons" -type f -exec chmod 0644 {} +
find "${TEMP_DIR}/addons" -type f -exec touch -t 198001010000 {} +

# Show what's being packaged
echo ""
echo "Contents:"
find "${TEMP_DIR}" -type f | sort | while read -r f; do
    REL="${f#$TEMP_DIR/}"
    SIZE=$(du -h "$f" | cut -f1 | xargs)
    printf "  %-60s %s\n" "$REL" "$SIZE"
done

# Create zip
mkdir -p "$(dirname "$OUTPUT_ZIP")"
rm -f "$OUTPUT_ZIP" "${OUTPUT_ZIP}.sha256"
cd "${TEMP_DIR}"
find addons -type f -print | LC_ALL=C sort | zip -X -9 "$OUTPUT_ZIP" -@

# Record only the archive basename. Downloaded checksum files must not contain
# a maintainer workstation or GitHub runner absolute path.
OUTPUT_DIR="$(dirname "$OUTPUT_ZIP")"
OUTPUT_BASENAME="$(basename "$OUTPUT_ZIP")"
(
    cd "$OUTPUT_DIR"
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$OUTPUT_BASENAME"
    else
        sha256sum "$OUTPUT_BASENAME"
    fi
) > "${OUTPUT_ZIP}.sha256"

TOTAL_SIZE=$(du -h "$OUTPUT_ZIP" | cut -f1 | xargs)
echo ""
echo "============================================"
echo "Done: ${OUTPUT_ZIP}"
echo "Size: ${TOTAL_SIZE}"
echo ""
echo "Users install by extracting into their Godot project root:"
echo "  unzip ${OUTPUT_NAME}.zip -d /path/to/godot_project/"
echo ""
echo "Or publish to Godot Asset Library:"
echo "  https://godotengine.org/asset-library/asset"
