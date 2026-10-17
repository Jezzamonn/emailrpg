import { Entity } from "./entity.ts";
import type { EntityType } from "./entity.ts";

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
}

export class QueenPlayer extends Player {
  public char: string = "👸";
  public letter = "Q";
}