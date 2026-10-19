import type { LevelState } from "./index.ts";
import type { Point } from "./lib/common.ts";

export type { Point };

export type UserState = "awaiting_customization" | "active";

export interface PlayerState {
  email: string;
  state: UserState;
  appearance?: PlayerAppearance;
  p: Point;
  currentLevel?: LevelState;
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
