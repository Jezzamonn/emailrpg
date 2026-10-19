import {
  PREGENERATED_DUNGEONS,
  createDungeonForLevel,
  getDungeonDefinition,
} from "../game/dungeon.ts";
import { stepLevelEnemies } from "../game/enemy.ts";
import { entityGroupOf } from "../game/entity.ts";
import {
  levelEntitiesAt,
  levelHasEnemies,
  levelInBound,
  type LevelState,
} from "../game/level.ts";
import { Dir, Dirs, Points, type Point } from "../game/lib/common.ts";

const PLAYER_ID = "solver-player";

interface CandidateAction {
  command: string;
  dir?: Dir;
  dist?: number;
}

const CANDIDATE_ACTIONS: CandidateAction[] = [
  { command: "up 1", dir: Dir.Up, dist: 1 },
  { command: "up 2", dir: Dir.Up, dist: 2 },
  { command: "down 1", dir: Dir.Down, dist: 1 },
  { command: "down 2", dir: Dir.Down, dist: 2 },
  { command: "left 1", dir: Dir.Left, dist: 1 },
  { command: "left 2", dir: Dir.Left, dist: 2 },
  { command: "right 1", dir: Dir.Right, dist: 1 },
  { command: "right 2", dir: Dir.Right, dist: 2 },
  { command: "wait" },
];

interface SearchNode {
  level: LevelState;
  playerP: Point;
  actions: string[];
  enemiesRemaining: number;
  lowerBound: number;
  priority: number;
}

export interface SolveResult {
  levelName: string;
  levelId: number;
  width: number;
  height: number;
  initialEnemies: number;
  beatable: boolean;
  steps: number | null;
  solution: string[] | null;
  statesExpanded: number;
  pathsExplored: number;
  playerDeathPaths: number;
  prunedBranches: number;
  uniqueStatesVisited: number;
  elapsedMs: number;
}

function serializeState(level: LevelState, playerP: Point): string {
  const enemies = level.entities
    .filter((e) => entityGroupOf(e.type) === "enemy")
    .map((e) => `${e.type}:${e.p.x},${e.p.y},${e.cooldown ?? 0}`)
    .join("|");
  return `${playerP.x},${playerP.y}#${enemies}`;
}

function computeLowerBound(level: LevelState): {
  enemiesRemaining: number;
  lowerBound: number;
} {
  const occupiedEnemyTiles = new Set<string>();
  let enemiesRemaining = 0;
  for (const entity of level.entities) {
    if (entityGroupOf(entity.type) === "enemy") {
      enemiesRemaining++;
      occupiedEnemyTiles.add(`${entity.p.x},${entity.p.y}`);
    }
  }
  // At most one tile can be stepped on per turn, so the number of distinct
  // tiles currently occupied by enemies is an admissible lower bound on turns left.
  return {
    enemiesRemaining,
    lowerBound: occupiedEnemyTiles.size,
  };
}

