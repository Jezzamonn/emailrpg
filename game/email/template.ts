import Handlebars from "handlebars";
import { convert } from "html-to-text";
import welcomeTemplateSource from "./template/welcome.html";
import introTemplateSource from "./template/intro.html";
import turnTemplateSource from "./template/turn.html";
import errorTemplateSource from "./template/error.html";
import customizationErrorTemplateSource from "./template/customization-error.html";

export type ImageIdAndBytes = Record<string, Uint8Array>;

export interface WelcomeTemplateContext {
  images?: ImageIdAndBytes;
}

export interface IntroTemplateContext {
  images: ImageIdAndBytes;
}

export interface TurnTemplateContext {
  images: ImageIdAndBytes;
  messages: string[];
}

export interface ErrorTemplateContext {
  images: ImageIdAndBytes;
  [key: string]: unknown;
}

export type CustomizationErrorTemplateContext = Record<string, string>;

export const welcomeTemplate = Handlebars.compile(welcomeTemplateSource);
export const introTemplate = Handlebars.compile(introTemplateSource);
export const turnTemplate = Handlebars.compile(turnTemplateSource);
export const errorTemplate = Handlebars.compile(errorTemplateSource);
export const customizationErrorTemplate = Handlebars.compile(
  customizationErrorTemplateSource,
);

export function renderWelcomeEmail(context: WelcomeTemplateContext = {}): string {
  return welcomeTemplate(context).trim();
}

export function renderIntroEmail(context: IntroTemplateContext): string {
  return introTemplate(context).trim();
}

export function renderTurnEmail(context: TurnTemplateContext): string {
  return turnTemplate(context).trim();
}

export function renderErrorEmail(context: ErrorTemplateContext): string {
  return errorTemplate(context).trim();
}

export function renderCustomizationErrorEmail(
  context: CustomizationErrorTemplateContext,
): string {
  return customizationErrorTemplate(context).trim();
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
