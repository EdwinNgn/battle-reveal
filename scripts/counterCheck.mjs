/**
 * Checks the fight counters shown to players make sense for every party size.
 *
 *   node scripts/counterCheck.mjs
 *
 * The counter reads "FIGHT x OF <number of participants>", because everybody
 * takes one turn. What differs is the ending:
 *
 *   odd  - the last participant's turn IS the decider, so the advertised total is
 *          already right. Three players see "OF 3" and the third fight settles it.
 *   even - everybody plays to a level score, then a bonus FINAL BATTLE is added.
 *          That extra fight is not advertised up front: telling a group of four
 *          "OF 5" would confuse them and reveal that the score ends level.
 *
 * This walks a whole session for each size and asserts the numbers hold up.
 */

import { installDomStubs } from "./stubDom.mjs";

installDomStubs();
const { GameState } = await import("../src/game/GameState.ts");

console.log("\nBABY BATTLE - fight counter check\n");
const problems = [];

for (let players = 1; players <= 8; players++) {
  const s = new GameState();
  s.totalPlayers = players;
  const parity = players % 2 === 1 ? "odd " : "even";

  console.log(
    `  ${players} player${players === 1 ? "" : "s"} (${parity}): ` +
      `counter says "OF ${s.announcedFights}", ${s.totalTurns} fights actually played`,
  );

  for (let turn = 1; turn <= s.totalTurns; turn++) {
    s.currentPlayer = turn;
    const decider = s.isDecidingTurn && s.totalTurns > 1;

    // What the turn card shows.
    const shown = decider
      ? `FINAL BATTLE (${s.isExtraFinalTurn ? "bonus turn" : "player " + turn})`
      : s.announcedFights > 1
        ? `fight ${turn} of ${s.announcedFights}`
        : "(no counter)";

    // What the result card shows afterwards.
    s.history = Array.from({ length: turn }, () => ({
      playerNumber: 1,
      fighter: "female",
      won: true,
      durationMs: 0,
      roundsWon: 1,
    }));
    const played = Math.min(s.history.length, s.announcedFights);
    const left = s.announcedFights - played;

    console.log(
      `    turn ${turn}: ${shown.padEnd(30)} then: ` +
        `${left > 0 ? left + " left" : "all players done"}`,
    );

    // --- assertions ---
    if (!decider && turn > s.announcedFights) {
      problems.push(`n=${players}: turn ${turn} exceeds the advertised total but is not the decider`);
    }
    if (left < 0) problems.push(`n=${players}: negative fights left after turn ${turn}`);
  }

  // The advertised total must be the participant count: that is the whole point.
  if (s.announcedFights !== players) {
    problems.push(`n=${players}: advertised ${s.announcedFights} fights, expected ${players}`);
  }

  // The decider must be exactly the last turn, and nothing before it.
  s.currentPlayer = s.totalTurns;
  if (!s.isDecidingTurn) problems.push(`n=${players}: last turn is not the decider`);
  if (s.totalTurns > 1) {
    s.currentPlayer = s.totalTurns - 1;
    if (s.isDecidingTurn) {
      problems.push(`n=${players}: second-to-last turn wrongly flagged as decider`);
    }
  }

  // Parity rules.
  if (players % 2 === 1) {
    // Odd: no bonus turn, so the advertised total equals the fights played.
    if (s.totalTurns !== players) {
      problems.push(`n=${players}: odd count should play exactly ${players} fights, plays ${s.totalTurns}`);
    }
    s.currentPlayer = s.totalTurns;
    if (s.isExtraFinalTurn) {
      problems.push(`n=${players}: odd count should not have a bonus turn`);
    }
  } else {
    // Even: exactly one bonus turn beyond the participants.
    if (s.totalTurns !== players + 1) {
      problems.push(`n=${players}: even count should play ${players + 1} fights, plays ${s.totalTurns}`);
    }
    s.currentPlayer = s.totalTurns;
    if (!s.isExtraFinalTurn) {
      problems.push(`n=${players}: even count's last turn should be flagged as the bonus`);
    }
  }

  // The balancing structure must still allow a tie before the decider.
  if (s.regularTurns % 2 !== 0) {
    problems.push(`n=${players}: regularTurns is ${s.regularTurns}, must be even for a level score`);
  }
  if (s.regularTurns + 1 !== s.totalTurns) {
    problems.push(
      `n=${players}: regularTurns (${s.regularTurns}) + 1 !== totalTurns (${s.totalTurns})`,
    );
  }

  console.log("");
}

if (problems.length) {
  console.log("  FAIL:");
  for (const p of problems) console.log(`    - ${p}`);
  process.exit(1);
}
console.log("  PASS: counters read \"of <participants>\" and the endings line up.\n");
