#!/usr/bin/env bash
set -euo pipefail

# Find Aseprite executable
ASEPRITE_BIN="${ASEPRITE:-}"
if [[ -z "$ASEPRITE_BIN" ]]; then
  if command -v aseprite >/dev/null 2>&1; then
    ASEPRITE_BIN="aseprite"
  elif [[ -x "/Applications/Aseprite.app/Contents/MacOS/aseprite" ]]; then
    ASEPRITE_BIN="/Applications/Aseprite.app/Contents/MacOS/aseprite"
  elif [[ -x "$HOME/Applications/Aseprite.app/Contents/MacOS/aseprite" ]]; then
    ASEPRITE_BIN="$HOME/Applications/Aseprite.app/Contents/MacOS/aseprite"
  else
    echo "Error: Aseprite executable not found. Please install Aseprite or set ASEPRITE environment variable." >&2
    exit 1
  fi
fi

# Determine directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE_FILE="${2:-$WORKSPACE_ROOT/assets/beachtiles.aseprite}"
OUT_DIR="${1:-$WORKSPACE_ROOT/assets/exported}"

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "Error: Source file not found at: $SOURCE_FILE" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

OUTPUT_PNG="$OUT_DIR/beachtiles.png"

echo "Exporting beachtiles: $SOURCE_FILE -> $OUTPUT_PNG"
"$ASEPRITE_BIN" -b "$SOURCE_FILE" --save-as "$OUTPUT_PNG"

if [[ -f "$OUTPUT_PNG" ]]; then
  echo " Successfully exported: $OUTPUT_PNG ($(stat -f "%z bytes" "$OUTPUT_PNG" 2>/dev/null || wc -c < "$OUTPUT_PNG"))"
else
  echo "Error: Failed to export $OUTPUT_PNG" >&2
  exit 1
fi
