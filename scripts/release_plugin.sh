#!/usr/bin/env bash
set -euo pipefail

# Create a GitHub Release and upload the installable Godot plugin zip.
#
# Usage:
#   scripts/release_plugin.sh 0.3.0
#   scripts/release_plugin.sh 0.3.0 --no-push
#
# Requirements:
#   - plugin.cfg version already updated and committed

usage() {
    cat <<'EOF'
Usage: scripts/release_plugin.sh <version> [--no-push]

Examples:
  scripts/release_plugin.sh 0.3.0
  scripts/release_plugin.sh v0.3.0 --no-push

The script verifies the package, creates a new immutable git tag vX.Y.Z, and
pushes it. The tag-driven GitHub Actions workflow is the only release publisher.
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

NO_PUSH=false

while [ "$#" -gt 0 ]; do
    case "$1" in
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

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
    echo "Invalid version: $VERSION" >&2
    echo "Expected something like 0.3.0 or v0.3.0" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TAG="v${VERSION}"
ZIP_PATH="${PROJECT_DIR}/dist/godot_mini_game_v${VERSION}.zip"
PLUGIN_CFG="${PROJECT_DIR}/addons/godot_mini_game/plugin.cfg"
SUPPORT_MATRIX="${PROJECT_DIR}/support-matrix.json"

cd "$PROJECT_DIR"

for cmd in git jq zip; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Missing required command: $cmd" >&2
        exit 1
    fi
done

if [ ! -f "$PLUGIN_CFG" ]; then
    echo "Missing plugin config: $PLUGIN_CFG" >&2
    exit 1
fi
if [ ! -s "$SUPPORT_MATRIX" ]; then
    echo "Missing support matrix: $SUPPORT_MATRIX" >&2
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

MATRIX_VERSION="$(jq -er '.pluginVersion | select(type == "string" and length > 0)' "$SUPPORT_MATRIX")"
if [ "$MATRIX_VERSION" != "$VERSION" ]; then
    echo "Version mismatch:" >&2
    echo "  requested:           $VERSION" >&2
    echo "  support-matrix.json: $MATRIX_VERSION" >&2
    echo "Update support-matrix.json before releasing." >&2
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "Working tree is not clean. Commit the exact release contents first." >&2
    git status --short
    exit 1
fi

"${SCRIPT_DIR}/package_plugin.sh"

if [ ! -f "$ZIP_PATH" ]; then
    echo "Package was not created: $ZIP_PATH" >&2
    exit 1
fi

if git rev-parse --verify "refs/tags/$TAG" >/dev/null 2>&1; then
    echo "Refusing to reuse existing local tag: $TAG" >&2
    exit 1
fi

if ! REMOTE_REFS="$(git ls-remote --tags origin "refs/tags/${TAG}" "refs/tags/${TAG}^{}")"; then
    echo "Unable to verify whether remote tag $TAG exists; refusing to publish." >&2
    exit 1
fi
if [ -n "$REMOTE_REFS" ]; then
    echo "Refusing to reuse existing remote tag: $TAG" >&2
    exit 1
fi

git tag -a "$TAG" -m "Release $TAG"
echo "Created tag: $TAG"

if [ "$NO_PUSH" = false ]; then
    git push origin "$TAG"
fi

echo ""
echo "Local package verified:"
echo "  $ZIP_PATH"
if [ "$NO_PUSH" = false ]; then
    echo "GitHub Actions will publish the immutable release for $TAG."
else
    echo "Tag was not pushed; review it and run: git push origin $TAG"
fi
