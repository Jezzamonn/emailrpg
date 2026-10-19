import { parseAction } from "./action.ts";
import { createDungeonForLevel } from "./dungeon.ts";
import { stepLevelEnemies } from "./enemy.ts";
import {
  type ClothesColor,
  type HairColor,
  type HairType,
  type PlayerAppearance,
  type SkinColor,
  entityGroupOf,
  getPortalTargetLevel,
} from "./entity.ts";
import {
  createHubLevel,
  levelEntitiesAt,
  levelHasEnemies,
  levelInBound,
  type LevelState,
} from "./level.ts";
import { Dirs, type Point, Points, parseColumnLetters } from "./lib/common.ts";

export type UserState = "awaiting_customization" | "active";

export interface PlayerState {
  email: string;
  state: UserState;
  appearance?: PlayerAppearance;
  p: Point;
  currentLevel?: LevelState;
}

export interface GameState {
  hubLevel: LevelState;
  // Map of player email to their state
  players: Record<string, PlayerState>;
}

export function createGame(): GameState {
  return {
    hubLevel: createHubLevel(),
    players: {},
  };
}

export type ResponseTemplate =
  | "newplayer"
  | "intro"
  | "turn"
  | "error"
  | "customization_error";

export interface ActionResponse {
  game: GameState;
  // Template for the response.
  template: ResponseTemplate;
  // Things that happened this turn, to tell the player about.
  messages: string[];
  additionalData: Record<string, string>;
}

export function doPlayerAction(
  game: GameState,
  address: string,
  emailContent: string,
): ActionResponse {
  // Work on a copy so the caller's game state is never modified.
  const newGame = structuredClone(game);

  const player = newGame.players[address];
  // If no player with the email: Add a new player!
  if (player == null) {
    addNewPlayer(newGame, address);
    return {
      game: newGame,
      template: "newplayer",
      messages: [],
      additionalData: {},
    };
  }

  // They've been asked what they look like, so this email is their answer.
  if (player.state === "awaiting_customization") {
    try {
      customizePlayer(newGame, player, emailContent);
    } catch (err) {
      return {
        game: newGame,
        template: "customization_error",
        messages: [],
        additionalData: { error: (err as Error).message },
      };
    }
    return {
      game: newGame,
      template: "intro",
      messages: [],
      additionalData: {},
    };
  }

  // Otherwise: Take the next action for that player.
  try {
    const messages = takePlayerTurn(newGame, player, emailContent);
    return { game: newGame, template: "turn", messages, additionalData: {} };
  } catch (err) {
    const errorMsg = (err as Error).message;
    return {
      game: newGame,
      template: "error",
      messages: [errorMsg],
      additionalData: { error: errorMsg },
    };
  }
}

export function getPlayerLevel(game: GameState, player: PlayerState): LevelState {
  return player.currentLevel ?? game.hubLevel;
}

function setPlayerLevel(
  game: GameState,
  player: PlayerState,
  level: LevelState,
): void {
  if (player.currentLevel) {
    player.currentLevel = level;
  } else {
    game.hubLevel = level;
  }
}

function addNewPlayer(game: GameState, address: string): void {
  // Players aren't placed in the world until they've said what they look like.
  game.players[address] = {
    email: address,
    state: "awaiting_customization",
    p: { x: 0, y: 0 },
  };
}

function customizePlayer(
  game: GameState,
  player: PlayerState,
  description: string,
): void {
  player.appearance = parseAppearance(description);
  player.state = "active";
  placePlayerInHub(game, player);
}

function placePlayerInHub(game: GameState, player: PlayerState): void {
  delete player.currentLevel;
  player.p = findUnoccupiedHubPosition(game.hubLevel);
  game.hubLevel.entities = game.hubLevel.entities.filter(
    (e) => e.playerId !== player.email,
  );
  game.hubLevel.entities.push({
    type: "player",
    p: { ...player.p },
    playerId: player.email,
    appearance: player.appearance,
  });
}

