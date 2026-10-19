import {
  type Point,
  type EntityState,
  type LevelState,
  entityGroupOf,
} from "./types.ts";
import { Surface, rgba } from "./lib/surface.ts";
import { TILE_SIZE, renderEntity } from "./entity.ts";
import { getBanterFont } from "./lib/font.ts";

function getColumnLetter(colIndex: number): string {
  let s = "";
  let n = colIndex;
  while (n >= 0) {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export function createLevel(width: number, height: number): LevelState {
  return {
    width,
    height,
    entities: [],
  };
}

export function levelInBound(level: LevelState, p: Point): boolean {
  return p.x >= 0 && p.x < level.width && p.y >= 0 && p.y < level.height;
}

export function levelEntitiesAt(level: LevelState, p: Point): EntityState[] {
  return level.entities.filter((e) => e.p.x === p.x && e.p.y === p.y);
}

export function levelHasEnemies(level: LevelState): boolean {
  return level.entities.some((e) => entityGroupOf(e.type) === "enemy");
}

export interface LevelRenderOptions {
  showCoordinates?: boolean;
  coordinateSides?: "all" | "bottom-left";
  fontColor?: number;
  borderColor?: number;
}

export function renderLevel(
  surface: Surface,
  level: LevelState,
  frame: number = 0,
  options: LevelRenderOptions = {},
  forPlayer?: string,
): void {

  const showCoordinates =
    options.showCoordinates ??
    (surface.width > level.width * TILE_SIZE ||
      surface.height > level.height * TILE_SIZE);

  const coordinateSides =
    options.coordinateSides ??
    (surface.width >= (level.width + 2) * TILE_SIZE &&
    surface.height >= (level.height + 2) * TILE_SIZE
      ? "all"
      : "bottom-left");

  const borderColor = options.borderColor ?? rgba(24, 24, 24);
  const fontColor = options.fontColor ?? rgba(180, 180, 180);

  let offsetX = 0;
  let offsetY = 0;

  if (showCoordinates) {
    if (coordinateSides === "all") {
      offsetX = TILE_SIZE;
      offsetY = TILE_SIZE;
    } else {
      offsetX = TILE_SIZE;
      offsetY = 0;
    }
    surface.clear(borderColor);
  }

  const boardW = level.width * TILE_SIZE;
  const boardH = level.height * TILE_SIZE;
  const boardSurface = new Surface(boardW, boardH);

  // Draw background grid tiles
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const isAlt = (x + y) % 2 === 1;
      const tileColor = isAlt ? rgba(35, 35, 35) : rgba(45, 45, 45);
      boardSurface.fillRect(
        x * TILE_SIZE,
        y * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE,
        tileColor,
      );
    }
  }

  // Draw entities (pick one player per tile, preferring forPlayer)
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const entitiesOnTile = levelEntitiesAt(level, { x, y });
      if (entitiesOnTile.length === 0) continue;

      let picked: EntityState;
      const forPlayerEntity =
        forPlayer != null
          ? entitiesOnTile.find((e) => e.playerId === forPlayer)
          : undefined;
      if (forPlayerEntity) {
        picked = forPlayerEntity;
      } else {
        picked =
          entitiesOnTile.find((e) => e.type === "player") ?? entitiesOnTile[0];
      }
      renderEntity(boardSurface, picked, frame);
    }
  }

  surface.drawSurface(boardSurface, offsetX, offsetY);

  // Render outside coordinates with banter font if requested
  if (showCoordinates) {
    const font = getBanterFont();

    // Numbers start at 1 at bottom and go up
    for (let y = 0; y < level.height; y++) {
      const rowNumber = (level.height - y).toString();
      const metrics = font.measureText(rowNumber);
      const rowY = offsetY + y * TILE_SIZE;

      // Left border
      const leftX = Math.floor((TILE_SIZE - metrics.width) / 2);
      font.drawText(surface, rowNumber, leftX, rowY, fontColor);

      // Right border (if all sides)
      if (coordinateSides === "all") {
        const rightX =
          offsetX + boardW + Math.floor((TILE_SIZE - metrics.width) / 2);
        font.drawText(surface, rowNumber, rightX, rowY, fontColor);
      }
    }

    // Letters go from a onwards starting at the left
    for (let x = 0; x < level.width; x++) {
      const colLetter = getColumnLetter(x);
      const metrics = font.measureText(colLetter);
      const colX =
        offsetX + x * TILE_SIZE + Math.floor((TILE_SIZE - metrics.width) / 2);

      // Bottom border
      const bottomY = offsetY + boardH;
      font.drawText(surface, colLetter, colX, bottomY, fontColor);

      // Top border (if all sides)
      if (coordinateSides === "all") {
        font.drawText(surface, colLetter, colX, 0, fontColor);
      }
    }
  }
}
