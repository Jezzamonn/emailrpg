import { Game } from "../game.ts";
import { renderLevelToGif } from "../lib/gif.ts";

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

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; max-width: 520px; margin: 0 auto;">
  <h2 style="margin: 0 0 0.75rem 0; color: #111827; font-size: 1.25rem;">Welcome to the game!</h2>
  <p style="font-size: 1.05rem; color: #374151;">Choose what your player looks like.</p>
  <div style="background: #f3f4f6; border-left: 4px solid #3b82f6; padding: 0.85rem 1rem; border-radius: 4px; margin-top: 1rem; color: #4b5563;">
    Reply to this email with what you'd like your character to look like (e.g. <em>King</em>, <em>Queen</em>) to enter the hub world.
  </div>
</div>
`.trim();

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

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; max-width: 520px; margin: 0 auto;">
  <h2 style="margin: 0 0 0.75rem 0; color: #111827; font-size: 1.25rem;">Welcome to the world!</h2>
  
  <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 0.75rem 1rem; border-radius: 4px; margin-bottom: 1.25rem;">
    <div style="font-weight: 600; color: #166534;">Character Created!</div>
    <div style="color: #15803d; font-size: 0.95rem; margin-top: 0.25rem;">
      You have joined the hub world as <strong>${player.char} [${player.letter}]</strong> at position (${player.p.x + 1}, ${player.p.y + 1}).
    </div>
  </div>

  <div style="text-align: center; margin: 1.5rem 0;">
    <img src="${imageSrc}" alt="Game Board (2-Frame GIF)" style="image-rendering: pixelated; width: 288px; height: 288px; border: 1px solid #d1d5db; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: inline-block;" />
  </div>

  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 1rem; font-size: 0.9rem; color: #4b5563; margin-top: 1rem;">
    <div style="font-weight: 600; color: #374151; margin-bottom: 0.4rem;">How to play:</div>
    <div>Reply to this email with your next move:</div>
    <ul style="margin: 0.4rem 0 0 1.2rem; padding: 0; line-height: 1.6;">
      <li><code>u</code>, <code>d</code>, <code>l</code>, <code>r</code> (or with distance: <code>up 2</code>, <code>left 3</code>)</li>
      <li><code>wait</code> (wait a turn)</li>
      <li><code>dungeon</code> (enter dungeon challenge)</li>
      <li><code>hub</code> (return to hub world)</li>
    </ul>
  </div>
</div>
`.trim();

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

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; max-width: 520px; margin: 0 auto;">
  <h2 style="margin: 0 0 0.75rem 0; color: #111827; font-size: 1.25rem;">LD60 Turn Update — ${locationInfo}</h2>
  
  <div style="background: ${commandExecuted ? "#f3f4f6" : "#fef2f2"}; border-left: 4px solid ${commandExecuted ? "#3b82f6" : "#ef4444"}; padding: 0.75rem 1rem; border-radius: 4px; margin-bottom: 1.25rem;">
    <div style="font-size: 0.85rem; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Status</div>
    <div style="font-size: 1rem; font-weight: 500; color: #1f2937; margin-top: 0.25rem;">
      ${commandExecuted ? `Command executed: <code>${escapeHtml(command)}</code>` : `Could not execute: <code>${escapeHtml(command)}</code>`}
    </div>
    <div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.35rem;">${rulesNote}</div>
  </div>

  <div style="text-align: center; margin: 1.5rem 0;">
    <img src="${imageSrc}" alt="Game Board (2-Frame GIF)" style="image-rendering: pixelated; width: 288px; height: 288px; border: 1px solid #d1d5db; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: inline-block;" />
  </div>

  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 1rem; font-size: 0.9rem; color: #4b5563; margin-top: 1rem;">
    <div>${
      user.location === "dungeon"
        ? enemiesPresent
          ? "Reply with movement (e.g. <code>u 2</code>, <code>left</code>), <code>wait</code>, or <code>hub</code> to exit."
          : "Level cleared! Reply with <code>next</code> for next challenge, or <code>hub</code> to return."
        : "Move freely (e.g. <code>u</code>, <code>left 3</code>), or enter the dungeon with <code>dungeon</code>."
    }</div>
  </div>
</div>
`.trim();

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

function escapeHtml(str: string): string {
  return str.replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m]!)
  );
}
