import { parseAction } from "./action.ts";
import { stepLevelEnemies } from "./enemy.ts";
import {
  type ClothesColor,
  type HairColor,
  type HairType,
  type PlayerAppearance,
  type SkinColor,
  entityGroupOf,
} from "./entity.ts";
import {
  createHubLevel,
  levelEntitiesAt,
  levelHasEnemies,
  levelInBound,
  type LevelState,
} from "./level.ts";
import { Dirs, type Point, Points } from "./lib/common.ts";

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

export type ResponseTemplate = "newplayer" | "intro" | "turn";

export interface ActionResponse {
  game: GameState;
  // Template for the response.
  template: ResponseTemplate;
  // Things that happened this turn, to tell the player about.
  messages: string[];
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
    return { game: newGame, template: "newplayer", messages: [] };
  }

  // They've been asked what they look like, so this email is their answer.
  if (player.state === "awaiting_customization") {
    customizePlayer(newGame, player, emailContent);
    return { game: newGame, template: "intro", messages: [] };
  }

  // Otherwise: Take the next action for that player.
  const messages = takePlayerTurn(newGame, player, emailContent);
  return { game: newGame, template: "turn", messages };
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
  let action;
  try {
    action = parseAction(command);
  } catch (err) {
    return [(err as Error).message];
  }

  const level = getPlayerLevel(game, player);
  if (!action.isValid(levelHasEnemies(level))) {
    return ["Whoa there! With enemies around you can only move 2 spaces at a time."];
  }

  const messages: string[] = [];

  if (action.type === "move") {
    const target = Points.add(
      player.p,
      Points.scale(Dirs.toPoint(action.dir!), action.dist),
    );
    if (!levelInBound(level, target)) {
      return ["You can't go that way, that's the edge of the world!"];
    }

    // Moving onto an enemy kills it.
    const killed = levelEntitiesAt(level, target).filter(
      (e) => entityGroupOf(e.type) === "enemy",
    );
    if (killed.length > 0) {
      level.entities = level.entities.filter((e) => !killed.includes(e));
      messages.push("You squash an enemy!");
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
  let playerKilled = false;
  const steppedLevel = stepLevelEnemies(level, (playerId) => {
    if (playerId === player.email) {
      playerKilled = true;
    }
  });
  setPlayerLevel(game, player, steppedLevel);

  if (playerKilled) {
    messages.push("Oh no, you got got! You wake up back on the beach...");
    placePlayerInHub(game, player);
  }

  return messages;
}

const HAIR_TYPES: HairType[] = ["short", "ponytail", "bald"];
const HAIR_COLORS: HairColor[] = ["blonde", "brown", "black"];
const SKIN_COLORS: SkinColor[] = ["light", "medium", "dark"];
const CLOTHES_COLORS: ClothesColor[] = ["red", "blue", "green"];

function parseAppearance(description: string): PlayerAppearance {
  // Look for any of the known options in what they wrote, otherwise use the first one.
  const words = description.toLowerCase().split(/[^a-z]+/);
  const pick = <T extends string>(options: T[]): T =>
    options.find((o) => words.includes(o)) ?? options[0];

  return {
    hairType: pick(HAIR_TYPES),
    hairColor: pick(HAIR_COLORS),
    skinColor: pick(SKIN_COLORS),
    clothesColor: pick(CLOTHES_COLORS),
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
