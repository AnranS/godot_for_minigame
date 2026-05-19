#!/usr/bin/env bash
set -euo pipefail

# Package the plugin into a distributable zip for Godot users.
# Output: godot_mini_game_v{VERSION}.zip
#
# The zip preserves the addons/ directory structure so users can
# extract it directly into their Godot project root.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Read version from plugin.cfg
VERSION=$(grep 'version=' "$PROJECT_DIR/addons/godot_mini_game/plugin.cfg" | head -1 | cut -d'"' -f2)
if [ -z "$VERSION" ]; then
    VERSION="0.0.0"
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

# Remove editor-generated files that aren't needed in distribution
find "${TEMP_DIR}" -name "*.uid" -delete
find "${TEMP_DIR}" -name ".DS_Store" -delete
find "${TEMP_DIR}" -name "*.import" -delete

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
rm -f "$OUTPUT_ZIP"
cd "${TEMP_DIR}"
zip -r -9 "$OUTPUT_ZIP" addons/

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
