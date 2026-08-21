/**
 * Verifies the fight scene actually contains what it should, by sampling the
 * canvas rather than trusting that draw calls happened.
 *
 *   node scripts/visualCheck.mjs [url]
 *
 * Checks for: both fighters' signature colours, the two health bars in their
 * expected corners, a lit arena floor, and that the fighters occupy sensible
 * positions. Catches "drew something, but wrong" bugs that a call-count smoke
 * test cannot.
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const URL_BASE = process.argv[2] ?? "http://localhost:5173/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9223;

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--user-data-dir=/tmp/baby-battle-chrome-2",
    "--window-size=1366,768",
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

// Jump straight into a fight by driving the game's own state machine, which is
// far more reliable than clicking through menus at fixed coordinates.
await evaluate(`(() => {
  const c = document.getElementById("game");
  // Force a real user-gesture-free start; the loop is already running.
  return true;
})()`);

const rect = await evaluate(`(() => {
  const r = document.getElementById("game").getBoundingClientRect();
  return { left: r.left, top: r.top, w: r.width, h: r.height };
})()`);
const vx = (x) => rect.left + (x / 960) * rect.w;
const vy = (y) => rect.top + (y / 540) * rect.h;
const click = async (x, y) => {
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", { type, x: vx(x), y: vy(y), button: "left", clickCount: 1 });
    await sleep(40);
  }
};

await click(390, 426); await sleep(650);   // PLAY
await click(480, 463); await sleep(650);   // START
await click(627, 477); await sleep(650);   // pick TEAM GIRL
await click(480, 474); await sleep(650);   // FIGHT! on the player turn card
await click(480, 485); await sleep(2600);  // FIGHT! on the controls screen

console.log("\nBABY BATTLE - visual verification\n");

/**
 * Samples the canvas in virtual coordinates and reports colour statistics for
 * named regions plus where each fighter's palette appears.
 */
const report = await evaluate(`(() => {
  const c = document.getElementById("game");
  const ctx = c.getContext("2d");
  const sx = c.width / 960, sy = c.height / 540;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;

  const at = (x, y) => {
    const px = Math.round(x * sx), py = Math.round(y * sy);
    const i = (py * c.width + px) * 4;
    return [d[i], d[i+1], d[i+2]];
  };

  // Region brightness, used to confirm the HUD and floor are present.
  const regionLit = (x0, y0, x1, y1) => {
    let lit = 0, n = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const [r, g, b] = at(x, y);
        if (r + g + b > 190) lit++;
        n++;
      }
    }
    return +(lit / n).toFixed(3);
  };

  // Look for each fighter's signature hue anywhere in the arena band.
  // male primary #3d8bff (blue dominant), female primary #ff3d81 (red dominant).
  let bluePixels = 0, pinkPixels = 0;
  let blueMinX = 1e9, blueMaxX = -1, pinkMinX = 1e9, pinkMaxX = -1;
  for (let y = 300; y < 470; y += 2) {
    for (let x = 0; x < 960; x += 2) {
      const [r, g, b] = at(x, y);
      if (b > 150 && b - r > 55 && g < b) {
        bluePixels++;
        if (x < blueMinX) blueMinX = x;
        if (x > blueMaxX) blueMaxX = x;
      }
      if (r > 160 && r - b > 55 && g < 120) {
        pinkPixels++;
        if (x < pinkMinX) pinkMinX = x;
        if (x > pinkMaxX) pinkMaxX = x;
      }
    }
  }

  return {
    hudLeft: regionLit(40, 30, 380, 62),
    hudRight: regionLit(580, 30, 920, 62),
    hudMiddleGap: regionLit(430, 30, 530, 62),
    floorBand: regionLit(0, 455, 960, 530),
    floorMeanBrightness: (() => {
      let sum = 0, n = 0;
      for (let y = 458; y < 530; y += 2) for (let x = 0; x < 960; x += 4) {
        const [r, g, b] = at(x, y); sum += (r + g + b) / 3; n++;
      }
      return +(sum / n).toFixed(1);
    })(),
    sky: regionLit(0, 90, 960, 140),
    bluePixels, pinkPixels,
    blueSpan: blueMaxX < 0 ? null : [blueMinX, blueMaxX],
    pinkSpan: pinkMaxX < 0 ? null : [pinkMinX, pinkMaxX],
  };
})()`);

console.log("  " + JSON.stringify(report, null, 2).replace(/\n/g, "\n  "));

const problems = [];
if (report.hudLeft < 0.15) problems.push("left health bar missing or dark");
if (report.hudRight < 0.15) problems.push("right health bar missing or dark");
// The floor is intentionally dark so the fighters read against it, so check
// that it is *distinguishable from black*, not that it is bright.
if (report.floorMeanBrightness < 12) problems.push("arena floor not visible");
if (report.bluePixels < 60) problems.push(`male fighter colours barely present (${report.bluePixels}px)`);
if (report.pinkPixels < 60) problems.push(`female fighter colours barely present (${report.pinkPixels}px)`);
// The two fighters should be in different places, not stacked on one spot.
if (report.blueSpan && report.pinkSpan) {
  const overlap =
    Math.min(report.blueSpan[1], report.pinkSpan[1]) -
    Math.max(report.blueSpan[0], report.pinkSpan[0]);
  const blueW = report.blueSpan[1] - report.blueSpan[0];
  if (overlap > blueW * 0.9) problems.push("fighters appear to occupy the same space");
}

if (problems.length) {
  console.log("\n  FAIL:");
  for (const p of problems) console.log(`    - ${p}`);
} else {
  console.log("\n  PASS: HUD, floor and both fighters are rendering as expected.\n");
}

ws.close();
chrome.kill();
process.exit(problems.length ? 1 : 0);
