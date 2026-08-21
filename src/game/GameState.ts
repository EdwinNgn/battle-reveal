import { DEFAULTS, type RoundMode } from "../config/gameConfig.ts";
import type { FighterId } from "../config/secretConfig.ts";

export type ScreenName =
  | "title"
  | "settings"
  | "playerSetup"
  | "teamSelect"
  | "playerTurn"
  | "controls"
  | "fight"
  | "result"
  | "reveal";

export interface PlayerRecord {
  playerNumber: number;
  fighter: FighterId;
  /** Did this participant win their match? */
  won: boolean;
  durationMs: number;
  /** Rounds won, for best-of-3. */
  roundsWon: number;
}

/**
 * Everything the party session needs to remember between screens.
 *
 * Note what is absent: nothing here records or derives the baby's gender. The
 * reveal screen asks the secret config directly at the very end, so no earlier
 * screen can leak it even by accident.
 */
export class GameState {
  screen: ScreenName = "title";

  totalPlayers: number = DEFAULTS.players;
  roundMode: RoundMode = DEFAULTS.roundMode;

  /**
   * The team everybody in the room is playing for, chosen once at the start.
   *
   * All participants fight for this same side, so the whole group is on one
   * team and the CPU always plays the opposing one. Every fight the group wins
   * scores a point for their team; every fight they lose scores for the other.
   */
  playerTeam: FighterId = "female";

  /** 1-based index of whose turn it is. */
  currentPlayer = 1;

  /**
   * The fighter the current participant controls. Always the team's fighter,
   * since everybody plays for the same side.
   */
  get selectedFighter(): FighterId {
    return this.playerTeam;
  }

  /** The fighter the CPU controls: always the opposing team. */
  get cpuFighter(): FighterId {
    return this.playerTeam === "male" ? "female" : "male";
  }

  /** Completed turns, in order. */
  history: PlayerRecord[] = [];

  /** Round tracking within a single participant's best-of-3. */
  currentRound = 1;
  playerRoundWins = 0;
  cpuRoundWins = 0;

  /** Set true once the controls screen has been shown once. */
  controlsShown = false;

  reset(): void {
    this.screen = "title";
    this.currentPlayer = 1;
    this.history = [];
    this.controlsShown = false;
    this.resetRounds();
  }

  resetRounds(): void {
    this.currentRound = 1;
    this.playerRoundWins = 0;
    this.cpuRoundWins = 0;
  }

  get roundsNeeded(): number {
    return this.roundMode === 3 ? 2 : 1;
  }

  /** True when the current participant's match (all rounds) is decided. */
  get matchDecided(): boolean {
    return (
      this.playerRoundWins >= this.roundsNeeded ||
      this.cpuRoundWins >= this.roundsNeeded
    );
  }

  /**
   * Total turns in the session, which is not always the participant count.
   *
   * An even number of participants plays everybody to a tie and then needs one
   * extra FINAL BATTLE to break it, so the session runs one turn longer. An odd
   * number spends its last turn on the decider and needs no extra.
   */
  get totalTurns(): number {
    return this.totalPlayers % 2 === 0 ? this.totalPlayers + 1 : this.totalPlayers;
  }

  /**
   * Fights before the decider: the ones that must end on a level score.
   *
   * Always even, matching ScoreDirector. An odd participant count spends its
   * last turn on the decider; an even count plays everybody, then adds one.
   *
   * This is a balancing concept, not a display one - see announcedFights for
   * what the player is actually told. Kept because it documents the structure
   * the ScoreDirector relies on, and scripts/counterCheck.mjs asserts the two
   * stay consistent: if these ever disagree the decider would begin on a score
   * that is not level, which would break the whole mechanism.
   */
  get regularTurns(): number {
    return this.totalPlayers % 2 === 1 ? this.totalPlayers - 1 : this.totalPlayers;
  }

  /**
   * The number of fights to advertise in the "FIGHT x OF y" counter.
   *
   * This is simply the participant count: everybody gets one turn, so a group of
   * three sees "FIGHT 1 OF 3" and a group of four sees "OF 4". Nice and obvious.
   *
   * The subtlety is what happens at the end, and it differs by parity:
   *
   *   odd  - the last participant's turn IS the decider. Three players play
   *          three fights, and the third is the one that settles it, so the
   *          advertised total is already correct.
   *   even - everybody plays, the score ends level, and an extra tie-breaker is
   *          added. That extra fight is deliberately NOT included here: saying
   *          "OF 5" to a group of four would be confusing and would also give
   *          away that the score is going to finish level.
   *
   * So the counter always reads "of <number of people>", and in the even case a
   * bonus FINAL BATTLE appears afterwards as a surprise.
   */
  get announcedFights(): number {
    return this.totalPlayers;
  }

  /** True when the current turn is the tie-breaking final battle. */
  get isDecidingTurn(): boolean {
    return this.currentPlayer >= this.totalTurns;
  }

  /** True when the extra final battle is an additional turn, not a participant's. */
  get isExtraFinalTurn(): boolean {
    return this.totalPlayers % 2 === 0 && this.currentPlayer > this.totalPlayers;
  }

  get isFinalPlayer(): boolean {
    return this.currentPlayer >= this.totalTurns;
  }

  /** Label for the HUD, e.g. "ROUND 2". Null in best-of-1. */
  get roundLabel(): string | null {
    return this.roundMode === 3 ? `ROUND ${this.currentRound}` : null;
  }

  recordTurn(won: boolean, durationMs: number): void {
    this.history.push({
      playerNumber: this.currentPlayer,
      fighter: this.playerTeam,
      won,
      durationMs,
      roundsWon: this.playerRoundWins,
    });
  }

  /** Points scored by the players' team, i.e. fights the group won. */
  get playerTeamPoints(): number {
    return this.history.filter((h) => h.won).length;
  }

  /** Points scored by the CPU's team, i.e. fights the group lost. */
  get cpuTeamPoints(): number {
    return this.history.filter((h) => !h.won).length;
  }

  advancePlayer(): void {
    this.currentPlayer++;
    this.resetRounds();
  }
}
