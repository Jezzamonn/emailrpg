export interface Point {
  x: number;
  y: number;
}

export const Points = {
  add(p1: Point, p2: Point): Point {
    return { x: p1.x + p2.x, y: p1.y + p2.y };
  },

  addTo(p1: Point, p2: Point): void {
    p1.x += p2.x;
    p1.y += p2.y;
  },

  copyInto(p1: Point, p2: Point): void {
    p1.x = p2.x;
    p1.y = p2.y;
  },

  scale(p: Point, factor: number): Point {
    return { x: p.x * factor, y: p.y * factor };
  },
};

export const Dir = {
  Up: 0,
  Down: 1,
  Left: 2,
  Right: 3,
} as const;
export type Dir = (typeof Dir)[keyof typeof Dir];

export const Dirs = {
  toPoint(dir: Dir): Point {
    switch (dir) {
      case Dir.Up:
        return { x: 0, y: -1 };
      case Dir.Down:
        return { x: 0, y: 1 };
      case Dir.Left:
        return { x: -1, y: 0 };
      case Dir.Right:
        return { x: 1, y: 0 };
    }
  },

  cornersInDirection(dir: Dir | undefined): Point[] {
    // What we have to multiply the width and height by to get the corners of an rectangle if the given direction.
    switch (dir) {
      case Dir.Up:
        return [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ];
      case Dir.Down:
        return [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ];
      case Dir.Left:
        return [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
        ];
      case Dir.Right:
        return [
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ];
      default:
        // Every corner
        return [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ];
    }
  },

  fromString(dir: string): Dir | undefined {
    switch (dir.toLowerCase()) {
      case "up":
      case "u":
      case "north":
      case "n":
        return Dir.Up;
      case "down":
      case "d":
      case "south":
      case "s":
        return Dir.Down;
      case "left":
      case "l":
      case "west":
      case "w":
        return Dir.Left;
      case "right":
      case "r":
      case "east":
      case "e":
        return Dir.Right;
      default:
        return undefined;
    }
  },
};

export function getColumnLetter(colIndex: number): string {
  let s = "";
  let n = colIndex;
  while (n >= 0) {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export function parseColumnLetters(letters: string): number {
  let n = 0;
  const lower = letters.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const code = lower.charCodeAt(i) - 97; // a=0, b=1, ...
    if (code < 0 || code > 25) {
      return -1;
    }
    n = n * 26 + (code + 1);
  }
  return n - 1;
}

export function coordToPoint(
  col: string,
  row: number,
  levelHeight: number,
): Point {
  return {
    x: parseColumnLetters(col),
    y: levelHeight - row,
  };
}

export function pointToCoord(p: Point, levelHeight: number): string {
  return `${getColumnLetter(p.x)}${levelHeight - p.y}`;
}
