import { FIGHTER_STATS, type FighterStatsDef } from "../config/gameConfig.ts";
import type { FighterId } from "../config/secretConfig.ts";

/**
 * Per-frame multipliers applied on top of a fighter's base stats.
 *
 * Everything the balancing layer does flows through this object, which keeps
 * the fighter itself completely unaware of why it is slightly stronger or
 * slower at any given moment.
 */
export interface StatModifiers {
  /** Multiplies outgoing damage. */
  damage: number;
  /** Divides incoming damage. */
  defense: number;
  /** Multiplies attack startup + recovery (lower = snappier). */
  recovery: number;
  /** Multiplies walk speed. */
  speed: number;
  /** Multiplies how much damage gets through this fighter's block. */
  blockLeak: number;
}

export function neutralModifiers(): StatModifiers {
  return { damage: 1, defense: 1, recovery: 1, speed: 1, blockLeak: 1 };
}

export function baseStats(id: FighterId): FighterStatsDef {
  return FIGHTER_STATS[id];
}
