/**
 * Verifies TEAM mode end to end, with real simulated fights.
 *
 *   npm run simulate:teams
 *   npm run simulate:teams -- 40      (sessions per configuration)
 *
 * The whole room plays for ONE team, chosen at the start; the CPU always plays
 * the other. Each fight the group wins scores a point for their team, each loss
 * scores for the CPU's team, and the team ahead after the last fight is the
 * baby's sex.
 *
 * Two cases matter, and they are very different:
 *
 *   - the group picked the team that must WIN  -> they need a majority
 *   - the group picked the team that must LOSE -> they must finish behind
 *
 * The second is the harder and more interesting one: skilled players have to end
 * up losing on aggregate without the fights feeling rigged.
 *
 * This uses the real Match, Fighter, CPU and balance code, with a different
 * skill level per participant, and checks the designated team always finishes
 * ahead while reporting how honest the session felt.
 */

import type { FighterId } from "../config/secretConfig.ts";
import { ScoreDirector, teamOf } from "../balancing/ScoreDirector.ts";
import { Rng } from "../core/rng.ts";
import { simulateMatch } from "./simulate.ts";
import { ALL_PROFILES, type PlayerProfile } from "./SyntheticPlayer.ts";

const PER_CONFIG = Number(process.argv[2]) || 20;

/** How skilled the group is overall. */
type Crowd = "mixed" | "skilled" | "casual";

const CROWDS: Crowd[] = ["mixed", "skilled", "casual"];

const CROWD_PROFILES: Record<Crowd, PlayerProfile[]> = {
  mixed: [...ALL_PROFILES],
  skilled: ["expert", "aggressive", "average"],
  casual: ["passive", "turtle", "terrible", "idle"],
};

interface SessionResult {
  designatedWon: boolean;
  scoreDesignated: number;
  scoreOther: number;
  fair: number;
  lean: number;
  must: number;
  /** Was the designated team behind at any point? A comeback is good drama. */
  wasBehind: boolean;
  /** Were the scores exactly level going into the decider? */
  levelBeforeDecider: boolean;
  /** Score at the moment the decider began, e.g. "3-3". */
  scoreBeforeDecider: string;
}

function runSession(
  expectedWinner: FighterId,
  playerTeam: FighterId,
  participants: number,
  crowd: Crowd,
  rng: Rng,
  seedBase: number,
): SessionResult {
  const director = new ScoreDirector(participants, playerTeam, expectedWinner);
  const designatedTeam = teamOf(expectedWinner);
  const otherTeam = designatedTeam === "boy" ? "girl" : "boy";

  let fair = 0;
  let lean = 0;
  let must = 0;
  let wasBehind = false;
  let levelBeforeDecider = false;
  let scoreBeforeDecider = "";

  // Every regular fight, plus the decider that settles it.
  for (let i = 0; i < director.totalFights; i++) {
    const plan = director.plan();
    if (plan.mode === "fair") fair++;
    else if (plan.mode === "lean") lean++;
    else must++;

    if (plan.isDecider) {
      const before = director.scores;
      levelBeforeDecider = before.boy === before.girl;
      scoreBeforeDecider = `${before[designatedTeam]}-${before[otherTeam]}`;
    }

    // A different participant each turn, all fighting for the same team.
    const profile = rng.pick(CROWD_PROFILES[crowd]);
    const seed = (seedBase ^ ((i + 1) * 2654435761)) >>> 0;

    const outcome = simulateMatch(playerTeam, profile, seed, plan.favour, plan.mode);
    director.record(outcome.winner);

    const s = director.scores;
    if (s[designatedTeam] < s[otherTeam]) wasBehind = true;
  }

  const s = director.scores;
  return {
    designatedWon: s[designatedTeam] > s[otherTeam],
    scoreDesignated: s[designatedTeam],
    scoreOther: s[otherTeam],
    fair,
    lean,
    must,
    wasBehind,
    levelBeforeDecider,
    scoreBeforeDecider,
  };
}

console.log(`\nBABY BATTLE - team mode verification`);
console.log(`${PER_CONFIG} sessions per configuration\n`);

let totalSessions = 0;
let failures = 0;
let tFair = 0;
let tLean = 0;
let tMust = 0;
let behindCount = 0;
let notLevelCount = 0;
const margins: number[] = [];
const deciderScores = new Map<string, number>();

