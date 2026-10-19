import type { Point } from "./lib/common.ts";
import type { EntityState } from "./entity.ts";
import type { LevelState } from "./level.ts";

export type EnemyType = "ortho" | "diag" | "knight" | "slow";

export interface DungeonEnemyConfig {
  type: EnemyType;
  p: Point;
  cooldown?: number;
}

export interface DungeonDefinition {
  id: number;
  name: string;
  width: number;
  height: number;
  playerStart: Point;
  enemies: DungeonEnemyConfig[];
}

function parseLevel(level: string): {
  width: number;
  height: number;
  playerStart: Point;
  enemies: DungeonEnemyConfig[];
} {
  // Parse 2D representation of level
  const rows = level
    .trim()
    .split("\n")
    .map((r) => Array.from(r.trim()));
  const height = rows.length;
  const width = rows[0].length;
  let playerStart: Point = { x: 0, y: 0 };
  const enemies: DungeonEnemyConfig[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = rows[y][x];
      switch (cell) {
        case "🤴":
          playerStart = { x, y };
          break;
        case "🐀":
          enemies.push({ type: "ortho", p: { x, y } });
          break;
        case "🦇":
          enemies.push({ type: "diag", p: { x, y } });
          break;
        case "🐴":
          enemies.push({ type: "knight", p: { x, y } });
          break;
        case "🐌":
          enemies.push({ type: "slow", p: { x, y }, cooldown: 0 });
          break;
        case "💤":
          enemies.push({ type: "slow", p: { x, y }, cooldown: 1 });
          break;
      }
    }
  }

  return { width, height, playerStart, enemies };
}

export const PREGENERATED_DUNGEONS: DungeonDefinition[] = [
  {
    id: 1,
    name: "rat-and-bat",
    ...parseLevel(`
🐀⬛⬛⬛
🦇⬛⬛🦇
⬛⬛⬛⬛
⬛🤴🐀⬛
    `),
  },
  {
    id: 2,
    name: "snail",
    ...parseLevel(`
🐌💤🐌
⬛🤴⬛
⬛💤🐌
    `),
  },
  {
    id: 3,
    name: "horsies",
    ...parseLevel(`
⬛🐴⬛
⬛🐴🐴
🐴⬛⬛
⬛🤴⬛
    `),
  },
  {
    id: 4,
    name: "everyone",
    ...parseLevel(`
🐴🐀🦇🐌
⬛⬛💤🐴
🦇⬛⬛🐀
⬛🤴⬛⬛
    `),
  },
];

const DUNGEON_ALIASES: string[][] = [
  ["Rat Cellar", "rat-and-bat"],
  ["Bat Belfry", "snail"],
  ["Wolf Warrens", "horsies"],
  ["The Gauntlet", "everyone"],
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

    const aliasIdx = DUNGEON_ALIASES.findIndex((aliases) =>
      aliases.some((name) => name.toLowerCase() === trimmed.toLowerCase()),
    );
    if (aliasIdx !== -1 && PREGENERATED_DUNGEONS[aliasIdx]) {
      return PREGENERATED_DUNGEONS[aliasIdx]!;
    }

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
    cooldown: enemyConfig.cooldown,
  }));

  return {
    name: def.name,
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

export function isLevelUnlocked(
  indexOrName: number | string,
  completedLevels: string[] = [],
): boolean {
  if (
    typeof indexOrName === "string" &&
    indexOrName.trim().toLowerCase() === "hub"
  ) {
    return true;
  }
  const def = getDungeonDefinition(indexOrName);
  const index = PREGENERATED_DUNGEONS.findIndex((d) => d.id === def.id);
  if (index <= 0) {
    return true;
  }
  const completedLower = completedLevels.map((l) => l.trim().toLowerCase());
  for (let i = 0; i < index; i++) {
    const prev = PREGENERATED_DUNGEONS[i]!;
    const aliases = DUNGEON_ALIASES[i] ?? [];
    if (
      !completedLower.includes(prev.name.toLowerCase()) &&
      !aliases.some((a) => completedLower.includes(a.toLowerCase())) &&
      !completedLower.includes(prev.id.toString())
    ) {
      return false;
    }
  }
  return true;
}
