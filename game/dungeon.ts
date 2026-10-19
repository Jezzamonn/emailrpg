import type { Point } from "./lib/common.ts";
import type { EntityState } from "./entity.ts";
import type { LevelState } from "./level.ts";

export type EnemyType = "ortho" | "diag" | "knight" | "slow";

export interface DungeonEnemyConfig {
  type: EnemyType;
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

export function getDungeonDefinition(
  indexOrName: number | string = 0,
): DungeonDefinition {
  if (typeof indexOrName === "string") {
    const trimmed = indexOrName.trim();
    // 1. Case-insensitive match on name
    const byName = PREGENERATED_DUNGEONS.find(
      (d) => d.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (byName) return byName;

    // 2. Exact match on id string (e.g. "1", "2")
    const byId = PREGENERATED_DUNGEONS.find((d) => d.id.toString() === trimmed);
    if (byId) return byId;

    // 3. Match without prefix like "dungeon 1", "level-2"
    const stripped = trimmed.replace(/^(dungeon|level)[-_\s]*/i, "");
    if (stripped !== trimmed) {
      return getDungeonDefinition(stripped);
    }

    // 4. Numeric index / id
    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed)) {
      const byParsedId = PREGENERATED_DUNGEONS.find((d) => d.id === parsed);
      if (byParsedId) return byParsedId;
      const safeIndex = Math.abs(parsed) % PREGENERATED_DUNGEONS.length;
      return PREGENERATED_DUNGEONS[safeIndex];
    }

    return PREGENERATED_DUNGEONS[0];
  }

  const safeIndex = Math.abs(indexOrName) % PREGENERATED_DUNGEONS.length;
  return PREGENERATED_DUNGEONS[safeIndex];
}

export function createPregeneratedDungeon(
  indexOrName: number | string = 0,
): LevelState {
  const def = getDungeonDefinition(indexOrName);

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

export function createDungeonForLevel(
  indexOrName: number | string = 0,
): { level: LevelState; playerStart: Point } {
  const def = getDungeonDefinition(indexOrName);
  return {
    level: createPregeneratedDungeon(indexOrName),
    playerStart: { ...def.playerStart },
  };
}