function takePlayerTurn(
  game: GameState,
  player: PlayerState,
  command: string,
): string[] {
  const action = parseAction(command);

  const level = getPlayerLevel(game, player);
  if (action.type === "move" && !action.isValid(levelHasEnemies(level))) {
    throw new Error(
      "Whoa there! With enemies around you can only move 2 spaces at a time.",
    );
  }

  const messages: string[] = [];

  let target: Point | undefined;
  if (action.type === "move") {
    target = Points.add(
      player.p,
      Points.scale(Dirs.toPoint(action.dir!), action.dist),
    );
    if (!levelInBound(level, target)) {
      throw new Error("You can't go that way, that's the edge of the world!");
    }
  } else if (action.type === "coord") {
    const colIndex = parseColumnLetters(action.coord!.col);
    const y = level.height - action.coord!.row;
    target = { x: colIndex, y };

    if (!levelInBound(level, target)) {
      throw new Error("You can't go that way, that's the edge of the world!");
    }

    if (levelHasEnemies(level)) {
      const dx = target.x - player.p.x;
      const dy = target.y - player.p.y;
      const isCardinal = (dx === 0 && dy !== 0) || (dy === 0 && dx !== 0);
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (!isCardinal || dist < 1 || dist > 2) {
        throw new Error("Whoa there! With enemies around you can only move 2 spaces at a time.");
      }
    }
  }

  if (target != null) {
    // Moving onto an enemy kills it.
    const killed = levelEntitiesAt(level, target).filter(
      (e) => entityGroupOf(e.type) === "enemy",
    );
    if (killed.length > 0) {
      level.entities = level.entities.filter((e) => !killed.includes(e));
      messages.push("You squash an enemy!");
    }

    // Check if player moved into a portal
    const portal = levelEntitiesAt(level, target).find(
      (e) => e.type === "portal",
    );
    if (portal) {
      const targetLevelStr = getPortalTargetLevel(portal) ?? "0";
      if (targetLevelStr.toLowerCase() === "hub") {
        placePlayerInHub(game, player);
      } else {
        const { level: newLevel, playerStart } =
          createDungeonForLevel(targetLevelStr);

        // Remove player from current level and hub level so they no longer show up in hub
        level.entities = level.entities.filter(
          (e) => e.playerId !== player.email,
        );
        game.hubLevel.entities = game.hubLevel.entities.filter(
          (e) => e.playerId !== player.email,
        );

        player.p = { ...playerStart };
        newLevel.entities.push({
          type: "player",
          p: { ...player.p },
          playerId: player.email,
          appearance: player.appearance,
        });
        player.currentLevel = newLevel;
      }

      return messages;
    }

    player.p = target;
    const playerEntity = level.entities.find(
      (e) => e.playerId === player.email,
    );
    if (playerEntity) {
      playerEntity.p = { ...target };
    }
  }

  // Then the enemies get their turn.
  const killedPlayerIds: string[] = [];
  const steppedLevel = stepLevelEnemies(level, (playerId) => {
    killedPlayerIds.push(playerId);
  });
  setPlayerLevel(game, player, steppedLevel);

  for (const killedId of killedPlayerIds) {
    const killedPlayer = game.players[killedId];
    if (killedPlayer) {
      placePlayerInHub(game, killedPlayer);
    }
    if (killedId === player.email) {
      messages.push("Oh no, you got got! You wake up back on the beach...");
    }
  }

  return messages;
}

const HAIR_TYPES: HairType[] = ["short", "ponytail", "bald"];
const HAIR_COLORS: HairColor[] = ["blonde", "brown", "black"];
const SKIN_COLORS: SkinColor[] = ["light", "medium", "dark"];
const CLOTHES_COLORS: ClothesColor[] = ["red", "blue", "green"];

function parseAppearance(description: string): PlayerAppearance {
  const words = description.toLowerCase().split(/[^a-z]+/);
  const find = <T extends string>(options: T[]): T | undefined =>
    options.find((o) => words.includes(o));

  const hairType = find(HAIR_TYPES);
  const hairColor = find(HAIR_COLORS);
  const skinColor = find(SKIN_COLORS);
  const clothesColor = find(CLOTHES_COLORS);

  const missing: string[] = [];
  if (!hairType) {
    missing.push(`hair style (${HAIR_TYPES.join(", ")})`);
  }
  if (hairType !== "bald" && !hairColor) {
    missing.push(`hair color (${HAIR_COLORS.join(", ")})`);
  }
  if (!skinColor) {
    missing.push(`skin color (${SKIN_COLORS.join(", ")})`);
  }
  if (!clothesColor) {
    missing.push(`clothes color (${CLOTHES_COLORS.join(", ")})`);
  }

  if (missing.length > 0) {
    throw new Error(
      `Could not understand what you look like! Please include your ${missing.join(", ")}.`,
    );
  }

  return {
    hairType: hairType!,
    hairColor: hairColor ?? HAIR_COLORS[0],
    skinColor: skinColor!,
    clothesColor: clothesColor!,
  };
}

function findUnoccupiedHubPosition(hubLevel: LevelState): Point {
  const midX = Math.floor(hubLevel.width / 2);
  const midY = Math.floor(hubLevel.height / 2);

  for (let r = 0; r <= Math.max(hubLevel.width, hubLevel.height); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = midX + dx;
        const y = midY + dy;
        if (
          levelInBound(hubLevel, { x, y }) &&
          levelEntitiesAt(hubLevel, { x, y }).length === 0
        ) {
          return { x, y };
        }
      }
    }
  }
  return { x: midX, y: midY };
}
