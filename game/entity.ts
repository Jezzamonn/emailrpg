import type { Point } from "./lib/common.ts";
import { type SpriteSheet, Surface, Colors } from "./lib/surface.ts";
import { decodePng } from "./lib/png.ts";
import skinLightPng from "../assets/exported/character-skin-light.png";
import skinMediumPng from "../assets/exported/character-skin-medium.png";
import skinDarkPng from "../assets/exported/character-skin-dark.png";
import clothesRedPng from "../assets/exported/character-clothes-red.png";
import clothesBluePng from "../assets/exported/character-clothes-blue.png";
import clothesGreenPng from "../assets/exported/character-clothes-green.png";
import spikehairBlondePng from "../assets/exported/character-spikehair-blonde.png";
import spikehairBrownPng from "../assets/exported/character-spikehair-brown.png";
import spikehairBlackPng from "../assets/exported/character-spikehair-black.png";
import ponytailBlondePng from "../assets/exported/character-ponytail-blonde.png";
import ponytailBrownPng from "../assets/exported/character-ponytail-brown.png";
import ponytailBlackPng from "../assets/exported/character-ponytail-black.png";

// Size of a tile in pixels, which is also the size of the player sprites.
export const TILE_SIZE = 30;

export type EntityGroup = "player" | "enemy" | "obstacle";
export type EntityType = "player" | "ortho" | "diag" | "knight" | "slow";

export function entityGroupOf(type: EntityType): EntityGroup {
  if (type === "player") return "player";
  return "enemy";
}

export type HairType = "short" | "ponytail" | "bald";
export type HairColor = "blonde" | "brown" | "black";
export type SkinColor = "light" | "medium" | "dark";
export type ClothesColor = "red" | "blue" | "green";

export interface PlayerAppearance {
  hairType: HairType;
  hairColor: HairColor;
  skinColor: SkinColor;
  clothesColor: ClothesColor;
}

export interface EntityState {
  type: EntityType;
  p: Point;
  playerId?: string;
  appearance?: PlayerAppearance;
  cooldown?: number;
}

const PLAYER_SPRITE_DATA = {
  skin: {
    light: skinLightPng,
    medium: skinMediumPng,
    dark: skinDarkPng,
  },
  clothes: {
    red: clothesRedPng,
    blue: clothesBluePng,
    green: clothesGreenPng,
  },
  hair: {
    short: {
      blonde: spikehairBlondePng,
      brown: spikehairBrownPng,
      black: spikehairBlackPng,
    },
    ponytail: {
      blonde: ponytailBlondePng,
      brown: ponytailBrownPng,
      black: ponytailBlackPng,
    },
  },
} as const;

const decodedSprites = new Map<ArrayBuffer, SpriteSheet>();

function getSprite(data: ArrayBuffer): SpriteSheet {
  let sheet = decodedSprites.get(data);
  if (!sheet) {
    sheet = decodePng(new Uint8Array(data));
    decodedSprites.set(data, sheet);
  }
  return sheet;
}

function playerSpriteLayers(appearance: PlayerAppearance): SpriteSheet[] {
  const layers = [
    PLAYER_SPRITE_DATA.skin[appearance.skinColor],
    PLAYER_SPRITE_DATA.clothes[appearance.clothesColor],
  ];
  if (appearance.hairType !== "bald") {
    layers.push(
      PLAYER_SPRITE_DATA.hair[appearance.hairType][appearance.hairColor],
    );
  }
  return layers.map(getSprite);
}

export function renderEntity(
  surface: Surface,
  entity: EntityState,
  frame: number = 0,
): void {
  const px = entity.p.x * TILE_SIZE;
  const py = entity.p.y * TILE_SIZE;

  if (entity.type === "player" && entity.appearance) {
    // Each sprite sheet has one TILE_SIZE wide frame per animation frame.
    for (const sheet of playerSpriteLayers(entity.appearance)) {
      surface.drawSprite(
        sheet,
        frame * TILE_SIZE,
        0,
        TILE_SIZE,
        TILE_SIZE,
        px,
        py,
      );
    }
    return;
  }

  const yOffset = frame === 1 ? -1 : 0;
  const dy = py + yOffset;

  if (entity.type === "player") {
    surface.fillRect(
      px + 2,
      dy + 2,
      TILE_SIZE - 4,
      TILE_SIZE - 4,
      Colors.Yellow,
    );
    surface.strokeRect(
      px + 1,
      dy + 1,
      TILE_SIZE - 2,
      TILE_SIZE - 2,
      Colors.White,
    );
  } else if (entityGroupOf(entity.type) === "enemy") {
    surface.fillRect(px + 2, dy + 2, TILE_SIZE - 4, TILE_SIZE - 4, Colors.Red);
  } else {
    surface.fillRect(
      px + 2,
      dy + 2,
      TILE_SIZE - 4,
      TILE_SIZE - 4,
      Colors.LightGrey,
    );
  }
}
