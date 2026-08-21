import { WINNING_FIGHTER, type FighterId } from "../config/secretConfig.ts";

/**
 * ============================================================================
 *  Score direction
 * ============================================================================
 *
 *  Everybody in the room plays for the SAME team, chosen once at the start. The
 *  CPU always plays the other side. Each fight the group wins scores a point for
 *  their team, each loss scores for the CPU's team.
 *
 *  The session is shaped so the reveal always comes down to ONE decisive fight:
 *
 *    odd number of participants
 *      The first N-1 fights are steered to finish DEAD LEVEL, and the last
 *      participant plays the decider.
 *      5 players -> 2-2 after four fights, then player 5 settles it.
 *
 *    even number of participants
 *      All N fights are steered to finish DEAD LEVEL, then one extra FINAL
 *      BATTLE is added on top to break the tie.
 *      6 players -> 3-3 after six fights, then a seventh decides it.
 *
 *  Either way the number of regular fights is even, so a tie is always
 *  arithmetically reachable, and only the decider is guaranteed.
 *
 *  This is a much better deal than steering the final margin: because the
 *  regular fights only have to balance out, most of them can be left completely
 *  alone. At eight participants roughly 70% of the session is genuinely
 *  undecided, against 16% under the old scheme. The tension also lands where it
 *  belongs - on a single last fight with the scores level - instead of leaking
 *  out of a scoreline that drifts.
 *
 *  Three levels of intervention per fight:
 *
 *    FAIR  no interference; whoever plays better wins
 *    LEAN  subtle modifiers at half strength; still losable either way
 *    MUST  guaranteed result for the side being helped
 *
 *  Proved exhaustively in scripts/proveDirector.mjs and verified against real
 *  simulated fights in src/dev/runTeamSimulations.ts.
 * ============================================================================
 */

export type MatchDirective = "fair" | "lean" | "must";

export interface TeamScore {
  boy: number;
  girl: number;
}

/**
 * What the director wants from the next fight.
 *
 * `favour` is the fighter the balancing should help; it may be either side,
 * since keeping the score level means sometimes helping the CPU.
 */
export interface MatchPlan {
  mode: MatchDirective;
  favour: FighterId;
  /** True when this fight is the decider that settles the reveal. */
  isDecider: boolean;
}

/** Which team a fighter belongs to. */
export function teamOf(fighter: FighterId): keyof TeamScore {
  return fighter === "male" ? "boy" : "girl";
}

export class ScoreDirector {
  /** Number of participants taking a turn. */
  private participants = 1;
  /** Fights before the decider. Always even. */
  private regular = 0;
  /** Fights completed so far. */
  private played = 0;
  private score: TeamScore = { boy: 0, girl: 0 };

  /** The fighter the whole group plays as. */
  private playerFighter: FighterId = "female";

  /**
   * Test-only override of the team to steer towards. The game never passes this,
   * so in the shipped build the target always comes from the organizer's config.
   */
  private readonly winnerOverride: FighterId | null;

  constructor(
    participants: number,
    playerFighter: FighterId = "female",
    winnerOverride: FighterId | null = null,
  ) {
    this.winnerOverride = winnerOverride;
    this.configure(participants, playerFighter);
  }

  reset(participants: number, playerFighter: FighterId): void {
    this.configure(participants, playerFighter);
  }

  private configure(participants: number, playerFighter: FighterId): void {
    this.participants = Math.max(1, participants);
    this.playerFighter = playerFighter;
    this.played = 0;
    this.score = { boy: 0, girl: 0 };

    // Regular fights must be an even number for a tie to be reachable.
    // An odd participant count spends its last turn on the decider; an even
    // count plays everybody, then adds a final battle.
    this.regular = this.participants % 2 === 1 ? this.participants - 1 : this.participants;
  }

  get scores(): TeamScore {
    return { ...this.score };
  }

  get matchesPlayed(): number {
    return this.played;
  }

  /** Total fights in the session, decider included. */
  get totalFights(): number {
    return this.regular + 1;
  }

  /** Fights before the decider. */
  get regularFights(): number {
    return this.regular;
  }

  /** True when the session needs an extra turn beyond the participant count. */
  get hasExtraFinal(): boolean {
    return this.participants % 2 === 0;
  }

  /** True when the fight about to be played is the decider. */
  get nextIsDecider(): boolean {
    return this.played >= this.regular;
  }

  get isComplete(): boolean {
    return this.played >= this.totalFights;
  }

  /** The fighter that must be ahead once the decider is done. */
  private get designatedFighter(): FighterId {
    return this.winnerOverride ?? WINNING_FIGHTER;
  }

  private get playerTeamKey(): keyof TeamScore {
    return teamOf(this.playerFighter);
  }

  private get cpuTeamKey(): keyof TeamScore {
    return this.playerTeamKey === "boy" ? "girl" : "boy";
  }

  /** Players' points minus the CPU's. */
  private get diff(): number {
    return this.score[this.playerTeamKey] - this.score[this.cpuTeamKey];
  }

  /** True when the group is playing for the team that has to win. */
  get playersAreOnWinningTeam(): boolean {
    return this.playerFighter === this.designatedFighter;
  }

  /** True when the scores are currently level. */
  get isLevel(): boolean {
    return this.score.boy === this.score.girl;
  }

  /**
   * The plan for the fight about to start.
   */
  plan(): MatchPlan {
    const designated = this.designatedFighter;
    const players = this.playerFighter;
    const cpu: FighterId = players === "male" ? "female" : "male";

    // --- the decider -------------------------------------------------------
    // Guaranteed for the designated team. With the scores level this single
    // fight settles the reveal, which is exactly the moment the room is watching.
    if (this.nextIsDecider) {
      return { mode: "must", favour: designated, isDecider: true };
    }

    // --- regular fights: steer towards a level score -----------------------
    const r = this.regular - this.played;
    const d = this.diff;

    // Wins the players still need from the remaining r fights to finish level:
    // final difference = d + 2w - r, solved for 0.
    const winsNeeded = (r - d) / 2;
    const lossesNeeded = r - winsNeeded;

    // Out of room in one direction: the tie is only still reachable if every
    // remaining fight goes one way, so force it.
    if (winsNeeded >= r) return { mode: "must", favour: players, isDecider: false };
    if (winsNeeded <= 0) return { mode: "must", favour: cpu, isDecider: false };

    // Slack: how many results we could afford to "waste" in either direction.
    const slack = Math.min(winsNeeded, lossesNeeded);

    // Leave the fight completely alone whenever the tie survives BOTH outcomes.
    //
    // That holds exactly when slack >= 1: a win takes winsNeeded to
    // winsNeeded-1 (still >= 0) and a loss leaves winsNeeded <= r-1, so either
    // result keeps a tie reachable. Requiring slack >= 2 here, as an earlier
    // version did, threw away a whole tier of genuinely free fights for no
    // benefit - the condition is verified exhaustively in
    // scripts/proveDirector.mjs.
    if (slack >= 1) return { mode: "fair", favour: designated, isDecider: false };

    // slack === 0 is unreachable given the two guards above, but keep a defined
    // behaviour rather than falling through: nudge whichever side is short.
    return {
      mode: "lean",
      favour: winsNeeded > lossesNeeded ? players : cpu,
      isDecider: false,
    };
  }

  /** Records a completed fight. */
  record(winningFighter: FighterId): void {
    this.score[teamOf(winningFighter)]++;
    this.played++;
  }

  /** The team with the most points. Only meaningful once complete. */
  get leadingTeam(): keyof TeamScore {
    return this.score.boy >= this.score.girl ? "boy" : "girl";
  }
}
