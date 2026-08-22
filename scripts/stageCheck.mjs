/**
 * Verifies the stage rotation and that every backdrop actually draws.
 *
 *   node scripts/stageCheck.mjs
 *
 * Two things matter here:
 *
 *   1. Lille comes first, then all seven travel stages with no repeat, so an
 *      eight-fight session tours every destination exactly once.
 *   2. Every theme really paints something. A backdrop that silently draws
 *      nothing would leave a flat sky, and nobody would notice until the party.
 */

import { installDomStubs, getDrawCalls } from "./stubDom.mjs";

installDomStubs();

const { StageRotation, ALL_STAGES, TRAVEL_STAGES, LILLE_STAGE } = await import(
  "../src/rendering/stages/index.ts"
);
const { Stage } = await import("../src/rendering/Stage.ts");

console.log("\nBABY BATTLE - stage rotation check\n");
const problems = [];

// --- the set --------------------------------------------------------------
console.log(`  stages: ${ALL_STAGES.length} total (1 home + ${TRAVEL_STAGES.length} travel)`);
console.log(`    ${ALL_STAGES.map((s) => s.name).join(", ")}`);
if (ALL_STAGES.length !== 8) problems.push(`expected 8 stages, found ${ALL_STAGES.length}`);
if (LILLE_STAGE.id !== "lille") problems.push("the home stage is not Lille");

// Ids must be unique, or stageById would resolve the wrong one.
const ids = ALL_STAGES.map((s) => s.id);
if (new Set(ids).size !== ids.length) problems.push(`duplicate stage ids: ${ids.join(",")}`);

// --- rotation over eight fights -------------------------------------------
console.log("\n  eight-fight sessions (should visit all eight, no repeats):");
for (let session = 0; session < 6; session++) {
  const rot = new StageRotation(0x1000 + session * 977);
  const seen = [];
  for (let i = 0; i < 8; i++) seen.push(rot.next().id);

  const unique = new Set(seen);
  const ok = unique.size === 8 && seen[0] === "lille";
  console.log(`    ${ok ? "ok  " : "FAIL"} ${seen.join(" -> ")}`);

  if (seen[0] !== "lille") problems.push(`session ${session}: first stage is ${seen[0]}, expected lille`);
  if (unique.size !== 8) {
    problems.push(`session ${session}: only ${unique.size} distinct stages in 8 fights`);
  }
}

// --- the order actually varies between sessions ----------------------------
const orders = new Set();
for (let s = 0; s < 40; s++) {
  const rot = new StageRotation(0x5000 + s * 7919);
  const seq = [];
  for (let i = 0; i < 8; i++) seq.push(rot.next().id);
  orders.add(seq.join(","));
}
console.log(`\n  distinct orderings over 40 sessions: ${orders.size}`);
if (orders.size < 20) {
  problems.push(`only ${orders.size} distinct orderings in 40 sessions - shuffle looks weak`);
}

// --- beyond eight fights the deck reshuffles -------------------------------
{
  const rot = new StageRotation(0xbeef);
  const seen = [];
  for (let i = 0; i < 15; i++) seen.push(rot.next().id);
  // Fights 9-15 come from a fresh shuffle, so repeats are expected there but the
  // first eight must still be unique.
  const firstEight = new Set(seen.slice(0, 8));
  console.log(`  15 fights: first 8 unique = ${firstEight.size === 8}, then reshuffles`);
  if (firstEight.size !== 8) problems.push("first eight of a long session were not unique");
  if (seen.length !== 15) problems.push("rotation stopped producing stages");
}

// --- every theme paints something -----------------------------------------
console.log("\n  draw output per stage:");
const stage = new Stage();
const canvas = { width: 960, height: 540 };
const ctx = { canvas, ...makeCtxProxy() };

for (const theme of ALL_STAGES) {
  stage.setTheme(theme);
  const before = getDrawCalls();
  // A few frames at different camera offsets, to exercise the parallax paths.
  for (let f = 0; f < 6; f++) {
    stage.update(1 / 60);
    stage.draw(realCtx(), 200 + f * 120);
  }
  const calls = getDrawCalls() - before;
  console.log(`    ${theme.name.padEnd(14)} ${String(calls).padStart(7)} ctx calls`);
  // The shared sky and floor alone account for a few dozen calls, so a theme
  // that adds nothing of its own would land suspiciously low.
  if (calls < 400) {
    problems.push(`${theme.name} drew only ${calls} calls - backdrop may be empty`);
  }
}

void ctx;

function makeCtxProxy() {
  return {};
}

/** A real stub context from the shared DOM stubs. */
function realCtx() {
  return document.createElement("canvas").getContext("2d");
}

if (problems.length) {
  console.log("\n  FAIL:");
  for (const p of problems) console.log(`    - ${p}`);
  process.exit(1);
}
console.log("\n  PASS: Lille first, all eight visited, every backdrop draws.\n");
