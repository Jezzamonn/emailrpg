import { Entity } from "./entity/entity.ts";
import type { Player } from "./entity/player.ts";
import { seededRandom } from "./lib/util.ts";
import type { Point } from "./lib/common.ts";
import { Surface, rgba } from "./lib/surface.ts";

export class Level {
  public width: number;
  public height: number;
  public name?: string;
  public dungeonId?: number;
  public playerStart?: Point;

  public entities: Entity[] = [];
  public rng: () => number = seededRandom("are you a young den'ist?");

  public turnLog: string[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  hasEnemies(): boolean {
    return this.entities.some((e) => e.type === "enemy");
  }

  next() {
    for (const entity of this.entities) {
      entity.move();
    }
  }

  entitiesAt(p: Point): Entity[] {
    return this.entities.filter((e) => e.p.x === p.x && e.p.y === p.y);
  }

  renderText(forPlayer?: Player): string {
    let output = "";
    const labelWidth = 3;

    // Render Letter chess style.
    output += " ".repeat(labelWidth); // Top-left corner spacing for the column letters
    for (let x = 0; x < this.width; x++) {
      output += ` ${String.fromCharCode(65 + x)}`;
    }
    output += "\n";

    // Chess goes up from 1 to 10, maybe do that?
    for (let y = 0; y < this.height; y++) {
      // Row number with constant width of 2 characters
      const row = (y + 1).toString().padStart(labelWidth, " ");
      output += `${row}`;
      for (let x = 0; x < this.width; x++) {
        const entitiesOnTile = this.entitiesAt({ x, y });
        if (entitiesOnTile.length === 0) {
          output += " .";
        } else {
          // When rendering, we pick one of the players on a tile (always preferring the player that we're rendering the game of)
          let picked: Entity;
          if (forPlayer && entitiesOnTile.some((e) => e === forPlayer)) {
            picked = forPlayer;
          } else {
            picked = entitiesOnTile.find((e) => e.type === "player") ?? entitiesOnTile[0];
          }
          output += picked.getText();
        }
      }
      output += "\n";
    }
    return output;
  }

  render(surface: Surface, tileSize: number = 16, frame: number = 0, forPlayer?: Player): void {
    // Draw background grid tiles
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const isAlt = (x + y) % 2 === 1;
        const tileColor = isAlt ? rgba(35, 35, 35) : rgba(45, 45, 45);
        surface.fillRect(x * tileSize, y * tileSize, tileSize, tileSize, tileColor);
      }
    }

    // Draw entities: pick one of the players on a tile (always preferring forPlayer)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const entitiesOnTile = this.entitiesAt({ x, y });
        if (entitiesOnTile.length === 0) continue;

        let picked: Entity;
        if (forPlayer && entitiesOnTile.some((e) => e === forPlayer)) {
          picked = forPlayer;
        } else {
          picked = entitiesOnTile.find((e) => e.type === "player") ?? entitiesOnTile[0];
        }
        picked.render(surface, tileSize, frame);
      }
    }
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
