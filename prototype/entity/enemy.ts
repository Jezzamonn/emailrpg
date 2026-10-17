import { Entity } from "./entity.ts";

export class RandomThing extends Entity {
  public char = "🐑";

  move() {
    // Random movement for now.
    const direction = Math.floor(this.level.rng() * 4);
    switch (direction) {
      case 0:
        this.x = Math.max(0, this.x - 1);
        break;
      case 1:
        this.x = Math.min(this.level.width - 1, this.x + 1);
        break;
      case 2:
        this.y = Math.max(0, this.y - 1);
        break;
      case 3:
        this.y = Math.min(this.level.height - 1, this.y + 1);
        break;
    }
  }
}

export class Enemy extends Entity {}
