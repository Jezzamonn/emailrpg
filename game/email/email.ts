import { doPlayerAction, type GameState } from "../game.ts";
import { renderLevelToGif } from "../lib/gif.ts";
import {
  renderWelcomeEmail,
  renderTurnEmail,
  htmlToPlainText,
} from "./template.ts";

export interface EmailRequest {
  from: string;
  subject?: string;
  body: string;
  imageSrc?: string; // e.g. "cid:game_view" for actual email attachment, or blob URL for web preview
}

export interface EmailResponse {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  gifBytes?: Uint8Array;
}

export function handleIncomingEmail(
  game: GameState,
  request: EmailRequest,
): { game: GameState; response: EmailResponse } {
  // TODO: Check some things about the email? E.g. don't reply to multiple people???

  // Parse email address and body of email
  const address = request.from.toLowerCase().trim();
  // TODO: I think this probably includes the reply text from the previous email but we somehow want to only consider the new part the user wrote.
  const body = request.body.trim();

  // Update game state. Within game?

  const { game: newGame, template } = doPlayerAction(game, address, body);

  const response = renderEmailTemplate(game, request, template);

  // Return updated game and response
  return { game: newGame, response };
}

function renderEmailTemplate(
  game: GameState,
  request: EmailRequest,
  template: string,
): EmailResponse {
  const address = request.from.toLowerCase().trim();
  const from = "game@emailrpg.com";
  const incomingSubject = request.subject || "";
  const subject = incomingSubject.toLowerCase().startsWith("re:")
    ? incomingSubject
    : `Re: ${incomingSubject}`;
  const imageSrc = request.imageSrc || "cid:game_view";

  let gifBytes: Uint8Array | undefined;

  let html: string;
  switch (template) {
    case "newplayer":
      html = renderWelcomeEmail();
      break;
    default:
      const player = game.players[address]!;
      const level = player.currentLevel ?? game.hubLevel;
      gifBytes = renderLevelToGif(level, 16, {}, address);

      html = renderTurnEmail({ imageSrc });
      break;
  }

  return {
    to: address,
    from,
    subject,
    html,
    text: htmlToPlainText(html),
  };
}

// export function handleIncomingEmailInternal(
//   game: Game,
//   request: EmailRequest,
// ): EmailResponse {
//   const to = request.from.toLowerCase().trim();
//   const body = request.body.trim();
//   const imageSrc = request.imageSrc || "cid:game_view";

//   const user = game.getUser(to);

//   // Phase 1: First email from user -> contents ignored, welcome & customization prompt
//   if (!user) {
//     game.registerUser(to);

//     const html =
//     const text = htmlToPlainText(html);

//     return {
//       from,
//       to,
//       subject,
//       text,
//       html,
//       phase: "welcome",
//     };
//   }

//   // Phase 2: User is awaiting customization -> create player, place on board, send intro email
//   if (user.playerState.state === "awaiting_customization") {
//     const player = game.createPlayerForUser(to, body);
//     const level = game.getLevelForUser(to);
//     const gifBytes = renderLevelToGif(level, 16, {}, player.playerState.char);

//     const html = renderIntroEmail({
//       player: {
//         char: player.playerState.char,
//         displayX: player.playerState.p.x + 1,
//         displayY: player.playerState.p.y + 1,
//       },
//       imageSrc,
//     });
//     const text = htmlToPlainText(html);

//     return {
//       from,
//       to,
//       subject,
//       text,
//       html,
//       gifBytes,
//       phase: "intro",
//     };
//   }

//   // Phase 3: Active user -> execute command and return turn update
//   const command = body;
//   const commandExecuted = game.processCommand(command, to);
//   const level = game.getLevelForUser(to);
//   const gifBytes = renderLevelToGif(level, 16, {}, user.playerState.char);

//   const subject = incomingSubject.toLowerCase().startsWith("re:")
//     ? incomingSubject
//     : `Re: ${incomingSubject || "Move"}`;

//   const locationInfo =
//     user.playerState.location === "dungeon"
//       ? `Dungeon (${level.name ?? "Level " + (user.playerState.dungeonLevelIndex + 1)})`
//       : "Shared Hub World";

//   const enemiesPresent = levelHasEnemies(level);
//   const rulesNote = enemiesPresent
//     ? "Enemies are present: movement is limited to 2 squares per direction."
//     : "No enemies present: you may move freely.";

//   const html = renderTurnEmail({
//     locationInfo,
//     command,
//     commandExecuted,
//     rulesNote,
//     imageSrc,
//     inDungeon: user.playerState.location === "dungeon",
//     enemiesPresent,
//   });
//   const text = htmlToPlainText(html);

//   return {
//     from,
//     to,
//     subject,
//     text,
//     html,
//     gifBytes,
//     phase: "turn",
//   };
// }
