import { ATTACKS } from "../config/gameConfig.ts";
import type { Rng } from "../core/rng.ts";
import { emptyIntent, type Fighter, type FighterIntent } from "../fighters/Fighter.ts";

/**
 * Stand-in humans for the headless simulations. Each profile models a way a
 * real party guest might play, so the outcome guarantee can be checked against
 * more than one style.
 */
export type PlayerProfile =
  | "expert"      // near-optimal: punishes, blocks, spaces well
  | "aggressive"  // mashes attacks constantly, never blocks
  | "turtle"      // blocks almost all the time, rarely attacks
  | "passive"     // barely does anything
  | "average"     // a plausible casual player
  | "terrible"    // random flailing
  | "idle";       // never touches the controls at all

interface ProfileTraits {
  /** Chance per decision of choosing to attack when in range. */
  attackChance: number;
  /** Chance of blocking when the opponent is swinging. */
  reactBlock: number;
  /** Baseline chance of just holding block. */
  idleBlock: number;
  /** How reliably it closes distance. */
  approach: number;
  /** Decision interval range in ms. Lower = sharper play. */
  reaction: [number, number];
  /** Chance of jumping around. */
  jump: number;
  /** Preference for the heavy attack. */
  strongBias: number;
}

const TRAITS: Record<PlayerProfile, ProfileTraits> = {
  expert:     { attackChance: 0.9,  reactBlock: 0.85, idleBlock: 0.1,  approach: 0.95, reaction: [70, 150],  jump: 0.05, strongBias: 0.3 },
  aggressive: { attackChance: 0.97, reactBlock: 0.0,  idleBlock: 0.0,  approach: 0.98, reaction: [80, 180],  jump: 0.1,  strongBias: 0.35 },
  turtle:     { attackChance: 0.18, reactBlock: 0.95, idleBlock: 0.85, approach: 0.35, reaction: [150, 320], jump: 0.02, strongBias: 0.1 },
  passive:    { attackChance: 0.08, reactBlock: 0.15, idleBlock: 0.2,  approach: 0.2,  reaction: [280, 600], jump: 0.03, strongBias: 0.1 },
  average:    { attackChance: 0.62, reactBlock: 0.4,  idleBlock: 0.15, approach: 0.75, reaction: [140, 320], jump: 0.12, strongBias: 0.2 },
  terrible:   { attackChance: 0.4,  reactBlock: 0.08, idleBlock: 0.08, approach: 0.45, reaction: [220, 520], jump: 0.3,  strongBias: 0.5 },
  // The worst case for the balancing layer: a fighter that deals no damage at
  // all. If this participant picked the fighter that has to win, only the
  // exhaustion fallback can resolve the round.
  idle:       { attackChance: 0,    reactBlock: 0,    idleBlock: 0,    approach: 0,    reaction: [600, 900], jump: 0,    strongBias: 0 },
};

const CLOSE_RANGE = ATTACKS.kick.reach + 58;

/** Drives a fighter the way a human roughly would, for testing only. */
export class SyntheticPlayer {
  private timer = 0;
  private mode: "idle" | "approach" | "retreat" | "block" | "attack" | "jump" = "approach";
  private queued: "punch" | "kick" | "strong" = "punch";
  private traits: ProfileTraits;

  readonly profile: PlayerProfile;
  private rng: Rng;

  constructor(profile: PlayerProfile, rng: Rng) {
    this.profile = profile;
    this.rng = rng;
    this.traits = TRAITS[profile];
  }

  update(dt: number, self: Fighter, opponent: Fighter): FighterIntent {
    const intent = emptyIntent();
    if (!self.alive || self.state === "ko" || self.state === "victory") return intent;

    this.timer -= dt * 1000;
    const dist = Math.abs(opponent.x - self.x);
    const toward: 1 | -1 = opponent.x >= self.x ? 1 : -1;
    const t = this.traits;

    if (this.timer <= 0) {
      this.timer = this.rng.range(t.reaction[0], t.reaction[1]);

      const swinging = opponent.state === "attack";
      if (swinging && dist < CLOSE_RANGE * 1.2 && this.rng.chance(t.reactBlock)) {
        this.mode = "block";
        this.timer = this.rng.range(180, 420);
      } else if (dist <= CLOSE_RANGE) {
        if (this.rng.chance(t.attackChance)) {
          this.queued = this.rng.chance(t.strongBias)
            ? "strong"
            : this.rng.chance(0.55)
              ? "punch"
              : "kick";
          this.mode = "attack";
          this.timer = this.rng.range(50, 130);
        } else if (this.rng.chance(t.idleBlock)) {
          this.mode = "block";
          this.timer = this.rng.range(200, 500);
        } else {
          this.mode = this.rng.chance(0.5) ? "idle" : "retreat";
        }
      } else if (this.rng.chance(t.jump)) {
        this.mode = "jump";
        this.timer = this.rng.range(400, 700);
      } else if (this.rng.chance(t.approach)) {
        this.mode = "approach";
        this.timer = this.rng.range(150, 400);
      } else {
        this.mode = this.rng.chance(t.idleBlock) ? "block" : "idle";
      }
    }

    switch (this.mode) {
      case "approach":
        if (dist > 52) {
          if (toward === 1) intent.moveRight = true;
          else intent.moveLeft = true;
        }
        break;
      case "retreat":
        if (toward === 1) intent.moveLeft = true;
        else intent.moveRight = true;
        break;
      case "block":
        intent.block = true;
        break;
      case "jump":
        if (self.grounded) intent.jump = true;
        if (toward === 1) intent.moveRight = true;
        else intent.moveLeft = true;
        break;
      case "attack":
        if (!self.busy) {
          intent.attack = this.queued;
          this.mode = "idle";
          this.timer = this.rng.range(60, 160);
        }
        break;
      case "idle":
        break;
    }

    return intent;
  }
}

export const ALL_PROFILES: PlayerProfile[] = [
  "expert",
  "aggressive",
  "turtle",
  "passive",
  "average",
  "terrible",
  "idle",
];
