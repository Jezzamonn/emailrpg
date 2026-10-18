import { Entity } from "./entity.ts";
import type { EntityType } from "./entity.ts";
import { Surface, Colors } from "../lib/surface.ts";

import type { Point } from "../lib/common.ts";
import type { Level } from "../level.ts";

export class Player extends Entity {
  public char: string = "🤴";
  public email?: string;
  public override type: EntityType = "player";
  public spawnPoint: Point = { x: 0, y: 0 };

  override die() {
    super.die();
    // Respawn on death
    this.p = { ...this.spawnPoint };
    if (!this.level.entities.includes(this)) {
      this.level.entities.push(this);
    }
  }

  transitionToLevel(newLevel: Level, targetPos?: Point) {
    const oldIdx = this.level.entities.indexOf(this);
    if (oldIdx !== -1) {
      this.level.entities.splice(oldIdx, 1);
    }

    this.level = newLevel;
    if (targetPos) {
      this.p = { x: targetPos.x, y: targetPos.y };
    } else {
      this.p = {
        x: Math.floor(newLevel.width / 2),
        y: Math.floor(newLevel.height / 2),
      };
    }
    this.spawnPoint = { ...this.p };

    if (!newLevel.entities.includes(this)) {
      newLevel.entities.push(this);
    }
  }

  move() {
    // I guess player doesn't move here but moves separately?
  }

  override render(
    surface: Surface,
    tileSize: number = 16,
    frame: number = 0,
  ): void {
    const yOffset = frame === 1 ? -1 : 0;
    const px = this.p.x * tileSize;
    const py = this.p.y * tileSize + yOffset;
    surface.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4, Colors.Yellow);
    surface.strokeRect(
      px + 1,
      py + 1,
      tileSize - 2,
      tileSize - 2,
      Colors.White,
    );
  }
}
