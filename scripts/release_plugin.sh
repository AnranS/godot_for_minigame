#!/usr/bin/env bash
set -euo pipefail

# Create a GitHub Release and upload the installable Godot plugin zip.
#
# Usage:
#   scripts/release_plugin.sh 0.1.1
#   scripts/release_plugin.sh v0.1.1 --draft
#   scripts/release_plugin.sh 0.1.1 --allow-dirty
#
# Requirements:
#   - gh CLI installed and authenticated (`gh auth login`)
#   - plugin.cfg version already updated and committed

usage() {
    cat <<'EOF'
Usage: scripts/release_plugin.sh <version> [--draft] [--prerelease] [--allow-dirty] [--no-push]

Examples:
  scripts/release_plugin.sh 0.1.1
  scripts/release_plugin.sh v0.2.0 --draft

The script packages addons/godot_mini_game into dist/godot_mini_game_vX.Y.Z.zip,
creates or reuses git tag vX.Y.Z, pushes it, and uploads the zip to GitHub Release assets.
EOF
}

if [ "$#" -lt 1 ]; then
    usage
    exit 1
fi

if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

VERSION="${1#v}"
shift

DRAFT=false
PRERELEASE=false
ALLOW_DIRTY=false
NO_PUSH=false

while [ "$#" -gt 0 ]; do
    case "$1" in
        --draft) DRAFT=true ;;
        --prerelease) PRERELEASE=true ;;
        --allow-dirty) ALLOW_DIRTY=true ;;
        --no-push) NO_PUSH=true ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            exit 1
            ;;
    esac
    shift
done

if ! [[ "$VERSION" =~ ^[0-9]+(\.[0-9]+){1,3}([.-][0-9A-Za-z]+)?$ ]]; then
    echo "Invalid version: $VERSION" >&2
    echo "Expected something like 0.1.1 or v0.1.1" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TAG="v${VERSION}"
ZIP_PATH="${PROJECT_DIR}/dist/godot_mini_game_v${VERSION}.zip"
PLUGIN_CFG="${PROJECT_DIR}/addons/godot_mini_game/plugin.cfg"

cd "$PROJECT_DIR"

for cmd in git gh zip; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Missing required command: $cmd" >&2
        exit 1
    fi
done

if [ ! -f "$PLUGIN_CFG" ]; then
    echo "Missing plugin config: $PLUGIN_CFG" >&2
    exit 1
fi

CFG_VERSION="$(grep 'version=' "$PLUGIN_CFG" | head -1 | cut -d'"' -f2)"
if [ "$CFG_VERSION" != "$VERSION" ]; then
    echo "Version mismatch:" >&2
    echo "  requested:  $VERSION" >&2
    echo "  plugin.cfg: $CFG_VERSION" >&2
    echo "Update addons/godot_mini_game/plugin.cfg before releasing." >&2
    exit 1
fi

if [ "$ALLOW_DIRTY" = false ] && [ -n "$(git status --porcelain)" ]; then
    echo "Working tree is not clean. Commit changes first, or pass --allow-dirty." >&2
    git status --short
    exit 1
fi

gh auth status >/dev/null

"${SCRIPT_DIR}/package_plugin.sh"

if [ ! -f "$ZIP_PATH" ]; then
    echo "Package was not created: $ZIP_PATH" >&2
    exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "Using existing local tag: $TAG"
else
    git tag -a "$TAG" -m "Release $TAG"
    echo "Created tag: $TAG"
fi

if [ "$NO_PUSH" = false ]; then
    git push origin "$TAG"
fi

NOTES_FILE="$(mktemp)"
trap 'rm -f "${NOTES_FILE}"' EXIT
cat > "$NOTES_FILE" <<EOF
## Godot Mini Game Plugin ${TAG}

### Installation

1. Download \`godot_mini_game_v${VERSION}.zip\` from the Assets section below.
2. Extract it into your Godot project root so it creates \`addons/godot_mini_game/\`.
3. Open Godot and enable **Godot Mini Game Export** in **Project > Project Settings > Plugins**.

Do not download GitHub's auto-generated Source code archives for plugin installation.
EOF

RELEASE_FLAGS=(--title "$TAG" --notes-file "$NOTES_FILE")
if [ "$DRAFT" = true ]; then
    RELEASE_FLAGS+=(--draft)
fi
if [ "$PRERELEASE" = true ]; then
    RELEASE_FLAGS+=(--prerelease)
fi

if gh release view "$TAG" >/dev/null 2>&1; then
    gh release edit "$TAG" "${RELEASE_FLAGS[@]}"
    gh release upload "$TAG" "$ZIP_PATH" --clobber
    echo "Updated GitHub Release: $TAG"
else
    gh release create "$TAG" "$ZIP_PATH" "${RELEASE_FLAGS[@]}"
    echo "Created GitHub Release: $TAG"
fi

echo ""
echo "Release asset:"
echo "  $ZIP_PATH"
