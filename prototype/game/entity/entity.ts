import { Level } from "../level.ts";
import { Dirs, Points, type Point } from "../../lib/common.ts";
import type { Action } from "../action.ts";

export class Entity {
  public p: Point = { x: 0, y: 0 };

  public level: Level;

  public char = "Ⓜ️";

  constructor(level: Level) {
    this.level = level;
  }

  move() {
    // Implemented by subclass.
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
    this.p = newP;
  }
}
