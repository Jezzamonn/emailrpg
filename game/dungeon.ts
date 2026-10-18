import type { Point, EntityState, EntityType, LevelState } from "./types.ts";

export interface DungeonEnemyConfig {
  type: Exclude<EntityType, "player">;
  p: Point;
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
      { type: "ortho", p: { x: 2, y: 1 } },
      { type: "ortho", p: { x: 4, y: 1 } },
    ],
  },
  {
    id: 2,
    name: "Bat Belfry",
    width: 7,
    height: 7,
    playerStart: { x: 3, y: 5 },
    enemies: [
      { type: "diag", p: { x: 1, y: 1 } },
      { type: "diag", p: { x: 5, y: 1 } },
      { type: "slow", p: { x: 3, y: 2 } },
    ],
  },
  {
    id: 3,
    name: "Wolf Warrens",
    width: 8,
    height: 8,
    playerStart: { x: 3, y: 6 },
    enemies: [
      { type: "knight", p: { x: 2, y: 2 } },
      { type: "knight", p: { x: 5, y: 2 } },
      { type: "ortho", p: { x: 3, y: 1 } },
    ],
  },
  {
    id: 4,
    name: "The Gauntlet",
    width: 8,
    height: 8,
    playerStart: { x: 3, y: 6 },
    enemies: [
      { type: "knight", p: { x: 1, y: 1 } },
      { type: "diag", p: { x: 6, y: 1 } },
      { type: "ortho", p: { x: 1, y: 3 } },
      { type: "slow", p: { x: 6, y: 3 } },
    ],
  },
];

export function createPregeneratedDungeon(index: number = 0): LevelState {
  const safeIndex = Math.abs(index) % PREGENERATED_DUNGEONS.length;
  const def = PREGENERATED_DUNGEONS[safeIndex];

  const entities: EntityState[] = def.enemies.map((enemyConfig) => ({
    type: enemyConfig.type,
    p: { ...enemyConfig.p },
    cooldown: enemyConfig.type === "slow" ? 0 : undefined,
  }));

  return {
    width: def.width,
    height: def.height,
    entities,
  };
}
