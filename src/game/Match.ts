import { MATCH, VIEW } from "../config/gameConfig.ts";
import { WINNING_FIGHTER, type FighterId } from "../config/secretConfig.ts";
import { Rng } from "../core/rng.ts";
import { SecretBalanceSystem, type BalanceMode } from "../balancing/SecretBalanceSystem.ts";
import { Fighter, emptyIntent, type FighterIntent } from "../fighters/Fighter.ts";
import { ComputerController, defaultBias } from "../fighters/ComputerController.ts";
import { resolveCombat, type HitEvent } from "./CombatSystem.ts";

export type MatchPhaseName = "intro" | "fighting" | "ko" | "over";

export interface MatchResult {
  winner: FighterId;
  durationMs: number;
  playerFighter: FighterId;
  playerWon: boolean;
  playerHealth: number;
  cpuHealth: number;
}

const START_OFFSET = 190;

/**
 * One fight. Owns the two fighters, the CPU controller and the balance system,
 * and steps them forward at a fixed timestep.
 *
 * Deliberately free of any rendering or DOM access so the same class can run
 * thousands of times headlessly in Node for outcome verification.
 */
export class Match {
  readonly player: Fighter;
  readonly cpu: Fighter;
  readonly playerFighterId: FighterId;

  private readonly balance: SecretBalanceSystem;
  private readonly cpuController: ComputerController;
  private readonly cpuBias = defaultBias();

  phase: MatchPhaseName = "intro";
  elapsedMs = 0;
  private phaseTimer: number = MATCH.roundIntroMs;
  result: MatchResult | null = null;

  /** Hits produced by the most recent step, for effects. */
  lastHits: HitEvent[] = [];

  /**
   * @param playerFighterId the fighter the human picked
   * @param seed RNG seed; omit for a fresh random match
   * @param winnerOverride test-only. The game never passes this, so in the
   *        shipped build the winner always comes from the organizer's config.
   */
  constructor(
    playerFighterId: FighterId,
    seed?: number,
    winnerOverride?: FighterId,
    mode: BalanceMode = "must",
  ) {
    this.playerFighterId = playerFighterId;
    const cpuFighterId: FighterId = playerFighterId === "male" ? "female" : "male";

    const center = (VIEW.minX + VIEW.maxX) / 2;
    this.player = new Fighter(playerFighterId, center - START_OFFSET, 1);
    this.cpu = new Fighter(cpuFighterId, center + START_OFFSET, -1);

    const rng = new Rng(seed);
    this.cpuController = new ComputerController(rng);
    this.balance = new SecretBalanceSystem(winnerOverride ?? WINNING_FIGHTER, mode);
  }

  get isOver(): boolean {
    return this.phase === "over";
  }

  /** True once the intro has finished and inputs are live. */
  get acceptsInput(): boolean {
    return this.phase === "fighting";
  }

  /** Progress through the round intro, for the READY/FIGHT overlay. */
  get introProgress(): number {
    if (this.phase !== "intro") return 1;
    return 1 - this.phaseTimer / MATCH.roundIntroMs;
  }

  /**
   * Advances the match.
   * @param dt fixed timestep in seconds
   * @param playerIntent what the human is doing this step
   */
  step(dt: number, playerIntent: FighterIntent): void {
    this.lastHits = [];

    if (this.phase === "intro") {
      this.phaseTimer -= dt * 1000;
      // Fighters idle in place during the intro.
      this.player.update(dt, emptyIntent(), this.cpu.x);
      this.cpu.update(dt, emptyIntent(), this.player.x);
      if (this.phaseTimer <= 0) {
        this.phase = "fighting";
      }
      return;
    }

    if (this.phase === "ko") {
      this.phaseTimer -= dt * 1000;
      this.player.update(dt, emptyIntent(), this.cpu.x);
      this.cpu.update(dt, emptyIntent(), this.player.x);
      if (this.phaseTimer <= 0) this.phase = "over";
      return;
    }

    if (this.phase === "over") return;

    // --- fighting ---
    this.elapsedMs += dt * 1000;

    this.balance.update(dt, this.player, this.cpu);
    this.balance.applyCpuBias(this.cpuBias, this.cpu, this.player);
    this.cpuController.bias = this.cpuBias;

    const cpuIntent = this.cpuController.update(dt, this.cpu, this.player);

    this.player.update(dt, playerIntent, this.cpu.x);
    this.cpu.update(dt, cpuIntent, this.player.x);

    this.lastHits = resolveCombat(this.player, this.cpu, this.balance);

    if (!this.player.alive || !this.cpu.alive) {
      this.beginKo();
    }
  }

  private beginKo(): void {
    const playerWon = this.cpu.health <= 0;
    const winner: FighterId = playerWon ? this.player.id : this.cpu.id;

    if (playerWon) this.player.celebrate();
    else this.cpu.celebrate();

    this.result = {
      winner,
      durationMs: this.elapsedMs,
      playerFighter: this.playerFighterId,
      playerWon,
      playerHealth: this.player.health,
      cpuHealth: this.cpu.health,
    };

    this.phase = "ko";
    this.phaseTimer = MATCH.koSequenceMs;
  }

  /** Dev-only introspection. Never called from the game UI. */
  debugBalance() {
    return this.balance.debug();
  }
}
