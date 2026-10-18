import { Game } from "../game.ts";
import { renderLevelToGif } from "../lib/gif.ts";
import {
  renderWelcomeEmail,
  renderIntroEmail,
  renderTurnEmail,
} from "./template.ts";

export interface EmailRequest {
  from: string;
  subject?: string;
  body: string;
  imageSrc?: string; // e.g. "cid:game_view" for actual email attachment, or blob URL for web preview
}

export type EmailPhase = "welcome" | "intro" | "turn";

export interface EmailResponse {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  gifBytes?: Uint8Array;
  phase: EmailPhase;
  playerLetter?: string;
}

export function handleIncomingEmail(
  game: Game,
  request: EmailRequest
): EmailResponse {
  const from = "game@ld60.workers.dev";
  const to = request.from.toLowerCase().trim();
  const incomingSubject = request.subject || "";
  const body = request.body.trim();
  const imageSrc = request.imageSrc || "cid:game_view";

  const user = game.getUser(to);

  // Phase 1: First email from user -> contents ignored, welcome & customization prompt
  if (!user) {
    game.registerUser(to);

    const subject = incomingSubject
      ? `Re: ${incomingSubject}`
      : "Welcome to the game!";

    const text = [
      "Welcome to the game!",
      "====================",
      "",
      "Choose what your player looks like.",
      "",
      "Reply to this email with your character customization (e.g. 'King', 'Queen', 'Knight') to enter the world.",
    ].join("\n");

    const html = renderWelcomeEmail();

    return {
      from,
      to,
      subject,
      text,
      html,
      phase: "welcome",
    };
  }

  // Phase 2: User is awaiting customization -> create player, place on board, send intro email
  if (user.state === "awaiting_customization") {
    const player = game.createPlayerForUser(to, body);
    const level = game.getLevelForUser(to);
    const gifBytes = renderLevelToGif(level, 16, {}, player);

    const subject = incomingSubject.toLowerCase().startsWith("re:")
      ? incomingSubject
      : `Re: ${incomingSubject || "Welcome to the game!"}`;

    const text = [
      `Welcome to the world!`,
      `====================`,
      ``,
      `Your character has been created as [${player.letter}] and placed in the hub world at (${player.p.x + 1}, ${player.p.y + 1}).`,
      ``,
      `Current Board State:`,
      level.renderText(player),
      `[An animated 2-frame game board is attached as game.gif]`,
      ``,
      `How to play:`,
      `Reply to this email with your commands:`,
      `  - Move: 'u', 'd', 'l', 'r' or 'up 2', 'left 3'`,
      `  - 'wait' (skip turn / let enemies move)`,
      `  - 'dungeon' (enter your private pregenerated dungeon challenge)`,
      `  - 'hub' (return to the shared hub world)`,
    ].join("\n");

    const html = renderIntroEmail({
      player: {
        char: player.char,
        letter: player.letter,
        displayX: player.p.x + 1,
        displayY: player.p.y + 1,
      },
      imageSrc,
    });

    return {
      from,
      to,
      subject,
      text,
      html,
      gifBytes,
      phase: "intro",
      playerLetter: player.letter,
    };
  }

  // Phase 3: Active user -> execute command and return turn update
  const command = body;
  const commandExecuted = game.processCommand(command, to);
  const level = game.getLevelForUser(to);
  const gifBytes = renderLevelToGif(level, 16, {}, user.player);

  const subject = incomingSubject.toLowerCase().startsWith("re:")
    ? incomingSubject
    : `Re: ${incomingSubject || "Move"}`;

  const locationInfo =
    user.location === "dungeon"
      ? `Dungeon (${level.name ?? "Level " + (user.dungeonLevelIndex + 1)})`
      : "Shared Hub World";

  const enemiesPresent = level.hasEnemies();
  const rulesNote = enemiesPresent
    ? "Enemies are present: movement is limited to 2 squares per direction."
    : "No enemies present: you may move freely.";

  const text = [
    `LD60 Game - Turn Update [${locationInfo}]`,
    `========================================`,
    ``,
    commandExecuted ? `Command executed: "${command}"` : `Invalid or failed command: "${command}"`,
    rulesNote,
    ``,
    `Current Board State:`,
    level.renderText(user.player),
    `[An animated 2-frame game board is attached as game.gif]`,
    ``,
    user.location === "dungeon"
      ? enemiesPresent
        ? `Reply with move ('u 2', 'wait', etc.) or 'hub' to return.`
        : `Dungeon cleared! Reply with 'next' for next level, or 'hub' to return.`
      : `Reply with move ('u', 'left 3', etc.) or 'dungeon' to enter dungeon.`,
  ].join("\n");

  const html = renderTurnEmail({
    locationInfo,
    command,
    commandExecuted,
    rulesNote,
    imageSrc,
    inDungeon: user.location === "dungeon",
    enemiesPresent,
  });

  return {
    from,
    to,
    subject,
    text,
    html,
    gifBytes,
    phase: "turn",
    playerLetter: user.player?.letter,
  };
}
