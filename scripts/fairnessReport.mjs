/**
 * Reports exactly how many fights are genuinely free of interference.
 *
 *   node scripts/fairnessReport.mjs
 *
 * "fair" is the only mode with literally zero interference: neutral modifiers,
 * no survival scaling, no hard floor, and a CPU whose behaviour cannot see which
 * fighter is which. "lean" applies the subtle modifiers at half strength, so it
 * is winnable either way but not honest. "must" is decided.
 *
 * Reported per position in the session, because where the free fights fall
 * matters as much as how many there are.
 */

const KEY = null;
void KEY;

/** Fights before the decider. Always even so a tie is reachable. */
function regularMatches(n) {
  return n % 2 === 1 ? n - 1 : n;
}

/** Mirror of ScoreDirector.plan for the regular fights. */
function directRegular(d, r) {
  const winsNeeded = (r - d) / 2;
  const lossesNeeded = r - winsNeeded;
  if (winsNeeded >= r) return "must";
  if (winsNeeded <= 0) return "must";
  // A free fight is safe whenever a tie survives both possible outcomes, which
  // is exactly when slack >= 1.
  const slack = Math.min(winsNeeded, lossesNeeded);
  if (slack >= 1) return "fair";
  return "lean";
}

/**
 * Walks every possible sequence of results and tallies the modes used, so the
 * numbers are exact rather than sampled.
 */
/**
 * Walks every possible sequence, weighting each branch by how likely it is.
 *
 * The weighting matters: a free fight is roughly a coin flip, so every branch it
 * creates is half as likely as its parent. Counting raw states instead would
 * over-weight the deep, rare branches and badly understate how many fights a
 * real session leaves alone.
 */
function analyse(n) {
  const reg = regularMatches(n);
  const perPosition = Array.from({ length: reg + 1 }, () => ({
    fair: 0,
    lean: 0,
    must: 0,
  }));
  const expected = { fair: 0, lean: 0, must: 0 };
  /** probability -> number of fair fights, for the distribution. */
  const fairDist = new Map();

  const walk = (i, d, fairSoFar, prob) => {
    if (i === reg) {
      // The decider is always guaranteed.
      perPosition[reg].must += prob;
      expected.must += prob;
      fairDist.set(fairSoFar, (fairDist.get(fairSoFar) ?? 0) + prob);
      return;
    }
    const r = reg - i;
    const mode = directRegular(d, r);
    perPosition[i][mode] += prob;
    expected[mode] += prob;

    if (mode === "must") {
      // Forced: only one branch is possible, so the probability carries over.
      const winsNeeded = (r - d) / 2;
      walk(i + 1, winsNeeded >= r ? d + 1 : d - 1, fairSoFar, prob);
    } else {
      // Open fight: both outcomes, each half as likely.
      const nextFair = mode === "fair" ? fairSoFar + 1 : fairSoFar;
      walk(i + 1, d + 1, nextFair, prob * 0.5);
      walk(i + 1, d - 1, nextFair, prob * 0.5);
    }
  };

  walk(0, 0, 0, 1);
  return { reg, perPosition, expected, fairDist };
}

console.log("\nBABY BATTLE - how many fights are genuinely free?\n");
console.log("  fair = zero interference   lean = subtly tilted   must = decided\n");

console.log(
  `  ${"players".padEnd(8)} ${"fights".padEnd(7)} ${"fair".padEnd(7)} ${"lean".padEnd(7)} ` +
    `${"decided".padEnd(8)} shape of a typical session`,
);

for (let n = 1; n <= 8; n++) {
  const { reg, perPosition, expected } = analyse(n);
  const allFights = reg + 1;

  const shape = perPosition
    .map((p) => {
      const top = Object.entries(p).sort((a, b) => b[1] - a[1])[0][0];
      return top === "fair" ? "F" : top === "lean" ? "L" : "M";
    })
    .join("");

  const pc = (v) => `${((v / allFights) * 100).toFixed(0)}%`;

  console.log(
    `  ${String(n).padEnd(8)} ${String(allFights).padEnd(7)} ` +
      `${`${expected.fair.toFixed(1)} (${pc(expected.fair)})`.padEnd(11)} ` +
      `${`${expected.lean.toFixed(1)}`.padEnd(7)} ` +
      `${`${expected.must.toFixed(1)}`.padEnd(8)} ${shape}`,
  );
}

console.log("\n  F = fair, L = leaned, M = decided; last character is the decider\n");

for (const n of [6, 8]) {
  const { reg, perPosition, fairDist } = analyse(n);
  console.log(`  n=${n}, chance each fight is completely fair:`);
  const line = perPosition
    .map((p, i) => {
      const total = p.fair + p.lean + p.must;
      const label = i === reg ? "decider" : `#${i + 1}`;
      return `${label}:${total ? ((p.fair / total) * 100).toFixed(0) : 0}%`;
    })
    .join("  ");
  console.log(`    ${line}`);

  const dist = [...fairDist.entries()].sort((a, b) => a[0] - b[0]);
  console.log(
    `    free fights per session: ` +
      dist.map(([f, p]) => `${f} (${(p * 100).toFixed(0)}%)`).join("  "),
  );
  console.log("");
}
