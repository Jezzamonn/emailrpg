import { Entity } from "./entity/entity.ts";
import { seededRandom } from "./lib/util.ts";

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

    for (let y = 0; y < this.height; y++) {
      // Row number with constant width of 2 characters
      const row = (y + 1).toString().padStart(labelWidth, " ");
      output += `${row}`;
      for (let x = 0; x < this.width; x++) {
        const entity = this.entities.find((e) => e.x === x && e.y === y);
        output += entity ? entity.getText() : " .";
      }
      output += "\n";
    }
    return output;
  }
}

export function makeLevel(): Level {
  const level = new Level(10, 10);
  for (let i = 0; i < 3; i++) {
    const entity = new Entity(level);
    entity.x = Math.floor(Math.random() * level.width);
    entity.y = Math.floor(Math.random() * level.height);
    level.entities.push(entity);
  }
  return level;
}
