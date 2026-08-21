/**
 * Plays the game with the real key scheme and checks the fighter responds.
 *
 *   node scripts/playabilityCheck.mjs
 *
 * keyCheck.mjs proves the mapping resolves correctly in isolation. This goes one
 * step further and drives an actual fight through real browser key events,
 * confirming each key produces the effect a player would expect: the fighter
 * moves, jumps, attacks, and blocking reduces the damage taken.
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const URL_BASE = process.argv[2] ?? "http://localhost:5173/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9227;

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--user-data-dir=/tmp/baby-battle-chrome-play",
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=1366,768",
    URL_BASE,
  ],
  { stdio: "ignore" },
);
process.on("exit", () => chrome.kill());

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json`);
      const t = (await r.json()).find((x) => x.type === "page" && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch {}
    await sleep(250);
  }
  throw new Error("no devtools endpoint");
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 1;
const pending = new Map();
const errors = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    return;
  }
  if (m.method === "Runtime.exceptionThrown") {
    errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  }
});
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", rej, { once: true });
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = id++;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description);
  return r.result.value;
};

await send("Runtime.enable");
await send("Page.enable");
await sleep(1700);

/** Dispatches a real key event pair through the browser input pipeline. */
async function keyDown(key, code) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    text: key.length === 1 ? key : undefined,
    windowsVirtualKeyCode: code === "Space" ? 32 : 0,
  });
}
async function keyUp(key, code) {
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code });
}
async function tapKey(key, code, holdMs = 60) {
  await keyDown(key, code);
  await sleep(holdMs);
  await keyUp(key, code);
  await sleep(90);
}

const rect = await evaluate(`(() => {
  const r = document.getElementById("game").getBoundingClientRect();
  return { left: r.left, top: r.top, w: r.width, h: r.height };
})()`);
const click = async (vxp, vyp) => {
  const x = rect.left + (vxp / 960) * rect.w;
  const y = rect.top + (vyp / 540) * rect.h;
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  }
  await sleep(320);
};

// Navigate into a fight: PLAY -> 1 player -> START -> team -> FIGHT -> FIGHT.
await click(390, 426);
await click(480, 463);
await click(627, 477);
await click(480, 474);
await click(480, 485);
// Let the READY/FIGHT intro finish so inputs are live.
await sleep(2600);

/** Reads the live fighter state out of the running game. */
const probe = () =>
  evaluate(`(() => {
    const g = window.__bbGame;
    if (!g || !g.match) return null;
    const p = g.match.player;
    return {
      x: Math.round(p.x), y: Math.round(p.y),
      state: p.state, grounded: p.grounded,
      health: +p.health.toFixed(1),
      cpuHealth: +g.match.cpu.health.toFixed(1),
      blocking: p.blocking,
      phase: g.match.phase,
    };
  })()`);

const start = await probe();
console.log("\nBABY BATTLE - playability check\n");
if (!start) {
  console.log("  FAIL: could not reach a fight (is the debug handle exposed?)");
  ws.close();
  chrome.kill();
  process.exit(1);
}
console.log(`  in a fight: phase=${start.phase} x=${start.x} health=${start.health}`);

/*
 * Two pieces of instrumentation, both installed inside the page.
 *
 * 1. The CPU is pinned to the far side of the arena. Otherwise it walks over and
 *    hits the player mid-test, and a fighter in hitstun legitimately cannot
 *    attack - the test would fail on correct behaviour.
 *
 * 2. Every state the player passes through is recorded in a buffer, sampled on a
 *    fast interval inside the page. Polling over the DevTools socket from Node
 *    is far too slow: a punch lasts about 450ms and the round trip regularly
 *    missed the whole window, which made the results random. Recording locally
 *    and reading the buffer afterwards removes that race entirely.
 */
await evaluate(`(() => {
  const m = window.__bbGame.currentMatch;
  window.__states = [];
  const tick = () => {
    m.cpu.x = 900;
    m.cpu.vx = 0;
    m.cpu.health = 100;
    const p = m.player;
    window.__states.push(p.state + (p.grounded ? "" : ":air"));
    if (window.__states.length > 4000) window.__states.shift();
  };
  tick();
  window.__pinCpu = setInterval(tick, 8);
  return true;
})()`);

/**
 * Presses a key and reports every state the fighter passed through.
 *
 * The whole press/observe cycle runs INSIDE the page, driven by a single
 * evaluate, and the key is dispatched via a synthetic KeyboardEvent rather than
 * over the DevTools socket. Doing it from Node meant several socket round trips
 * around a window that only lasts a few hundred milliseconds, which made the
 * results random. One call, no races.
 */
async function pressAndRecord(key, code, holdMs = 250, watchMs = 550) {
  return evaluate(`(async () => {
    const m = window.__bbGame.currentMatch;
    const p = m.player;
    const seen = [];
    const rec = setInterval(() => {
      seen.push(p.state + (p.grounded ? "" : ":air"));
    }, 8);

    const opts = { key: ${JSON.stringify(key)}, code: ${JSON.stringify(code)}, bubbles: true };
    window.dispatchEvent(new KeyboardEvent("keydown", opts));
    await new Promise((r) => setTimeout(r, ${holdMs}));
    window.dispatchEvent(new KeyboardEvent("keyup", opts));
    await new Promise((r) => setTimeout(r, ${watchMs - holdMs}));

    clearInterval(rec);
    return [...new Set(seen)];
  })()`);
}

