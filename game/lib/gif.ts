import * as gifencModule from "gifenc";
const gifenc = (gifencModule as any).default ?? gifencModule;
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { Surface } from "./surface.ts";
import type { Level } from "../level.ts";
import type { Player } from "../entity/player.ts";

export interface GifOptions {
  delay?: number; // Delay in ms per frame (default: 500)
  repeat?: number; // 0 = loop forever (default: 0)
  maxColors?: number; // max palette colors (default: 256)
  showCoordinates?: boolean; // default: true
  coordinateSides?: "all" | "bottom-left"; // default: "all"
  fontColor?: number;
  borderColor?: number;
}

/**
 * Encodes an array of Surfaces into an animated GIF byte array.
 */
export function encodeSurfacesToGif(
  frames: Surface[],
  options: GifOptions = {}
): Uint8Array {
  if (frames.length === 0) {
    throw new Error("Cannot encode 0 frames to GIF");
  }

  const delay = options.delay ?? 500;
  const repeat = options.repeat ?? 0;
  const maxColors = options.maxColors ?? 256;

  const width = frames[0].width;
  const height = frames[0].height;

  const gif = GIFEncoder();

  for (const frame of frames) {
    const palette = quantize(frame.bytes, maxColors);
    const index = applyPalette(frame.bytes, palette);

    gif.writeFrame(index, width, height, {
      palette,
      delay,
      repeat,
    });
  }

  gif.finish();
  return gif.bytes();
}

/**
 * Helper to render a 2-frame animated GIF for a given Level.
 */
export function renderLevelToGif(
  level: Level,
  tileSize: number = 16,
  options: GifOptions = {},
  forPlayer?: Player
): Uint8Array {
  const showCoordinates = options.showCoordinates ?? true;
  const coordinateSides = options.coordinateSides ?? "all";

  let width: number;
  let height: number;

  if (!showCoordinates) {
    width = level.width * tileSize;
    height = level.height * tileSize;
  } else if (coordinateSides === "bottom-left") {
    width = (level.width + 1) * tileSize;
    height = (level.height + 1) * tileSize;
  } else {
    width = (level.width + 2) * tileSize;
    height = (level.height + 2) * tileSize;
  }

  const frame0 = new Surface(width, height);
  const frame1 = new Surface(width, height);

  level.render(frame0, tileSize, 0, options, forPlayer);
  level.render(frame1, tileSize, 1, options, forPlayer);

  return encodeSurfacesToGif([frame0, frame1], options);
}

