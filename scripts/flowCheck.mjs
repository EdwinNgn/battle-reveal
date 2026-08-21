/**
 * Verifies the party flow, in particular that a single participant goes straight
 * from the KO to the reveal while multiple participants still see a result card
 * between turns.
 *
 *   node scripts/flowCheck.mjs
 *
 * Reuses the DOM stubs from smokeTest.mjs via ./stubDom.mjs.
 */

import { installDomStubs } from "./stubDom.mjs";

const { canvas, touchLayer } = installDomStubs();
const { Game } = await import("../src/game/Game.ts");

/** Runs frames until the screen changes or the budget runs out. */
function runUntil(game, predicate, maxSeconds = 400) {
  const frames = maxSeconds * 60;
  for (let i = 0; i < frames; i++) {
    game.update(1 / 60);
    if (i % 20 === 0) game.draw(1 / 60);
    if (predicate()) return true;
  }
  return false;
}

function settle(game, seconds = 0.8) {
  for (let i = 0; i < seconds * 60; i++) game.update(1 / 60);
}

function playThrough(playerCount) {
  const game = new Game(canvas, touchLayer);
  const state = game.state;

  game.activate("play");
  settle(game);
  game.activate(`players-${playerCount}`);
  game.activate("start");
  settle(game);
  // The whole room picks one team, once, before any fighting.
  if (state.screen === "teamSelect") {
    game.activate("pick-female");
    settle(game);
  }

  const screensSeen = [];
  let turns = 0;

  // An even participant count adds a tie-breaking final battle, so allow for it.
  const expectedTurns = playerCount % 2 === 0 ? playerCount + 1 : playerCount;
  while (turns < expectedTurns + 1) {
    if (state.screen === "teamSelect") {
      screensSeen.push("teamSelect");
      game.activate("pick-female");
      settle(game);
    }
    if (state.screen === "playerTurn") {
      screensSeen.push(`playerTurn(${state.currentPlayer})`);
      game.activate("go");
      settle(game);
    }
    if (state.screen === "controls") {
      screensSeen.push("controls");
      game.activate("fight");
      settle(game);
    }
    if (state.screen === "fight") {
      screensSeen.push("fight");
      const done = runUntil(game, () => state.screen !== "fight");
      if (!done) throw new Error("fight never resolved");
      settle(game);
      turns++;
    }
    if (state.screen === "result") {
      screensSeen.push("result");
      game.activate("next");
      settle(game);
    }
    if (state.screen === "reveal") {
      screensSeen.push("reveal");
      break;
    }
  }

  return { screensSeen, finalScreen: state.screen, recorded: state.history.length };
}

console.log("\nBABY BATTLE - party flow check\n");

const problems = [];

// --- single player: KO must lead straight to the reveal ---
{
  const { screensSeen, finalScreen } = playThrough(1);
  console.log("  1 player:");
  console.log(`    ${screensSeen.join(" -> ")}`);
  if (finalScreen !== "reveal") {
    problems.push(`1 player ended on "${finalScreen}", expected "reveal"`);
  }
  if (screensSeen.includes("result")) {
    problems.push("1 player saw a result card; it should go straight to the reveal");
  }
}

// --- the team is chosen once, not per participant ---
{
  const { screensSeen } = playThrough(4);
  const teamPicks = screensSeen.filter((s) => s === "teamSelect").length;
  console.log(`\n  team is chosen ${teamPicks} time(s) across a 4-player session`);
  if (teamPicks > 1) {
    problems.push(`team was chosen ${teamPicks} times; it must be picked once per session`);
  }
}

// --- odd count: the last participant plays the decider, no extra turn ---
{
  const { screensSeen, finalScreen, recorded } = playThrough(3);
  console.log("\n  3 players (odd -> player 3 is the decider):");
  console.log(`    ${screensSeen.join(" -> ")}`);
  const fights = screensSeen.filter((s) => s === "fight").length;
  if (finalScreen !== "reveal") {
    problems.push(`3 players ended on "${finalScreen}", expected "reveal"`);
  }
  // Three participants, three fights: the third IS the decider.
  if (fights !== 3) problems.push(`3 players: expected 3 fights, saw ${fights}`);
  if (recorded !== 3) problems.push(`3 players: expected 3 recorded turns, got ${recorded}`);
  if (screensSeen.indexOf("reveal") !== screensSeen.length - 1) {
    problems.push("reveal appeared before the final turn");
  }
}

// --- even count: everybody plays, then one extra final battle ---
{
  const { screensSeen, finalScreen, recorded } = playThrough(4);
  console.log("\n  4 players (even -> one extra FINAL BATTLE):");
  console.log(`    ${screensSeen.join(" -> ")}`);
  const fights = screensSeen.filter((s) => s === "fight").length;
  if (finalScreen !== "reveal") {
    problems.push(`4 players ended on "${finalScreen}", expected "reveal"`);
  }
  // Four participants plus the tie-breaker: five fights in total.
  if (fights !== 5) {
    problems.push(`4 players: expected 5 fights (4 + decider), saw ${fights}`);
  }
  if (recorded !== 5) problems.push(`4 players: expected 5 recorded turns, got ${recorded}`);
  if (screensSeen.indexOf("reveal") !== screensSeen.length - 1) {
    problems.push("reveal appeared before the final turn");
  }
}

if (problems.length) {
  console.log("\n  FAIL:");
  for (const p of problems) console.log(`    - ${p}`);
  process.exit(1);
}
console.log("\n  PASS: solo goes straight to the reveal, multiplayer keeps its turns.\n");
