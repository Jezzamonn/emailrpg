import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { Surface } from "./surface.ts";
import type { Level } from "../level.ts";

export interface GifOptions {
  delay?: number; // Delay in ms per frame (default: 500)
  repeat?: number; // 0 = loop forever (default: 0)
  maxColors?: number; // max palette colors (default: 256)
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
  options: GifOptions = {}
): Uint8Array {
  const width = level.width * tileSize;
  const height = level.height * tileSize;

  const frame0 = new Surface(width, height);
  const frame1 = new Surface(width, height);

  level.render(frame0, tileSize, 0);
  level.render(frame1, tileSize, 1);

  return encodeSurfacesToGif([frame0, frame1], options);
}

