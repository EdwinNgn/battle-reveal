/**
 * Headless outcome verification.
 *
 *   npm run simulate
 *   npm run simulate -- 200        (matches per combination)
 *
 * Runs the real game logic thousands of times against synthetic players of
 * varying skill, for BOTH possible baby genders, and reports:
 *
 *   - whether the designated fighter always won  (the hard requirement)
 *   - how long matches lasted                    (target 2-3 minutes)
 *   - how close the player came to winning       (the drama requirement)
 *
 * This file is not imported by the game and is not part of the bundle.
 */

import type { FighterId } from "../config/secretConfig.ts";
import { simulateMatch, type SimOutcome } from "./simulate.ts";
import { ALL_PROFILES, type PlayerProfile } from "./SyntheticPlayer.ts";

const PER_COMBO = Number(process.argv[2]) || 40;

interface Bucket {
  outcomes: SimOutcome[];
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function secs(ms: number): string {
  return `${(ms / 1000).toFixed(0)}s`;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

let totalRuns = 0;
let totalFailures = 0;
let totalTimeouts = 0;
let totalFloorNeeded = 0;
let totalExhausted = 0;
const allDurations: number[] = [];
const allLoserLowest: number[] = [];
const allLeadFractions: number[] = [];
const allLeadChanges: number[] = [];

console.log(`\nBABY BATTLE - outcome verification`);
console.log(`${PER_COMBO} matches per combination\n`);

for (const expectedWinner of ["female", "male"] as FighterId[]) {
  const label = expectedWinner === "female" ? "GIRL" : "BOY";
  console.log(`${"=".repeat(72)}`);
  console.log(`BABY_GENDER = "${label.toLowerCase()}"  ->  expected winner: ${expectedWinner.toUpperCase()}`);
  console.log(`${"=".repeat(72)}`);

  for (const playerFighter of ["male", "female"] as FighterId[]) {
    const pickedCorrect = playerFighter === expectedWinner;
    console.log(
      `\n  player picks ${playerFighter.toUpperCase()} ` +
        `(${pickedCorrect ? "the fighter that must win" : "the fighter that must lose"})`,
    );
    console.log(
      `  ${"profile".padEnd(12)} ${"correct".padEnd(9)} ${"median".padEnd(8)} ` +
        `${"range".padEnd(12)} ${"loser got to".padEnd(13)} ${"player ahead".padEnd(13)} swings`,
    );

    for (const profile of ALL_PROFILES as PlayerProfile[]) {
      const bucket: Bucket = { outcomes: [] };

      for (let i = 0; i < PER_COMBO; i++) {
        const seed = (0x1234567 + i * 2654435761 + profile.length * 97) >>> 0;
        bucket.outcomes.push(simulateMatch(playerFighter, profile, seed, expectedWinner));
      }

      const correct = bucket.outcomes.filter((o) => o.winner === expectedWinner).length;
      const failures = PER_COMBO - correct;
      const timeouts = bucket.outcomes.filter((o) => o.timedOut).length;
      const floors = bucket.outcomes.filter((o) => o.floorNeeded).length;
      const durations = bucket.outcomes.map((o) => o.durationMs);
      const loserLowest = bucket.outcomes.map((o) => o.loserLowestHealth);
      const leadFractions = bucket.outcomes.map((o) => o.playerLeadFraction);
      const leadChanges = bucket.outcomes.map((o) => o.leadChanges);

      totalRuns += PER_COMBO;
      totalFailures += failures;
      totalTimeouts += timeouts;
      totalFloorNeeded += floors;
      totalExhausted += bucket.outcomes.filter((o) => o.exhausted).length;
      allDurations.push(...durations);
      allLoserLowest.push(...loserLowest);
      allLeadFractions.push(...leadFractions);
      allLeadChanges.push(...leadChanges);

      const flag = failures === 0 ? "  " : "!!";
      console.log(
        `${flag}${profile.padEnd(12)} ` +
          `${`${correct}/${PER_COMBO}`.padEnd(9)} ` +
          `${secs(median(durations)).padEnd(8)} ` +
          `${`${secs(Math.min(...durations))}-${secs(Math.max(...durations))}`.padEnd(12)} ` +
          `${pct(mean(loserLowest)).padEnd(13)} ` +
          `${pct(mean(leadFractions)).padEnd(13)} ` +
          `${mean(leadChanges).toFixed(1)}`,
      );
    }
  }
  console.log("");
}

console.log(`${"=".repeat(72)}`);
console.log(`SUMMARY`);
console.log(`${"=".repeat(72)}`);
console.log(`  total matches simulated : ${totalRuns}`);
console.log(`  wrong winner            : ${totalFailures}`);
console.log(`  timed out               : ${totalTimeouts}`);
console.log(`  needed the hard floor   : ${totalFloorNeeded} (${pct(totalFloorNeeded / totalRuns)})`);
console.log(`  needed exhaustion       : ${totalExhausted} (${pct(totalExhausted / totalRuns)})`);
console.log(`  median duration         : ${secs(median(allDurations))}`);
console.log(
  `  duration range          : ${secs(Math.min(...allDurations))} - ${secs(Math.max(...allDurations))}`,
);
console.log(`  in 90-210s window       : ${pct(allDurations.filter((d) => d >= 90_000 && d <= 210_000).length / allDurations.length)}`);
console.log(`\n  drama checks (how beatable it felt):`);
console.log(`  loser's lowest health   : ${pct(mean(allLoserLowest))} avg`);
console.log(
  `  losses within 15%       : ${pct(allLoserLowest.filter((h) => h <= 0.15).length / allLoserLowest.length)}`,
);
console.log(`  time player spent ahead : ${pct(mean(allLeadFractions))} avg`);
console.log(`  lead changes per match  : ${mean(allLeadChanges).toFixed(1)} avg`);

if (totalFailures > 0) {
  console.log(`\n  FAIL: ${totalFailures} match(es) produced the wrong winner.\n`);
  process.exit(1);
}
console.log(`\n  PASS: the designated fighter won all ${totalRuns} matches.\n`);
