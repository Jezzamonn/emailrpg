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
import { choose } from "./lib/util.ts";

export type UserState =
  | "awaiting_customization"
  | "active"
  | "dead";

export interface PlayerState {
  email: string;
  state: UserState;
  appearance?: PlayerAppearance;
  p: Point;
  currentLevel?: LevelState;
  currentLevelName?: string;
  initialLevel?: LevelState;
  initialP?: Point;
  completedLevels: string[];
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
  games: GameState[];
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
  const player = game.players[address];
  // If no player with the email: Add a new player!
  if (player == null) {
    const newGame = addNewPlayer(game, address);
    return {
      games: [newGame],
      template: "newplayer",
      messages: [],
      additionalData: {},
    };
  }

  // Responding to customization
  if (player.state === "awaiting_customization") {
    let newGame: GameState;
    try {
      newGame = customizePlayer(game, address, emailContent);
    } catch (err) {
      return {
        games: [game],
        template: "customization_error",
        messages: [],
        additionalData: { error: (err as Error).message },
      };
    }
    return {
      games: [newGame],
      template: "intro",
      messages: [],
      additionalData: {},
    };
  }

  // Otherwise: Take the next action for that player.
  try {
    const { messages, games } = takePlayerTurn(game, address, emailContent);
    return { games, template: "turn", messages, additionalData: {} };
  } catch (err) {
    const errorMsg = (err as Error).message;
    return {
      games: [game],
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

function addNewPlayer(game: GameState, address: string): GameState {
  const newGame = structuredClone(game);
  // Players aren't placed in the world until they've said what they look like.
  newGame.players[address] = {
    email: address,
    state: "awaiting_customization",
    p: { x: 0, y: 0 },
    completedLevels: [],
  };
  return newGame;
}

function customizePlayer(
  game: GameState,
  address: string,
  description: string,
): GameState {
  const appearance = parseAppearance(description);
  const newGame = structuredClone(game);
  const player = newGame.players[address]!;
  player.appearance = appearance;
  player.state = "active";
  return placePlayerInHub(newGame, address);
}

function placePlayerInHub(game: GameState, address: string): GameState {
  const newGame = structuredClone(game);
  const player = newGame.players[address]!;
  player.state = "active";
  delete player.currentLevel;
  delete player.currentLevelName;
  delete player.initialLevel;
  delete player.initialP;
  player.p = findUnoccupiedHubPosition(newGame.hubLevel);
  newGame.hubLevel.entities = newGame.hubLevel.entities.filter(
    (e) => e.playerId !== player.email,
  );
  newGame.hubLevel.entities.push({
    type: "player",
    p: { ...player.p },
    playerId: player.email,
    appearance: player.appearance,
  });
  return newGame;
}

function enterDungeon(
  game: GameState,
  address: string,
  targetLevelStr: string,
): GameState {
  const newGame = structuredClone(game);
  const player = newGame.players[address]!;
  const { level: newLevel, playerStart } =
    createDungeonForLevel(targetLevelStr);

  const currentLevel = getPlayerLevel(newGame, player);
  // Remove player from current level and hub level so they no longer show up in hub
  currentLevel.entities = currentLevel.entities.filter(
    (e) => e.playerId !== player.email,
  );
  newGame.hubLevel.entities = newGame.hubLevel.entities.filter(
    (e) => e.playerId !== player.email,
  );

  player.state = "active";
  player.p = { ...playerStart };
  newLevel.entities.push({
    type: "player",
    p: { ...player.p },
    playerId: player.email,
    appearance: player.appearance,
  });
  player.currentLevel = newLevel;
  player.currentLevelName = newLevel.name ?? targetLevelStr;
  player.initialLevel = structuredClone(newLevel);
  player.initialP = { ...player.p };
  return newGame;
}

function restartPlayerLevel(game: GameState, address: string): GameState {
  const newGame = structuredClone(game);
  const player = newGame.players[address]!;
  player.state = "active";
  if (player.initialLevel) {
    const restoredLevel = structuredClone(player.initialLevel);
    const existingPlayer = restoredLevel.entities.find(
      (e) => e.type === "player" && e.playerId === player.email,
    );
    if (existingPlayer) {
      player.p = { ...existingPlayer.p };
      existingPlayer.appearance = player.appearance;
    } else {
      if (player.initialP) {
        player.p = { ...player.initialP };
      }
      restoredLevel.entities.push({
        type: "player",
        p: { ...player.p },
        playerId: player.email,
        appearance: player.appearance,
      });
    }
    player.currentLevel = restoredLevel;
    return newGame;
  }

  const levelName = player.currentLevelName ?? player.currentLevel?.name;
  if (levelName != null) {
    return enterDungeon(newGame, address, levelName);
  }

  if (player.currentLevel) {
    const existingPlayer = player.currentLevel.entities.find(
      (e) => e.type === "player" && e.playerId === player.email,
    );
    if (!existingPlayer) {
      player.currentLevel.entities.push({
        type: "player",
        p: { ...player.p },
        playerId: player.email,
        appearance: player.appearance,
      });
    }
    player.initialLevel = structuredClone(player.currentLevel);
    player.initialP = { ...player.p };
    return newGame;
  }

  return enterDungeon(newGame, address, "0");
}

function takePlayerTurn(
  game: GameState,
  address: string,
  command: string,
): { messages: string[]; games: GameState[] } {
  const newGame = structuredClone(game);
  const player = newGame.players[address]!;

  if (player.state === "dead") {
    let action;
    try {
      action = parseAction(command);
    } catch {
      throw new Error(
        'You died! You must choose to "restart" the level or "exit" to the island.',
      );
    }
    if (action.type === "restart") {
      return { messages: [], games: [restartPlayerLevel(newGame, address)] };
    }
    if (action.type === "exit") {
      return { messages: [], games: [placePlayerInHub(newGame, address)] };
    }
    throw new Error(
      'You died! You must choose to "restart" the level or "exit" to the island.',
    );
  }

  const action = parseAction(command);

  if (action.type === "restart") {
    if (!player.currentLevel) {
      throw new Error(
        `Something's wrong with that command: "${command.trim()}". Try something like "up 2", "a1" or "wait".`,
      );
    }
    return { messages: [], games: [restartPlayerLevel(newGame, address)] };
  }

  if (action.type === "exit") {
    if (!player.currentLevel) {
      throw new Error(
        `Something's wrong with that command: "${command.trim()}". Try something like "up 2", "a1" or "wait".`,
      );
    }
    return { messages: [], games: [placePlayerInHub(newGame, address)] };
  }

  if (player.currentLevel && !player.initialLevel) {
    player.initialLevel = structuredClone(player.currentLevel);
    player.initialP = { ...player.p };
  }

  const level = getPlayerLevel(newGame, player);
  const hadEnemies = levelHasEnemies(level);
  if (action.type === "move" && !action.isValid(hadEnemies)) {
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

    if (hadEnemies) {
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
      const nextGame =
        targetLevelStr.toLowerCase() === "hub"
          ? placePlayerInHub(newGame, address)
          : enterDungeon(newGame, address, targetLevelStr);

      return { messages, games: [nextGame] };
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
  const killedPlayerIds = new Set<string>();
  const steppedLevel = stepLevelEnemies(level, (playerId) => {
    killedPlayerIds.add(playerId);
  });

  for (const killedId of killedPlayerIds) {
    steppedLevel.entities = steppedLevel.entities.filter(
      (e) => !(e.type === "player" && e.playerId === killedId),
    );
    const killedPlayer = newGame.players[killedId];
    if (killedPlayer) {
      killedPlayer.state = "dead";
    }
    if (killedId === player.email) {
      messages.push(
        'Oh no, you died! Reply "restart" to restart the level, or "exit" to go back to the island.',
      );
    }
  }

  setPlayerLevel(newGame, player, steppedLevel);

  if (
    player.currentLevel &&
    hadEnemies &&
    !levelHasEnemies(steppedLevel) &&
    killedPlayerIds.size === 0
  ) {
    const completedLevelName =
      player.currentLevelName ?? steppedLevel.name ?? "Dungeon";
    player.completedLevels ??= [];
    if (!player.completedLevels.includes(completedLevelName)) {
      player.completedLevels.push(completedLevelName);
    }
    messages.push(
      `You beat ${completedLevelName}! You got the reward for ${completedLevelName}!`,
    );
    const hubGame = placePlayerInHub(newGame, address);
    return { messages, games: [newGame, hubGame] };
  }

  return { messages, games: [newGame] };
}

const HAIR_TYPES: HairType[] = ["short", "ponytail", "bald"];
const HAIR_COLORS: HairColor[] = ["blonde", "brown", "black"];
const SKIN_COLORS: SkinColor[] = ["light", "medium", "dark"];
const CLOTHES_COLORS: ClothesColor[] = ["red", "blue", "green"];

function parseAppearance(description: string): PlayerAppearance {
  const words = description.toLowerCase().split(/[^a-z]+/);
  const find = <T extends string>(options: T[]): T | undefined =>
    options.find((o) => words.includes(o));

  let hairType: HairType | undefined;
  let hairColor: HairColor | undefined;
  let skinColor: SkinColor | undefined;
  let clothesColor: ClothesColor | undefined;

  if (words.includes("whatever")) {
    // Random player
    hairType = choose(HAIR_TYPES);
    hairColor = choose(HAIR_COLORS);
    skinColor = choose(SKIN_COLORS);
    clothesColor = choose(CLOTHES_COLORS);
  } else {
    hairType = find(HAIR_TYPES);
    hairColor = find(HAIR_COLORS);
    skinColor = find(SKIN_COLORS);
    clothesColor = find(CLOTHES_COLORS);

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
      throw new Error(`${missing.join(", ")}`);
    }
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
