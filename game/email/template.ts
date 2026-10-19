import Handlebars from "handlebars";
import { convert } from "html-to-text";
import welcomeTemplateSource from "./templates/welcome.html";
import customizationTemplateSource from "./templates/customization.html";
import introTemplateSource from "./templates/intro.html";
import turnTemplateSource from "./templates/turn.html";
import errorTemplateSource from "./templates/error.html";
import customizationErrorTemplateSource from "./templates/customization-error.html";
import ratAndBatEnterSource from "./templates/levels/rat-and-bat/enter.html";
import ratAndBatCompleteSource from "./templates/levels/rat-and-bat/complete.html";
import snailEnterSource from "./templates/levels/snail/enter.html";
import snailCompleteSource from "./templates/levels/snail/complete.html";
import horsiesEnterSource from "./templates/levels/horsies/enter.html";
import horsiesCompleteSource from "./templates/levels/horsies/complete.html";
import everyoneEnterSource from "./templates/levels/everyone/enter.html";
import everyoneCompleteSource from "./templates/levels/everyone/complete.html";
import type { ChatMessage } from "../game.ts";

export type ImageIdAndBytes = Record<string, Uint8Array>;

export interface WelcomeTemplateContext {
  images?: ImageIdAndBytes;
}

export interface CustomizationTemplateContext {
  images?: ImageIdAndBytes;
  name?: string;
}

export interface IntroTemplateContext {
  images: ImageIdAndBytes;
  chatMessages?: ChatMessage[];
}

export interface TurnTemplateContext {
  images: ImageIdAndBytes;
  messages: string[];
  chatMessages?: ChatMessage[];
  // What the player just did, e.g. "You move left 2 squares."
  action?: string;
}

export interface ErrorTemplateContext {
  images: ImageIdAndBytes;
  [key: string]: unknown;
}

export type CustomizationErrorTemplateContext = Record<string, string>;

export interface LevelTemplateContext {
  images: ImageIdAndBytes;
  messages: string[];
  chatMessages?: ChatMessage[];
  // What the player just did, e.g. "You move left 2 squares."
  action?: string;
}

function resolvePath(
  path: hbs.AST.PathExpression,
  stack: unknown[],
): unknown {
  const idx = Math.max(0, stack.length - 1 - (path.depth ?? 0));
  let current: any = stack[idx];
  for (const part of path.parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function evaluateProgram(
  program: hbs.AST.Program | undefined | null,
  stack: unknown[],
): string {
  if (!program) return "";
  let out = "";
  for (const stmt of program.body) {
    switch (stmt.type) {
      case "ContentStatement":
        out += (stmt as hbs.AST.ContentStatement).value;
        break;
      case "MustacheStatement": {
        const mustache = stmt as hbs.AST.MustacheStatement;
        const val =
          mustache.path.type === "PathExpression"
            ? resolvePath(mustache.path as hbs.AST.PathExpression, stack)
            : undefined;
        if (val != null && val !== false) {
          const str = String(val);
          out += mustache.escaped ? Handlebars.escapeExpression(str) : str;
        }
        break;
      }
      case "BlockStatement": {
        const block = stmt as hbs.AST.BlockStatement;
        const path = block.path as hbs.AST.PathExpression;
        const name = path.original;
        if (name === "if" || name === "unless") {
          const param = block.params[0] as hbs.AST.PathExpression | undefined;
          const val = param ? resolvePath(param, stack) : undefined;
          const isTruthy = !Handlebars.Utils.isEmpty(val);
          const cond = name === "if" ? isTruthy : !isTruthy;
          out += evaluateProgram(
            cond ? block.program : block.inverse,
            stack,
          );
        } else if (name === "each") {
          const param = block.params[0] as hbs.AST.PathExpression | undefined;
          const list = param ? resolvePath(param, stack) : undefined;
          if (Array.isArray(list) && list.length > 0) {
            for (const item of list) {
              out += evaluateProgram(block.program, [...stack, item]);
            }
          } else if (list && typeof list === "object" && !Array.isArray(list)) {
            const values = Object.values(list);
            if (values.length > 0) {
              for (const item of values) {
                out += evaluateProgram(block.program, [...stack, item]);
              }
            } else {
              out += evaluateProgram(block.inverse, stack);
            }
          } else {
            out += evaluateProgram(block.inverse, stack);
          }
        } else {
          const val = resolvePath(path, stack);
          if (Array.isArray(val)) {
            if (val.length > 0) {
              for (const item of val) {
                out += evaluateProgram(block.program, [...stack, item]);
              }
            } else {
              out += evaluateProgram(block.inverse, stack);
            }
          } else if (!Handlebars.Utils.isEmpty(val)) {
            const nextStack =
              typeof val === "object" && val !== null ? [...stack, val] : stack;
            out += evaluateProgram(block.program, nextStack);
          } else {
            out += evaluateProgram(block.inverse, stack);
          }
        }
        break;
      }
    }
  }
  return out;
}

function compileTemplate<T = any>(source: string): (context?: T) => string {
  const ast = Handlebars.parse(source);
  return (context?: T) => evaluateProgram(ast, [context ?? {}]);
}

export const welcomeTemplate = compileTemplate<WelcomeTemplateContext>(welcomeTemplateSource);
export const customizationTemplate = compileTemplate<CustomizationTemplateContext>(
  customizationTemplateSource,
);
export const introTemplate = compileTemplate<IntroTemplateContext>(introTemplateSource);
export const turnTemplate = compileTemplate<TurnTemplateContext>(turnTemplateSource);
export const errorTemplate = compileTemplate<ErrorTemplateContext>(errorTemplateSource);
export const customizationErrorTemplate = compileTemplate<CustomizationErrorTemplateContext>(
  customizationErrorTemplateSource,
);

// Per-level templates, keyed by dungeon name (see PREGENERATED_DUNGEONS).
const levelTemplates: Record<
  string,
  {
    enter: (context?: LevelTemplateContext) => string;
    complete: (context?: LevelTemplateContext) => string;
  }
> = {
  "rat-and-bat": {
    enter: compileTemplate(ratAndBatEnterSource),
    complete: compileTemplate(ratAndBatCompleteSource),
  },
  snail: {
    enter: compileTemplate(snailEnterSource),
    complete: compileTemplate(snailCompleteSource),
  },
  horsies: {
    enter: compileTemplate(horsiesEnterSource),
    complete: compileTemplate(horsiesCompleteSource),
  },
  everyone: {
    enter: compileTemplate(everyoneEnterSource),
    complete: compileTemplate(everyoneCompleteSource),
  },
};

export function renderWelcomeEmail(context: WelcomeTemplateContext = {}): string {
  return welcomeTemplate(context).trim();
}

export function renderCustomizationEmail(
  context: CustomizationTemplateContext = {},
): string {
  return customizationTemplate(context).trim();
}

export function renderIntroEmail(context: IntroTemplateContext): string {
  return introTemplate(context).trim();
}

export function renderTurnEmail(context: TurnTemplateContext): string {
  return turnTemplate(context).trim();
}

// Levels without their own template fall back to the regular turn email.
export function renderLevelEnterEmail(
  level: string,
  context: LevelTemplateContext,
): string {
  return (levelTemplates[level]?.enter ?? turnTemplate)(context).trim();
}

export function renderLevelCompleteEmail(
  level: string,
  context: LevelTemplateContext,
): string {
  return (levelTemplates[level]?.complete ?? turnTemplate)(context).trim();
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
