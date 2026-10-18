import { Level } from "./level.ts";
import { KingPlayer, Player } from "./entity/player.ts";
import { type Action, parseActions } from "./action.ts";
import type { Point } from "./lib/common.ts";
import {
  createPregeneratedDungeon,
  PREGENERATED_DUNGEONS,
} from "./dungeon.ts";

export type UserState = "awaiting_customization" | "active";
export type UserLocation = "hub" | "dungeon";

export interface User {
  email: string;
  state: UserState;
  player?: Player;
  location: UserLocation;
  dungeonLevelIndex: number;
  dungeonLevel?: Level;
}

export class Game {
  public hubLevel: Level;
  public users: Map<string, User> = new Map();

  constructor() {
    this.hubLevel = makeHubLevel();
  }

  get currentLevel(): Level {
    for (const user of this.users.values()) {
      if (user.location === "dungeon" && user.dungeonLevel) {
        return user.dungeonLevel;
      }
    }
    return this.hubLevel;
  }

  set currentLevel(level: Level) {
    this.hubLevel = level;
  }

  getUser(email: string): User | undefined {
    return this.users.get(email.toLowerCase().trim());
  }

  getUserForPlayer(player: Player): User | undefined {
    if (player.email) {
      return this.getUser(player.email);
    }
    for (const user of this.users.values()) {
      if (user.player === player) return user;
    }
    return undefined;
  }

  getLevelForUser(email: string): Level {
    const user = this.getUser(email);
    if (user?.location === "dungeon" && user.dungeonLevel) {
      return user.dungeonLevel;
    }
    return user?.player?.level ?? this.hubLevel;
  }

  getLevelForPlayer(player: Player): Level {
    return player.level ?? this.hubLevel;
  }

  getAllPlayers(): Player[] {
    const players: Player[] = [];
    for (const entity of this.hubLevel.entities) {
      if (entity instanceof Player && !players.includes(entity)) {
        players.push(entity);
      }
    }
    for (const user of this.users.values()) {
      if (user.player && !players.includes(user.player)) {
        players.push(user.player);
      }
    }
    return players;
  }

  registerUser(email: string): User {
    const key = email.toLowerCase().trim();
    let user = this.users.get(key);
    if (!user) {
      user = {
        email: key,
        state: "awaiting_customization",
        location: "hub",
        dungeonLevelIndex: 0,
      };
      this.users.set(key, user);
    }
    return user;
  }

  findHubPosition(): Point {
    const midX = Math.floor(this.hubLevel.width / 2);
    const midY = Math.floor(this.hubLevel.height / 2);
    return { x: midX, y: midY };
  }

