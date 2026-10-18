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
    const gifBytes = renderLevelToGif(game.currentLevel, 16);

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
      game.currentLevel.renderText(),
      `[An animated 2-frame game board is attached as game.gif]`,
      ``,
      `How to play:`,
      `Reply to this email with your movement commands:`,
      `  - 'u' or 'up' (or '${player.letter.toLowerCase()} u' to move up)`,
      `  - 'd' or 'down' (or '${player.letter.toLowerCase()} d' to move down)`,
      `  - 'l' or 'left' (or '${player.letter.toLowerCase()} l' to move left)`,
      `  - 'r' or 'right' (or '${player.letter.toLowerCase()} r' to move right)`,
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
      <li><code>u</code> or <code>up</code> (move up)</li>
      <li><code>d</code> or <code>down</code> (move down)</li>
      <li><code>l</code> or <code>left</code> (move left)</li>
      <li><code>r</code> or <code>right</code> (move right)</li>
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
  const gifBytes = renderLevelToGif(game.currentLevel, 16);

  const subject = incomingSubject.toLowerCase().startsWith("re:")
    ? incomingSubject
    : `Re: ${incomingSubject || "Move"}`;

  const text = [
    `LD60 Game - Turn Update`,
    `========================`,
    ``,
    commandExecuted ? `Move executed: "${command}"` : `Invalid or failed move: "${command}"`,
    ``,
    `Current Board State:`,
    game.currentLevel.renderText(),
    `[An animated 2-frame game board is attached as game.gif]`,
    ``,
    `Reply to this email with your next move (e.g. 'u', 'd', 'l', 'r').`,
  ].join("\n");

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; max-width: 520px; margin: 0 auto;">
  <h2 style="margin: 0 0 0.75rem 0; color: #111827; font-size: 1.25rem;">LD60 Turn Update</h2>
  
  <div style="background: ${commandExecuted ? "#f3f4f6" : "#fef2f2"}; border-left: 4px solid ${commandExecuted ? "#3b82f6" : "#ef4444"}; padding: 0.75rem 1rem; border-radius: 4px; margin-bottom: 1.25rem;">
    <div style="font-size: 0.85rem; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Move Status</div>
    <div style="font-size: 1rem; font-weight: 500; color: #1f2937; margin-top: 0.25rem;">
      ${commandExecuted ? `Move executed: <code>${escapeHtml(command)}</code>` : `Could not execute: <code>${escapeHtml(command)}</code>`}
    </div>
  </div>

  <div style="text-align: center; margin: 1.5rem 0;">
    <img src="${imageSrc}" alt="Game Board (2-Frame GIF)" style="image-rendering: pixelated; width: 288px; height: 288px; border: 1px solid #d1d5db; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: inline-block;" />
  </div>

  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 1rem; font-size: 0.9rem; color: #4b5563; margin-top: 1rem;">
    <div>Reply to this email with your next move (e.g. <code>u</code>, <code>d</code>, <code>l</code>, <code>r</code>).</div>
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
