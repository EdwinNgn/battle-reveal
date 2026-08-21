import { COMBAT, MATCH } from "../config/gameConfig.ts";
import type { FighterId } from "../config/secretConfig.ts";
import type { Fighter } from "../fighters/Fighter.ts";
import type { CpuBias } from "../fighters/ComputerController.ts";
import { neutralModifiers } from "../fighters/FighterStats.ts";

/**
 * ============================================================================
 *  The quiet part.
 * ============================================================================
 *
 *  This system is the only place in the codebase that knows one fighter is
 *  supposed to end up winning. It never touches health directly, never blocks
 *  input, never teleports anybody, and never runs a scripted animation.
 *  Everything it does is a multiplier on a number the combat code was already
 *  going to use.
 *
 *  Three layers, in increasing order of strength and decreasing order of how
 *  often they actually come into play:
 *
 *  1. PHASE DRIFT - as the match runs on, the designated winner gets a few
 *     percent more damage / defense / recovery, and the other fighter drifts a
 *     few percent the other way. In the first ~30 seconds this is literally
 *     nothing: the fight is completely fair.
 *
 *  2. PACING - keeps the match inside the 2-3 minute window by softening
 *     damage when somebody is about to die too early, and sharpening it when
 *     the fight is dragging. This applies to BOTH fighters, so it doubles as
 *     cover for layer 3.
 *
 *  3. SURVIVAL SCALING - the designated winner's incoming damage tapers as
 *     their health gets low. This is what actually guarantees the result, and
 *     it is also what produces the best moment in the match: the player gets
 *     the health bar down to a sliver, lands hit after hit, and the fighter
 *     just refuses to go down. It reads as a dramatic last stand because
 *     that is exactly what it looks like from the outside - the bar keeps
 *     moving, it just moves slower.
 *
 *  A fighter under survival scaling is NOT invincible: every hit still takes
 *  health, still flashes, still knocks back, still makes noise. And above
 *  half health the scaling is exactly 1.0, so most of the match is untouched.
 * ============================================================================
 */

/** Tuning for the hidden layer. Everything here is deliberately small. */
const TUNING = {
  /** Phase drift caps, reached at the end of the match. */
  winnerDamageGain: 0.07,
  winnerDefenseGain: 0.04,
  winnerRecoveryGain: 0.04,
  loserDamageLoss: 0.06,
  loserRecoveryLoss: 0.05,
  loserSpeedLoss: 0.04,
  loserBlockLeakGain: 0.25,

  /**
   * Survival scaling only engages below this fraction of health. Above it the
   * designated winner takes completely normal damage.
   */
  survivalThreshold: 0.5,
  /** Incoming damage multiplier at 0 health, before the asymptote. */
  survivalFloor: 0.1,
  /** Curve shape. >1 keeps the early part of the range nearly untouched. */
  survivalCurve: 2.1,
  /**
   * Below this fraction of health the multiplier tapers toward zero, so the
   * bar approaches empty without ever arriving. Small enough that there is
   * always a visible sliver left, which is what sells the near-KO.
   */
  asymptoteBelow: 0.12,
  /** The multiplier never drops under this, so the bar always keeps moving. */
  minDamageScale: 0.02,
  /**
   * Hard invariant. The designated winner's health is not allowed to cross this
   * fraction of maximum, which is what turns "very likely to win" into
   * "guaranteed to win".
   *
   * This is a backstop, not the mechanism. The layers above are tuned so that
   * the match normally resolves long before it is needed - the simulation
   * harness in src/dev reports how often it actually engages. When it does
   * engage it looks like a fighter surviving on a sliver of health, because
   * that is precisely what is on screen: the bar is at 2%, every hit still
   * connects, flashes and knocks back, and the fighter is one clean hit from
   * going down. They just never quite get there.
   */
  winnerHealthFloor: 0.02,

  /** When in danger, the winner hits harder to fight their way out. */
  comebackDamageGain: 0.3,
  comebackRecoveryGain: 0.12,

  /** Pacing: damage softening when a KO would land too early. */
  earlyKoSoftening: 0.45,
  /** Pacing: damage sharpening when the match is overrunning. */
  latePushGain: 4.5,

  /**
   * Exhaustion. A last-resort resolution for a stalemate.
   *
   * Consider a participant who picks the fighter that has to win and then never
   * presses a button. Their fighter cannot deal damage, so no amount of tuning
   * the multipliers will ever end the round: there is nothing to multiply. The
   * fight would run forever.
   *
   * Past this much overrun both fighters begin to tire and lose health slowly,
   * with the designated loser tiring faster. It reads as an exhaustion finish,
   * which is a recognisable arcade convention, and it only ever engages long
   * after the intended 2-3 minute window - in a normal match it never fires at
   * all. The `floorWasNeeded` diagnostic and the simulation harness both report
   * when it does.
   */
  exhaustionAfterOverrun: 0.6,
  /** Health per second drained from the designated loser at full exhaustion. */
  exhaustionLoserRate: 3.2,
  /** Health per second drained from the designated winner. Deliberately lower. */
  exhaustionWinnerRate: 0.55,
} as const;