export function solveLevel(
  levelNameOrId: string | number,
  maxSteps: number = 60,
): SolveResult {
  const startTime = performance.now();
  const def = getDungeonDefinition(levelNameOrId);
  const { level: initialLevel, playerStart } = createDungeonForLevel(def.name);

  initialLevel.entities.push({
    type: "player",
    p: { ...playerStart },
    playerId: PLAYER_ID,
  });

  const initialMetrics = computeLowerBound(initialLevel);
  const startNode: SearchNode = {
    level: initialLevel,
    playerP: { ...playerStart },
    actions: [],
    enemiesRemaining: initialMetrics.enemiesRemaining,
    lowerBound: initialMetrics.lowerBound,
    priority: initialMetrics.lowerBound,
  };

  if (!levelHasEnemies(initialLevel)) {
    return {
      levelName: def.name,
      levelId: def.id,
      width: def.width,
      height: def.height,
      initialEnemies: 0,
      beatable: true,
      steps: 0,
      solution: [],
      statesExpanded: 0,
      pathsExplored: 0,
      playerDeathPaths: 0,
      prunedBranches: 0,
      uniqueStatesVisited: 1,
      elapsedMs: performance.now() - startTime,
    };
  }

  // Best-first branch-and-bound frontier and visited-state cost bound map
  const frontier: SearchNode[] = [startNode];
  const bestDepthByState = new Map<string, number>();
  bestDepthByState.set(serializeState(initialLevel, playerStart), 0);

  let upperBound = maxSteps + 1;
  let bestSolution: string[] | null = null;

  let statesExpanded = 0;
  let pathsExplored = 0;
  let playerDeathPaths = 0;
  let prunedBranches = 0;

  while (frontier.length > 0) {
    // Pick node with lowest estimated total steps (f = g + h), breaking ties by fewer enemies left
    let bestIdx = 0;
    for (let i = 1; i < frontier.length; i++) {
      const a = frontier[i]!;
      const b = frontier[bestIdx]!;
      if (
        a.priority < b.priority ||
        (a.priority === b.priority &&
          a.enemiesRemaining < b.enemiesRemaining) ||
        (a.priority === b.priority &&
          a.enemiesRemaining === b.enemiesRemaining &&
          a.actions.length < b.actions.length)
      ) {
        bestIdx = i;
      }
    }

    const current = frontier[bestIdx]!;
    frontier[bestIdx] = frontier[frontier.length - 1]!;
    frontier.pop();

    // Bound check before expanding
    if (current.actions.length + current.lowerBound >= upperBound) {
      prunedBranches++;
      continue;
    }

    statesExpanded++;

    for (const action of CANDIDATE_ACTIONS) {
      let target: Point | undefined;
      if (action.dir != null && action.dist != null) {
        target = Points.add(
          current.playerP,
          Points.scale(Dirs.toPoint(action.dir), action.dist),
        );
        if (!levelInBound(current.level, target)) {
          continue;
        }
      }

      pathsExplored++;
      const nextActions = [...current.actions, action.command];
      const nextStepCount = nextActions.length;

      // Clone level entities for simulation
      const nextLevel: LevelState = {
        ...current.level,
        entities: current.level.entities.map((e) => ({
          ...e,
          p: { ...e.p },
        })),
      };

      const nextPlayerP = target ? { ...target } : { ...current.playerP };

      if (target != null) {
        // Moving onto an enemy squashes it
        const killed = levelEntitiesAt(nextLevel, target).filter(
          (e) => entityGroupOf(e.type) === "enemy",
        );
        if (killed.length > 0) {
          nextLevel.entities = nextLevel.entities.filter(
            (e) => !killed.includes(e),
          );
        }

        const playerEntity = nextLevel.entities.find(
          (e) => e.playerId === PLAYER_ID,
        );
        if (playerEntity) {
          playerEntity.p = { ...nextPlayerP };
        }
      }

      // Enemy turn
      let playerDied = false;
      const steppedLevel = stepLevelEnemies(nextLevel, (killedId) => {
        if (killedId === PLAYER_ID) {
          playerDied = true;
        }
      });

      if (playerDied) {
        playerDeathPaths++;
        continue;
      }

      if (!levelHasEnemies(steppedLevel)) {
        bestSolution = nextActions;
        upperBound = nextStepCount;
        // Stop immediately once a solution is found
        frontier.length = 0;
        break;
      }

      const { enemiesRemaining, lowerBound } = computeLowerBound(steppedLevel);

      // Branch-and-bound pruning: exceed step bound
      if (nextStepCount + lowerBound >= upperBound) {
        prunedBranches++;
        continue;
      }

      // Dominance pruning: already reached identical board state in <= steps
      const stateKey = serializeState(steppedLevel, nextPlayerP);
      const prevBest = bestDepthByState.get(stateKey);
      if (prevBest !== undefined && prevBest <= nextStepCount) {
        prunedBranches++;
        continue;
      }
      bestDepthByState.set(stateKey, nextStepCount);

      frontier.push({
        level: steppedLevel,
        playerP: nextPlayerP,
        actions: nextActions,
        enemiesRemaining,
        lowerBound,
        priority: nextStepCount + lowerBound,
      });
    }
  }

  const elapsedMs = performance.now() - startTime;

  return {
    levelName: def.name,
    levelId: def.id,
    width: def.width,
    height: def.height,
    initialEnemies: initialMetrics.enemiesRemaining,
    beatable: bestSolution !== null,
    steps: bestSolution ? bestSolution.length : null,
    solution: bestSolution,
    statesExpanded,
    pathsExplored,
    playerDeathPaths,
    prunedBranches,
    uniqueStatesVisited: bestDepthByState.size,
    elapsedMs,
  };
}

export function findMatchingDungeons(arg: string) {
  const trimmed = arg.trim();
  if (trimmed.toLowerCase() === "all") {
    return PREGENERATED_DUNGEONS;
  }
  const exact = PREGENERATED_DUNGEONS.find(
    (d) =>
      d.name.toLowerCase() === trimmed.toLowerCase() ||
      d.id.toString() === trimmed ||
      `level ${d.id}` === trimmed.toLowerCase() ||
      `dungeon ${d.id}` === trimmed.toLowerCase(),
  );
  return exact ? [exact] : [];
}
