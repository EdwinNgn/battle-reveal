import "./style.css";
import { Game } from "./game/Game.ts";
import { isTouchDevice } from "./input/TouchInput.ts";
import { applyDomStrings } from "./i18n/dom.ts";

/**
 * Entry point. Wires up the canvas, the orientation guard and the game loop.
 */

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const touchLayer = document.getElementById("touch-layer");
const rotateOverlay = document.getElementById("rotate-overlay");

if (!canvas || !touchLayer || !rotateOverlay) {
  throw new Error("Expected markup is missing from index.html");
}

// --- portrait guard -------------------------------------------------------
// Only nags on touch devices: a narrow desktop window is the user's business.
function checkOrientation(): void {
  const portrait = window.innerHeight > window.innerWidth;
  const shouldWarn = isTouchDevice() && portrait;
  rotateOverlay!.toggleAttribute("hidden", !shouldWarn);
}

window.addEventListener("resize", checkOrientation);
window.addEventListener("orientationchange", () => {
  // Safari reports stale dimensions immediately after the event.
  setTimeout(checkOrientation, 120);
});
checkOrientation();

// --- stop the page behaving like a document -------------------------------
// Prevents rubber-band scrolling, pinch zoom and double-tap zoom from
// interfering with gameplay, while leaving the on-screen buttons working.
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());

// Localise the DOM-based text (the rotate prompt) before the first paint.
applyDomStrings();

const game = new Game(canvas, touchLayer);
game.start();

// --- development-only testing tools ---------------------------------------
// This branch is statically false in a production build, so the dev panel and
// the simulation harness are dropped from the bundle entirely.
if (import.meta.env.DEV) {
  void import("./dev/devPanel.ts").then((m) => m.installDevPanel());
  // Handle used by scripts/playabilityCheck.mjs to read live fighter state.
  // Dropped from production builds along with the rest of this branch.
  (window as unknown as { __bbGame: Game }).__bbGame = game;
}
