#!/usr/bin/env bash
set -euo pipefail

# Print the commit that the official Godot editor build of an exact tag
# reports through Engine.get_version_info().hash.
#
# Usage:
#   scripts/official_editor_commit.sh 4.6.3-stable
#
# Official release binaries are not always built from the public tag commit
# (4.6.3-stable is tagged 35e80b3a but its editors report 7d41c59c). The
# exporter accepts such an editor only when the template lists this commit in
# godot.editorCommits, so certification reads it from the verified binary
# instead of trusting a hand-typed value.

GODOT_TAG="${1:-}"
if ! [[ "$GODOT_TAG" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?-[0-9A-Za-z]+$ ]]; then
    echo "Usage: $0 <exact Godot tag, for example 4.6.3-stable>" >&2
    exit 1
fi

case "$(uname -s)" in
    Linux)
        ASSET="Godot_v${GODOT_TAG}_linux.x86_64.zip"
        EDITOR="Godot_v${GODOT_TAG}_linux.x86_64"
        ;;
    Darwin)
        ASSET="Godot_v${GODOT_TAG}_macos.universal.zip"
        EDITOR="Godot.app/Contents/MacOS/Godot"
        ;;
    *)
        echo "Unsupported host: $(uname -s)" >&2
        exit 1
        ;;
esac

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/godot-editor-commit.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT
BASE_URL="https://github.com/godotengine/godot/releases/download/${GODOT_TAG}"
curl -fsSL -o "${WORK_DIR}/SHA512-SUMS.txt" "${BASE_URL}/SHA512-SUMS.txt"
curl -fsSL -o "${WORK_DIR}/${ASSET}" "${BASE_URL}/${ASSET}"

EXPECTED_SHA="$(awk -v asset="$ASSET" '$2 == asset { print $1 }' "${WORK_DIR}/SHA512-SUMS.txt")"
if command -v sha512sum >/dev/null 2>&1; then
    ACTUAL_SHA="$(sha512sum "${WORK_DIR}/${ASSET}" | cut -d' ' -f1)"
else
    ACTUAL_SHA="$(shasum -a 512 "${WORK_DIR}/${ASSET}" | cut -d' ' -f1)"
fi
if [ -z "$EXPECTED_SHA" ] || [ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]; then
    echo "Official editor ${ASSET} does not match the release SHA512-SUMS.txt" >&2
    exit 1
fi

unzip -q "${WORK_DIR}/${ASSET}" -d "${WORK_DIR}/editor"
mkdir -p "${WORK_DIR}/project"
printf 'config_version=5\n' > "${WORK_DIR}/project/project.godot"
cat > "${WORK_DIR}/project/editor_commit.gd" <<'EOF'
extends SceneTree
func _init() -> void:
	var info := Engine.get_version_info()
	print("GODOT_EDITOR_VERSION=%d.%d.%d.%s" % [info.major, info.minor, info.patch, info.status])
	print("GODOT_EDITOR_COMMIT=", info.hash)
	quit()
EOF
OUTPUT="$("${WORK_DIR}/editor/${EDITOR}" --headless --path "${WORK_DIR}/project" \
    --script res://editor_commit.gd 2>/dev/null)"

EXPECTED_VERSION="$(printf '%s' "$GODOT_TAG" | awk -F- '{
    split($1, part, ".");
    printf "%d.%d.%d.%s", part[1], part[2], part[3], $2
}')"
EDITOR_VERSION="$(printf '%s\n' "$OUTPUT" | sed -n 's/^GODOT_EDITOR_VERSION=//p' | tail -1)"
EDITOR_COMMIT="$(printf '%s\n' "$OUTPUT" | sed -n 's/^GODOT_EDITOR_COMMIT=//p' | tail -1)"
if [ "$EDITOR_VERSION" != "$EXPECTED_VERSION" ]; then
    echo "Official editor reports ${EDITOR_VERSION:-nothing}, expected ${EXPECTED_VERSION}" >&2
    exit 1
fi
if ! [[ "$EDITOR_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Official editor did not report a full commit: ${EDITOR_COMMIT:-nothing}" >&2
    exit 1
fi
printf '%s\n' "$EDITOR_COMMIT"
