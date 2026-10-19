import type { Point } from "./lib/common.ts";
import { type EntityState, entityGroupOf } from "./entity.ts";
import type { LevelState } from "./level.ts";

export const ENEMY_MOVE_VECTORS = {
  diag: [
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ],
  ortho: [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ],
  knight: [
    { x: 2, y: 1 },
    { x: 2, y: -1 },
    { x: -2, y: 1 },
    { x: -2, y: -1 },
    { x: 1, y: 2 },
    { x: 1, y: -2 },
    { x: -1, y: 2 },
    { x: -1, y: -2 },
  ],
  slow: [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ],
  random: [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ],
} as const;

export function stepLevelEnemies(
  level: LevelState,
  onPlayerKilled?: (playerId: string) => void
): LevelState {
  const players = level.entities.filter((e) => e.type === "player");
  if (players.length === 0) {
    return level;
  }

  // Work with a copy of entities to produce an updated level state
  const updatedEntities: EntityState[] = level.entities.map((e) => ({
    ...e,
    p: { ...e.p },
  }));

  for (let i = 0; i < updatedEntities.length; i++) {
    const entity = updatedEntities[i];
    if (entityGroupOf(entity.type) !== "enemy") continue;

    // Check slow enemy cooldown
    if (entity.type === "slow") {
      if (entity.cooldown && entity.cooldown > 0) {
        entity.cooldown--;
        continue;
      }
      entity.cooldown = 1;
    }

    // Find closest player by Euclidean distance
    let closestPlayer: EntityState | null = null;
    let closestDistSq = Infinity;
    for (const p of updatedEntities) {
      if (p.type !== "player") continue;
      const dx = p.p.x - entity.p.x;
      const dy = p.p.y - entity.p.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestPlayer = p;
      }
    }

    if (!closestPlayer) continue;

    const moveVectors =
      entity.type in ENEMY_MOVE_VECTORS
        ? ENEMY_MOVE_VECTORS[entity.type as keyof typeof ENEMY_MOVE_VECTORS]
        : ENEMY_MOVE_VECTORS.ortho;

    let bestNewP: Point | null = null;
    let bestDist = Infinity;
    let bestSqRealDist = Infinity;

    for (const move of moveVectors) {
      const newP: Point = { x: entity.p.x + move.x, y: entity.p.y + move.y };

      // In-bounds check
      if (
        newP.x < 0 ||
        newP.x >= level.width ||
        newP.y < 0 ||
        newP.y >= level.height
      ) {
        continue;
      }

      // Check collision: entities of the same type can occupy the same square
      const obstacle = updatedEntities.find(
        (other) =>
          other !== entity &&
          other.p.x === newP.x &&
          other.p.y === newP.y &&
          other.type !== entity.type &&
          entityGroupOf(other.type) !== "player"
      );
      if (obstacle) continue;

      const dx = closestPlayer.p.x - newP.x;
      const dy = closestPlayer.p.y - newP.y;
      const dist = Math.abs(dx) + Math.abs(dy); // Taxicab distance
      const sqRealDist = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance

      if (
        dist < bestDist ||
        (dist === bestDist && sqRealDist < bestSqRealDist)
      ) {
        bestDist = dist;
        bestSqRealDist = sqRealDist;
        bestNewP = newP;
      }
    }

    if (bestNewP) {
      entity.p = bestNewP;

      // Check if enemy moved onto any player's position
      for (const p of updatedEntities) {
        if (p.type === "player" && p.p.x === bestNewP.x && p.p.y === bestNewP.y) {
          if (onPlayerKilled && p.playerId) {
            onPlayerKilled(p.playerId);
          }
        }
      }
    }
  }

  return {
    ...level,
    entities: updatedEntities,
  };
}
