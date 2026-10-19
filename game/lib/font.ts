import { type SpriteSheet, Surface, Colors } from "./surface.ts";
import { decodePng } from "./png.ts";
import banterPng from "../../assets/banter.png";
import banterJsonData from "../../assets/banter.json" with { type: "json" };

export interface Glyph {
  chr: string;
  x: number;
  y: number;
  w: number;
  h: number;
  off_x: number;
  off_y: number;
  adv: number;
}

export interface FontKerning {
  left: string;
  right: string;
  kern: number;
}

export interface FontData {
  size: number;
  line_gap: number;
  space_w: number;
  glyphs: Glyph[];
  kerning?: FontKerning[];
}

export interface DrawTextOptions {
  align?: "left" | "center" | "right";
  baseline?: "top" | "middle" | "bottom" | "alphabetic";
}

export class Font {
  public sheet: SpriteSheet;
  public data: FontData;
  public glyphMap: Map<string, Glyph> = new Map();
  public kerningMap: Map<string, number> = new Map();

  constructor(sheet: SpriteSheet, data: FontData) {
    this.sheet = sheet;
    this.data = data;

    for (const glyph of data.glyphs) {
      this.glyphMap.set(glyph.chr, glyph);
    }

    if (data.kerning) {
      for (const k of data.kerning) {
        this.kerningMap.set(`${k.left}${k.right}`, k.kern);
      }
    }
  }

  getKerning(left: string, right: string): number {
    return this.kerningMap.get(`${left}${right}`) ?? 0;
  }

  /**
   * Measures the pixel dimensions of a string of text.
   */
  measureText(text: string): { width: number; height: number } {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === " ") {
        width += this.data.space_w;
        continue;
      }

      const glyph = this.glyphMap.get(char);
      if (!glyph) continue;

      const isLast = i === text.length - 1;
      width += isLast ? glyph.off_x + glyph.w : glyph.adv;

      if (!isLast) {
        width += this.getKerning(char, text[i + 1]);
      }
    }
    return { width, height: this.data.size };
  }

  /**
   * Draws a single glyph onto the surface at the given baseline position.
   * Returns the advance width of the glyph.
   */
  drawChar(
    surface: Surface,
    char: string,
    baselineX: number,
    baselineY: number,
    color: number = Colors.White
  ): number {
    if (char === " ") return this.data.space_w;

    const glyph = this.glyphMap.get(char);
    if (!glyph) return 0;

    const gx = Math.floor(baselineX + glyph.off_x);
    const gy = Math.floor(baselineY + glyph.off_y);

    const sheetW = this.sheet.width;
    const sheetH = this.sheet.height;
    const surfW = surface.width;
    const surfH = surface.height;

    const colorAlpha = (color >>> 24) & 0xff;
    const colorR = color & 0xff;
    const colorG = (color >> 8) & 0xff;
    const colorB = (color >> 16) & 0xff;

    for (let py = 0; py < glyph.h; py++) {
      const targetY = gy + py;
      if (targetY < 0 || targetY >= surfH) continue;

      const srcY = glyph.y + py;
      if (srcY < 0 || srcY >= sheetH) continue;

      const targetRow = targetY * surfW;
      const srcRow = srcY * sheetW;

      for (let px = 0; px < glyph.w; px++) {
        const targetX = gx + px;
        if (targetX < 0 || targetX >= surfW) continue;

        const srcX = glyph.x + px;
        if (srcX < 0 || srcX >= sheetW) continue;

        const sheetPixel = this.sheet.pixels[srcRow + srcX];
        const glyphAlpha = (sheetPixel >>> 24) & 0xff;
        if (glyphAlpha === 0) continue;

        if (colorAlpha === 255 && glyphAlpha === 255) {
          surface.pixels[targetRow + targetX] = color;
        } else {
          // Fast alpha blend
          const effAlpha = (glyphAlpha * colorAlpha) >> 8;
          const invAlpha = 255 - effAlpha;
          const bg = surface.pixels[targetRow + targetX];

          const r = ((colorR * effAlpha) + ((bg & 0xff) * invAlpha)) >> 8;
          const g = ((colorG * effAlpha) + (((bg >> 8) & 0xff) * invAlpha)) >> 8;
          const b = ((colorB * effAlpha) + (((bg >> 16) & 0xff) * invAlpha)) >> 8;

          surface.pixels[targetRow + targetX] = (0xff << 24) | (b << 16) | (g << 8) | r;
        }
      }
    }

    return glyph.adv;
  }

  /**
   * Draws a string of text onto the target surface.
   */
  drawText(
    surface: Surface,
    text: string,
    x: number,
    y: number,
    color: number = Colors.White,
    options: DrawTextOptions = {}
  ): { width: number; height: number } {
    const { align = "left", baseline = "top" } = options;
    const metrics = this.measureText(text);

    let startX = x;
    if (align === "center") {
      startX = x - Math.floor(metrics.width / 2);
    } else if (align === "right") {
      startX = x - metrics.width;
    }

    let baselineY = y;
    if (baseline === "top") {
      // For banter font (size 16), ascent is roughly 12px from top
      baselineY = y + 12;
    } else if (baseline === "middle") {
      baselineY = y + 4;
    } else if (baseline === "bottom") {
      baselineY = y - 4;
    }

    let curX = startX;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === " ") {
        curX += this.data.space_w;
        continue;
      }

      const adv = this.drawChar(surface, char, curX, baselineY, color);
      curX += adv;

      if (i < text.length - 1) {
        curX += this.getKerning(char, text[i + 1]);
      }
    }

    return metrics;
  }
}

let cachedFont: Font | null = null;

/**
 * Returns the cached Banter font instance loaded from assets/banter.png and assets/banter.json.
 */
export function getBanterFont(): Font {
  if (!cachedFont) {
    const sheet = decodePng(new Uint8Array(banterPng));
    cachedFont = new Font(sheet, banterJsonData as FontData);
  }
  return cachedFont;
}
