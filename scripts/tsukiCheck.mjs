/**
 * Verifies Tsuki behaves like an easter egg rather than a distraction.
 *
 *   node scripts/tsukiCheck.mjs
 *
 * The things that could go wrong are all about restraint:
 *   - she must be on screen only a small fraction of the time
 *   - she must reach all her behaviours, not get stuck walking
 *   - she must always stay behind and below the fighters' bodies
 *   - she must never leave the arena floor or drift off into the sky
 *   - a heavy hit nearby must send her off
 */

import { installDomStubs, getDrawCalls } from "./stubDom.mjs";

installDomStubs();
const { Tsuki } = await import("../src/rendering/Tsuki.ts");
const { VIEW, PHYSICS } = await import("../src/config/gameConfig.ts");

console.log("\nBABY BATTLE - Tsuki easter egg check\n");
const problems = [];

// --- how often is she around? ---------------------------------------------
{
  // Simulate 30 minutes of game time and measure her screen time.
  const cat = new Tsuki(0x7501);
  const dt = 1 / 60;
  const totalSeconds = 30 * 60;
  let visibleFrames = 0;
  let appearances = 0;
  let wasVisible = false;

  for (let i = 0; i < totalSeconds / dt; i++) {
    cat.update(dt);
    if (cat.visible) {
      visibleFrames++;
      if (!wasVisible) appearances++;
    }
    wasVisible = cat.visible;
  }

  const fraction = visibleFrames / (totalSeconds / dt);
  const perHour = appearances * 2;
  console.log(
    `  screen time: ${(fraction * 100).toFixed(1)}% of 30 min, ` +
      `${appearances} appearances (~${perHour}/hour)`,
  );
  // Rare enough to be a find, common enough that somebody notices during a party.
  if (fraction > 0.12) problems.push(`on screen ${(fraction * 100).toFixed(0)}% of the time - too often`);
  if (appearances < 2) problems.push(`only ${appearances} appearances in 30 min - too rare to be spotted`);
}

// --- does she use her whole behaviour repertoire? --------------------------
{
  const cat = new Tsuki(0x7502);
  const dt = 1 / 60;
  const seen = new Set();
  for (let i = 0; i < (60 * 60) / dt; i++) {
    cat.update(dt);
    // Reach into the private state: this is a test harness and the states are
    // the thing under test.
    seen.add(cat.state);
  }
  const expected = ["away", "entering", "walking", "sitting", "grooming", "stretching", "leaving"];
  const missing = expected.filter((s) => !seen.has(s));
  console.log(`  behaviours seen in an hour: ${[...seen].sort().join(", ")}`);
  if (missing.length) problems.push(`never reached: ${missing.join(", ")}`);
}

// --- does she stay where she belongs? -------------------------------------
{
  const cat = new Tsuki(0x7503);
  const dt = 1 / 60;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < (20 * 60) / dt; i++) {
    cat.update(dt);
    if (cat.visible) {
      minX = Math.min(minX, cat.x);
      maxX = Math.max(maxX, cat.x);
    }
  }
  console.log(`  horizontal range while visible: ${minX.toFixed(0)} .. ${maxX.toFixed(0)}`);
  // She may walk off the edges, but should not wander far beyond them.
  if (minX < -120 || maxX > VIEW.width + 120) {
    problems.push(`wandered outside the arena (${minX.toFixed(0)}..${maxX.toFixed(0)})`);
  }
}

// --- is she drawn clear of the fighters? -----------------------------------
{
  // She is drawn at floorY - 26 and stands roughly 26px tall at her scale, so
  // her top sits well below the fighters' heads. Confirm against the real body
  // height rather than a guessed number.
  const catTopApprox = VIEW.floorY - 26 - 30;
  const fighterTop = VIEW.floorY - PHYSICS.bodyHeight;
  console.log(
    `  vertical placement: cat top ~${catTopApprox}, fighter top ${fighterTop} ` +
      `(floor ${VIEW.floorY})`,
  );
  if (catTopApprox < fighterTop) {
    problems.push("the cat can reach above the fighters' heads - she would obscure the action");
  }
}

// --- does a nearby hit startle her? ---------------------------------------
{
  const cat = new Tsuki(0x7504);
  const dt = 1 / 60;
  // Fast-forward until she is on screen and settled.
  let guard = 0;
  while (!cat.visible && guard++ < 60 * 60 * 5) cat.update(dt);
  if (!cat.visible) {
    problems.push("she never appeared, cannot test startle");
  } else {
    // Nudge her into a stationary state so the change is unambiguous.
    for (let i = 0; i < 300; i++) cat.update(dt);
    const before = cat.state;
    cat.startle(cat.x + 40);
    const after = cat.state;
    console.log(`  startle: ${before} -> ${after}`);
    if (after !== "leaving") problems.push(`a nearby hit left her in "${after}", expected "leaving"`);

    // A distant hit should be ignored.
    const cat2 = new Tsuki(0x7505);
    let g2 = 0;
    while (!cat2.visible && g2++ < 60 * 60 * 5) cat2.update(dt);
    const s2 = cat2.state;
    cat2.startle(cat2.x + 600);
    console.log(`  distant hit: ${s2} -> ${cat2.state} (should be unchanged)`);
    if (cat2.state === "leaving" && s2 !== "leaving") {
      problems.push("a hit 600px away startled her - the range check is too wide");
    }
  }
}

// --- does she actually draw? ----------------------------------------------
{
  const cat = new Tsuki(0x7506);
  const ctx = document.createElement("canvas").getContext("2d");
  const dt = 1 / 60;
  // Force her through each pose and confirm each one paints.
  const poses = ["walking", "sitting", "grooming", "stretching"];
  for (const pose of poses) {
    cat.state = pose;
    cat.x = 400;
    const before = getDrawCalls();
    for (let f = 0; f < 5; f++) {
      cat.update(dt);
      cat.state = pose; // hold the pose against the state machine
      cat.draw(ctx, VIEW.floorY);
    }
    const calls = getDrawCalls() - before;
    console.log(`  pose ${pose.padEnd(11)} ${String(calls).padStart(5)} ctx calls`);
    if (calls < 40) problems.push(`pose "${pose}" drew only ${calls} calls - may be blank`);
  }
}

if (problems.length) {
  console.log("\n  FAIL:");
  for (const p of problems) console.log(`    - ${p}`);
  process.exit(1);
}
console.log("\n  PASS: Tsuki wanders, behaves, and never gets in the way.\n");
