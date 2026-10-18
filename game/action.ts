import { Dirs, type Dir } from "./lib/common.ts";

export class Action {
  public target: string | undefined;
  public dir: Dir | undefined;
  public dist: number = 1;

  constructor() {}

  isValid(): boolean {
    return (
      this.target != null &&
      this.dir != null &&
      this.dist >= 1 &&
      this.dist <= 2
    );
  }
}

type TokenType = "target" | "action" | "dist";

export function parseActions(command: string): Action[] {
  const actions: Action[] = [];
  const args = command.trim().split(/\s+/);

  let nextValidTokenTypes: TokenType[] = ["target"];

  for (let i = 0; i < args.length; i++) {
    let arg = args[i].toLowerCase();
    let argAsTarget = arg.match(/k|q/) ? arg : undefined;
    let argAsAction = Dirs.fromString(args[i]);
    let argAsDist = parseIntOrUndefined(arg);

    let matched = false;
    for (const tokenType of nextValidTokenTypes) {
      if (tokenType === "target" && argAsTarget != undefined) {
        // new action
        const currentAction = new Action();
        currentAction.target = argAsTarget;
        actions.push(currentAction);
        nextValidTokenTypes = ["action"];
        matched = true;
        break;
      }

      if (tokenType === "action" && argAsAction != undefined) {
        actions[actions.length - 1].dir = argAsAction;
        nextValidTokenTypes = ["dist", "action"];
        matched = true;
        break;
      }

      if (tokenType === "dist" && argAsDist != undefined) {
        actions[actions.length - 1].dist = argAsDist;
        nextValidTokenTypes = ["target"];
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Give a clearer syntax error showing the full command and highlighting the problematic argument
      let errorMessage = "Something's wrong with that command: ";
      errorMessage +=
        args.slice(0, i).join(" ") +
        " PROBLEM HERE >>" +
        args[i] +
        "<< " +
        args.slice(i + 1).join(" ");
      // TODO: More error?
      throw new Error(errorMessage);
    }
  }
  return actions;
}

function parseIntOrUndefined(value: string): number | undefined {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}
