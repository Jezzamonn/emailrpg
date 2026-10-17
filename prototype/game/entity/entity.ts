import { Level } from "../level.ts";
import type { Point } from "../../lib/common.ts";

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
}
