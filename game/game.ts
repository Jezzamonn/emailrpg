import { Level } from "./level.ts";
import { KingPlayer, Player } from "./entity/player.ts";
import { DiagEnemy, OrthoEnemy, RandomThing } from "./entity/enemy.ts";
import { type Action, parseActions } from "./action.ts";

export class Game {
  public currentLevel: Level;

  constructor() {
    this.currentLevel = makeLevel();
  }

  processCommand(command: string) {
    // Handle command
    let actions: Action[];
    try {
      actions = parseActions(command);
    } catch (error) {
      console.error(`${error}`);
      return;
    }

    // Just handle 1 action so far?
    // Find the right player
    const player = this.currentLevel.entities.find(
      (entity) =>
        entity instanceof Player &&
        entity.letter.toLowerCase() === actions[0].target?.toLowerCase(),
    ) as Player | undefined;

    if (!player) {
      console.error(`Couldn't find anything called ${actions[0].target}`);
      return;
    }

    try {
      player.applyAction(actions[0]);
    } catch (error) {
      console.error(`${error}`);
    }

    // Next level state
    this.currentLevel.next();
  }
}

function makeLevel(): Level {
  const level = new Level(9, 9);
  level.addEntity(KingPlayer, 4, 8);
  level.addEntity(DiagEnemy, 3, 3);
  level.addEntity(OrthoEnemy, 7, 3);
  level.addEntity(RandomThing, 1, 1);
  return level;
}
