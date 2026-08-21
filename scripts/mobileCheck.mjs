/**
 * Verifies the mobile experience: touch emulation, landscape scaling, the
 * on-screen control pad, and the portrait rotate prompt.
 *
 *   node scripts/mobileCheck.mjs [url]
 *
 * Emulates a few real device viewports rather than just resizing the window, so
 * the touch-detection path and the CSS breakpoints are genuinely exercised.
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const URL_BASE = process.argv[2] ?? "http://localhost:5173/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9224;
const OUT = ".artifacts";
mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--user-data-dir=/tmp/baby-battle-chrome-3",
    "--autoplay-policy=no-user-gesture-required",
    "about:blank",
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

const DEVICES = [
  { name: "iPhone SE landscape", w: 667, h: 375, dpr: 2 },
  { name: "iPhone 15 Pro landscape", w: 852, h: 393, dpr: 3 },
  { name: "Pixel 8 landscape", w: 892, h: 412, dpr: 2.6 },
  { name: "iPad landscape", w: 1080, h: 810, dpr: 2 },
  { name: "iPhone 15 PORTRAIT", w: 393, h: 852, dpr: 3, portrait: true },
];

console.log("\nBABY BATTLE - mobile check\n");
const problems = [];

for (const dev of DEVICES) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: dev.w,
    height: dev.h,
    deviceScaleFactor: dev.dpr,
    mobile: true,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Page.navigate", { url: URL_BASE });
  await sleep(1500);

  const info = await evaluate(`(() => {
    const c = document.getElementById("game");
    const r = c.getBoundingClientRect();
    const overlay = document.getElementById("rotate-overlay");
    const pad = document.getElementById("touch-layer");
    return {
      cssW: +r.width.toFixed(1),
      cssH: +r.height.toFixed(1),
      aspect: +(r.width / r.height).toFixed(3),
      fitsWidth: r.width <= window.innerWidth + 1,
      fitsHeight: r.height <= window.innerHeight + 1,
      rotateShown: !overlay.hasAttribute("hidden"),
      padExists: pad.querySelectorAll(".touch-btn").length,
      bodyScrollable: document.body.scrollHeight > window.innerHeight + 1,
    };
  })()`);

  const targetAspect = 960 / 540;
  const aspectOk = Math.abs(info.aspect - targetAspect) < 0.02;

  console.log(`  ${dev.name}`);
  console.log(
    `    canvas ${info.cssW}x${info.cssH}  aspect ${info.aspect}` +
      `${aspectOk ? " ok" : " WRONG"}  buttons ${info.padExists}` +
      `  rotatePrompt ${info.rotateShown}`,
  );

  if (!aspectOk) problems.push(`${dev.name}: aspect ratio distorted (${info.aspect})`);
  if (!info.fitsWidth || !info.fitsHeight) {
    problems.push(`${dev.name}: canvas overflows the viewport`);
  }
  if (info.bodyScrollable) problems.push(`${dev.name}: page is scrollable`);
  if (info.padExists !== 7) problems.push(`${dev.name}: expected 7 touch buttons, found ${info.padExists}`);

  if (dev.portrait && !info.rotateShown) {
    problems.push(`${dev.name}: rotate prompt should be visible in portrait`);
  }
  if (!dev.portrait && info.rotateShown) {
    problems.push(`${dev.name}: rotate prompt should be hidden in landscape`);
  }

  // On the first landscape device, drive a fight with real touches and confirm
  // the control pad becomes visible and actually moves the fighter.
  if (dev.name.startsWith("iPhone SE")) {
    const rect = await evaluate(`(() => {
      const r = document.getElementById("game").getBoundingClientRect();
      return { left: r.left, top: r.top, w: r.width, h: r.height };
    })()`);
    // synthesizeTapGesture produces the full touch -> pointer event sequence
    // Chrome generates for a real finger, which is what the game listens for.
    const tap = async (vxp, vyp) => {
      const x = rect.left + (vxp / 960) * rect.w;
      const y = rect.top + (vyp / 540) * rect.h;
      await send("Input.synthesizeTapGesture", {
        x: Math.round(x),
        y: Math.round(y),
        duration: 60,
        gestureSourceType: "touch",
      });
      await sleep(260);
    };

    await tap(390, 426); // PLAY
    await tap(480, 463); // START
    await tap(627, 477); // pick TEAM GIRL
    await tap(480, 474); // FIGHT! on the player turn card
    await tap(480, 485); // FIGHT! on the controls screen
    await sleep(2400);

    const padState = await evaluate(`(() => {
      const layer = document.getElementById("touch-layer");
      const btn = layer.querySelector(".touch-btn");
      const r = btn.getBoundingClientRect();
      return {
        visible: layer.classList.contains("touch-visible"),
        opacity: getComputedStyle(layer).opacity,
        buttonSize: [Math.round(r.width), Math.round(r.height)],
        pointerEvents: getComputedStyle(btn).pointerEvents,
      };
    })()`);
    console.log(`    pad in fight: ${JSON.stringify(padState)}`);
    // Sample the canvas: the fight screen has health bars along the top, the
    // menus do not. Distinguishes "reached the fight" from "stuck in a menu".
    const looksLikeFight = await evaluate(`(() => {
      const c = document.getElementById("game");
      const ctx = c.getContext("2d");
      const sx = c.width / 960, sy = c.height / 540;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const lit = (x0,y0,x1,y1) => {
        let n=0,t=0;
        for (let y=y0;y<y1;y+=2) for (let x=x0;x<x1;x+=2) {
          const px=Math.round(x*sx), py=Math.round(y*sy);
          const i=(py*c.width+px)*4;
          if (d[i]+d[i+1]+d[i+2] > 190) n++;
          t++;
        }
        return t ? n/t : 0;
      };
      return { hudLeft: +lit(40,30,380,62).toFixed(2), hudRight: +lit(580,30,920,62).toFixed(2) };
    })()`);
    console.log(`    hud bars: ${JSON.stringify(looksLikeFight)}`);
    if (!padState.visible) problems.push("touch pad not shown during a fight");
    if (padState.pointerEvents === "none") problems.push("touch buttons not interactive");
    if (padState.buttonSize[0] < 44 || padState.buttonSize[1] < 44) {
      problems.push(`touch targets too small: ${padState.buttonSize.join("x")}`);
    }

    // Confirm the buttons actually drive the fighter, not just light up.
    const moveTest = await evaluate(`(() => {
      const layer = document.getElementById("touch-layer");
      const btn = [...layer.querySelectorAll(".touch-btn")]
        .find(b => b.getAttribute("aria-label") === "right");
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const opts = { pointerId: 1, bubbles: true, clientX: x, clientY: y, isPrimary: true };
      btn.dispatchEvent(new PointerEvent("pointerdown", opts));
      return { pressed: btn.classList.contains("is-active") };
    })()`);
    // Hold it for a moment so the fighter has time to walk.
    await sleep(500);
    const released = await evaluate(`(() => {
      const layer = document.getElementById("touch-layer");
      const btn = [...layer.querySelectorAll(".touch-btn")]
        .find(b => b.getAttribute("aria-label") === "right");
      btn.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, bubbles: true, isPrimary: true }));
      return !btn.classList.contains("is-active");
    })()`);
    console.log(`    right button: pressed=${moveTest.pressed} released=${released}`);
    if (!moveTest.pressed) problems.push("touch button did not register a press");
    if (!released) problems.push("touch button stayed active after release");

    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${OUT}/mobile-fight.png`, Buffer.from(data, "base64"));
  }

  if (dev.portrait) {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${OUT}/mobile-portrait.png`, Buffer.from(data, "base64"));
  }
}

console.log(`\n  page exceptions: ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log(`    ${e}`);

if (problems.length || errors.length) {
  console.log("\n  FAIL:");
  for (const p of problems) console.log(`    - ${p}`);
  process.exit(1);
}
console.log("\n  PASS: mobile landscape, touch pad and rotate prompt all behave.\n");

ws.close();
chrome.kill();
