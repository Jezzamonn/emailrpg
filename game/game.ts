import { createLevel, levelEntitiesAt, levelInBound } from "./level.ts";
import { type LevelState, type PlayerState, type Point } from "./types.ts";

export * from "./types.ts";

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

function createHubLevel(): LevelState {
  return createLevel(11, 11);
}

export interface ActionResponse {
  game: GameState;
  // Template for the response.
  template: string;
  // TODO: This should include some messages somehow? Or idk something to pass up to the email sending part.
}

export function doPlayerAction(
  game: GameState,
  address: string,
  emailContent: string,
): ActionResponse {
  const existingPlayer = game.players[address];
  // If no player with the email: Add a new player!
  if (existingPlayer == null) {
    const newState = addNewPlayer(game, address);
    return { game: newState, template: "newplayer" };
  }

  // Otherwise: Take the next action for that player.
  // TODO: Doing that.
  return { game, template: "generic" };
}

function addNewPlayer(game: GameState, address: string): GameState {
  return game;
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

// export function registerUser(
//   game: GameState,
//   email: string,
// ): { game: GameState; player: PlayerEntry } {
//   const norm = email.toLowerCase().trim();
//   const existing = getUser(game, norm);
//   if (existing) {
//     return { game, player: existing };
//   }

//   const hubPos = findUnoccupiedHubPosition(game.hubLevel);
//   const playerState: PlayerState = {
//     email: norm,
//     state: "awaiting_customization",
//     p: { ...hubPos },
//     spawnPoint: { ...hubPos },
//     dungeonLevelIndex: 0,
//   };

//   const newEntry = makePlayerEntry(playerState);
//   const newGame: GameState = {
//     ...game,
//     players: [...game.players, newEntry],
//   };

//   return { game: newGame, player: newEntry };
// }

// export function processCommand(
//   game: GameState,
//   command: string,
//   forEmail?: string,
// ): { game: GameState; success: boolean } {
//   let actions: Action[];
//   try {
//     actions = parseActions(command);
//   } catch (err) {
//     console.error(`${err}`);
//     return { game, success: false };
//   }

//   if (actions.length === 0) {
//     return { game, success: false };
//   }

//   const action = actions[0];

//   // Find player
//   let player = forEmail ? getUser(game, forEmail) : undefined;

//   if (!player && action.target) {
//     const target = action.target.toLowerCase();
//     player = game.players.find(
//       (p) =>
//         p.playerState.char.toLowerCase() === target ||
//         p.playerState.email.toLowerCase() === target,
//     );
//   }

//   if (!player && game.players.length === 1) {
//     player = game.players[0];
//   }

//   // Auto-create player for CLI prototype testing if none exists
//   let workingGame = game;
//   if (!player && !forEmail && game.players.length === 0) {
//     const created = createPlayerForUser(game, "player@example.com");
//     workingGame = created.game;
//     player = created.player;
//   }

//   if (!player) {
//     console.error(`Couldn't find target player for command: ${command}`);
//     return { game: workingGame, success: false };
//   }

//   const email = player.playerState.email;

//   // Handle action types
//   if (action.type === "dungeon") {
//     return { game: enterDungeon(workingGame, email), success: true };
//   }

//   if (action.type === "hub") {
//     return { game: leaveDungeon(workingGame, email), success: true };
//   }

//   if (action.type === "next") {
//     if (player.playerState.location === "dungeon" && player.playerLevel) {
//       if (levelHasEnemies(player.playerLevel)) {
//         console.error(
//           "Cannot proceed to next dungeon level while enemies remain.",
//         );
//         return { game: workingGame, success: false };
//       }
//       return { game: nextDungeonLevel(workingGame, email), success: true };
//     }
//     return { game: workingGame, success: false };
//   }

//   const isDungeon = player.playerState.location === "dungeon";
//   let activeLevel: LevelState = isDungeon
//     ? (player.playerLevel ??
//       createPregeneratedDungeon(player.playerState.dungeonLevelIndex))
//     : workingGame.hubLevel;

//   if (action.type === "wait") {
//     // Player does not move, enemies take turn
//     if (isDungeon) {
//       const steppedLevel = stepLevelEnemies(activeLevel, (killedPlayerId) => {
//         // Player was killed -> respawn at spawnPoint
//         console.log(`Player ${killedPlayerId} killed in dungeon, respawning.`);
//       });
//       const updatedPlayers = workingGame.players.map((p) =>
//         p.playerState.email === email
//           ? makePlayerEntry(p.playerState, steppedLevel)
//           : p,
//       );
//       return {
//         game: { ...workingGame, players: updatedPlayers },
//         success: true,
//       };
//     }
//     return { game: workingGame, success: true };
//   }

//   // Movement command
//   if (levelHasEnemies(activeLevel) && action.dist > 2) {
//     console.error(
//       `Movement limited to 2 squares when enemies are present (requested ${action.dist}).`,
//     );
//     return { game: workingGame, success: false };
//   }

//   if (action.dir == null) {
//     return { game: workingGame, success: false };
//   }

//   const dirVector = Dirs.toPoint(action.dir);
//   const newP = Points.add(
//     player.playerState.p,
//     Points.scale(dirVector, action.dist),
//   );

//   if (!levelInBound(activeLevel, newP)) {
//     console.log("New position out of bounds:", newP);
//     return { game: workingGame, success: false };
//   }

//   // Check collisions at target position
//   const entitiesAtTarget = levelEntitiesAt(activeLevel, newP);
//   let killedEnemy = false;

//   for (const entity of entitiesAtTarget) {
//     if (entity.type === "enemy") {
//       killedEnemy = true;
//     } else if (entity.type === "player") {
//       // Overlapping with another player is allowed
//       continue;
//     } else {
//       // Obstacle or blocked
//       console.log("Cannot move to position, blocked by obstacle:", entity);
//       return { game: workingGame, success: false };
//     }
//   }

//   // Update player position and remove killed enemies
//   const filteredEntities = activeLevel.entities.filter(
//     (e) =>
//       !(
//         killedEnemy &&
//         e.type === "enemy" &&
//         e.p.x === newP.x &&
//         e.p.y === newP.y
//       ),
//   );

//   const updatedEntities = filteredEntities.map((e) =>
//     e.id === email ? { ...e, p: { ...newP } } : e,
//   );

//   const updatedActiveLevel: LevelState = {
//     ...activeLevel,
//     entities: updatedEntities,
//   };

//   // Step enemy AI if in dungeon
//   let finalLevel = updatedActiveLevel;
//   let playerKilled = false;

//   if (isDungeon) {
//     finalLevel = stepLevelEnemies(updatedActiveLevel, (killedId) => {
//       if (killedId === email) {
//         playerKilled = true;
//       }
//     });
//   }

//   const finalPlayerPos = playerKilled
//     ? { ...player.playerState.spawnPoint }
//     : { ...newP };

//   if (playerKilled) {
//     finalLevel = {
//       ...finalLevel,
//       entities: finalLevel.entities.map((e) =>
//         e.id === email ? { ...e, p: { ...finalPlayerPos } } : e,
//       ),
//     };
//   }

//   const updatedPlayerState: PlayerState = {
//     ...player.playerState,
//     p: finalPlayerPos,
//   };

//   if (isDungeon) {
//     const updatedPlayers = workingGame.players.map((p) =>
//       p.playerState.email === email
//         ? makePlayerEntry(updatedPlayerState, finalLevel)
//         : p,
//     );
//     return {
//       game: { ...workingGame, players: updatedPlayers },
//       success: true,
//     };
//   } else {
//     const updatedPlayers = workingGame.players.map((p) =>
//       p.playerState.email === email
//         ? makePlayerEntry(updatedPlayerState, p.playerLevel)
//         : p,
//     );
//     return {
//       game: {
//         ...workingGame,
//         hubLevel: finalLevel,
//         players: updatedPlayers,
//       },
//       success: true,
//     };
//   }
// }

// // Stateful Game class wrapper for callers wanting class API
// export class Game {
//   public state: GameState;

//   constructor(initialState?: GameState) {
//     this.state = initialState ?? createGame();
//   }

//   get hubLevel(): LevelState {
//     return this.state.hubLevel;
//   }

//   get players(): PlayerEntry[] {
//     return this.state.players;
//   }

//   get currentLevel(): LevelState {
//     for (const player of this.state.players) {
//       if (player.playerState.location === "dungeon" && player.playerLevel) {
//         return player.playerLevel;
//       }
//     }
//     return this.state.hubLevel;
//   }

//   set currentLevel(level: LevelState) {
//     this.state.hubLevel = level;
//   }

//   getUser(email: string): PlayerEntry | undefined {
//     return getUser(this.state, email);
//   }

//   registerUser(email: string): PlayerEntry {
//     const res = registerUser(this.state, email);
//     this.state = res.game;
//     return res.player;
//   }

//   createPlayerForUser(
//     email: string,
//     customizationText: string = "",
//   ): PlayerEntry {
//     const res = createPlayerForUser(this.state, email, customizationText);
//     this.state = res.game;
//     return res.player;
//   }

//   enterDungeon(email: string): LevelState {
//     this.state = enterDungeon(this.state, email);
//     return this.getLevelForUser(email);
//   }

//   leaveDungeon(email: string): LevelState {
//     this.state = leaveDungeon(this.state, email);
//     return this.state.hubLevel;
//   }

//   nextDungeonLevel(email: string): LevelState | undefined {
//     this.state = nextDungeonLevel(this.state, email);
//     return this.getLevelForUser(email);
//   }

//   processCommand(command: string, forEmail?: string): boolean {
//     const res = processCommand(this.state, command, forEmail);
//     this.state = res.game;
//     return res.success;
//   }

//   getLevelForUser(email: string): LevelState {
//     return getLevelForUser(this.state, email);
//   }

//   getAllPlayers(): PlayerEntry[] {
//     return this.state.players;
//   }

//   toJSON(): GameState {
//     return this.state;
//   }
// }
