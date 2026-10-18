import { Entity } from "./entity.ts";
import type { EntityType } from "./entity.ts";
import { Surface, Colors } from "../lib/surface.ts";

export class Player extends Entity {
  public letter = "";
  public type: EntityType = "player";

  move() {
    // I guess player doesn't move here but moves separately?
  }
}

export class KingPlayer extends Player {
  public char: string = "🤴";
  public letter = "K";

  override render(surface: Surface, tileSize: number = 16, frame: number = 0): void {
    const yOffset = frame === 1 ? -1 : 0;
    const px = this.p.x * tileSize;
    const py = this.p.y * tileSize + yOffset;
    surface.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4, Colors.Yellow);
    surface.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2, Colors.White);
  }
}

export class QueenPlayer extends Player {
  public char: string = "👸";
  public letter = "Q";

  override render(surface: Surface, tileSize: number = 16, frame: number = 0): void {
    const yOffset = frame === 1 ? -1 : 0;
    const px = this.p.x * tileSize;
    const py = this.p.y * tileSize + yOffset;
    surface.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4, Colors.Yellow);
  }
}