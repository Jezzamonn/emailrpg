import Handlebars from "handlebars";
import welcomeTemplateSource from "./welcome.html.hbs";
import introTemplateSource from "./intro.html.hbs";
import turnTemplateSource from "./turn.html.hbs";

export interface WelcomeTemplateContext {
  [key: string]: unknown;
}

export interface IntroPlayerContext {
  char: string;
  letter: string;
  displayX: number;
  displayY: number;
}

export interface IntroTemplateContext {
  player: IntroPlayerContext;
  imageSrc: string;
}

export interface TurnTemplateContext {
  locationInfo: string;
  command: string;
  commandExecuted: boolean;
  rulesNote: string;
  imageSrc: string;
  inDungeon: boolean;
  enemiesPresent: boolean;
}

export const welcomeTemplate = Handlebars.compile(welcomeTemplateSource);
export const introTemplate = Handlebars.compile(introTemplateSource);
export const turnTemplate = Handlebars.compile(turnTemplateSource);

export function renderWelcomeEmail(
  context: WelcomeTemplateContext = {}
): string {
  return welcomeTemplate(context).trim();
}

export function renderIntroEmail(context: IntroTemplateContext): string {
  return introTemplate(context).trim();
}

export function renderTurnEmail(context: TurnTemplateContext): string {
  return turnTemplate(context).trim();
}

/**
 * Strips HTML tags and converts formatted HTML into clean plain text.
 */
export function htmlToPlainText(html: string): string {
  return html
    // Replace <img ... alt="alt text" ...> with [alt text]
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, "[$1]")
    .replace(/<img[^>]*>/gi, "[image]")
    // Replace <br> with newline
    .replace(/<br\s*\/?>/gi, "\n")
    // Replace list elements cleanly without extra blank lines
    .replace(/\s*<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<\/(ul|ol)>/gi, "\n\n")
    // Headers
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<h[1-6][^>]*>/gi, "\n\n")
    // Block containers
    .replace(/<\/(p|div|table|blockquote|section|header|footer)>/gi, "\n")
    .replace(/<(p|div|table|blockquote|section|header|footer)[^>]*>/gi, "\n")
    // Strip remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode HTML entities
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    // Normalize lines: trim whitespace on each line, collapse multiple empty lines to at most one
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0))
    .join("\n")
    .trim();
}

export { Handlebars };
