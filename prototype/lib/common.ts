export interface Point {
  x: number;
  y: number;
}

export enum Dir {
  Up,
  Down,
  Left,
  Right,
}

export const Dirs = {
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
