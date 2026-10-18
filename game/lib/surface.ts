export interface SpriteSheet {
  width: number;
  height: number;
  pixels: Uint32Array;
}

/**
 * Creates a 32-bit packed RGBA color integer in little-endian format (0xAABBGGRR).
 */
export function rgba(r: number, g: number, b: number, a: number = 255): number {
  return ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

/**
 * Common color palette constants for quick prototyping.
 */
export const Colors = {
  Transparent: 0,
  Black: rgba(0, 0, 0),
  White: rgba(255, 255, 255),
  Red: rgba(230, 57, 70),
  Green: rgba(42, 157, 143),
  Blue: rgba(69, 123, 157),
  Yellow: rgba(233, 196, 106),
  Orange: rgba(244, 162, 97),
  DarkGrey: rgba(30, 30, 30),
  LightGrey: rgba(180, 180, 180),
} as const;

export class Surface implements SpriteSheet {
  public width: number;
  public height: number;
  public buffer: ArrayBuffer;
  public pixels: Uint32Array;
  public bytes: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.buffer = new ArrayBuffer(width * height * 4);
    this.pixels = new Uint32Array(this.buffer);
    this.bytes = new Uint8ClampedArray(this.buffer);
  }

  clear(color: number = 0): void {
    this.pixels.fill(color);
  }

  setPixel(x: number, y: number, color: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.pixels[y * this.width + x] = color;
    }
  }

  getPixel(x: number, y: number): number {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.pixels[y * this.width + x];
    }
    return 0;
  }

  fillRect(x: number, y: number, w: number, h: number, color: number): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.floor(x + w));
    const y1 = Math.min(this.height, Math.floor(y + h));

    for (let py = y0; py < y1; py++) {
      const rowStart = py * this.width;
      this.pixels.fill(color, rowStart + x0, rowStart + x1);
    }
  }

  strokeRect(x: number, y: number, w: number, h: number, color: number): void {
    this.fillRect(x, y, w, 1, color);
    this.fillRect(x, y + h - 1, w, 1, color);
    this.fillRect(x, y, 1, h, color);
    this.fillRect(x + w - 1, y, 1, h, color);
  }

  /**
   * Blits a sprite rectangle from a spritesheet/surface with alpha blending.
   */
  drawSprite(
    sheet: SpriteSheet,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    flipX: boolean = false
  ): void {
    const floorDx = Math.floor(dx);
    const floorDy = Math.floor(dy);

    for (let py = 0; py < sh; py++) {
      const targetY = floorDy + py;
      if (targetY < 0 || targetY >= this.height) continue;

      const srcY = sy + py;
      if (srcY < 0 || srcY >= sheet.height) continue;

      const targetRow = targetY * this.width;
      const srcRow = srcY * sheet.width;

      for (let px = 0; px < sw; px++) {
        const targetX = floorDx + px;
        if (targetX < 0 || targetX >= this.width) continue;

        const srcX = flipX ? sx + (sw - 1 - px) : sx + px;
        if (srcX < 0 || srcX >= sheet.width) continue;

        const pixel = sheet.pixels[srcRow + srcX];
        // Skip fully transparent pixels
        const alpha = (pixel >>> 24) & 0xff;
        if (alpha === 0) continue;

        // Fully opaque: direct 32-bit copy
        if (alpha === 255) {
          this.pixels[targetRow + targetX] = pixel;
        } else {
          // Fast alpha blend
          const invAlpha = 255 - alpha;
          const bg = this.pixels[targetRow + targetX];

          const r = (((pixel & 0xff) * alpha) + ((bg & 0xff) * invAlpha)) >> 8;
          const g = ((((pixel >> 8) & 0xff) * alpha) + (((bg >> 8) & 0xff) * invAlpha)) >> 8;
          const b = ((((pixel >> 16) & 0xff) * alpha) + (((bg >> 16) & 0xff) * invAlpha)) >> 8;

          this.pixels[targetRow + targetX] = (0xff << 24) | (b << 16) | (g << 8) | r;
        }
      }
    }
  }

  drawSurface(source: Surface, dx: number, dy: number): void {
    this.drawSprite(source, 0, 0, source.width, source.height, dx, dy);
  }

  clone(): Surface {
    const copy = new Surface(this.width, this.height);
    copy.pixels.set(this.pixels);
    return copy;
  }
}

