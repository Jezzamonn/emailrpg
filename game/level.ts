import { Entity } from "./entity/entity.ts";
import type { Player } from "./entity/player.ts";
import { seededRandom } from "./lib/util.ts";
import type { Point } from "./lib/common.ts";
import { Surface, rgba } from "./lib/surface.ts";
import { getBanterFont } from "./lib/font.ts";

export interface LevelRenderOptions {
  showCoordinates?: boolean;
  coordinateSides?: "all" | "bottom-left";
  fontColor?: number;
  borderColor?: number;
  forPlayer?: Player;
}

function getColumnLetter(colIndex: number): string {
  let s = "";
  let n = colIndex;
  while (n >= 0) {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

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

  render(
    surface: Surface,
    tileSize: number = 16,
    frame: number = 0,
    optionsOrPlayer: LevelRenderOptions | Player = {},
    forPlayerArg?: Player
  ): void {
    const options: LevelRenderOptions =
      typeof optionsOrPlayer === "object" && optionsOrPlayer !== null && "render" in optionsOrPlayer
        ? {}
        : (optionsOrPlayer as LevelRenderOptions);
    const forPlayer =
      forPlayerArg ??
      (optionsOrPlayer !== null && typeof optionsOrPlayer === "object" && "render" in optionsOrPlayer
        ? (optionsOrPlayer as Player)
        : options.forPlayer);

    const showCoordinates =
      options.showCoordinates ??
      (surface.width > this.width * tileSize || surface.height > this.height * tileSize);

    const coordinateSides =
      options.coordinateSides ??
      (surface.width >= (this.width + 2) * tileSize && surface.height >= (this.height + 2) * tileSize
        ? "all"
        : "bottom-left");

    const borderColor = options.borderColor ?? rgba(24, 24, 24);
    const fontColor = options.fontColor ?? rgba(180, 180, 180);

    let offsetX = 0;
    let offsetY = 0;

    if (showCoordinates) {
      if (coordinateSides === "all") {
        offsetX = tileSize;
        offsetY = tileSize;
      } else {
        offsetX = tileSize;
        offsetY = 0;
      }
      surface.clear(borderColor);
    }

    const boardW = this.width * tileSize;
    const boardH = this.height * tileSize;
    const boardSurface = new Surface(boardW, boardH);

    // Draw background grid tiles
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const isAlt = (x + y) % 2 === 1;
        const tileColor = isAlt ? rgba(35, 35, 35) : rgba(45, 45, 45);
        boardSurface.fillRect(x * tileSize, y * tileSize, tileSize, tileSize, tileColor);
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
        picked.render(boardSurface, tileSize, frame);
      }
    }

    surface.drawSurface(boardSurface, offsetX, offsetY);

    // Render outside coordinates with banter font if requested
    if (showCoordinates) {
      const font = getBanterFont();

      // Numbers start at 1 at the bottom and go up (like chess ranks)
      for (let y = 0; y < this.height; y++) {
        const rowNumber = (this.height - y).toString();
        const metrics = font.measureText(rowNumber);
        const rowY = offsetY + y * tileSize;

        // Left border
        const leftX = Math.floor((tileSize - metrics.width) / 2);
        font.drawText(surface, rowNumber, leftX, rowY, fontColor);

        // Right border (if all sides)
        if (coordinateSides === "all") {
          const rightX = offsetX + boardW + Math.floor((tileSize - metrics.width) / 2);
          font.drawText(surface, rowNumber, rightX, rowY, fontColor);
        }
      }

      // Letters go from a onwards starting at the left (like chess files)
      for (let x = 0; x < this.width; x++) {
        const colLetter = getColumnLetter(x);
        const metrics = font.measureText(colLetter);
        const colX = offsetX + x * tileSize + Math.floor((tileSize - metrics.width) / 2);

        // Bottom border
        const bottomY = offsetY + boardH;
        font.drawText(surface, colLetter, colX, bottomY, fontColor);

        // Top border (if all sides)
        if (coordinateSides === "all") {
          font.drawText(surface, colLetter, colX, 0, fontColor);
        }
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
