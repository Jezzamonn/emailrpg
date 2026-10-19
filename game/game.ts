import { describeAction, parseAction } from "./action.ts";
import {
  createDungeonForLevel,
  getDungeonDefinition,
  isLevelUnlocked,
} from "./dungeon.ts";
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
  | "awaiting_name"
  | "awaiting_customization"
  | "active"
  | "dead";

export interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
}

export interface PlayerState {
  email: string;
  name?: string;
  state: UserState;
  appearance?: PlayerAppearance;
  p: Point;
  currentLevel?: LevelState;
  currentLevelName?: string;
  initialLevel?: LevelState;
  initialP?: Point;
  completedLevels: string[];
  // Levels the player has entered at least once.
  enteredLevels?: string[];
  // Timestamp of when chat messages were last sent to this player.
  lastChatTimestamp?: number;
}

export interface GameState {
  hubLevel: LevelState;
  // Map of player email to their state
  players: Record<string, PlayerState>;
  // Logged chat messages in the hub world
  chatMessages: ChatMessage[];
}

export function createGame(): GameState {
  return {
    hubLevel: createHubLevel(),
    players: {},
    chatMessages: [],
  };
}

export type ResponseTemplate =
  | "newplayer"
  | "customization"
  | "intro"
  | "turn"
  | "error"
  | "customization_error"
  | "level_enter"
  | "level_complete";

