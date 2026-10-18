#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."
OUT_DIR="${1:-assets/exported}"
mkdir -p "$OUT_DIR"

echo "Exporting assets to $OUT_DIR..."

# Beach tiles
aseprite -b assets/beachtiles.aseprite --save-as "$OUT_DIR/beachtiles.png"

# Character, in sections using different palettes for the different parts

# Skin:
aseprite -b --layer "skin" assets/character.aseprite \
  --color-mode indexed \
  --palette assets/palettes/skin-light.aseprite \
  --filename-format "{title}-{layer}-{frame}" \
  --sheet "$OUT_DIR/character-skin-light.png" \
  --data "$OUT_DIR/character-skin-light.json"
aseprite -b --layer "skin" assets/character.aseprite \
  --color-mode indexed \
  --palette assets/palettes/skin-medium.aseprite \
  --filename-format "{title}-{layer}-{frame}" \
  --sheet "$OUT_DIR/character-skin-medium.png" \
  --data "$OUT_DIR/character-skin-medium.json"
aseprite -b --layer "skin" assets/character.aseprite \
  --color-mode indexed \
  --palette assets/palettes/skin-dark.aseprite \
  --filename-format "{title}-{layer}-{frame}" \
  --sheet "$OUT_DIR/character-skin-dark.png" \
  --data "$OUT_DIR/character-skin-dark.json"

# clothes
aseprite -b --layer "clothes" assets/character.aseprite \
  --color-mode indexed \
  --palette assets/palettes/clothes-blue.aseprite \
  --filename-format "{title}-{layer}-{frame}" \
  --sheet "$OUT_DIR/character-clothes-blue.png" \
  --data "$OUT_DIR/character-clothes-blue.json"
aseprite -b --layer "clothes" assets/character.aseprite \
  --color-mode indexed \
  --palette assets/palettes/clothes-red.aseprite \
  --filename-format "{title}-{layer}-{frame}" \
  --sheet "$OUT_DIR/character-clothes-red.png" \
  --data "$OUT_DIR/character-clothes-red.json"
aseprite -b --layer "clothes" assets/character.aseprite \
  --color-mode indexed \
  --palette assets/palettes/clothes-green.aseprite \
  --filename-format "{title}-{layer}-{frame}" \
  --sheet "$OUT_DIR/character-clothes-green.png" \
  --data "$OUT_DIR/character-clothes-green.json"

# spikehair
aseprite -b --layer "spikehair" assets/character.aseprite \
  --color-mode indexed \
  --palette assets/palettes/hair-blonde.aseprite \
  --filename-format "{title}-{layer}-{frame}" \
  --sheet "$OUT_DIR/character-spikehair-blonde.png" \
  --data "$OUT_DIR/character-spikehair-blonde.json"
aseprite -b --layer "spikehair" assets/character.aseprite \
  --color-mode indexed \
  --palette assets/palettes/hair-brown.aseprite \
  --filename-format "{title}-{layer}-{frame}" \
  --sheet "$OUT_DIR/character-spikehair-brown.png" \
  --data "$OUT_DIR/character-spikehair-brown.json"
aseprite -b --layer "spikehair" assets/character.aseprite \
  --color-mode indexed \
  --palette assets/palettes/hair-black.aseprite \
  --filename-format "{title}-{layer}-{frame}" \
  --sheet "$OUT_DIR/character-spikehair-black.png" \
  --data "$OUT_DIR/character-spikehair-black.json"

# ponytail
aseprite -b --layer "ponytail" assets/character.aseprite \
  --color-mode indexed \
  --palette assets/palettes/hair-blonde.aseprite \
  --filename-format "{title}-{layer}-{frame}" \
  --sheet "$OUT_DIR/character-ponytail-blonde.png" \
  --data "$OUT_DIR/character-ponytail-blonde.json"
aseprite -b --layer "ponytail" assets/character.aseprite \
  --color-mode indexed \
  --palette assets/palettes/hair-brown.aseprite \
  --filename-format "{title}-{layer}-{frame}" \
  --sheet "$OUT_DIR/character-ponytail-brown.png" \
  --data "$OUT_DIR/character-ponytail-brown.json"
aseprite -b --layer "ponytail" assets/character.aseprite \
  --color-mode indexed \
  --palette assets/palettes/hair-black.aseprite \
  --filename-format "{title}-{layer}-{frame}" \
  --sheet "$OUT_DIR/character-ponytail-black.png" \
  --data "$OUT_DIR/character-ponytail-black.json"

echo "Done!"
