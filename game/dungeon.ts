import { Level } from "./level.ts";
import type { Point } from "./lib/common.ts";
import {
  DiagEnemy,
  OrthoEnemy,
  KnightEnemy,
  SlowEnemy,
} from "./entity/enemy.ts";
import type { Entity } from "./entity/entity.ts";

export interface DungeonEnemyConfig {
  type: new (level: Level) => Entity;
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
      { type: OrthoEnemy, pos: { x: 2, y: 1 } },
      { type: OrthoEnemy, pos: { x: 4, y: 1 } },
    ],
  },
  {
    id: 2,
    name: "Bat Belfry",
    width: 7,
    height: 7,
    playerStart: { x: 3, y: 5 },
    enemies: [
      { type: DiagEnemy, pos: { x: 1, y: 1 } },
      { type: DiagEnemy, pos: { x: 5, y: 1 } },
      { type: SlowEnemy, pos: { x: 3, y: 2 } },
    ],
  },
  {
    id: 3,
    name: "Wolf Warrens",
    width: 8,
    height: 8,
    playerStart: { x: 3, y: 6 },
    enemies: [
      { type: KnightEnemy, pos: { x: 2, y: 2 } },
      { type: KnightEnemy, pos: { x: 5, y: 2 } },
      { type: OrthoEnemy, pos: { x: 3, y: 1 } },
    ],
  },
  {
    id: 4,
    name: "The Gauntlet",
    width: 8,
    height: 8,
    playerStart: { x: 3, y: 6 },
    enemies: [
      { type: KnightEnemy, pos: { x: 1, y: 1 } },
      { type: DiagEnemy, pos: { x: 6, y: 1 } },
      { type: OrthoEnemy, pos: { x: 1, y: 3 } },
      { type: SlowEnemy, pos: { x: 6, y: 3 } },
    ],
  },
];

export function createPregeneratedDungeon(index: number = 0): Level {
  const safeIndex = Math.abs(index) % PREGENERATED_DUNGEONS.length;
  const def = PREGENERATED_DUNGEONS[safeIndex];

  const level = new Level(def.width, def.height);
  level.name = def.name;
  level.dungeonId = def.id;
  level.playerStart = { ...def.playerStart };

  for (const enemyConfig of def.enemies) {
    const enemy = new enemyConfig.type(level);
    enemy.p = { ...enemyConfig.pos };
    level.entities.push(enemy);
  }

  return level;
}