export interface ActionResponse {
  games: GameState[];
  // Template for the response.
  template: ResponseTemplate;
  // Things that happened this turn, to tell the player about.
  messages: string[];
  // Recent chat messages to include when sending the state of the overworld.
  chatMessages?: ChatMessage[];
  // What the player just did, e.g. "You move left 2 squares."
  actionDescription?: string;
  additionalData: Record<string, string>;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const MAX_RECENT_CHAT_MESSAGES = 10;

let lastGeneratedTimestamp = 0;

function resolveTimestamp(now?: number): number {
  if (now !== undefined) {
    return now;
  }
  const current = Date.now();
  lastGeneratedTimestamp = Math.max(current, lastGeneratedTimestamp + 1);
  return lastGeneratedTimestamp;
}

function collectOverworldChatMessages(
  game: GameState,
  address: string,
  timestamp: number,
): ChatMessage[] {
  const player = game.players[address]!;
  const lastSent = player.lastChatTimestamp;
  const cutoff = timestamp - SIX_HOURS_MS;
  const allMessages = game.chatMessages ?? [];

  const recent = allMessages
    .filter(
      (msg) =>
        msg.timestamp >= cutoff &&
        (lastSent == null || msg.timestamp > lastSent),
    )
    .slice(-MAX_RECENT_CHAT_MESSAGES);

  player.lastChatTimestamp = timestamp;
  return recent;
}

export function doPlayerAction(
  game: GameState,
  address: string,
  emailContent: string,
  now?: number,
): ActionResponse {
  const timestamp = resolveTimestamp(now);
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

  // Responding with name
  if (player.state === "awaiting_name") {
    const newGame = setPlayerName(game, address, emailContent);
    return {
      games: [newGame],
      template: "customization",
      messages: [],
      additionalData: { name: newGame.players[address]!.name ?? "" },
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
    const chatMessages = collectOverworldChatMessages(
      newGame,
      address,
      timestamp,
    );
    return {
      games: [newGame],
      template: "intro",
      messages: [],
      chatMessages,
      additionalData: {},
    };
  }

  // Otherwise: Take the next action for that player.
  try {
    const { messages, games, template, level, actionDescription } = takePlayerTurn(
      game,
      address,
      emailContent,
      timestamp,
    );
    const lastGame = games[games.length - 1]!;
    const lastPlayer = lastGame.players[address]!;
    let chatMessages: ChatMessage[] | undefined;
    if (!lastPlayer.currentLevel) {
      chatMessages = collectOverworldChatMessages(
        lastGame,
        address,
        timestamp,
      );
    }
    return {
      games,
      template: template ?? "turn",
      messages,
      chatMessages,
      actionDescription,
      additionalData: level != null ? { level } : {},
    };
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
  // Players aren't placed in the world until they've given their name and said what they look like.
  newGame.players[address] = {
    email: address,
    state: "awaiting_name",
    p: { x: 0, y: 0 },
    completedLevels: [],
  };
  return newGame;
}

function setPlayerName(
  game: GameState,
  address: string,
  emailContent: string,
): GameState {
  const newGame = structuredClone(game);
  const player = newGame.players[address]!;
  const firstLine = emailContent.trim().split(/\r?\n/)[0]?.trim() ?? "";
  player.name = firstLine || address.split("@")[0] || address;
  player.state = "awaiting_customization";
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

interface TurnResult {
  messages: string[];
  games: GameState[];
  // Overrides the default "turn" template, e.g. for entering or beating a level.
  template?: ResponseTemplate;
  // Dungeon name the template is about.
  level?: string;
  actionDescription?: string;
}

function takePlayerTurn(
  game: GameState,
  address: string,
  command: string,
  timestamp: number,
): TurnResult {
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
      return {
        messages: [],
        games: [restartPlayerLevel(newGame, address)],
        actionDescription: describeAction(action),
      };
    }
    if (action.type === "exit") {
      return {
        messages: [],
        games: [placePlayerInHub(newGame, address)],
        actionDescription: describeAction(action),
      };
    }
    throw new Error(
      'You died! You must choose to "restart" the level or "exit" to the island.',
    );
  }

  const action = parseAction(command);

  if (action.type === "say") {
    if (player.currentLevel) {
      throw new Error(
        `Something's wrong with that command: "${command.trim()}". You can only chat in the hub world!`,
      );
    }
    newGame.chatMessages ??= [];
    newGame.chatMessages.push({
      sender: player.name || player.email,
      message: action.message!,
      timestamp,
    });
    return { messages: [], games: [newGame] };
  }

  if (action.type === "restart") {
    if (!player.currentLevel) {
      throw new Error(
        `Something's wrong with that command: "${command.trim()}". Try something like "up 2", "a1" or "wait".`,
      );
    }
    return {
      messages: [],
      games: [restartPlayerLevel(newGame, address)],
      actionDescription: describeAction(action),
    };
  }

  if (action.type === "exit") {
    if (!player.currentLevel) {
      throw new Error(
        `Something's wrong with that command: "${command.trim()}". Try something like "up 2", "a1" or "wait".`,
      );
    }
    return {
      messages: [],
      games: [placePlayerInHub(newGame, address)],
      actionDescription: describeAction(action),
    };
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
  const actionDescription = describeAction(action);

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
      if (!isLevelUnlocked(targetLevelStr, player.completedLevels ?? [])) {
        throw new Error(
          "That portal seems closed. Maybe you gotta beat some other levels first.",
        );
      }
      if (targetLevelStr.toLowerCase() === "hub") {
        return {
          messages,
          games: [placePlayerInHub(newGame, address)],
          actionDescription,
        };
      }

      const nextGame = enterDungeon(newGame, address, targetLevelStr);
      const dungeonName = getDungeonDefinition(targetLevelStr).name;
      const nextPlayer = nextGame.players[address]!;
      nextPlayer.enteredLevels ??= [];
      if (!nextPlayer.enteredLevels.includes(dungeonName)) {
        nextPlayer.enteredLevels.push(dungeonName);
        return {
          messages,
          games: [nextGame],
          template: "level_enter",
          level: dungeonName,
          actionDescription,
        };
      }
      return { messages, games: [nextGame], actionDescription };
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
    return {
      messages,
      games: [newGame, hubGame],
      template: "level_complete",
      level: getDungeonDefinition(completedLevelName).name,
      actionDescription,
    };
  }

  return { messages, games: [newGame], actionDescription };
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
