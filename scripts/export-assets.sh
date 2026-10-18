#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

OUT_DIR="${1:-$WORKSPACE_ROOT/assets/exported}"

echo "========================================"
echo "Exporting Aseprite assets to: $OUT_DIR"
echo "========================================"

mkdir -p "$OUT_DIR"

echo ""
echo "[1/2] Exporting beachtiles..."
"$SCRIPT_DIR/export-beachtiles.sh" "$OUT_DIR"

echo ""
echo "[2/2] Exporting character spritesheets..."
"$SCRIPT_DIR/export-character.sh" "$OUT_DIR"

echo ""
echo "All assets exported successfully to: $OUT_DIR"
