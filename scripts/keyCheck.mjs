/**
 * Verifies the keyboard mapping in a real browser, on BOTH keyboard layouts.
 *
 *   node scripts/keyCheck.mjs
 *
 * The interesting case is AZERTY: the key printed "Q" sends
 * `{ key: "q", code: "KeyA" }`, so any mapping built on `code` would treat it as
 * A. This dispatches the exact event pairs each layout produces and confirms the
 * intended action fires either way.
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const URL_BASE = process.argv[2] ?? "http://localhost:5173/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9225;

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--user-data-dir=/tmp/baby-battle-chrome-keys",
    "--autoplay-policy=no-user-gesture-required",
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
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
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
await sleep(1600);

/**
 * Probe the mapping directly: build a KeyboardInput, feed it synthetic events,
 * and read back which actions it reports. Faster and far more precise than
 * inferring from on-screen behaviour.
 */
const setup = await evaluate(`(async () => {
  const mod = await import("/src/input/KeyboardInput.ts");
  const ki = new mod.KeyboardInput();
  ki.attach(window);
  window.__ki = ki;
  return "ready";
})()`);
if (setup !== "ready") throw new Error("could not load KeyboardInput");

/**
 * @param key  the character the key produces (what is printed on the cap)
 * @param code the physical position, QWERTY-named
 */
async function probe(key, code) {
  return evaluate(`(() => {
    const ki = window.__ki;
    ki.endFrame();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(key)}, code: ${JSON.stringify(code)}, bubbles: true }));
    const actions = ["left","right","jump","punch","kick","strong","block"];
    const down = actions.filter(a => ki.isDown(a));
    const pressed = actions.filter(a => ki.wasPressed(a));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: ${JSON.stringify(key)}, code: ${JSON.stringify(code)}, bubbles: true }));
    const after = actions.filter(a => ki.isDown(a));
    return { down, pressed, stuckAfterRelease: after };
  })()`);
}

console.log("\nBABY BATTLE - keyboard mapping check\n");

/**
 * key printed, code on QWERTY, code on AZERTY, expected action.
 *
 * S, D and F sit in the same physical position on both layouts, which is exactly
 * why they were chosen for the attacks; the pairs below are identical for them
 * and differ only for the A/Q and W/Z fallbacks.
 */
const CASES = [
  ["ArrowLeft", "ArrowLeft", "ArrowLeft", "left"],
  ["ArrowRight", "ArrowRight", "ArrowRight", "right"],
  ["ArrowUp", "ArrowUp", "ArrowUp", "jump"],
  ["ArrowDown", "ArrowDown", "ArrowDown", "block"],
  // Primary attack row.
  ["s", "KeyS", "KeyS", "punch"],
  ["d", "KeyD", "KeyD", "kick"],
  ["f", "KeyF", "KeyF", "strong"],
  // Block under the thumb.
  [" ", "Space", "Space", "block"],
  // Movement fallbacks: the two letters that swap position between layouts.
  ["a", "KeyA", "KeyQ", "left"],
  ["q", "KeyQ", "KeyA", "left"],
  ["w", "KeyW", "KeyZ", "jump"],
  ["z", "KeyZ", "KeyW", "jump"],
  // Attack fallbacks.
  ["j", "KeyJ", "KeyJ", "punch"],
  ["k", "KeyK", "KeyK", "kick"],
  ["l", "KeyL", "KeyL", "strong"],
];

const problems = [];

for (const [printed, qwertyCode, azertyCode, expected] of CASES) {
  const label = printed === " " ? "SPACE" : printed.toUpperCase();

  for (const [layout, code] of [
    ["QWERTY", qwertyCode],
    ["AZERTY", azertyCode],
  ]) {
    const r = await probe(printed, code);
    const ok =
      r.down.includes(expected) &&
      r.pressed.includes(expected) &&
      r.stuckAfterRelease.length === 0 &&
      r.down.length === 1;

    console.log(
      `  ${label.padEnd(11)} ${layout}  code=${code.padEnd(11)} ` +
        `-> ${(r.down.join(",") || "nothing").padEnd(8)} ${ok ? "ok" : "MISMATCH"}`,
    );

    if (!r.down.includes(expected)) {
      problems.push(`${label} on ${layout} gave [${r.down}] not "${expected}"`);
    }
    if (r.down.length > 1) {
      problems.push(`${label} on ${layout} triggered several actions: ${r.down}`);
    }
    if (r.stuckAfterRelease.length) {
      problems.push(`${label} on ${layout} stayed held after release: ${r.stuckAfterRelease}`);
    }
  }
}

// Auto-repeat must not re-trigger attacks, or holding a key would machine-gun.
const repeat = await evaluate(`(() => {
  const ki = window.__ki;
  ki.endFrame();
  const mk = (repeat) => new KeyboardEvent("keydown", { key: "s", code: "KeyS", repeat, bubbles: true });
  window.dispatchEvent(mk(false));
  const first = ki.wasPressed("punch");
  ki.endFrame();
  window.dispatchEvent(mk(true));
  const second = ki.wasPressed("punch");
  window.dispatchEvent(new KeyboardEvent("keyup", { key: "s", code: "KeyS", bubbles: true }));
  return { first, second };
})()`);
console.log(`\n  auto-repeat: first press ${repeat.first}, repeat re-fires ${repeat.second}`);
if (!repeat.first) problems.push("S did not register as a press");
if (repeat.second) problems.push("auto-repeat re-fires the attack (would machine-gun)");

if (problems.length) {
  console.log("\n  FAIL:");
  for (const p of problems) console.log(`    - ${p}`);
  ws.close();
  chrome.kill();
  process.exit(1);
}
console.log("\n  PASS: every key maps correctly on both QWERTY and AZERTY.\n");
ws.close();
chrome.kill();
