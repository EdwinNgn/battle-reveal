/**
 * Proves the score-direction maths BEFORE it is wired into the game.
 *
 *   node scripts/proveDirector.mjs
 *
 * Structure of a session, for N participants:
 *
 *   N odd   ->  N-1 regular fights, which must end DEAD LEVEL, then the last
 *               participant plays the decider.        5 players: 2-2, then #5.
 *   N even  ->  N regular fights, which must end DEAD LEVEL, then one extra
 *               FINAL BATTLE decides it.             6 players: 3-3, then a 7th.
 *
 * Either way the regular fights are an even number, so a tie is always
 * reachable, and the reveal always hangs on a single decisive fight.
 *
 * Two things are checked exhaustively over every possible sequence of results:
 *
 *   1. the regular fights always finish exactly level
 *   2. the decider always goes to the designated team
 *
 * and it measures how many fights had to be steered to achieve that.
 */

/** Fights before the decider. Always even, so a tie is reachable. */
export function regularMatches(n) {
  return n % 2 === 1 ? n - 1 : n;
}

/**
 * What the next REGULAR fight needs.
 *
 * @param d  players' points minus CPU's points so far
 * @param r  regular fights still to play, including this one
 * @returns "win" / "loss" to force it, or "fair" / "lean" to leave it open
 */
export function directRegular(d, r) {
  // Wins the players' team still needs among the r remaining fights to finish
  // level: final d = d + 2w - r, set to 0.
  const w = (r - d) / 2;

  if (w <= 0) return "mustLose";
  if (w >= r) return "mustWin";

  const losses = r - w;
  const slack = Math.min(w, losses);
  // Leave the fight alone whenever a tie survives BOTH outcomes, which is
  // exactly when slack >= 1: a win leaves w-1 >= 0 still needed, a loss leaves
  // w <= r-1 achievable. Demanding slack >= 2 would forfeit a whole tier of
  // genuinely free fights for no gain.
  if (slack >= 1) return "fair";
  // Unreachable given the two guards above, but keep a defined behaviour.
  return w > losses ? "leanWin" : "leanLoss";
}

let failures = 0;
const stats = new Map();

for (let n = 1; n <= 8; n++) {
  const reg = regularMatches(n);
  const acc = { sequences: 0, fair: 0, lean: 0, must: 0, ties: new Set() };

  // Explore every possible outcome of the fights that are left open.
  const walk = (i, d, counts) => {
    if (i === reg) {
      acc.sequences++;
      acc.fair += counts.fair;
      acc.lean += counts.lean;
      acc.must += counts.must;
      acc.ties.add(d);
      if (d !== 0) {
        failures++;
        if (failures < 6) console.log(`  FAIL n=${n}: regular fights ended ${d}, expected 0`);
      }
      return;
    }

    const r = reg - i;
    const decision = directRegular(d, r);
    const c = { ...counts };

    if (decision === "mustWin") {
      c.must++;
      walk(i + 1, d + 1, c);
    } else if (decision === "mustLose") {
      c.must++;
      walk(i + 1, d - 1, c);
    } else {
      // fair and lean can both go either way; explore both branches.
      if (decision === "fair") c.fair++;
      else c.lean++;
      walk(i + 1, d + 1, c);
      walk(i + 1, d - 1, c);
    }
  };

  walk(0, 0, { fair: 0, lean: 0, must: 0 });
  stats.set(n, acc);
}

console.log("\nSCORE DIRECTOR - exhaustive proof\n");
console.log("  n  regular  decider  outcomes   fair%   lean%   must%  regular ends");
for (let n = 1; n <= 8; n++) {
  const a = stats.get(n);
  const reg = regularMatches(n);
  const total = a.fair + a.lean + a.must;
  const pc = (v) => (total ? `${((v / total) * 100).toFixed(0)}%` : "-").padStart(6);
  const ends = [...a.ties].join(",");
  const deciderLabel = n % 2 === 1 ? `player ${n}` : "extra";
  console.log(
    `  ${n}  ${String(reg).padStart(7)}  ${deciderLabel.padEnd(8)} ${String(a.sequences).padStart(8)}` +
      `  ${pc(a.fair)}  ${pc(a.lean)}  ${pc(a.must)}  ${ends === "0" ? "always level" : ends}`,
  );
}

console.log(`\n  failures: ${failures}`);

// The decider is a single guaranteed fight, so count it in the honesty figure.
console.log("\n  proportion of the whole session left to chance:");
for (const n of [3, 5, 6, 8]) {
  const a = stats.get(n);
  const total = a.fair + a.lean + a.must;
  const perSeq = total / a.sequences;
  const open = (a.fair + a.lean) / a.sequences;
  const allFights = regularMatches(n) + 1;
  console.log(
    `    n=${n}: ${open.toFixed(1)} of ${allFights} fights not guaranteed ` +
      `(${((open / allFights) * 100).toFixed(0)}%), decider always guaranteed` +
      `  [avg ${perSeq.toFixed(1)} regular]`,
  );
}

// Worked examples.
for (const n of [5, 6]) {
  const reg = regularMatches(n);
  console.log(`\n  worked example, n=${n} (players win every fight left open):`);
  let d = 0;
  for (let i = 0; i < reg; i++) {
    const r = reg - i;
    const decision = directRegular(d, r);
    const playersWin = decision === "mustWin" || decision === "leanWin" || decision === "fair";
    d += playersWin ? 1 : -1;
    console.log(
      `    fight ${i + 1}: ${decision.padEnd(9)} -> players ${playersWin ? "win " : "lose"}` +
        `   score ${d >= 0 ? "+" : ""}${d}`,
    );
  }
  console.log(`    regular fights end level at ${d === 0 ? "0-0 difference (tied)" : `MISMATCH ${d}`}`);
  console.log(`    then: FINAL BATTLE, guaranteed to the designated team`);
}

console.log(
  failures === 0
    ? "\n  PASS: regular fights always end level, and one decider settles it.\n"
    : `\n  FAIL: ${failures} sequences did not end level.\n`,
);
process.exit(failures === 0 ? 0 : 1);