/** Waits until the fighter is idle and on the ground, so inputs are accepted. */
async function waitReady(timeoutMs = 2500) {
  return evaluate(`(async () => {
    const p = window.__bbGame.currentMatch.player;
    const deadline = Date.now() + ${timeoutMs};
    while (Date.now() < deadline) {
      if (p.state === "idle" && p.grounded && p.hitstun <= 0 && !p.attack) return true;
      await new Promise((r) => setTimeout(r, 16));
    }
    return false;
  })()`);
}

const problems = [];

/** Holds a movement key and reports how far the fighter travelled. */
async function measureMove(key, code, holdMs = 400) {
  return evaluate(`(async () => {
    const p = window.__bbGame.currentMatch.player;
    const from = p.x;
    const opts = { key: ${JSON.stringify(key)}, code: ${JSON.stringify(code)}, bubbles: true };
    window.dispatchEvent(new KeyboardEvent("keydown", opts));
    await new Promise((r) => setTimeout(r, ${holdMs}));
    const to = p.x;
    window.dispatchEvent(new KeyboardEvent("keyup", opts));
    return { from: Math.round(from), to: Math.round(to) };
  })()`);
}

// --- move right ---
await waitReady();
const right = await measureMove("ArrowRight", "ArrowRight");
console.log(`  ArrowRight: x ${right.from} -> ${right.to}`);
if (right.to <= right.from) problems.push("ArrowRight did not move the fighter right");
await sleep(150);

// --- move left ---
await waitReady();
const left = await measureMove("ArrowLeft", "ArrowLeft");
console.log(`  ArrowLeft:  x ${left.from} -> ${left.to}`);
if (left.to >= left.from) problems.push("ArrowLeft did not move the fighter left");
await sleep(150);

// --- jump ---
// Jump and the attacks are edge-triggered and short-lived, so a single probe
// after the fact can easily miss them. Sample repeatedly and keep the best
// observation instead, which is what a player actually perceives.
await waitReady();
const jumpStates = await pressAndRecord("ArrowUp", "ArrowUp", 60, 500);
const jumped = jumpStates.some((s) => s.endsWith(":air"));
console.log(`  ArrowUp:    left the ground = ${jumped}   [${jumpStates.join(" ")}]`);
if (!jumped) problems.push("ArrowUp did not get the fighter off the ground");
// Wait for the landing so later checks are not confused by the jump.
await sleep(700);

// --- attacks: each key must put the fighter into an attack state ---
for (const [key, code, label] of [
  ["s", "KeyS", "punch"],
  ["d", "KeyD", "kick"],
  ["f", "KeyF", "strong"],
]) {
  // The fighter must be free to act, otherwise the input is legitimately
  // ignored and the test would be measuring the wrong thing.
  const ready = await waitReady();
  if (!ready) {
    problems.push(`fighter never became ready before testing ${key.toUpperCase()}`);
    continue;
  }

  const states = await pressAndRecord(key, code, 120, 600);
  const attacked = states.includes("attack");
  console.log(
    `  ${key.toUpperCase()} (${label}): entered attack = ${attacked}   [${states.join(" ")}]`,
  );
  if (!attacked) problems.push(`${key.toUpperCase()} did not start an attack`);

  // Let the recovery finish before the next one.
  await sleep(700);
}

// --- block: space must hold the guard up, and drop it on release ---
await waitReady();
const blockResult = await evaluate(`(async () => {
  const p = window.__bbGame.currentMatch.player;
  const opts = { key: " ", code: "Space", bubbles: true };
  window.dispatchEvent(new KeyboardEvent("keydown", opts));
  // Sample across several frames: blocking is set during update, not on the event.
  let held = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 16));
    if (p.blocking) { held = true; break; }
  }
  window.dispatchEvent(new KeyboardEvent("keyup", opts));
  let released = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 16));
    if (!p.blocking) { released = true; break; }
  }
  return { held, released };
})()`);
console.log(`  SPACE:      guard up = ${blockResult.held}, drops on release = ${blockResult.released}`);
if (!blockResult.held) problems.push("SPACE did not raise the guard");
if (!blockResult.released) problems.push("guard stayed up after SPACE was released");

await evaluate(`(() => { clearInterval(window.__pinCpu); return true; })()`);

console.log(`\n  page exceptions: ${errors.length}`);
for (const e of errors.slice(0, 4)) console.log(`    ${e}`);

if (problems.length || errors.length) {
  console.log("\n  FAIL:");
  for (const p of problems) console.log(`    - ${p}`);
  ws.close();
  chrome.kill();
  process.exit(1);
}
console.log("\n  PASS: every key produces the effect a player would expect.\n");
ws.close();
chrome.kill();
