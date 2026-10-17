import { Level } from "./level.ts";
import { KingPlayer, Player } from "./entity/player.ts";
import { DiagEnemy, OrthoEnemy, RandomThing } from "./entity/enemy.ts";
import { Dirs } from "../lib/common.ts";
import { parseActions } from "./action.ts";

export class Game {
  public currentLevel: Level;

  constructor() {
    this.currentLevel = makeLevel();
  }

  processCommand(command: string) {
    // Handle command
    const actions = parseActions(command);

    // Just handle 1 action so far?
    // Find the right player
    const player = this.currentLevel.entities.find(
      (entity) =>
        entity instanceof Player &&
        entity.letter.toLowerCase() === actions[0].target?.toLowerCase(),
    ) as Player | undefined;

    if (!player) {
      throw new Error(`Couldn't find anything called ${actions[0].target}`);
    }

    player.applyAction(actions[0]);

    // Next level state
    this.currentLevel.next();
  }
}

function makeLevel(): Level {
  const level = new Level(11, 11);
  level.addEntity(KingPlayer, 5, 10);
  level.addEntity(DiagEnemy, 3, 3);
  level.addEntity(OrthoEnemy, 7, 3);
  level.addEntity(RandomThing, 1, 1);
  return level;
}
