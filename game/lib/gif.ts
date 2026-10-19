import * as gifencModule from "gifenc";
const gifenc = (gifencModule as any).default ?? gifencModule;
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { Surface } from "./surface.ts";

export interface GifOptions {
  delay?: number; // Delay in ms per frame (default: 100)
  repeat?: number; // 0 = loop forever (default: 0)
  maxColors?: number; // max palette colors (default: 256)
  showCoordinates?: boolean; // default: true
  coordinateSides?: "all" | "bottom-left"; // default: "all"
  fontColor?: number;
  borderColor?: number;
  rng?: () => number;
  seed?: string;
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

  const delay = options.delay ?? 100;
  const repeat = options.repeat ?? 0;
  const maxColors = options.maxColors ?? 256;

  const width = frames[0].width;
  const height = frames[0].height;

  const gif = GIFEncoder();

  for (const frame of frames) {
    let hasTransparency = false;
    for (let i = 3; i < frame.bytes.length; i += 4) {
      if (frame.bytes[i] === 0) {
        hasTransparency = true;
        break;
      }
    }

    if (hasTransparency) {
      const palette = quantize(frame.bytes, maxColors, { format: "rgba4444" });
      const index = applyPalette(frame.bytes, palette, { format: "rgba4444" });
      const transparentIndex = palette.findIndex((p: number[]) => p[3] === 0);
      gif.writeFrame(index, width, height, {
        palette,
        delay,
        repeat,
        transparent: transparentIndex !== -1,
        transparentIndex: transparentIndex !== -1 ? transparentIndex : undefined,
      });
    } else {
      const palette = quantize(frame.bytes, maxColors);
      const index = applyPalette(frame.bytes, palette);
      gif.writeFrame(index, width, height, {
        palette,
        delay,
        repeat,
      });
    }
  }

  gif.finish();
  return gif.bytes();
}

import { renderLevel, type LevelState } from "../level.ts";
import { renderEntity, TILE_SIZE, type PlayerAppearance } from "../entity.ts";
import { seededRandom } from "./util.ts";

/**
 * Helper to render an array of player appearances side-by-side into an animated GIF.
 */
export function renderAppearancesToGif(
  appearances: PlayerAppearance[],
  options: GifOptions = {},
): Uint8Array {
  const width = appearances.length * TILE_SIZE;
  const height = TILE_SIZE;

  const frame0 = new Surface(width, height);
  const frame1 = new Surface(width, height);

  for (let i = 0; i < appearances.length; i++) {
    renderEntity(
      frame0,
      { type: "player", p: { x: i, y: 0 }, appearance: appearances[i] },
      0,
    );
    renderEntity(
      frame1,
      { type: "player", p: { x: i, y: 0 }, appearance: appearances[i] },
      1,
    );
  }

  return encodeSurfacesToGif([frame0, frame1], options);
}

/**
 * Helper to render a 2-frame animated GIF for a given Level.
 */
export function renderLevelToGif(
  level: LevelState,
  options: GifOptions = {},
  forPlayer: string,
): Uint8Array {
  const showCoordinates = options.showCoordinates ?? true;
  const coordinateSides = options.coordinateSides ?? "all";

  let width: number;
  let height: number;

  if (!showCoordinates) {
    width = level.width * TILE_SIZE;
    height = level.height * TILE_SIZE;
  } else if (coordinateSides === "bottom-left") {
    width = (level.width + 1) * TILE_SIZE;
    height = (level.height + 1) * TILE_SIZE;
  } else {
    width = (level.width + 2) * TILE_SIZE;
    height = (level.height + 2) * TILE_SIZE;
  }

  const frame0 = new Surface(width, height);
  const frame1 = new Surface(width, height);

  const seed = options.seed ?? "entities";
  const rng0 = seededRandom(seed);
  const rng1 = seededRandom(seed);

  renderLevel(frame0, level, 0, { ...options, rng: rng0 }, forPlayer);
  renderLevel(frame1, level, 1, { ...options, rng: rng1 }, forPlayer);

  return encodeSurfacesToGif([frame0, frame1], options);
}

