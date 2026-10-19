import { type Point, getColumnLetter } from "./lib/common.ts";
import { type SpriteSheet, Surface, Colors, rgba } from "./lib/surface.ts";
import {
  TILE_SIZE,
  entityGroupOf,
  renderEntity,
  type EntityState,
} from "./entity.ts";
import { getBanterFont } from "./lib/font.ts";
import { decodePng } from "./lib/png.ts";
import { seededRandom } from "./lib/util.ts";
import { ENEMY_MOVE_VECTORS } from "./enemy.ts";
import beachTilesPng from "../assets/exported/beachtiles.png";
import positionPng from "../assets/exported/position.png";
import warningPng from "../assets/exported/warning.png";

// psuedo enum but just a number
export const BeachTile = {
  DeepWater: 0,
  Water: 1,
  Sand: 2,
  Grass: 3,
} as const;
export type BeachTile = (typeof BeachTile)[keyof typeof BeachTile];

let beachTilesSheet: SpriteSheet | null = null;

function getBeachTilesSheet(): SpriteSheet {
  if (!beachTilesSheet) {
    beachTilesSheet = decodePng(new Uint8Array(beachTilesPng));
  }
  return beachTilesSheet;
}

let positionSheet: SpriteSheet | null = null;
let warningSheet: SpriteSheet | null = null;

function getPositionSheet(): SpriteSheet {
  if (!positionSheet) {
    positionSheet = decodePng(new Uint8Array(positionPng));
  }
  return positionSheet;
}

function getWarningSheet(): SpriteSheet {
  if (!warningSheet) {
    warningSheet = decodePng(new Uint8Array(warningPng));
  }
  return warningSheet;
}

// Squares the player(s) can move to: 1 or 2 spaces in a cardinal direction.
function playerMoveTargets(level: LevelState, forPlayer?: string): Point[] {
  const players = level.entities.filter(
    (e) =>
      e.type === "player" && (forPlayer == null || e.playerId === forPlayer),
  );
  const targets: Point[] = [];
  for (const player of players) {
    for (const dir of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      for (let dist = 1; dist <= 2; dist++) {
        const p = { x: player.p.x + dir.x * dist, y: player.p.y + dir.y * dist };
        if (levelInBound(level, p)) targets.push(p);
      }
    }
  }
  return targets;
}

// Squares any enemy could move to on its next step.
function enemyMoveTargets(level: LevelState): Point[] {
  const targets: Point[] = [];
  for (const enemy of level.entities) {
    if (entityGroupOf(enemy.type) !== "enemy") continue;
    // Sleeping slow enemies don't move next step.
    if (enemy.type === "slow" && enemy.cooldown && enemy.cooldown > 0) continue;
    const moveVectors =
      enemy.type in ENEMY_MOVE_VECTORS
        ? ENEMY_MOVE_VECTORS[enemy.type as keyof typeof ENEMY_MOVE_VECTORS]
        : ENEMY_MOVE_VECTORS.ortho;
    for (const move of moveVectors) {
      const p = { x: enemy.p.x + move.x, y: enemy.p.y + move.y };
      if (levelInBound(level, p)) targets.push(p);
    }
  }
  return targets;
}

function renderMoveIndicators(
  surface: Surface,
  level: LevelState,
  frame: number,
  forPlayer?: string,
): void {
  const draw = (sheet: SpriteSheet, points: Point[]) => {
    for (const p of points) {
      surface.drawSprite(
        sheet,
        (frame % 2) * TILE_SIZE,
        0,
        TILE_SIZE,
        TILE_SIZE,
        p.x * TILE_SIZE,
        p.y * TILE_SIZE,
      );
    }
  };
  draw(getPositionSheet(), playerMoveTargets(level, forPlayer));
  draw(getWarningSheet(), enemyMoveTargets(level));
}

function getBeachTileAt(
  tiles: BeachTile[][],
  x: number,
  y: number,
): BeachTile {
  if (y < 0 || y >= tiles.length || x < 0 || x >= tiles[y].length) {
    return BeachTile.DeepWater;
  }
  return tiles[y][x];
}

