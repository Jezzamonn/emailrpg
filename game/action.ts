import { Dirs, type Dir } from "./lib/common.ts";

export type ActionType = "move" | "wait" | "dungeon" | "hub" | "next";

export class Action {
  public target: string | undefined;
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

type TokenType = "target" | "action" | "dist";

export function parseActions(command: string): Action[] {
  const trimmed = command.trim();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();

  // Check simple special commands
  if (lower === "wait") {
    return [new Action("wait")];
  }
  if (
    lower === "dungeon" ||
    lower === "render dungeon" ||
    lower === "enter dungeon" ||
    lower === "render" ||
    lower === "enter"
  ) {
    return [new Action("dungeon")];
  }
  if (
    lower === "hub" ||
    lower === "leave" ||
    lower === "exit" ||
    lower === "return" ||
    lower === "leave dungeon" ||
    lower === "exit dungeon"
  ) {
    return [new Action("hub")];
  }
  if (lower === "next" || lower === "next level") {
    return [new Action("next")];
  }

  const args = trimmed.split(/\s+/);

  // Check target-prefixed special commands (e.g. "k wait", "k dungeon", "k hub", "k render dungeon")
  if (
    args.length >= 2 &&
    args[0].length === 1 &&
    /[a-z]/i.test(args[0]) &&
    Dirs.fromString(args[0]) === undefined
  ) {
    const target = args[0].toLowerCase();
    const rest = args.slice(1).join(" ").toLowerCase();
    if (rest === "wait") {
      const a = new Action("wait");
      a.target = target;
      return [a];
    }
    if (
      rest === "dungeon" ||
      rest === "render dungeon" ||
      rest === "enter dungeon" ||
      rest === "render" ||
      rest === "enter"
    ) {
      const a = new Action("dungeon");
      a.target = target;
      return [a];
    }
    if (
      rest === "hub" ||
      rest === "leave" ||
      rest === "exit" ||
      rest === "return" ||
      rest === "leave dungeon" ||
      rest === "exit dungeon"
    ) {
      const a = new Action("hub");
      a.target = target;
      return [a];
    }
    if (rest === "next" || rest === "next level") {
      const a = new Action("next");
      a.target = target;
      return [a];
    }
  }

  // Token-based parsing for movements
  const actions: Action[] = [];
  let nextValidTokenTypes: TokenType[] = ["target", "action"];

  for (let i = 0; i < args.length; i++) {
    let arg = args[i].toLowerCase();
    let argAsAction = Dirs.fromString(args[i]);
    let argAsTarget =
      arg.length === 1 && /[a-z]/i.test(arg) && argAsAction === undefined
        ? arg
        : undefined;
    let argAsDist = parseIntOrUndefined(arg);

    let matched = false;
    for (const tokenType of nextValidTokenTypes) {
      if (tokenType === "target" && argAsTarget != undefined) {
        const currentAction = new Action("move");
        currentAction.target = argAsTarget;
        actions.push(currentAction);
        nextValidTokenTypes = ["action"];
        matched = true;
        break;
      }

      if (tokenType === "action" && argAsAction != undefined) {
        if (actions.length === 0 || actions[actions.length - 1].dir != undefined) {
          actions.push(new Action("move"));
        }
        actions[actions.length - 1].dir = argAsAction;
        nextValidTokenTypes = ["dist", "target", "action"];
        matched = true;
        break;
      }

      if (tokenType === "dist" && argAsDist != undefined && actions.length > 0) {
        actions[actions.length - 1].dist = argAsDist;
        nextValidTokenTypes = ["target", "action"];
        matched = true;
        break;
      }
    }

    if (!matched) {
      let errorMessage = "Something's wrong with that command: ";
      errorMessage +=
        args.slice(0, i).join(" ") +
        " PROBLEM HERE >>" +
        args[i] +
        "<< " +
        args.slice(i + 1).join(" ");
      throw new Error(errorMessage);
    }
  }
  return actions;
}

function parseIntOrUndefined(value: string): number | undefined {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}
