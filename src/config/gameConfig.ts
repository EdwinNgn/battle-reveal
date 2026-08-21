/**
 * All tunable gameplay numbers live here so the feel of the game can be
 * adjusted without touching logic. Times are in milliseconds, distances in
 * virtual canvas pixels, speeds in pixels per second.
 */

export const VIEW = {
  width: 960,
  height: 540,
  /** Y coordinate of the arena floor (feet rest here). */
  floorY: 452,
  /** Fighters cannot walk past these x bounds. */
  minX: 60,
  maxX: 900,
} as const;

export const PHYSICS = {
  gravity: 2100,
  /** Fighters push each other apart instead of overlapping. */
  bodyWidth: 58,
  bodyHeight: 132,
  /** Minimum horizontal gap between two fighter centres. */
  minSeparation: 62,
} as const;

export type AttackKind = "punch" | "kick" | "strong";

export interface AttackDef {
  kind: AttackKind;
  /** Windup before the hitbox appears. */
  startupMs: number;
  /** Hitbox is live for this long. */
  activeMs: number;
  /** Locked out after the hitbox closes. */
  recoveryMs: number;
  damage: number;
  /** Horizontal reach measured from the front of the body. */
  reach: number;
  /** Vertical size of the hitbox, centred on the height offset. */
  hitboxHeight: number;
  /** Offset from floor level to the centre of the hitbox. */
  heightOffset: number;
  /** Pushback applied to the victim. */
  knockback: number;
  /** How long the victim is stunned. */
  hitstunMs: number;
  /** Screen shake magnitude. */
  shake: number;
  /** Number of impact particles. */
  particles: number;
}

export const ATTACKS: Record<AttackKind, AttackDef> = {
  punch: {
    kind: "punch",
    startupMs: 100,
    activeMs: 100,
    recoveryMs: 250,
    damage: 1.25,
    reach: 46,
    hitboxHeight: 40,
    heightOffset: 96,
    knockback: 70,
    hitstunMs: 180,
    shake: 3,
    particles: 7,
  },
  kick: {
    kind: "kick",
    startupMs: 160,
    activeMs: 130,
    recoveryMs: 330,
    damage: 1.95,
    reach: 66,
    hitboxHeight: 46,
    heightOffset: 62,
    knockback: 120,
    hitstunMs: 260,
    shake: 5,
    particles: 11,
  },
  strong: {
    kind: "strong",
    startupMs: 300,
    activeMs: 150,
    recoveryMs: 520,
    damage: 3.5,
    reach: 78,
    hitboxHeight: 58,
    heightOffset: 88,
    knockback: 210,
    hitstunMs: 420,
    shake: 11,
    particles: 22,
  },
};

export const COMBAT = {
  maxHealth: 100,
  /** Fraction of damage that still lands through a block. */
  blockDamageMultiplier: 0.22,
  /** Fraction of knockback that still applies through a block. */
  blockKnockbackMultiplier: 0.3,
  /** Blocking only works against attacks coming from the front. */
  blockRequiresFacing: true,
  /** Airborne fighters cannot block. */
  blockRequiresGround: true,
  /** Extra damage multiplier when hitting an airborne opponent. */
  airHitMultiplier: 1.1,
  /** Invulnerability after being hit, prevents multi-hits from one attack. */
  hitInvulnMs: 90,
  /** Minimum delay between two attack inputs. */
  attackBufferMs: 60,
} as const;

export interface FighterStatsDef {
  walkSpeed: number;
  jumpVelocity: number;
  /** Multiplies outgoing damage. */
  power: number;
  /** Divides incoming damage. */
  defense: number;
  /** Multiplies attack startup/recovery times (lower is faster). */
  recovery: number;
}

/**
 * Baseline stats. The two fighters are deliberately near-identical: the male
 * hits slightly harder, the female moves slightly faster. Both are balanced to
 * roughly equal effectiveness so neither feels stronger on paper.
 */
export const FIGHTER_STATS: Record<"male" | "female", FighterStatsDef> = {
  male: {
    walkSpeed: 208,
    jumpVelocity: 760,
    power: 1.05,
    defense: 1.04,
    recovery: 1.02,
  },
  female: {
    walkSpeed: 232,
    jumpVelocity: 800,
    power: 0.97,
    defense: 0.98,
    recovery: 0.95,
  },
};

/**
 * Fighter display names.
 *
 * The fighters are named for what they represent, so the health bars and the
 * character select double as the reveal's vocabulary. Note this gives nothing
 * away: both names are always on screen, and which one wins is only decided by
 * the match itself.
 */
export const FIGHTER_FLAVOR: Record<"male" | "female", { name: string }> = {
  male: { name: "BOY" },
  female: { name: "GIRL" },
};

export const MATCH = {
  /** Target match length used by the pacing system. */
  targetDurationMs: 150_000,
  /** Soft floor: the pacing system avoids finishing before this. */
  minDurationMs: 110_000,
  /** Hard ceiling: past this the game pushes for a finish. */
  maxDurationMs: 165_000,
  /** Ready / FIGHT! intro timings. */
  roundIntroMs: 1500,
  fightFlashMs: 900,
  koFreezeMs: 900,
  koSequenceMs: 3200,
} as const;

export type RoundMode = 1 | 3;

export const DEFAULTS = {
  players: 1,
  roundMode: 1 as RoundMode,
  music: true,
  sfx: true,
} as const;