function renderBeachTiles(
  surface: Surface,
  level: LevelState,
  tiles: BeachTile[][],
): void {
  const sheet = getBeachTilesSheet();
  const halfTile = TILE_SIZE / 2;

  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const tile = getBeachTileAt(tiles, x, y);
      if (tile === BeachTile.DeepWater) {
        surface.drawSprite(
          sheet,
          0,
          0,
          TILE_SIZE,
          TILE_SIZE,
          x * TILE_SIZE,
          y * TILE_SIZE,
        );
        continue;
      }

      const baseTileX = (tile * 2 - 1) * TILE_SIZE;
      for (let qy = 0; qy < 2; qy++) {
        for (let qx = 0; qx < 2; qx++) {
          const nx = x + (qx === 0 ? -1 : 1);
          const ny = y + (qy === 0 ? -1 : 1);
          const horizMatch = getBeachTileAt(tiles, nx, y) >= tile ? 1 : 0;
          const vertMatch = getBeachTileAt(tiles, x, ny) >= tile ? 1 : 0;
          const diagMatch = getBeachTileAt(tiles, nx, ny) >= tile ? 1 : 0;
          const diagReallyDontMatch = getBeachTileAt(tiles, nx, ny) < tile - 1;

          let sx = baseTileX + horizMatch * TILE_SIZE + qx * halfTile;
          let sy = vertMatch * TILE_SIZE + qy * halfTile;
          if (!horizMatch && !vertMatch && diagReallyDontMatch) {
            sx = baseTileX + qx * halfTile;
            sy = 2 * TILE_SIZE + qy * halfTile;
          }
          if (horizMatch && vertMatch && !diagMatch) {
            sx = 1 * TILE_SIZE + baseTileX + qx * halfTile;
            sy = 2 * TILE_SIZE + qy * halfTile;
          }
          surface.drawSprite(
            sheet,
            sx,
            sy,
            halfTile,
            halfTile,
            x * TILE_SIZE + qx * halfTile,
            y * TILE_SIZE + qy * halfTile,
          );
        }
      }
    }
  }
}

export interface LevelState {
  name?: string;
  width: number;
  height: number;
  entities: EntityState[];
  backgroundTiles?: BeachTile[][];
}

export function createLevel(width: number, height: number): LevelState {
  return {
    width,
    height,
    entities: [],
  };
}

export function createHubLevel(): LevelState {
  const level = createLevel(15, 11);

  // Ascii drawing
  const beachTiles = `
DDWWWWWWWWDDDDD
DWWSSSSSSSWWDDD
DWSSSSGSSSSSWWD
DDWSGGGGGGGGSWD
DWWSGGGGGGGSSWD
WWSSGGGGGGGSSWW
WSGGGGGGGGGGSSW
WSSGGGGGGGGSSWW
WWSSGGGGGSSSWWD
DWWWSSSSSSWWWDD
DDDWWWWWWWWDDDD
  `;
  level.backgroundTiles = beachTiles
    .trim()
    .split("\n")
    .map((row) =>
      row.split("").map((c) => {
        switch (c) {
          case "D":
            return BeachTile.DeepWater;
          case "W":
            return BeachTile.Water;
          case "S":
            return BeachTile.Sand;
          case "G":
            return BeachTile.Grass;
          default:
            throw new Error(`Unknown tile: ${c}`);
        }
      }),
    );

  level.entities = [
    {
      type: "portal",
      p: { x: 4, y: 3 },
      targetLevel: "Rat Cellar",
      portalLevel: "Rat Cellar",
    },
    {
      type: "portal",
      p: { x: 10, y: 3 },
      targetLevel: "Bat Belfry",
      portalLevel: "Bat Belfry",
    },
    {
      type: "portal",
      p: { x: 4, y: 7 },
      targetLevel: "Wolf Warrens",
      portalLevel: "Wolf Warrens",
    },
    {
      type: "portal",
      p: { x: 10, y: 7 },
      targetLevel: "The Gauntlet",
      portalLevel: "The Gauntlet",
    },
  ];

  return level;
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
  rng?: () => number;
  seed?: string;
  completedLevels?: string[];
}

