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

SOURCE_FILE="${2:-$WORKSPACE_ROOT/assets/character.aseprite}"
OUT_DIR="${1:-$WORKSPACE_ROOT/assets/exported}"

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "Error: Source file not found at: $SOURCE_FILE" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "Inspecting layers in: $SOURCE_FILE"
EXISTING_LAYERS="$("$ASEPRITE_BIN" -b --list-layers "$SOURCE_FILE")"

# Target layers matching file layers: skin, clothes, spikehair, ponytail
TARGET_LAYERS=("skin" "clothes" "spikehair" "ponytail")

echo "Exporting character layers to $OUT_DIR..."

for layer in "${TARGET_LAYERS[@]}"; do
  # Determine layer name in aseprite file (supporting legacy aliases if present)
  actual_layer="$layer"
  if ! echo "$EXISTING_LAYERS" | grep -qx "$actual_layer"; then
    if [[ "$layer" == "skin" ]] && echo "$EXISTING_LAYERS" | grep -qx "skin-colored-stuff"; then
      actual_layer="skin-colored-stuff"
    elif [[ "$layer" == "spikehair" ]] && echo "$EXISTING_LAYERS" | grep -qx "hair-front"; then
      actual_layer="hair-front"
    fi
  fi

  if ! echo "$EXISTING_LAYERS" | grep -qx "$actual_layer"; then
    echo " Warning: Layer '$layer' (or alias) not found in $SOURCE_FILE. Skipping."
    continue
  fi

  out_sheet="$OUT_DIR/character-${layer}.png"
  out_data="$OUT_DIR/character-${layer}.json"

  "$ASEPRITE_BIN" -b \
    --filename-format "{title}-{layer}-{frame}" \
    --layer "$actual_layer" \
    "$SOURCE_FILE" \
    --sheet "$out_sheet" \
    --data "$out_data"

  # Also provide standard alias $OUT_DIR/${layer}.png
  cp -f "$out_sheet" "$OUT_DIR/${layer}.png"
  if [[ -f "$out_data" ]]; then
    cp -f "$out_data" "$OUT_DIR/${layer}.json"
  fi

  echo "  Exported layer '$layer' -> $out_sheet & $OUT_DIR/${layer}.png"
done

# Also export combined split-layers spritesheet with all layers separated
COMBINED_SHEET="$OUT_DIR/character.png"
COMBINED_DATA="$OUT_DIR/character.json"

echo "Exporting combined multi-layer spritesheet -> $COMBINED_SHEET"
"$ASEPRITE_BIN" -b \
  --split-layers \
  --filename-format "{layer}-{frame}" \
  "$SOURCE_FILE" \
  --sheet "$COMBINED_SHEET" \
  --data "$COMBINED_DATA"

echo " Exported character spritesheets successfully."
