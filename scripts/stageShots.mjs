/**
 * Screenshots each stage and measures whether the fighters stay readable.
 *
 *   node scripts/stageShots.mjs
 *
 * A pretty backdrop that swallows the fighters is worse than a plain one, so this
 * checks the thing that actually matters: contrast between the fighter band and
 * the scenery behind it, plus that each stage looks different from the others.
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const URL_BASE = process.argv[2] ?? "http://localhost:5173/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9229;
const OUT = ".artifacts/stages";
mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--user-data-dir=/tmp/baby-battle-chrome-stages",
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

const rect = await evaluate(`(() => {
  const r = document.getElementById("game").getBoundingClientRect();
  return { left: r.left, top: r.top, w: r.width, h: r.height };
})()`);
const click = async (vx, vy) => {
  const x = rect.left + (vx / 960) * rect.w;
  const y = rect.top + (vy / 540) * rect.h;
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  }
  await sleep(320);
};

// Get into a fight so the stage is on screen with fighters present.
await click(390, 426);
await click(480, 463);
await click(627, 477);
await click(480, 474);
await click(480, 485);
await sleep(2800);

console.log("\nBABY BATTLE - stage screenshots\n");
const problems = [];

const stageIds = await evaluate(`(async () => {
  const m = await import("/src/rendering/stages/index.ts");
  return m.ALL_STAGES.map((s) => ({ id: s.id, name: s.name }));
})()`);

const fingerprints = new Map();

for (const { id: sid, name } of stageIds) {
  // Force the stage directly, rather than replaying fights to reach it.
  await evaluate(`(async () => {
    const m = await import("/src/rendering/stages/index.ts");
    const g = window.__bbGame;
    g.stage.setTheme(m.stageById(${JSON.stringify(sid)}));
    return true;
  })()`);
  // Let the animation settle so the shot is representative.
  await sleep(700);

  const stats = await evaluate(`(() => {
    const c = document.getElementById("game");
    const ctx = c.getContext("2d");
    const sx = c.width / 960, sy = c.height / 540;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const at = (x, y) => {
      const i = (Math.round(y * sy) * c.width + Math.round(x * sx)) * 4;
      return [d[i], d[i + 1], d[i + 2]];
    };
    const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Mean brightness of the band the fighters occupy, versus the sky above it.
    let band = 0, bandN = 0, sky = 0, skyN = 0;
    for (let y = 330; y < 450; y += 3) for (let x = 0; x < 960; x += 6) { band += lum(at(x, y)); bandN++; }
    for (let y = 40; y < 200; y += 3) for (let x = 0; x < 960; x += 6) { sky += lum(at(x, y)); skyN++; }

    // Coarse colour fingerprint, to prove the stages differ from each other.
    const fp = [];
    for (let y = 60; y < 460; y += 100) for (let x = 60; x < 900; x += 120) {
      const [r, g, b] = at(x, y);
      fp.push((r >> 5) + "," + (g >> 5) + "," + (b >> 5));
    }
    return {
      bandLum: +(band / bandN).toFixed(1),
      skyLum: +(sky / skyN).toFixed(1),
      fingerprint: fp.join("|"),
    };
  })()`);

  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${sid}.png`, Buffer.from(data, "base64"));

  console.log(
    `  ${name.padEnd(14)} band=${String(stats.bandLum).padStart(6)} ` +
      `sky=${String(stats.skyLum).padStart(6)}`,
  );

  // The fighter band must stay dark: the sprites are mid-tone, so a bright
  // backdrop behind them destroys the silhouette.
  if (stats.bandLum > 110) {
    problems.push(`${name}: fighter band is too bright (${stats.bandLum}) - fighters will wash out`);
  }
  fingerprints.set(sid, stats.fingerprint);
}

// Every stage should look distinct.
const uniqueFp = new Set(fingerprints.values());
console.log(`\n  visually distinct stages: ${uniqueFp.size} / ${fingerprints.size}`);
if (uniqueFp.size !== fingerprints.size) {
  const dupes = [...fingerprints.entries()].filter(
    ([, fp], _i, arr) => arr.filter(([, o]) => o === fp).length > 1,
  );
  problems.push(`stages look identical: ${dupes.map(([k]) => k).join(", ")}`);
}

console.log(`  page exceptions: ${errors.length}`);
for (const e of errors.slice(0, 4)) console.log(`    ${e}`);

if (problems.length || errors.length) {
  console.log("\n  FAIL:");
  for (const p of problems) console.log(`    - ${p}`);
  ws.close();
  chrome.kill();
  process.exit(1);
}
console.log(`\n  PASS: all stages distinct and fighters stay readable. Shots in ${OUT}/\n`);
ws.close();
chrome.kill();
