import type { Point, EntityState, LevelState, EnemyKind } from "./types.ts";

export interface DungeonEnemyConfig {
  enemyKind: EnemyKind;
  char: string;
  pos: Point;
}

export interface DungeonDefinition {
  id: number;
  name: string;
  width: number;
  height: number;
  playerStart: Point;
  enemies: DungeonEnemyConfig[];
}

export const PREGENERATED_DUNGEONS: DungeonDefinition[] = [
  {
    id: 1,
    name: "Rat Cellar",
    width: 7,
    height: 7,
    playerStart: { x: 3, y: 5 },
    enemies: [
      { enemyKind: "ortho", char: "🐀", pos: { x: 2, y: 1 } },
      { enemyKind: "ortho", char: "🐀", pos: { x: 4, y: 1 } },
    ],
  },
  {
    id: 2,
    name: "Bat Belfry",
    width: 7,
    height: 7,
    playerStart: { x: 3, y: 5 },
    enemies: [
      { enemyKind: "diag", char: "🦇", pos: { x: 1, y: 1 } },
      { enemyKind: "diag", char: "🦇", pos: { x: 5, y: 1 } },
      { enemyKind: "slow", char: "🐌", pos: { x: 3, y: 2 } },
    ],
  },
  {
    id: 3,
    name: "Wolf Warrens",
    width: 8,
    height: 8,
    playerStart: { x: 3, y: 6 },
    enemies: [
      { enemyKind: "knight", char: "🐺", pos: { x: 2, y: 2 } },
      { enemyKind: "knight", char: "🐺", pos: { x: 5, y: 2 } },
      { enemyKind: "ortho", char: "🐀", pos: { x: 3, y: 1 } },
    ],
  },
  {
    id: 4,
    name: "The Gauntlet",
    width: 8,
    height: 8,
    playerStart: { x: 3, y: 6 },
    enemies: [
      { enemyKind: "knight", char: "🐺", pos: { x: 1, y: 1 } },
      { enemyKind: "diag", char: "🦇", pos: { x: 6, y: 1 } },
      { enemyKind: "ortho", char: "🐀", pos: { x: 1, y: 3 } },
      { enemyKind: "slow", char: "🐌", pos: { x: 6, y: 3 } },
    ],
  },
];

export function createPregeneratedDungeon(index: number = 0): LevelState {
  const safeIndex = Math.abs(index) % PREGENERATED_DUNGEONS.length;
  const def = PREGENERATED_DUNGEONS[safeIndex];

  const entities: EntityState[] = def.enemies.map((enemyConfig, i) => ({
    id: `enemy-${def.id}-${i}`,
    type: "enemy",
    enemyKind: enemyConfig.enemyKind,
    char: enemyConfig.char,
    p: { ...enemyConfig.pos },
    cooldown: enemyConfig.enemyKind === "slow" ? 0 : undefined,
  }));

  return {
    id: def.id,
    name: def.name,
    width: def.width,
    height: def.height,
    playerStart: { ...def.playerStart },
    entities,
  };
}
