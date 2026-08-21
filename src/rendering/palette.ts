/** Original neon-arcade colour identity. Nothing borrowed. */

export const PALETTE = {
  bgDeep: "#0a0714",
  bgMid: "#140d28",
  bgFar: "#1d1240",
  neonPink: "#ff3d81",
  neonCyan: "#3df0ff",
  neonPurple: "#a94dff",
  neonYellow: "#ffd23d",
  neonGreen: "#4dffa3",
  white: "#fdf7ff",
  black: "#05030b",
  floor: "#1a1030",
  floorLine: "#42277a",
};

/** Colour scheme shared by both fighters. */
export interface FighterColors {
  primary: string;
  secondary: string;
  accent: string;
  skin: string;
  skinShadow: string;
  hair: string;
  trim: string;
  /** Health bar fill. */
  bar: string;
  /** Health bar highlight and glow. */
  barGlow: string;
  /** Outline colour for gloves and boots. */
  outline: string;
}

/** Per-fighter colour schemes, used for both sprites and HUD. */
export const FIGHTER_COLORS: Record<"male" | "female", FighterColors> = {
  male: {
    primary: "#3d8bff",
    secondary: "#1c4fb8",
    accent: "#ffd23d",
    skin: "#e8b088",
    skinShadow: "#c98d66",
    hair: "#2b1b14",
    trim: "#7fd0ff",
    bar: "#3d8bff",
    barGlow: "#8fc4ff",
    outline: "#0a1226",
  },
  female: {
    primary: "#ff3d81",
    secondary: "#b81c5a",
    accent: "#3df0ff",
    skin: "#f0bb96",
    skinShadow: "#d1997a",
    hair: "#4a1030",
    trim: "#ff9ec4",
    bar: "#ff3d81",
    barGlow: "#ffa0c6",
    outline: "#26060f",
  },
};