export type MatchPhase = "early" | "mid" | "late";

/** How strongly a single match may be steered. See SecretBalanceSystem.mode. */
export type BalanceMode = "fair" | "lean" | "must";

/** Read-only snapshot for the dev tools. Never surfaced in the game UI. */
export interface BalanceDebug {
  phase: MatchPhase;
  progress: number;
  winnerSurvivalScale: number;
  loserSurvivalScale: number;
  winnerDanger: number;
  pacing: number;
  floorEngagements: number;
  exhausting: boolean;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class SecretBalanceSystem {
  /** The fighter that must end up winning this match. */
  private readonly winnerId: FighterId;

  /**
   * How much this particular match is allowed to be influenced.
   *
   *   "fair" - nothing below runs. Both fighters use their raw stats and the
   *            result is whatever the players and the dice produce.
   *   "lean" - the gradual modifiers apply, but the hard floor does not, so the
   *            designated fighter can still genuinely lose.
   *   "must" - everything applies, including the floor. The result is certain.
   */
  private mode: BalanceMode = "must";

  private elapsedMs = 0;
  private progress = 0;
  private phase: MatchPhase = "early";

  private winnerSurvivalScale = 1;
  private loserSurvivalScale = 1;
  private winnerDanger = 0;
  private pacing = 1;
  /** 0..1 measure of how far past the target length the match has run. */
  private overrun = 0;
  /** Diagnostic only: how many times the hard floor had to engage. */
  private floorEngagements = 0;
  /** Diagnostic only: whether the exhaustion fallback was ever needed. */
  private exhausting = false;

  constructor(winnerId: FighterId, mode: BalanceMode = "must") {
    this.winnerId = winnerId;
    this.mode = mode;
  }

  reset(): void {
    this.elapsedMs = 0;
    this.progress = 0;
    this.phase = "early";
    this.winnerSurvivalScale = 1;
    this.loserSurvivalScale = 1;
    this.winnerDanger = 0;
    this.pacing = 1;
    this.overrun = 0;
    this.floorEngagements = 0;
    this.exhausting = false;
  }

  /**
   * Enforces the hard invariant. Called from the combat system on the same
   * frame a hit resolves, before anything is drawn, so a KO that gets undone
   * here was never visible for even one frame.
   *
   * This withholds damage that was about to land; it does not heal. A fighter
   * held at the floor sits on a sliver of health and stays there, which reads
   * as an desperate last stand rather than as anything unusual.
   */
  enforceFloor(a: Fighter, b: Fighter): void {
    // Only a "must" match is guaranteed. In fair and lean matches the designated
    // fighter is fully mortal and can be knocked out like anyone else.
    if (this.mode !== "must") return;

    const winner = a.id === this.winnerId ? a : b;
    const floor = COMBAT.maxHealth * TUNING.winnerHealthFloor;
    if (winner.health >= floor) return;

    winner.health = floor;
    this.floorEngagements++;

    // The hit may have already pushed the fighter into the KO state. Convert
    // that into an ordinary heavy stagger instead.
    if (winner.state === "ko") {
      winner.state = "hit";
      winner.hitstun = 320;
      winner.vy = -150;
    }
  }

  get floorWasNeeded(): boolean {
    return this.floorEngagements > 0;
  }

  isDesignatedWinner(f: Fighter): boolean {
    return f.id === this.winnerId;
  }

  /**
   * Recomputes every modifier. Called once per simulation step, before the
   * fighters update, so the numbers are always current.
   */
  update(dt: number, a: Fighter, b: Fighter): void {
    this.elapsedMs += dt * 1000;

    const winner = a.id === this.winnerId ? a : b;
    const loser = winner === a ? b : a;

    // A fair match gets no help of any kind. Both fighters keep neutral
    // modifiers for the whole fight and the result stands on its own.
    if (this.mode === "fair") {
      winner.modifiers = neutralModifiers();
      loser.modifiers = neutralModifiers();
      this.progress = clamp01(this.elapsedMs / MATCH.targetDurationMs);
      this.phase = this.progress < 0.3 ? "early" : this.progress < 0.65 ? "mid" : "late";
      // Pacing still applies so fair matches last a sensible length, but it is
      // symmetric: it never favours either fighter.
      this.applyFairPacing(dt, winner, loser);
      return;
    }

    this.progress = clamp01(this.elapsedMs / MATCH.targetDurationMs);
    this.phase = this.progress < 0.3 ? "early" : this.progress < 0.65 ? "mid" : "late";

    const winnerPct = winner.health / COMBAT.maxHealth;
    const loserPct = loser.health / COMBAT.maxHealth;

    // ---- layer 1: phase drift -------------------------------------------
    // Eased so the first third of the match is effectively untouched. A "lean"
    // match gets roughly half the influence of a "must" match, which is enough
    // to tilt the odds without ever making the result feel decided.
    const strength = this.mode === "lean" ? 0.5 : 1;
    const drift = Math.pow(this.progress, 1.5) * strength;

    this.winnerDanger = clamp01(
      (TUNING.survivalThreshold - winnerPct) / TUNING.survivalThreshold,
    );

    // A little extra push only while genuinely in trouble. This is the
    // "comeback" the audience is hoping for anyway.
    const comeback = Math.pow(this.winnerDanger, 2) * strength;

    const wm = neutralModifiers();
    wm.damage =
      1 + TUNING.winnerDamageGain * drift + TUNING.comebackDamageGain * comeback;
    wm.defense = 1 + TUNING.winnerDefenseGain * drift;
    wm.recovery =
      1 - TUNING.winnerRecoveryGain * drift - TUNING.comebackRecoveryGain * comeback;

    const lm = neutralModifiers();
    lm.damage = 1 - TUNING.loserDamageLoss * drift;
    lm.recovery = 1 + TUNING.loserRecoveryLoss * drift;
    lm.speed = 1 - TUNING.loserSpeedLoss * drift;
    lm.blockLeak = 1 + TUNING.loserBlockLeakGain * drift;

    // ---- layer 2: pacing ------------------------------------------------
    // Shared by both fighters, which is what makes layer 3 hard to spot: a
    // fight that softens up near a KO is just how this game feels.
    this.pacing = 1;
    this.overrun = 0;
    const lowest = Math.min(winnerPct, loserPct);
    if (this.elapsedMs < MATCH.minDurationMs && lowest < 0.3) {
      // Somebody is about to die well before the two minute mark.
      const earliness = 1 - this.elapsedMs / MATCH.minDurationMs;
      const closeness = 1 - lowest / 0.3;
      this.pacing = 1 - TUNING.earlyKoSoftening * earliness * closeness;
    } else if (this.elapsedMs > MATCH.maxDurationMs) {
      // Overrunning: encourage a finish rather than forcing one. Usually this
      // means a very defensive player, so both fighters start hitting harder
      // and the exchanges get more decisive.
      this.overrun = clamp01((this.elapsedMs - MATCH.maxDurationMs) / 20_000);
      this.pacing = 1 + TUNING.latePushGain * this.overrun;
    }

    wm.damage *= this.pacing;
    lm.damage *= this.pacing;

    // ---- layer 3: survival scaling --------------------------------------
    this.winnerSurvivalScale = this.survivalScale(winnerPct, true);
    // The other fighter gets the same treatment early on, purely so that a
    // near-KO on either side looks and feels identical. It is released as the
    // match matures, which is how the designated winner closes it out.
    this.loserSurvivalScale = this.survivalScale(loserPct, false);

    winner.modifiers = wm;
    loser.modifiers = lm;

    // ---- last resort: exhaustion ----------------------------------------
    this.applyExhaustion(dt, winner, loser);
  }

  /**
   * Keeps a FAIR match to a sensible length without favouring anybody.
   *
   * Both fighters get the identical treatment: damage is softened if a knockout
   * would land absurdly early, sharpened if the fight is dragging, and in a true
   * stalemate both tire at the same rate so whoever is ahead on health wins.
   * Nothing here consults the designated winner.
   */
  private applyFairPacing(dt: number, a: Fighter, b: Fighter): void {
    const lowest = Math.min(a.health, b.health) / COMBAT.maxHealth;

    this.pacing = 1;
    this.overrun = 0;

    if (this.elapsedMs < MATCH.minDurationMs && lowest < 0.3) {
      const earliness = 1 - this.elapsedMs / MATCH.minDurationMs;
      const closeness = 1 - lowest / 0.3;
      this.pacing = 1 - TUNING.earlyKoSoftening * earliness * closeness;
    } else if (this.elapsedMs > MATCH.maxDurationMs) {
      this.overrun = clamp01((this.elapsedMs - MATCH.maxDurationMs) / 20_000);
      this.pacing = 1 + TUNING.latePushGain * this.overrun;
    }

    const shared = neutralModifiers();
    shared.damage = this.pacing;
    a.modifiers = { ...shared };
    b.modifiers = { ...shared };

    // Symmetric exhaustion, so even two idle players eventually get a result.
    if (this.overrun > TUNING.exhaustionAfterOverrun && a.state !== "ko" && b.state !== "ko") {
      const intensity =
        (this.overrun - TUNING.exhaustionAfterOverrun) /
        (1 - TUNING.exhaustionAfterOverrun);
      this.exhausting = true;
      const rate = TUNING.exhaustionLoserRate * intensity * dt;
      // Drain both equally; the healthier fighter survives, which is the fair
      // outcome for a fight nobody is winning.
      for (const f of [a, b]) {
        f.health = Math.max(0, f.health - rate);
        if (f.health <= 0) {
          f.state = "ko";
          f.attack = null;
          f.blocking = false;
          f.hitstun = 0;
          f.vy = -280;
          f.grounded = false;
        }
      }
    }
  }

  /**
   * Drains both fighters once a match has run absurdly long, so a stalemate can
   * still resolve. See TUNING.exhaustionAfterOverrun for why this exists.
   */
  private applyExhaustion(dt: number, winner: Fighter, loser: Fighter): void {
    if (this.overrun <= TUNING.exhaustionAfterOverrun) return;
    if (winner.state === "ko" || loser.state === "ko") return;

    // In a lean match the drain is symmetric, so a stalemate resolves without
    // the outcome being dictated. Only a "must" match tilts it.
    if (this.mode === "lean") {
      const evenIntensity =
        (this.overrun - TUNING.exhaustionAfterOverrun) /
        (1 - TUNING.exhaustionAfterOverrun);
      this.exhausting = true;
      const rate = TUNING.exhaustionLoserRate * evenIntensity * dt;
      for (const f of [winner, loser]) {
        f.health = Math.max(0, f.health - rate);
        if (f.health <= 0) {
          f.state = "ko";
          f.attack = null;
          f.blocking = false;
          f.hitstun = 0;
          f.vy = -280;
          f.grounded = false;
        }
      }
      return;
    }

    const intensity =
      (this.overrun - TUNING.exhaustionAfterOverrun) /
      (1 - TUNING.exhaustionAfterOverrun);
    this.exhausting = true;

    const floor = COMBAT.maxHealth * TUNING.winnerHealthFloor;
    loser.health = Math.max(0, loser.health - TUNING.exhaustionLoserRate * intensity * dt);
    winner.health = Math.max(
      floor,
      winner.health - TUNING.exhaustionWinnerRate * intensity * dt,
    );

    if (loser.health <= 0) {
      // Route it through the normal KO path so the presentation is identical to
      // any other knockout.
      loser.state = "ko";
      loser.attack = null;
      loser.blocking = false;
      loser.hitstun = 0;
      loser.vy = -280;
      loser.grounded = false;
    }
  }

  /**
   * Incoming-damage multiplier for a fighter at a given health fraction.
   *
   * For the designated winner this never releases. For the other fighter it
   * fades out as the match progresses, so late in the fight they take full
   * damage and the match can actually end.
   */
  private survivalScale(healthPct: number, isWinner: boolean): number {
    if (healthPct >= TUNING.survivalThreshold) return 1;

    const danger = clamp01(
      (TUNING.survivalThreshold - healthPct) / TUNING.survivalThreshold,
    );
    let scale = lerp(1, TUNING.survivalFloor, Math.pow(danger, TUNING.survivalCurve));

    // A lean match only halves incoming damage at worst, so the designated
    // fighter remains genuinely killable.
    if (this.mode === "lean") scale = lerp(1, scale, 0.5);

    // Asymptote: the last sliver of health is the hardest to take.
    if (healthPct < TUNING.asymptoteBelow) {
      scale *= Math.max(0.08, healthPct / TUNING.asymptoteBelow);
    }

    if (!isWinner) {
      // Released over the course of the match. By the late phase this is 1.0
      // and the fighter is fully mortal.
      const release = clamp01((this.progress - 0.25) / 0.45);
      scale = lerp(scale, 1, release);
    } else if (this.overrun > 0) {
      // The match has badly overrun, which in practice means a very defensive
      // player and a fight that is going nowhere. Ease the protection so the
      // round can actually conclude; the hard floor still guarantees the result.
      scale = lerp(scale, 1, this.overrun * 0.8);
    }

    return Math.max(TUNING.minDamageScale, Math.min(1, scale));
  }

  /**
   * Applied by the combat system to every hit. The fighter taking the hit does
   * not know this happened, and neither does the fighter throwing it.
   */
  incomingDamageScale(victim: Fighter): number {
    // No survival scaling in a fair match; every hit lands at face value.
    if (this.mode === "fair") return 1;
    return this.isDesignatedWinner(victim)
      ? this.winnerSurvivalScale
      : this.loserSurvivalScale;
  }

  /**
   * Nudges the CPU's behaviour weights. Which direction depends on whether the
   * CPU happens to be the designated winner this round, i.e. on which fighter
   * the player picked.
   */
  applyCpuBias(bias: CpuBias, cpu: Fighter, player: Fighter): void {
    const p = this.progress;
    const o = this.overrun;

    // In a fair match the CPU follows the ordinary arcade progression only. It
    // has no idea which fighter it is, and nothing here reads the designated
    // winner, so its behaviour is identical whichever side the player chose.
    if (this.mode === "fair") {
      bias.mistakeChance = lerp(0.16, 0.05, p);
      bias.aggression = lerp(0.95, 1.2, p);
      bias.guard = lerp(0.85, 1.3, p);
      bias.reactionScale = lerp(1.1, 0.9, p);
      bias.pressure = lerp(1, 1.15, p);
      if (o > 0) {
        // Push for a finish in a dragging match, still symmetrically.
        bias.aggression *= 1 + 0.9 * o;
        bias.pressure *= 1 + 0.7 * o;
        bias.guard *= 1 - 0.4 * o;
      }
      return;
    }

    const cpuIsWinner = this.isDesignatedWinner(cpu);

    // Baseline arcade-CPU progression: it does not get smarter, it just makes
    // slightly fewer mistakes and commits a little more often.
    bias.mistakeChance = lerp(0.16, 0.05, p);
    bias.aggression = lerp(0.95, 1.2, p);
    bias.guard = lerp(0.85, 1.3, p);
    bias.reactionScale = lerp(1.1, 0.9, p);
    bias.pressure = lerp(1, 1.15, p);

    if (cpuIsWinner) {
      // The player picked the other fighter, so the CPU has to come good.
      // Small, gradual, and it still keeps making mistakes throughout.
      const danger = this.winnerDanger;
      bias.aggression *= 1 + 0.18 * p + 0.35 * danger;
      bias.guard *= 1 + 0.2 * p + 0.4 * danger;
      bias.mistakeChance *= 1 - 0.35 * p - 0.4 * danger;
      bias.reactionScale *= 1 - 0.12 * p - 0.15 * danger;
      bias.pressure *= 1 + 0.12 * p;
    } else {
      // The player picked the fighter that is going to win. The CPU quietly
      // runs out of steam, but stays lively enough to look dangerous.
      bias.mistakeChance *= 1 + 0.5 * p;
      bias.aggression *= 1 - 0.1 * p;
      bias.guard *= 1 - 0.18 * p;
      bias.reactionScale *= 1 + 0.15 * p;

      // If the player is somehow in real trouble despite the help, ease off a
      // little more. Only kicks in when it is actually needed.
      const playerPct = player.health / COMBAT.maxHealth;
      if (playerPct < 0.3) {
        const relief = 1 - playerPct / 0.3;
        bias.aggression *= 1 - 0.3 * relief;
        bias.mistakeChance *= 1 + 0.6 * relief;
        bias.guard *= 1 - 0.2 * relief;
      }
    }

    // The match has overrun, which almost always means a passive player who is
    // not creating any exchanges. Push the CPU to seek contact so something
    // actually happens, rather than letting the round stall out.
    if (o > 0) {
      bias.aggression *= 1 + 0.9 * o;
      bias.pressure *= 1 + 0.7 * o;
      bias.guard *= 1 - 0.4 * o;
      bias.mistakeChance *= 1 - 0.5 * o;
      bias.reactionScale *= 1 - 0.25 * o;
    }

    bias.mistakeChance = Math.max(0.02, Math.min(0.5, bias.mistakeChance));
    bias.aggression = Math.max(0.4, Math.min(2.2, bias.aggression));
    bias.guard = Math.max(0.3, Math.min(2.4, bias.guard));
    bias.reactionScale = Math.max(0.6, Math.min(1.6, bias.reactionScale));
    bias.pressure = Math.max(0.5, Math.min(1.8, bias.pressure));
  }

  debug(): BalanceDebug {
    return {
      phase: this.phase,
      progress: this.progress,
      winnerSurvivalScale: this.winnerSurvivalScale,
      loserSurvivalScale: this.loserSurvivalScale,
      winnerDanger: this.winnerDanger,
      pacing: this.pacing,
      floorEngagements: this.floorEngagements,
      exhausting: this.exhausting,
    };
  }
}
