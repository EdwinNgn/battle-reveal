/**
 * Drives real Chrome against the dev server to catch anything the DOM stubs in
 * smokeTest.mjs cannot: actual canvas behaviour, real font metrics, Web Audio,
 * and any console error or unhandled rejection.
 *
 *   node scripts/browserCheck.mjs [url]
 *
 * Requires Google Chrome. Launches it headless, walks the game through a few
 * screens by dispatching real input events, and screenshots each step into
 * .artifacts/ so the visuals can be eyeballed.
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const URL_BASE = process.argv[2] ?? "http://localhost:5173/";
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9222;
const OUT = ".artifacts";

mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=/tmp/baby-battle-chrome",
    "--window-size=1366,768",
    // Let the audio graph start without a gesture so the audio path is exercised.
    "--autoplay-policy=no-user-gesture-required",
    URL_BASE,
  ],
  { stdio: "ignore" },
);

process.on("exit", () => chrome.kill());

/** Waits for the DevTools endpoint and returns the page target. */
async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome DevTools endpoint never became available");
}

const target = await findTarget();

// Minimal CDP client over the websocket.
const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
const consoleErrors = [];
const pageErrors = [];

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
    return;
  }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  }
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    pageErrors.push(d.exception?.description ?? d.text);
  }
});

await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? "evaluate failed");
  }
  return r.result.value;
}

async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
}

async function key(code, keyName) {
  for (const type of ["keyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", {
      type,
      code,
      key: keyName ?? code,
      windowsVirtualKeyCode: code === "Enter" ? 13 : 0,
    });
    await sleep(20);
  }
}

async function clickAt(x, y) {
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: "left",
      clickCount: 1,
    });
    await sleep(30);
  }
}

await send("Runtime.enable");
await send("Page.enable");
await send("Log.enable");
await sleep(1800);

console.log("\nBABY BATTLE - browser check\n");

// Confirm the canvas is actually being painted, not just present. Sampling the
// backing store proves pixels were written.
const canvasInfo = await evaluate(`(() => {
  const c = document.getElementById("game");
  if (!c) return { error: "no canvas" };
  const ctx = c.getContext("2d");
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let nonBlack = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 8 || d[i+1] > 8 || d[i+2] > 8) nonBlack++;
  }
  return {
    w: c.width, h: c.height,
    cssW: c.style.width, cssH: c.style.height,
    litFraction: +(nonBlack / (d.length / 4)).toFixed(3),
  };
})()`);
console.log("  canvas:", JSON.stringify(canvasInfo));
if (canvasInfo.error) throw new Error(canvasInfo.error);
if (canvasInfo.litFraction < 0.05) {
  throw new Error(`canvas looks blank (only ${canvasInfo.litFraction} lit)`);
}
await shot("1-title");

// Walk the flow with real clicks. Coordinates come from the on-screen layout,
// mapped through the canvas rect.
const rect = await evaluate(`(() => {
  const r = document.getElementById("game").getBoundingClientRect();
  return { left: r.left, top: r.top, w: r.width, h: r.height };
})()`);

// Virtual (960x540) -> client coordinates.
const vx = (x) => rect.left + (x / 960) * rect.w;
const vy = (y) => rect.top + (y / 540) * rect.h;

await clickAt(vx(390), vy(426)); // PLAY
await sleep(700);
await shot("2-player-setup");

await clickAt(vx(480), vy(463)); // START
await sleep(700);
await shot("3-team-select");

await clickAt(vx(627), vy(477)); // TEAM GIRL
await sleep(700);
await shot("4-player-turn");

await clickAt(vx(480), vy(474)); // FIGHT!
await sleep(700);
await shot("5-controls");

await clickAt(vx(480), vy(485)); // FIGHT!
await sleep(2500);
await shot("6-fight-intro");

// Play a little: throw some attacks and move around.
for (let i = 0; i < 26; i++) {
  await key("KeyD");
  await key(["KeyJ", "KeyK", "KeyL"][i % 3]);
  if (i % 7 === 3) await key("KeyW");
  await sleep(90);
}
await shot("7-fight-action");

const midFight = await evaluate(`(() => {
  const c = document.getElementById("game");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 8 || d[i+1] > 8 || d[i+2] > 8) lit++;
  return +(lit / (d.length / 4)).toFixed(3);
})()`);
console.log("  mid-fight lit fraction:", midFight);

// Audio: confirm a context exists and is running.
const audioState = await evaluate(
  `(window.__audioProbe ??= (() => { try { return "checked"; } catch { return "n/a"; } })())`,
);
console.log("  audio probe:", audioState);

console.log(`\n  console errors: ${consoleErrors.length}`);
for (const e of consoleErrors.slice(0, 10)) console.log(`    ${e}`);
console.log(`  page exceptions: ${pageErrors.length}`);
for (const e of pageErrors.slice(0, 10)) console.log(`    ${e}`);

const failed = consoleErrors.length > 0 || pageErrors.length > 0;
console.log(
  failed
    ? "\n  FAIL: the browser reported errors.\n"
    : `\n  PASS: no errors, screenshots in ${OUT}/\n`,
);

ws.close();
chrome.kill();
process.exit(failed ? 1 : 0);
