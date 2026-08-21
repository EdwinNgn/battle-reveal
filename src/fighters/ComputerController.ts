import { ATTACKS, type AttackKind } from "../config/gameConfig.ts";
import type { Rng } from "../core/rng.ts";
import { emptyIntent, type Fighter, type FighterIntent } from "./Fighter.ts";

/**
 * A deliberately simple rule-based opponent.
 *
 * There is no AI here in any meaningful sense: no learning, no search, no
 * pathfinding. The controller looks at the horizontal distance to the other
 * fighter, rolls dice against a small weight table, and commits to that choice
 * for 100-300ms. Everything interesting about how it feels comes from the
 * randomness and from the deliberate mistakes.
 */

export type CpuState = "idle" | "approach" | "retreat" | "attack" | "block" | "jump";

/** Weights for the close-range decision. Not required to sum to 1. */
export interface CloseWeights {
  punch: number;
  kick: number;
  strong: number;
  block: number;
  retreat: number;
  idle: number;
}

/** Weights for the far-range decision. */
export interface FarWeights {
  approach: number;
  jump: number;
  idle: number;
  retreat: number;
}

/**
 * Nudges supplied from outside every frame. The controller has no idea where
 * these come from, which keeps the balancing concern in exactly one place.
 */
export interface CpuBias {
  /** Multiplies the three attack weights at close range. */
  aggression: number;
  /** Multiplies the block weight. */
  guard: number;
  /** Probability of deliberately fumbling a decision. */
  mistakeChance: number;
  /** Multiplies the pause between decisions (lower = twitchier). */
  reactionScale: number;
  /** Multiplies how eagerly it closes distance. */
  pressure: number;
}

export function defaultBias(): CpuBias {
  return { aggression: 1, guard: 1, mistakeChance: 0.15, reactionScale: 1, pressure: 1 };
}

const BASE_CLOSE: CloseWeights = {
  punch: 0.3,
  kick: 0.25,
  strong: 0.1,
  block: 0.15,
  retreat: 0.1,
  idle: 0.1,
};

const BASE_FAR: FarWeights = {
  approach: 0.68,
  jump: 0.1,
  idle: 0.12,
  retreat: 0.1,
};

/** Distance at which the CPU considers itself "in range". */
const CLOSE_RANGE = ATTACKS.kick.reach + 58;
const PUNCH_RANGE = ATTACKS.punch.reach + 52;

export class ComputerController {
  private state: CpuState = "approach";
  private stateTimer = 0;
  /** Which attack the current `attack` state will throw. */
  private queuedAttack: AttackKind = "punch";
  /** Set when the current decision is intentionally a bad one. */
  private fumbling = false;
  private jumpEdge = false;
  /** Rolling count of decisions, only used for light variety. */
  private decisions = 0;

  bias: CpuBias = defaultBias();

  private rng: Rng;

  constructor(rng: Rng) {
    this.rng = rng;
  }

  reset(): void {
    this.state = "approach";
    this.stateTimer = 0;
    this.fumbling = false;
    this.jumpEdge = false;
    this.decisions = 0;
    this.bias = defaultBias();
  }

  /**
   * Produces the intent for this frame.
   * @param dt seconds
   */
  update(dt: number, self: Fighter, opponent: Fighter): FighterIntent {
    const intent = emptyIntent();
    if (!self.alive || self.state === "ko" || self.state === "victory") return intent;

    this.stateTimer -= dt * 1000;
    if (this.stateTimer <= 0) this.decide(self, opponent);

    const dx = opponent.x - self.x;
    const dist = Math.abs(dx);
    const toward: 1 | -1 = dx >= 0 ? 1 : -1;

    switch (this.state) {
      case "idle":
        break;

      case "approach": {
        // Stop shuffling once genuinely on top of the opponent.
        if (dist > 52) {
          if (toward === 1) intent.moveRight = true;
          else intent.moveLeft = true;
        }
        break;
      }

      case "retreat": {
        if (toward === 1) intent.moveLeft = true;
        else intent.moveRight = true;
        break;
      }

      case "block":
        intent.block = true;
        break;

      case "jump": {
        // Only trigger the jump on the first frame of the state.
        if (this.jumpEdge && self.grounded) {
          intent.jump = true;
          this.jumpEdge = false;
        }
        if (dist > 60) {
          if (toward === 1) intent.moveRight = true;
          else intent.moveLeft = true;
        }
        break;
      }

      case "attack": {
        // The attack fires once, on the first frame we are free to act.
        if (!self.busy) {
          intent.attack = this.queuedAttack;
          // Mistake flavour: sometimes step backwards into the swing so it
          // whiffs, which reads as a misjudged distance rather than a cheat.
          if (this.fumbling && this.rng.chance(0.5)) {
            if (toward === 1) intent.moveLeft = true;
            else intent.moveRight = true;
          }
          this.state = "idle";
          this.stateTimer = this.rng.range(90, 200);
        }
        break;
      }
    }

    return intent;
  }