for (const expectedWinner of ["female", "male"] as FighterId[]) {
  const winLabel = expectedWinner === "female" ? "GIRL" : "BOY";
  console.log(`${"=".repeat(78)}`);
  console.log(`BABY_GENDER implies TEAM ${winLabel} must finish ahead`);
  console.log(`${"=".repeat(78)}`);

  for (const playerTeam of ["female", "male"] as FighterId[]) {
    const teamLabel = playerTeam === "female" ? "GIRL" : "BOY";
    const groupMustWin = playerTeam === expectedWinner;
    console.log(
      `\n  the room plays for TEAM ${teamLabel} ` +
        `-> the group must ${groupMustWin ? "WIN overall" : "LOSE overall"}`,
    );
    console.log(
      `  ${"players".padEnd(8)} ${"crowd".padEnd(8)} ${"correct".padEnd(9)} ` +
        `${"fair".padEnd(6)} ${"lean".padEnd(6)} ${"rigged".padEnd(7)} ` +
        `${"scores seen".padEnd(20)} comeback`,
    );

    for (const participants of [1, 2, 3, 5, 6, 8]) {
      for (const crowd of CROWDS) {
        let correct = 0;
        let fair = 0;
        let lean = 0;
        let must = 0;
        let behind = 0;
        const seen: string[] = [];

        for (let i = 0; i < PER_CONFIG; i++) {
          const rng = new Rng((0x51ed270b + i * 7919 + participants * 131) >>> 0);
          const r = runSession(
            expectedWinner,
            playerTeam,
            participants,
            crowd,
            rng,
            (0xc0ffee + i * 104729 + participants * 7919) >>> 0,
          );

          totalSessions++;
          if (r.designatedWon) correct++;
          else failures++;

          // The whole design rests on the scores being level going into the
          // decider, so treat any session that is not a failure in its own right.
          if (participants > 1 && !r.levelBeforeDecider) {
            notLevelCount++;
            failures++;
            if (notLevelCount <= 3) {
              console.log(
                `\n  NOT LEVEL: n=${participants} ${crowd} went into the decider at ` +
                  `${r.scoreBeforeDecider}\n`,
              );
            }
          }
          if (r.scoreBeforeDecider) {
            deciderScores.set(
              r.scoreBeforeDecider,
              (deciderScores.get(r.scoreBeforeDecider) ?? 0) + 1,
            );
          }

          fair += r.fair;
          lean += r.lean;
          must += r.must;
          if (r.wasBehind) behind++;
          margins.push(r.scoreDesignated - r.scoreOther);

          const line = `${r.scoreDesignated}-${r.scoreOther}`;
          if (!seen.includes(line)) seen.push(line);
        }

        tFair += fair;
        tLean += lean;
        tMust += must;
        behindCount += behind;

        const all = fair + lean + must;
        const pc = (v: number) => `${((v / all) * 100).toFixed(0)}%`;
        const flag = correct === PER_CONFIG ? "  " : "!!";
        console.log(
          `${flag}${String(participants).padEnd(8)} ${crowd.padEnd(8)} ` +
            `${`${correct}/${PER_CONFIG}`.padEnd(9)} ` +
            `${pc(fair).padEnd(6)} ${pc(lean).padEnd(6)} ${pc(must).padEnd(7)} ` +
            `${seen.slice(0, 4).join(" ").padEnd(20)} ` +
            `${((behind / PER_CONFIG) * 100).toFixed(0)}%`,
        );
      }
    }
  }
  console.log("");
}

const allDecisions = tFair + tLean + tMust;
const pc = (v: number, of: number) => `${((v / of) * 100).toFixed(1)}%`;

console.log(`${"=".repeat(78)}`);
console.log("SUMMARY");
console.log(`${"=".repeat(78)}`);
console.log(`  sessions simulated      : ${totalSessions}`);
console.log(`  individual fights       : ${allDecisions}`);
console.log(`  wrong team won          : ${failures}`);
console.log(`  completely fair fights  : ${tFair} (${pc(tFair, allDecisions)})`);
console.log(`  gently leaned fights    : ${tLean} (${pc(tLean, allDecisions)})`);
console.log(`  guaranteed fights       : ${tMust} (${pc(tMust, allDecisions)})`);
console.log(`  sessions with a comeback: ${behindCount} (${pc(behindCount, totalSessions)})`);
console.log(`  NOT level at the decider : ${notLevelCount}`);
const deciderList = [...deciderScores.entries()].sort((a, b) => b[1] - a[1]);
console.log(
  `  scores going into decider: ${deciderList
    .slice(0, 6)
    .map(([s, n]) => `${s} (x${n})`)
    .join("  ")}`,
);
const avg = margins.reduce((a, b) => a + b, 0) / margins.length;
console.log(`  average final margin    : +${avg.toFixed(2)} points`);
console.log(`  largest final margin    : +${Math.max(...margins)} points`);

if (failures > 0) {
  console.log(`\n  FAIL: ${failures} session(s) ended with the wrong team ahead.\n`);
  process.exit(1);
}
console.log(`\n  PASS: the designated team finished ahead in all ${totalSessions} sessions.\n`);
