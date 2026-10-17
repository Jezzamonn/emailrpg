import { Level } from "../level.ts";

export class Entity {
  public x: number = 0;
  public y: number = 0;

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
