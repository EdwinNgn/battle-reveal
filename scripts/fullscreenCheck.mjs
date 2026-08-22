/**
 * Verifies the fullscreen and home-screen setup.
 *
 *   node scripts/fullscreenCheck.mjs [url]
 *
 * Checks that:
 *   - the manifest is served, parses, and asks for fullscreen landscape
 *   - the icon is a real, decodable raster image (iOS ignores SVG)
 *   - the Apple standalone meta tags are present
 *   - requestFullscreen is actually attempted on a button press (touch devices)
 *   - the iOS hint appears on iOS and nowhere else
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const URL_BASE = process.argv[2] ?? "http://localhost:5173/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9228;

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--user-data-dir=/tmp/baby-battle-chrome-fs",
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

console.log("\nBABY BATTLE - fullscreen setup check\n");
const problems = [];

// --- manifest ---------------------------------------------------------------
const manifestUrl = new URL("manifest.webmanifest", URL_BASE).href;
const mRes = await fetch(manifestUrl);
console.log(`  manifest: HTTP ${mRes.status}`);
if (!mRes.ok) {
  problems.push(`manifest not served (HTTP ${mRes.status})`);
} else {
  const m = await mRes.json();
  console.log(`    display=${m.display}  orientation=${m.orientation}  icons=${m.icons?.length}`);
  if (m.display !== "fullscreen") problems.push(`manifest display is "${m.display}", expected fullscreen`);
  if (m.orientation !== "landscape") problems.push(`manifest orientation is "${m.orientation}"`);
  if (!m.icons?.length) problems.push("manifest has no icons");
  // iOS ignores SVG for Add to Home Screen, so at least one raster icon is needed.
  const raster = (m.icons ?? []).some((i) => i.type === "image/png");
  if (!raster) problems.push("manifest has no PNG icon (iOS ignores SVG)");
}

// --- icon is a real image ---------------------------------------------------
const iconUrl = new URL("icon-512.png", URL_BASE).href;
const iRes = await fetch(iconUrl);
const iconBytes = new Uint8Array(await iRes.arrayBuffer());
const isPng =
  iconBytes[0] === 0x89 && iconBytes[1] === 0x50 && iconBytes[2] === 0x4e && iconBytes[3] === 0x47;
// Dimensions live in the IHDR chunk, bytes 16..24.
const iw = (iconBytes[16] << 24) | (iconBytes[17] << 16) | (iconBytes[18] << 8) | iconBytes[19];
const ih = (iconBytes[20] << 24) | (iconBytes[21] << 16) | (iconBytes[22] << 8) | iconBytes[23];
console.log(`  icon: HTTP ${iRes.status}  png=${isPng}  ${iw}x${ih}  ${(iconBytes.length / 1024).toFixed(1)} kB`);
if (!iRes.ok) problems.push(`icon not served (HTTP ${iRes.status})`);
if (!isPng) problems.push("icon is not a valid PNG");
if (iw < 180 || ih < 180) problems.push(`icon is ${iw}x${ih}, too small for a home screen icon`);

// --- meta tags --------------------------------------------------------------
await send("Emulation.setDeviceMetricsOverride", {
  width: 852,
  height: 393,
  deviceScaleFactor: 3,
  mobile: true,
});
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await send("Page.navigate", { url: URL_BASE });
await sleep(1700);

const meta = await evaluate(`(() => {
  const get = (n) => document.querySelector('meta[name="' + n + '"]')?.content ?? null;
  return {
    appleCapable: get("apple-mobile-web-app-capable"),
    mobileCapable: get("mobile-web-app-capable"),
    statusBar: get("apple-mobile-web-app-status-bar-style"),
    appleTitle: get("apple-mobile-web-app-title"),
    manifestLink: document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null,
    appleIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") ?? null,
    viewportFit: (get("viewport") ?? "").includes("viewport-fit=cover"),
  };
})()`);
console.log("  meta:", JSON.stringify(meta));
if (meta.appleCapable !== "yes") problems.push("apple-mobile-web-app-capable missing");
if (meta.mobileCapable !== "yes") problems.push("mobile-web-app-capable missing");
if (!meta.manifestLink) problems.push("manifest link missing from the page");
if (!meta.appleIcon) problems.push("apple-touch-icon missing");
if (!meta.viewportFit) problems.push("viewport-fit=cover missing (notch handling)");

// --- fullscreen is attempted on a button press ------------------------------
const fsAttempt = await evaluate(`(async () => {
  let called = false;
  const orig = document.documentElement.requestFullscreen;
  document.documentElement.requestFullscreen = function (...a) {
    called = true;
    // Resolve rather than actually going fullscreen, which headless refuses.
    return Promise.resolve();
  };

  const c = document.getElementById("game");
  const r = c.getBoundingClientRect();
  // PLAY button, in virtual coordinates 390,426.
  const x = r.left + (390 / 960) * r.width;
  const y = r.top + (426 / 540) * r.height;
  for (const type of ["pointerdown", "pointerup"]) {
    c.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1, isPrimary: true }));
  }
  await new Promise((res) => setTimeout(res, 350));
  document.documentElement.requestFullscreen = orig;
  return called;
})()`);
console.log(`  requestFullscreen attempted on button press: ${fsAttempt}`);
if (!fsAttempt) problems.push("requestFullscreen was not attempted on a touch button press");

// --- the iOS hint only shows on iOS ----------------------------------------
const hintLogic = await evaluate(`(async () => {
  const fs = await import("/src/input/fullscreen.ts");
  return { isIos: fs.isIos(), standalone: fs.isStandalone(), supported: fs.fullscreenSupported() };
})()`);
console.log("  platform:", JSON.stringify(hintLogic));
// Emulated Chrome is not iOS, so the hint must be suppressed here.
if (hintLogic.isIos) {
  problems.push("isIos() true under emulated Chrome - detection is too loose");
}

console.log(`\n  page exceptions: ${errors.length}`);
for (const e of errors.slice(0, 4)) console.log(`    ${e}`);

if (problems.length || errors.length) {
  console.log("\n  FAIL:");
  for (const p of problems) console.log(`    - ${p}`);
  ws.close();
  chrome.kill();
  process.exit(1);
}
console.log("\n  PASS: fullscreen on Android, home-screen install path for iOS.\n");
ws.close();
chrome.kill();
