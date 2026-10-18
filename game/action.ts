import { Dirs, type Dir } from "./lib/common.ts";

export type ActionType = "move" | "wait";

export class Action {
  public dir: Dir | undefined;
  public dist: number = 1;
  public type: ActionType = "move";

  constructor(type: ActionType = "move") {
    this.type = type;
  }

  isValid(hasEnemies: boolean = false): boolean {
    if (this.type !== "move") {
      return true;
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

// Parses a command like "up 2", "left" or "wait". See spec/commands.md.
export function parseAction(command: string): Action {
  const args = command.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (args.length === 0) {
    throw new Error("You didn't say what to do!");
  }

  if (args.length === 1 && args[0] === "wait") {
    return new Action("wait");
  }

  const dir = Dirs.fromString(args[0]);
  const dist = args.length === 2 ? parseIntOrUndefined(args[1]) : 1;
  if (dir === undefined || dist === undefined || args.length > 2) {
    throw new Error(
      `Something's wrong with that command: "${command.trim()}". Try something like "up 2" or "wait".`,
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
