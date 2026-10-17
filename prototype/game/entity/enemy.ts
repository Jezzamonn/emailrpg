import { Entity } from "./entity.ts";
import { Player } from "./player.ts";
import { Dir, Dirs, Points, type Point } from "../../lib/common.ts";
import type { EntityType } from "./entity.ts";

export class RandomThing extends Entity {
  public char = "🐑";

  override move() {
    // Random movement for now.
    const direction = Math.floor(this.level.rng() * 4) as Dir;
    const newP = Points.add(this.p, Dirs.toPoint(direction));
    this.moveTo(newP);
  }
}

export class TargetingEnemy extends Entity {
  // Can use these or define a function. Relative to this thing.
  public staticMovePossibilities: Point[] = [];
  public type: EntityType = "enemy";

  getMovePossibilities(): Point[] {
    return this.staticMovePossibilities;
  }

  getClosestPlayer(): Player | null {
    let closest: Player | null = null;
    let closestDistance = Infinity;
    for (const entity of this.level.entities) {
      if (entity instanceof Player) {
        const dx = entity.p.x - this.p.x;
        const dy = entity.p.y - this.p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = entity;
        }
      }
    }
    return closest;
  }

  override move() {
    // Move towards closest player
    const closestPlayer = this.getClosestPlayer();
    if (!closestPlayer) return;

    let bestNewP: Point | null = null;
    let bestDist = Infinity;
    let bestSqRealDist = Infinity;
    for (const move of this.getMovePossibilities()) {
      const newP = Points.add(this.p, move);
      // TODO: Allow moving where attacking things are?
      if (!this.level.inBound(newP)) {
        continue;
      }
      const entityAt = this.level.entityAt(newP);

      if (entityAt && !this.canKill(entityAt)) {
        continue;
      }

      const dx = closestPlayer.p.x - newP.x;
      const dy = closestPlayer.p.y - newP.y;
      // Taxicab distance
      const dist = Math.abs(dx) + Math.abs(dy);
      // Tiebreaker: Triangly distance?
      const sqRealDist = Math.max(Math.abs(dx), Math.abs(dy));

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
      // TODO: This will need to attack things somehow.
      this.moveTo(bestNewP);
    }
  }
}

export class DiagEnemy extends TargetingEnemy {
  public char = "🦇";
  public staticMovePossibilities: Point[] = [
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ];
}

export class OrthoEnemy extends TargetingEnemy {
  public char = "🐀";
  public staticMovePossibilities: Point[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
}

export class KnightEnemy extends TargetingEnemy {
  public char = "🐺";
  public staticMovePossibilities: Point[] = [
    { x: 2, y: 1 },
    { x: 2, y: -1 },
    { x: -2, y: 1 },
    { x: -2, y: -1 },
    { x: 1, y: 2 },
    { x: 1, y: -2 },
    { x: -1, y: 2 },
    { x: -1, y: -2 },
  ];
}

export class SlowEnemy extends TargetingEnemy {
  public char = "🐌";
  public staticMovePossibilities: Point[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  public cooldown = 0;

  override getMovePossibilities() {
    if (this.cooldown > 0) {
      this.cooldown--;
      return [];
    }
    this.cooldown = 1;
    return this.staticMovePossibilities;
  }
}