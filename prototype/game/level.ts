import { Entity } from "./entity/entity.ts";
import { seededRandom } from "../lib/util.ts";
import type { Point } from "../lib/common.ts";
import { DiagEnemy, RandomThing, OrthoEnemy } from "./entity/enemy.ts";
import { Player } from "./entity/player.ts";

export class Level {
  public width: number;
  public height: number;

  public entities: Entity[] = [];
  public rng: () => number = seededRandom("are you a young den'ist?");

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  next() {
    for (const entity of this.entities) {
      entity.move();
    }
  }

  renderText(): string {
    let output = "";
    const labelWidth = 3;

    // Render Letter chess style.
    output += " ".repeat(labelWidth); // Top-left corner spacing for the column letters
    for (let x = 0; x < this.width; x++) {
      output += ` ${String.fromCharCode(65 + x)}`;
    }
    output += "\n";

    // TODO: Chess goes up from 1 to 10, maybe do that?
    for (let y = 0; y < this.height; y++) {
      // Row number with constant width of 2 characters
      const row = (y + 1).toString().padStart(labelWidth, " ");
      output += `${row}`;
      for (let x = 0; x < this.width; x++) {
        const entity = this.entities.find((e) => e.p.x === x && e.p.y === y);
        output += entity ? entity.getText() : " .";
      }
      output += "\n";
    }
    return output;
  }

  inBound(p: Point): boolean {
    return p.x >= 0 && p.x < this.width && p.y >= 0 && p.y < this.height;
  }

  entityAt(p: Point): Entity | undefined {
    return this.entities.find((e) => e.p.x === p.x && e.p.y === p.y);
  }

  addEntity(type: typeof Entity, x: number, y: number) {
    const entity = new type(this);
    entity.p.x = x;
    entity.p.y = y;
    this.entities.push(entity);
  }
}
