#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."
OUT_DIR="${1:-assets/exported}"
mkdir -p "$OUT_DIR"

echo "Exporting assets to $OUT_DIR..."

# Beach tiles
aseprite -b assets/beachtiles.aseprite --save-as "$OUT_DIR/beachtiles.png"

# Character layers
for layer in skin clothes spikehair ponytail; do
  aseprite -b --layer "$layer" assets/character.aseprite \
    --filename-format "{title}-{layer}-{frame}" \
    --sheet "$OUT_DIR/character-${layer}.png" \
    --data "$OUT_DIR/character-${layer}.json"
  cp -f "$OUT_DIR/character-${layer}.png" "$OUT_DIR/${layer}.png"
  cp -f "$OUT_DIR/character-${layer}.json" "$OUT_DIR/${layer}.json"
done

# Character combined sheet
aseprite -b --split-layers assets/character.aseprite \
  --filename-format "{layer}-{frame}" \
  --sheet "$OUT_DIR/character.png" \
  --data "$OUT_DIR/character.json"

echo "Done!"
