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

export { Handlebars };