  /** Picks the next state. Called roughly every 100-300ms. */
  private decide(self: Fighter, opponent: Fighter): void {
    this.decisions++;
    const dist = Math.abs(opponent.x - self.x);
    const b = this.bias;

    // Reaction time. Faster when biased low, always with a random jitter so the
    // rhythm never feels metronomic.
    this.stateTimer = this.rng.range(100, 300) * b.reactionScale;

    this.fumbling = this.rng.chance(b.mistakeChance);

    // A fumble at range: wander pointlessly or stand still for a beat.
    if (this.fumbling && this.rng.chance(0.45)) {
      this.state = this.rng.chance(0.55) ? "idle" : "retreat";
      this.stateTimer = this.rng.range(140, 380);
      return;
    }

    // Reacting to an incoming attack. Even this is coarse: it only checks
    // whether the opponent is currently swinging, and it often reacts late.
    const opponentSwinging = opponent.state === "attack";
    if (opponentSwinging && dist < CLOSE_RANGE * 1.15) {
      const blockNow = 0.34 * b.guard;
      if (this.rng.chance(blockNow)) {
        this.state = "block";
        this.stateTimer = this.rng.range(220, 520);
        return;
      }
    }

    if (dist <= CLOSE_RANGE) {
      const weights: CloseWeights = {
        punch: BASE_CLOSE.punch * b.aggression,
        kick: BASE_CLOSE.kick * b.aggression,
        strong: BASE_CLOSE.strong * b.aggression,
        block: BASE_CLOSE.block * b.guard,
        retreat: BASE_CLOSE.retreat,
        idle: BASE_CLOSE.idle,
      };
      // Punches are the sensible choice up close; kicks want a bit more room.
      if (dist < PUNCH_RANGE * 0.7) {
        weights.punch *= 1.35;
        weights.kick *= 0.85;
      }
      const choice = this.rng.weighted(weights as unknown as Record<string, number>);

      switch (choice) {
        case "punch":
        case "kick":
        case "strong": {
          this.queuedAttack = choice as AttackKind;
          // Mistake flavour: swap in the slow heavy attack at a bad moment.
          if (this.fumbling && this.rng.chance(0.35)) this.queuedAttack = "strong";
          this.state = "attack";
          this.stateTimer = this.rng.range(60, 160);
          break;
        }
        case "block":
          this.state = "block";
          this.stateTimer = this.rng.range(200, 560);
          break;
        case "retreat":
          this.state = "retreat";
          this.stateTimer = this.rng.range(180, 420);
          break;
        default:
          this.state = "idle";
          this.stateTimer = this.rng.range(120, 320);
          break;
      }
      return;
    }

    // --- out of range ---
    const far: FarWeights = {
      approach: BASE_FAR.approach * b.pressure,
      jump: BASE_FAR.jump,
      idle: BASE_FAR.idle,
      retreat: BASE_FAR.retreat,
    };

    // Attacking from slightly too far out is a classic basic-CPU mistake.
    if (this.fumbling && dist < CLOSE_RANGE * 1.45 && this.rng.chance(0.5)) {
      this.queuedAttack = this.rng.pick(["punch", "kick", "strong"] as const);
      this.state = "attack";
      this.stateTimer = this.rng.range(60, 160);
      return;
    }

    const choice = this.rng.weighted(far as unknown as Record<string, number>);
    switch (choice) {
      case "jump":
        this.state = "jump";
        this.jumpEdge = true;
        this.stateTimer = this.rng.range(420, 720);
        break;
      case "idle":
        this.state = "idle";
        this.stateTimer = this.rng.range(120, 340);
        break;
      case "retreat":
        this.state = "retreat";
        this.stateTimer = this.rng.range(160, 380);
        break;
      default:
        this.state = "approach";
        this.stateTimer = this.rng.range(180, 460);
        break;
    }
  }
}
