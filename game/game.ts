import { Level } from "./level.ts";
import { KingPlayer, Player } from "./entity/player.ts";
import { type Action, parseActions } from "./action.ts";
import type { Point } from "./lib/common.ts";

export type UserState = "awaiting_customization" | "active";

export interface User {
  email: string;
  state: UserState;
  player?: Player;
}

export class Game {
  public currentLevel: Level;
  public users: Map<string, User> = new Map();

  constructor() {
    this.currentLevel = makeLevel();
  }

  getUser(email: string): User | undefined {
    return this.users.get(email.toLowerCase().trim());
  }

  registerUser(email: string): User {
    const key = email.toLowerCase().trim();
    let user = this.users.get(key);
    if (!user) {
      user = {
        email: key,
        state: "awaiting_customization",
      };
      this.users.set(key, user);
    }
    return user;
  }

  findUnoccupiedPosition(): Point {
    const midX = Math.floor(this.currentLevel.width / 2);
    const midY = Math.floor(this.currentLevel.height / 2);

    for (let r = 0; r <= Math.max(this.currentLevel.width, this.currentLevel.height); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = midX + dx;
          const y = midY + dy;
          if (this.currentLevel.inBound({ x, y }) && !this.currentLevel.entityAt({ x, y })) {
            return { x, y };
          }
        }
      }
    }
    return { x: 0, y: 0 };
  }

  createPlayerForUser(email: string, _customizationText: string = ""): Player {
    const user = this.registerUser(email);
    const pos = this.findUnoccupiedPosition();

    const existingPlayers = this.currentLevel.entities.filter(
      (e): e is Player => e instanceof Player
    );
    const letters = ["K", "Q", "A", "B", "C", "D", "E", "F"];
    const chars = ["🤴", "👸", "🧙", "🧝", "🧑‍🚀", "🦸", "🥷", "🧚"];
    const index = existingPlayers.length % letters.length;

    const player = new KingPlayer(this.currentLevel);
    player.email = user.email;
    player.letter = letters[index];
    player.char = chars[index];
    player.p = { x: pos.x, y: pos.y };

    this.currentLevel.entities.push(player);
    user.player = player;
    user.state = "active";
    return player;
  }

  processCommand(command: string, forEmail?: string): boolean {
    let actions: Action[];
    try {
      actions = parseActions(command);
    } catch (error) {
      console.error(`${error}`);
      return false;
    }

    if (actions.length === 0) return false;

    // Find the right player
    let player: Player | undefined;

    if (actions[0].target) {
      player = this.currentLevel.entities.find(
        (entity): entity is Player =>
          entity instanceof Player &&
          entity.letter.toLowerCase() === actions[0].target?.toLowerCase()
      );
    }

    if (!player && forEmail) {
      const user = this.getUser(forEmail);
      player = user?.player;
    }

    // Fallback: if no target specified and only 1 player exists, use it
    if (!player) {
      const players = this.currentLevel.entities.filter(
        (e): e is Player => e instanceof Player
      );
      if (players.length === 1) {
        player = players[0];
      }
    }

    if (!player) {
      console.error(`Couldn't find target player for command: ${command}`);
      return false;
    }

    try {
      player.applyAction(actions[0]);
    } catch (error) {
      console.error(`${error}`);
      return false;
    }

    // Next level state
    this.currentLevel.next();
    return true;
  }
}

function makeLevel(): Level {
  // Empty 11 x 11 hub world
  return new Level(11, 11);
}
