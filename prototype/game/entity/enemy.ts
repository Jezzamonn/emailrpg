import { Entity } from "./entity.ts";
import { Player } from "./player.ts";
import { Points, type Point } from "../../lib/common.ts";

export class RandomThing extends Entity {
  public char = "🐑";

  move() {
    // Random movement for now.
    const direction = Math.floor(this.level.rng() * 4);
    switch (direction) {
      case 0:
        this.p.x = Math.max(0, this.p.x - 1);
        break;
      case 1:
        this.p.x = Math.min(this.level.width - 1, this.p.x + 1);
        break;
      case 2:
        this.p.y = Math.max(0, this.p.y - 1);
        break;
      case 3:
        this.p.y = Math.min(this.level.height - 1, this.p.y + 1);
        break;
    }
  }
}

export class TargetingEnemy extends Entity {
  // Can use these or define a function. Relative to this thing.
  public staticMovePossibilities: Point[] = [];

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

  move() {
    // Move towards closest player
    const closestPlayer = this.getClosestPlayer();
    if (!closestPlayer) return;

    let bestMove: Point | null = null;
    let bestDist = Infinity;
    for (const move of this.getMovePossibilities()) {
      const newP = Points.add(this.p, move);
      if (!this.level.inBound(newP)) {
        continue;
      }

      const dx = closestPlayer.p.x - newP.x;
      const dy = closestPlayer.p.y - newP.y;
      // Taxicab distance
      const dist = Math.abs(dx) + Math.abs(dy);

      if (dist < bestDist) {
        bestDist = dist;
        bestMove = move;
      }
    }

    if (bestMove) {
      // TODO: This will need to attack things somehow.
      Points.addTo(this.p, bestMove);
    }
  }
}
