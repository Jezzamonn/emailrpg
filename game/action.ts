import { Dirs, type Dir, type Point, parseColumnLetters } from "./lib/common.ts";

export type ActionType = "move" | "wait" | "coord";

export interface Coordinate {
  col: string;
  row: number;
}

export class Action {
  public dir: Dir | undefined;
  public dist: number = 1;
  public type: ActionType = "move";
  public coord: Coordinate | undefined;

  constructor(type: ActionType = "move") {
    this.type = type;
  }

  isValid(
    hasEnemies: boolean = false,
    from?: Point,
    levelHeight?: number,
  ): boolean {
    if (this.type === "wait") {
      return true;
    }
    if (this.type === "coord") {
      if (!hasEnemies) {
        return true;
      }
      if (from == null || levelHeight == null || this.coord == null) {
        return true;
      }
      const colIndex = parseColumnLetters(this.coord.col);
      const y = levelHeight - this.coord.row;
      const dx = colIndex - from.x;
      const dy = y - from.y;
      const isCardinal = (dx === 0 && dy !== 0) || (dy === 0 && dx !== 0);
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      return isCardinal && dist >= 1 && dist <= 2;
    }
    if (this.dir == null || this.dist < 1) {
      return false;
    }
    if (hasEnemies && this.dist > 2) {
      return false;
    }
    return true;
  }
}

// Parses a command like "up 2", "left", "a1", or "wait". See spec/commands.md.
export function parseAction(command: string): Action {
  const args = command.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (args.length === 0) {
    throw new Error("You didn't say what to do!");
  }

  if (args.length === 1 && args[0] === "wait") {
    return new Action("wait");
  }

  // Coordinate command: "a1", "l19", "m10", or "m 10"
  if (args.length === 1) {
    const match = args[0].match(/^([a-z]+)(\d+)$/);
    if (match) {
      const row = parseInt(match[2], 10);
      const action = new Action("coord");
      action.coord = { col: match[1], row };
      return action;
    }
  } else if (args.length === 2) {
    if (
      Dirs.fromString(args[0]) === undefined &&
      /^[a-z]+$/.test(args[0]) &&
      /^\d+$/.test(args[1])
    ) {
      const row = parseInt(args[1], 10);
      const action = new Action("coord");
      action.coord = { col: args[0], row };
      return action;
    }
  }

  const dir = Dirs.fromString(args[0]);
  const dist = args.length === 2 ? parseIntOrUndefined(args[1]) : 1;
  if (dir === undefined || dist === undefined || dist < 1 || args.length > 2) {
    throw new Error(
      `Something's wrong with that command: "${command.trim()}". Try something like "up 2", "a1" or "wait".`,
    );
  }

  const action = new Action("move");
  action.dir = dir;
  action.dist = dist;
  return action;
}

function parseIntOrUndefined(value: string): number | undefined {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}
