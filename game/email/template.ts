import Handlebars from "handlebars";
import { convert } from "html-to-text";
import welcomeTemplateSource from "./welcome.html.hbs";
import introTemplateSource from "./intro.html.hbs";
import turnTemplateSource from "./turn.html.hbs";

export interface WelcomeTemplateContext {
  [key: string]: unknown;
}

export interface IntroPlayerContext {
  char: string;
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
 * Strips HTML tags and converts formatted HTML into clean plain text using html-to-text.
 */
export function htmlToPlainText(html: string): string {
  return convert(html, {
    wordwrap: false,
    formatters: {
      imageAltOnly: (elem, _walk, builder) => {
        const alt = elem.attribs?.alt;
        if (alt) {
          builder.addInline(`[${alt}]`);
        }
      },
    },
    selectors: [
      { selector: "img", format: "imageAltOnly" },
      { selector: "a", options: { ignoreHref: true } },
      { selector: "ul", options: { itemPrefix: "  - " } },
      { selector: "h1", options: { uppercase: false } },
      { selector: "h2", options: { uppercase: false } },
      { selector: "h3", options: { uppercase: false } },
    ],
  }).trim();
}

export { Handlebars };
