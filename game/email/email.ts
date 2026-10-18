import {
  doPlayerAction,
  getPlayerLevel,
  type ActionResponse,
  type GameState,
} from "../game.ts";
import { renderLevelToGif } from "../lib/gif.ts";
import {
  renderWelcomeEmail,
  renderIntroEmail,
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

  const action = doPlayerAction(game, address, body);

  const response = renderEmailTemplate(request, address, action);

  // Return updated game and response
  return { game: action.game, response };
}

function renderEmailTemplate(
  request: EmailRequest,
  address: string,
  { game, template, messages }: ActionResponse,
): EmailResponse {
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
    case "intro":
      gifBytes = renderPlayerView(game, address);
      html = renderIntroEmail({ imageSrc });
      break;
    case "turn":
      gifBytes = renderPlayerView(game, address);
      html = renderTurnEmail({ imageSrc, messages });
      break;
  }

  return {
    to: address,
    from,
    subject,
    html,
    text: htmlToPlainText(html),
    gifBytes,
  };
}

function renderPlayerView(game: GameState, address: string): Uint8Array {
  const player = game.players[address]!;
  return renderLevelToGif(getPlayerLevel(game, player), {}, address);
}
