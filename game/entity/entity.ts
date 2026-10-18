import { Level } from "../level.ts";
import { Dirs, Points, type Point } from "../lib/common.ts";
import type { Action } from "../action.ts";

export type EntityType = "player" | "enemy" | "obstacle";

export const killable: Map<EntityType, Set<EntityType>> = new Map();
killable.set("enemy", new Set(["player"]));
killable.set("player", new Set(["enemy"]));
killable.set("obstacle", new Set());

export class Entity {
  public p: Point = { x: 0, y: 0 };

  public level: Level;

  public char = "Ⓜ️";
  public type: EntityType = "obstacle";

  constructor(level: Level) {
    this.level = level;
  }

  die() {
    const index = this.level.entities.indexOf(this);
    if (index !== -1) {
      this.level.entities.splice(index, 1);
    }
    console.log(`DIED!!! ${this.constructor.name}`);
  }

  move() {
    // Implemented by subclass.
  }

  canKill(other: Entity): boolean {
    return killable.get(this.type)?.has(other.type) ?? false;
  }

  // Internalish method that handles taking and stuff
  moveTo(p: Point): boolean {
    if (!this.level.inBound(p)) {
      console.log("MoveTo position out of bounds:", p);
      return false;
    }

    const entityAtTarget = this.level.entityAt(p);
    if (entityAtTarget) {
      // Check if we can kill it
      if (killable.get(this.type)?.has(entityAtTarget.type)) {
        entityAtTarget.die();
      } else {
        console.log(
          "Cannot move to position, entity is not killable:",
          entityAtTarget,
        );
        return false;
      }
    }

    this.p = p;
    return true;
  }

  getText(): string {
    return this.char;
  }

  applyAction(action: Action) {
    const { dir, dist } = action;
    if (dir == undefined) {
      console.log("No direction specified in action.");
      return;
    }

    if (dist == 0) {
      console.log("Distance is zero in action.");
      return;
    }

    const dirPoint = Dirs.toPoint(dir);
    const newP = Points.add(this.p, Points.scale(dirPoint, dist));

    if (!this.level.inBound(newP)) {
      // Should probably be an error or something.
      console.log("New position out of bounds:", newP);
      return;
    }

    // TODO: Should log something if we can't move?

    const moved = this.moveTo(newP);
    if (!moved) {
      console.log("Failed to move to new position:", newP);
    }
  }
}
