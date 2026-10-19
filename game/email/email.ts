import {
  doPlayerAction,
  getPlayerLevel,
  type ActionResponse,
  type GameState,
} from "../game.ts";
import { renderLevelToGif, renderAppearanceToGif } from "../lib/gif.ts";
import {
  renderWelcomeEmail,
  renderIntroEmail,
  renderTurnEmail,
  renderLevelEnterEmail,
  renderLevelCompleteEmail,
  renderErrorEmail,
  renderCustomizationErrorEmail,
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

/**
 * Extracts only the new text written by the user in an email reply,
 * stripping quoted blocks and reply headers (e.g. `>`, `On ... wrote:`,
 * `--- Original Message ---`, `From: ...`).
 */
export function extractReplyText(body: string): string {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Quoted line starting with ">"
    if (trimmed.startsWith(">")) {
      break;
    }

    // Standard separator lines like "--- Original Message ---" or "________"
    if (
      /^-{2,}\s*(?:original message|forwarded message)\s*-{2,}$/i.test(
        trimmed,
      ) ||
      /^_{5,}$/.test(trimmed)
    ) {
      break;
    }

    // "On <date>, <sender> wrote:" (possibly wrapped across two lines)
    if (/^on\s+.+wrote:\s*$/i.test(trimmed)) {
      break;
    }
    if (
      /^on\s+.+/i.test(trimmed) &&
      i + 1 < lines.length &&
      /wrote:\s*$/i.test(lines[i + 1].trim())
    ) {
      break;
    }

    // Outlook-style "From: ..." header block
    if (
      /^from:\s+.+/i.test(trimmed) &&
      i + 1 < lines.length &&
      /^(?:sent|date|to|subject):\s+/i.test(lines[i + 1].trim())
    ) {
      break;
    }

    resultLines.push(line);
  }

  return resultLines.join("\n").trim();
}

export function handleIncomingEmail(
  game: GameState,
  request: EmailRequest,
): { game: GameState; response: EmailResponse } {
  // TODO: Check some things about the email? E.g. don't reply to multiple people???

  // Parse email address and body of email
  const address = request.from.toLowerCase().trim();
  const body = extractReplyText(request.body);

  const action = doPlayerAction(game, address, body);

  const response = renderEmailTemplate(request, address, action);

  // Return updated game and response
  return { game: action.games[action.games.length - 1]!, response };
}

function renderEmailTemplate(
  request: EmailRequest,
  address: string,
  { games, template, messages, additionalData }: ActionResponse,
): EmailResponse {
  const from = "game@emailrpg.com";
  const incomingSubject = request.subject || "";
  const subject = incomingSubject.toLowerCase().startsWith("re:")
    ? incomingSubject
    : `Re: ${incomingSubject}`;

  const lastGame = games[games.length - 1]!;
  let images: ImageIdAndBytes = {};

  let html: string;
  switch (template) {
    case "newplayer":
      images = renderCustomizationImages();
      html = renderWelcomeEmail({ images });
      break;
    case "intro":
      images["game_view"] = renderPlayerView(lastGame, address);
      html = renderIntroEmail({ images });
      break;
    case "turn":
      images["game_view"] = renderPlayerView(games[0]!, address);
      if (games.length > 1) {
        images["hub_view"] = renderPlayerView(lastGame, address);
      }
      html = renderTurnEmail({ images, messages });
      break;
    case "level_enter":
      images["game_view"] = renderPlayerView(lastGame, address);
      html = renderLevelEnterEmail(additionalData.level!, { images, messages });
      break;
    case "level_complete":
      images["game_view"] = renderPlayerView(games[0]!, address);
      images["hub_view"] = renderPlayerView(lastGame, address);
      html = renderLevelCompleteEmail(additionalData.level!, {
        images,
        messages,
      });
      break;
    case "error":
      images["game_view"] = renderPlayerView(lastGame, address);
      html = renderErrorEmail({ images, ...additionalData });
      break;
    case "customization_error":
      html = renderCustomizationErrorEmail(additionalData);
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

export function renderCustomizationImages(): ImageIdAndBytes {
  return {
    short_brown_hair_light_skin_green_clothes: renderAppearanceToGif({
      hairType: "short",
      hairColor: "brown",
      skinColor: "light",
      clothesColor: "green",
    }),
    blonde_ponytail_medium_skin_blue_clothes: renderAppearanceToGif({
      hairType: "ponytail",
      hairColor: "blonde",
      skinColor: "medium",
      clothesColor: "blue",
    }),
    bald_dark_skin_red_clothes: renderAppearanceToGif({
      hairType: "bald",
      hairColor: "brown",
      skinColor: "dark",
      clothesColor: "red",
    }),
    black_hair_medium_skin_green_clothes: renderAppearanceToGif({
      hairType: "short",
      hairColor: "black",
      skinColor: "medium",
      clothesColor: "green",
    }),
  };
}

function renderPlayerView(game: GameState, address: string): Uint8Array {
  const player = game.players[address]!;
  return renderLevelToGif(
    getPlayerLevel(game, player),
    { completedLevels: player.completedLevels },
    address,
  );
}
