import type { Point } from "./lib/common.ts";

export type { Point };

export type EntityGroup = "player" | "enemy" | "obstacle";
export type EntityType = "player" | "ortho" | "diag" | "knight" | "slow";

export function entityGroupOf(type: EntityType): EntityGroup {
  if (type === "player") return "player";
  return "enemy";
}

export interface LevelState {
  width: number;
  height: number;
  entities: EntityState[];
}

export interface EntityState {
  type: EntityType;
  p: Point;
  playerId?: string;
  cooldown?: number;
}

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
