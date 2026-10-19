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
  type ImageIdAndBytes,
} from "./template.ts";

export interface EmailRequest {
  from: string;
  subject?: string;
  body: string;
}

export interface EmailResponse {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  images: ImageIdAndBytes;
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

  let images: ImageIdAndBytes = {};

  let html: string;
  switch (template) {
    case "newplayer":
      html = renderWelcomeEmail();
      break;
    case "intro":
      images["game_view"] = renderPlayerView(game, address);
      html = renderIntroEmail({ images });
      break;
    case "turn":
      images["game_view"] = renderPlayerView(game, address);
      html = renderTurnEmail({ images, messages });
      break;
  }

  return {
    to: address,
    from,
    subject,
    html,
    text: htmlToPlainText(html),
    images,
  };
}

function renderPlayerView(game: GameState, address: string): Uint8Array {
  const player = game.players[address]!;
  return renderLevelToGif(getPlayerLevel(game, player), {}, address);
}
