/**
 * Headless smoke test for the rendering and screen-flow code.
 *
 *   node scripts/smokeTest.mjs
 *
 * The simulation harness (`npm run simulate`) covers gameplay logic, but it
 * never touches the canvas. This script drives the real Game class through every
 * screen against stubbed DOM APIs, so runtime errors in the drawing code get
 * caught without needing a browser.
 *
 * It counts context calls per screen, so a screen that silently draws nothing
 * shows up as a suspiciously low count rather than passing quietly.
 */

import { installDomStubs, getDrawCalls } from "./stubDom.mjs";

const { canvas, touchLayer } = installDomStubs();

const { Game } = await import("../src/game/Game.ts");

const game = new Game(canvas, touchLayer);

const step = (seconds, label) => {
  const before = getDrawCalls();
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    game.update(1 / 60);
    game.draw(1 / 60);
  }
  const drawn = getDrawCalls() - before;
  console.log(`  ${label.padEnd(34)} ${String(drawn).padStart(8)} ctx calls`);
  if (drawn < 50) throw new Error(`screen "${label}" drew almost nothing (${drawn} calls)`);
};

const click = (id) => {
  game.activate(id);
  // Let the fade-out transition complete so the screen actually changes.
  for (let i = 0; i < 40; i++) game.update(1 / 60);
};

console.log("\nBABY BATTLE - render smoke test\n");

step(0.5, "title");

click("play");
step(0.5, "player setup");

// Three participants, so the result card between turns is exercised too.
click("players-3");
click("start");
step(0.5, "team select");

// The whole room commits to one team here, once for the session.
click("pick-female");
step(0.5, "player turn");

click("go");
step(0.5, "controls");

click("fight");
step(3, "fight (intro + opening)");

// Fast-forward a long stretch of combat, which also exercises hits, particles,
// screen shake and the balancing layer through the real render path.
step(45, "fight (sustained combat)");

// Play the current match to a KO through the real Game flow, so the KO overlay,
// finishRound and the transition into the result screen are all covered.
{
  const state = game.state;
  let frames = 0;
  const limit = 60 * 60 * 8;
  while (state.screen === "fight" && frames < limit) {
    game.update(1 / 60);
    if (frames % 10 === 0) game.draw(1 / 60);
    frames++;
  }
  if (state.screen === "fight") throw new Error("match never finished");
  console.log(
    `  match ran to completion            ${String(Math.round(frames / 60)).padStart(8)}s, ` +
      `now on "${state.screen}"`,
  );
  if (state.history.length !== 1) {
    throw new Error(`expected 1 recorded turn, got ${state.history.length}`);
  }
}

const state = game.state;

state.screen = "settings";
step(0.5, "settings");

state.screen = "result";
step(0.5, "result");

// Reveal: the session ends after the decider, so jump to the turn before it and
// let the normal flow carry us through the last fight into the celebration.
state.currentPlayer = state.totalTurns;
state.screen = "reveal";
game.reveal.reset();
step(9, "reveal (full sequence)");
if (state.screen !== "reveal") {
  throw new Error(`expected the reveal screen, got "${state.screen}"`);
}

console.log(`\n  PASS: all screens rendered, ${getDrawCalls()} total context calls.\n`);
