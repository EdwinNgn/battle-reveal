import { COMBAT } from "../config/gameConfig.ts";
import type { BalanceMode } from "../balancing/SecretBalanceSystem.ts";
import type { FighterId } from "../config/secretConfig.ts";
import { Rng } from "../core/rng.ts";
import { Match } from "../game/Match.ts";
import { SyntheticPlayer, type PlayerProfile } from "./SyntheticPlayer.ts";

export const SIM_STEP = 1 / 60;
/** Safety valve so a stalled simulation cannot spin forever. */
const MAX_SIM_MS = 12 * 60 * 1000;

export interface SimOutcome {
  winner: FighterId;
  playerFighter: FighterId;
  playerWon: boolean;
  durationMs: number;
  /** Lowest health the eventual winner dropped to, as a fraction. */
  winnerLowestHealth: number;
  /** Lowest health the eventual loser dropped to, as a fraction. */
  loserLowestHealth: number;
  /** Fraction of the match the player spent ahead on health. */
  playerLeadFraction: number;
  /** How many times the health lead changed hands. */
  leadChanges: number;
  /** True if the hard invariant floor had to engage at any point. */
  floorNeeded: boolean;
  /** True if the exhaustion fallback had to resolve the round. */
  exhausted: boolean;
  timedOut: boolean;
}

/**
 * Runs one full match headlessly with a synthetic player.
 *
 * Uses the real Match / Fighter / CPU / balance code, so a pass here is
 * meaningful evidence about the shipped game rather than about a model of it.
 */
export function simulateMatch(
  playerFighter: FighterId,
  profile: PlayerProfile,
  seed: number,
  expectedWinner?: FighterId,
  mode: BalanceMode = "must",
): SimOutcome {
  const match = new Match(playerFighter, seed, expectedWinner, mode);
  const player = new SyntheticPlayer(profile, new Rng(seed ^ 0x5bf03635));

  let playerLowest = 1;
  let cpuLowest = 1;
  let leadSamples = 0;
  let playerAheadSamples = 0;
  let leadChanges = 0;
  let lastLead = 0;
  let simMs = 0;
  let timedOut = false;

  while (!match.isOver) {
    const intent = match.acceptsInput
      ? player.update(SIM_STEP, match.player, match.cpu)
      : { moveLeft: false, moveRight: false, jump: false, block: false, attack: null };

    match.step(SIM_STEP, intent);
    simMs += SIM_STEP * 1000;

    if (match.phase === "fighting") {
      const p = match.player.health / COMBAT.maxHealth;
      const c = match.cpu.health / COMBAT.maxHealth;
      if (p < playerLowest) playerLowest = p;
      if (c < cpuLowest) cpuLowest = c;
      leadSamples++;
      if (p > c) playerAheadSamples++;
      const lead = p > c ? 1 : p < c ? -1 : 0;
      if (lead !== 0 && lastLead !== 0 && lead !== lastLead) leadChanges++;
      if (lead !== 0) lastLead = lead;
    }

    if (simMs > MAX_SIM_MS) {
      timedOut = true;
      break;
    }
  }

  const result = match.result;
  const leadFraction = leadSamples ? playerAheadSamples / leadSamples : 0;
  const debug = match.debugBalance();
  const floorNeeded = debug.floorEngagements > 0;
  const exhausted = debug.exhausting;

  if (!result || timedOut) {
    const winner: FighterId =
      match.cpu.health > match.player.health ? match.cpu.id : match.player.id;
    return {
      winner,
      playerFighter,
      playerWon: winner === match.player.id,
      durationMs: match.elapsedMs,
      winnerLowestHealth: winner === match.player.id ? playerLowest : cpuLowest,
      loserLowestHealth: winner === match.player.id ? cpuLowest : playerLowest,
      playerLeadFraction: leadFraction,
      leadChanges,
      floorNeeded,
      exhausted,
      timedOut: true,
    };
  }

  const winnerIsPlayer = result.winner === match.player.id;

  return {
    winner: result.winner,
    playerFighter,
    playerWon: result.playerWon,
    durationMs: result.durationMs,
    winnerLowestHealth: winnerIsPlayer ? playerLowest : cpuLowest,
    loserLowestHealth: winnerIsPlayer ? cpuLowest : playerLowest,
    playerLeadFraction: leadFraction,
    leadChanges,
    floorNeeded,
    exhausted,
    timedOut: false,
  };
}