export function renderLevel(
  surface: Surface,
  level: LevelState,
  frame: number = 0,
  options: LevelRenderOptions = {},
  forPlayer?: string,
  completedLevels?: string[],
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

  const hasBeachTiles = level.backgroundTiles != null;
  const borderColor =
    options.borderColor ??
    (hasBeachTiles ? getBeachTilesSheet().pixels[0] : rgba(24, 24, 24));
  const fontColor =
    options.fontColor ?? (hasBeachTiles ? Colors.Black : rgba(180, 180, 180));

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
    if (hasBeachTiles && options.borderColor == null) {
      const sheet = getBeachTilesSheet();
      for (let ty = 0; ty < Math.ceil(surface.height / TILE_SIZE); ty++) {
        for (let tx = 0; tx < Math.ceil(surface.width / TILE_SIZE); tx++) {
          surface.drawSprite(
            sheet,
            0,
            0,
            TILE_SIZE,
            TILE_SIZE,
            tx * TILE_SIZE,
            ty * TILE_SIZE,
          );
        }
      }
    }
  }

  const boardW = level.width * TILE_SIZE;
  const boardH = level.height * TILE_SIZE;
  const boardSurface = new Surface(boardW, boardH);

  // Draw background grid tiles
  if (level.backgroundTiles) {
    renderBeachTiles(boardSurface, level, level.backgroundTiles);
  } else {
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
  }

  // Show move indicators in dungeons only (the hub has beach tiles and no enemies)
  if (level.backgroundTiles == null && levelHasEnemies(level)) {
    renderMoveIndicators(boardSurface, level, frame, forPlayer);
  }

  // 1. Loop over each entity and put them in a data structure indexed by coordinate
  const entitiesByCoord = new Map<string, EntityState[]>();
  for (const entity of level.entities) {
    const key = `${entity.p.x},${entity.p.y}`;
    const list = entitiesByCoord.get(key);
    if (list) {
      list.push(entity);
    } else {
      entitiesByCoord.set(key, [entity]);
    }
  }

  // 2. Create a seeded random with a fixed seed
  const rng = options.rng ?? seededRandom(options.seed ?? "entities");

  // 3. Render entities, and if multiple entities are on the same tile shift them by a random amount
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const entitiesOnTile = entitiesByCoord.get(`${x},${y}`);
      if (!entitiesOnTile || entitiesOnTile.length === 0) continue;

      const isShifted = entitiesOnTile.length > 1;
      const sorted = entitiesOnTile.slice().sort((a, b) => {
        if (forPlayer != null) {
          if (a.playerId === forPlayer) return 1;
          if (b.playerId === forPlayer) return -1;
        }
        return 0;
      });

      const usedOffsets = new Set<string>();
      for (const entity of sorted) {
        let offset: Point = { x: 0, y: 0 };
        if (isShifted) {
          let attempts = 0;
          do {
            offset = {
              x: Math.floor(rng() * 7) - 3,
              y: Math.floor(rng() * 7) - 3,
            };
            attempts++;
          } while (usedOffsets.has(`${offset.x},${offset.y}`) && attempts < 10);
          usedOffsets.add(`${offset.x},${offset.y}`);
        }
        renderEntity(
          boardSurface,
          entity,
          frame,
          offset,
          completedLevels ?? options.completedLevels ?? [],
        );
      }
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
      const rowY =
        offsetY + y * TILE_SIZE + Math.floor((TILE_SIZE - metrics.height) / 2);

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
      const textYOffset = Math.floor((TILE_SIZE - metrics.height) / 2);

      // Bottom border
      const bottomY = offsetY + boardH + textYOffset;
      font.drawText(surface, colLetter, colX, bottomY, fontColor);

      // Top border (if all sides)
      if (coordinateSides === "all") {
        font.drawText(surface, colLetter, colX, textYOffset, fontColor);
      }
    }
  }
}