  findUnoccupiedPosition(): Point {
    const midX = Math.floor(this.hubLevel.width / 2);
    const midY = Math.floor(this.hubLevel.height / 2);

    for (let r = 0; r <= Math.max(this.hubLevel.width, this.hubLevel.height); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = midX + dx;
          const y = midY + dy;
          if (this.hubLevel.inBound({ x, y }) && !this.hubLevel.entityAt({ x, y })) {
            return { x, y };
          }
        }
      }
    }
    return { x: midX, y: midY };
  }

  createPlayerForUser(email: string, _customizationText: string = ""): Player {
    const user = this.registerUser(email);
    const pos = this.findUnoccupiedPosition();

    const existingPlayers = this.getAllPlayers();
    const letters = ["K", "Q", "A", "B", "C", "D", "E", "F"];
    const chars = ["🤴", "👸", "🧙", "🧝", "🧑‍🚀", "🦸", "🥷", "🧚"];
    const index = existingPlayers.length % letters.length;

    const player = new KingPlayer(this.hubLevel);
    player.email = user.email;
    player.letter = letters[index];
    player.char = chars[index];
    player.p = { x: pos.x, y: pos.y };
    player.spawnPoint = { x: pos.x, y: pos.y };

    this.hubLevel.entities.push(player);
    user.player = player;
    user.location = "hub";
    user.state = "active";
    return player;
  }

  enterDungeon(user: User): Level {
    if (!user.player) {
      throw new Error("User has no player to enter dungeon");
    }

    if (!user.dungeonLevel) {
      user.dungeonLevel = createPregeneratedDungeon(user.dungeonLevelIndex);
    }

    const startPos = user.dungeonLevel.playerStart ?? {
      x: Math.floor(user.dungeonLevel.width / 2),
      y: user.dungeonLevel.height - 1,
    };
    user.player.transitionToLevel(user.dungeonLevel, startPos);
    user.location = "dungeon";
    return user.dungeonLevel;
  }

  leaveDungeon(user: User): Level {
    if (!user.player) {
      throw new Error("User has no player to leave dungeon");
    }

    const pos = this.findHubPosition();
    user.player.transitionToLevel(this.hubLevel, pos);
    user.location = "hub";
    return this.hubLevel;
  }

  nextDungeonLevel(user: User): Level | undefined {
    if (!user.player) return undefined;

    user.dungeonLevelIndex = (user.dungeonLevelIndex + 1) % PREGENERATED_DUNGEONS.length;
    user.dungeonLevel = createPregeneratedDungeon(user.dungeonLevelIndex);

    const startPos = user.dungeonLevel.playerStart ?? {
      x: Math.floor(user.dungeonLevel.width / 2),
      y: user.dungeonLevel.height - 1,
    };
    user.player.transitionToLevel(user.dungeonLevel, startPos);
    user.location = "dungeon";
    return user.dungeonLevel;
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
    const action = actions[0];

    // Find the right player
    let player: Player | undefined;

    if (action.target) {
      player = this.getAllPlayers().find(
        (p) => p.letter.toLowerCase() === action.target?.toLowerCase()
      );
    }

    if (!player && forEmail) {
      const user = this.getUser(forEmail);
      player = user?.player;
    }

    // Fallback: if no target specified and only 1 player exists, use it
    if (!player) {
      const allPlayers = this.getAllPlayers();
      if (allPlayers.length === 1) {
        player = allPlayers[0];
      }
    }

    // Auto-create player for CLI prototype testing if none exists
    if (!player && !forEmail && this.getAllPlayers().length === 0) {
      player = this.createPlayerForUser("player@example.com");
    }

    if (!player) {
      console.error(`Couldn't find target player for command: ${command}`);
      return false;
    }

    const user = this.getUserForPlayer(player);

    if (action.type === "dungeon") {
      if (user) {
        this.enterDungeon(user);
        return true;
      }
      return false;
    }

    if (action.type === "hub") {
      if (user) {
        this.leaveDungeon(user);
        return true;
      }
      return false;
    }

    if (action.type === "next") {
      if (user && user.dungeonLevel) {
        if (user.dungeonLevel.hasEnemies()) {
          console.error("Cannot proceed to next dungeon level while enemies remain.");
          return false;
        }
        this.nextDungeonLevel(user);
        return true;
      }
      return false;
    }

    if (action.type === "wait") {
      player.level.next();
      return true;
    }

    // Movement command:
    // If there are enemies in the level, player movement is limited to 2 squares in each direction.
    // If there are none, players may move freely.
    if (player.level.hasEnemies() && action.dist > 2) {
      console.error(
        `Movement limited to 2 squares when enemies are present (requested ${action.dist}).`
      );
      return false;
    }

    try {
      const moved = player.applyAction(action);
      if (!moved) {
        return false;
      }
    } catch (error) {
      console.error(`${error}`);
      return false;
    }

    // Advance turn for enemies in player's current level
    player.level.next();
    return true;
  }
}

function makeHubLevel(): Level {
  // Empty 11 x 11 hub world with no enemies
  const hub = new Level(11, 11);
  hub.name = "Hub World";
  return hub;
}
