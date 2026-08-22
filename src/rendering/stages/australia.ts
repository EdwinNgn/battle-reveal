import { Rng } from "../../core/rng.ts";
import { px, water, windows } from "./draw.ts";
import type { StageTheme } from "./types.ts";

/**
 * AUSTRALIE - Sydney Harbour at dusk.
 *
 * The two landmarks that make the harbour unmistakable: the shell roofs of the
 * Opera House and the steel arch of the bridge. Drawn from a viewpoint where both
 * sit together, bridge on the left, Opera House on the right, city lights between.
 */

/** One Opera House shell: a quarter-arc leaning into the wind. */
function shell(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  h: number,
  lean: number,
  color: string,
  rib: string,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  // Two curves meeting at a point produce the sail shape.
  ctx.bezierCurveTo(x + w * 0.05, baseY - h * 0.7, x + w * (0.3 + lean), baseY - h, x + w, baseY - h * 0.16);
  ctx.lineTo(x + w, baseY);
  ctx.closePath();
  ctx.fill();

  // Ribs following the curve, which is what reads as the tiled surface.
  ctx.strokeStyle = rib;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(x + w * t * 0.5, baseY);
    ctx.bezierCurveTo(
      x + w * 0.1,
      baseY - h * 0.6 * (1 - t * 0.3),
      x + w * (0.3 + lean) * (1 - t * 0.2),
      baseY - h * (1 - t * 0.35),
      x + w * (1 - t * 0.25),
      baseY - h * 0.16,
    );
    ctx.stroke();
  }
  ctx.restore();
}

export const AUSTRALIA: StageTheme = {
  id: "australia",
  name: "AUSTRALIE",
  stars: true,
  palette: {
    skyTop: "#141a3a",
    skyMid: "#3a2f5e",
    skyHorizon: "#c96a5e",
    glow: "rgba(255,160,120,0.3)",
    far: "#242a48",
    mid: "#2e3554",
    near: "#3a4166",
    light: "#ffd98a",
    lightAlt: "#a8d8ff",
    floorTop: "#33384f",
    floorMid: "#1c2030",
    floorDeep: "#0b0d16",
    floorEdge: "#8ad4ff",
    floorLine: "#454d6a",
  },

  drawBackdrop(ctx, time, shift, floorY) {
    const p = AUSTRALIA.palette;
    const waterTop = floorY - 84;

    // --- city skyline in the middle distance -------------------------------
    const rng = new Rng(0x5d4e7);
    for (let i = 0; i < 22; i++) {
      const bx = 240 + i * 26 + shift * 0.1;
      const bw = rng.range(18, 34);
      const bh = rng.range(50, 150);
      px(ctx, bx, waterTop - bh, bw, bh, p.far);
      windows(ctx, bx, waterTop - bh + 4, bw, bh - 8, rng.int(1, 9999), [p.light, p.lightAlt], time, 0.3);
    }

    // --- Harbour Bridge ----------------------------------------------------
    const bx0 = -40 + shift * 0.2;
    const bx1 = 400 + shift * 0.2;
    const deckY = waterTop - 96;
    const span = bx1 - bx0;
    const archH = 104;

    // Arch, as a thick stroked curve.
    ctx.save();
    ctx.strokeStyle = p.near;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(bx0, deckY);
    ctx.quadraticCurveTo(bx0 + span / 2, deckY - archH * 1.6, bx1, deckY);
    ctx.stroke();

    // Lower chord.
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bx0, deckY + 4);
    ctx.quadraticCurveTo(bx0 + span / 2, deckY - archH * 0.55, bx1, deckY + 4);
    ctx.stroke();
    ctx.restore();

    // Vertical hangers between arch and deck.
    for (let i = 1; i < 16; i++) {
      const t = i / 16;
      const hx = bx0 + span * t;
      // Height of the quadratic at t.
      const ay = deckY + (deckY - archH * 1.6 - deckY) * 2 * t * (1 - t);
      px(ctx, hx - 1.5, ay, 3, deckY - ay, p.near, 0.9);
    }

    // Deck.
    px(ctx, bx0, deckY, span, 9, p.mid);
    // Pylons at each end: the stone towers.
    for (const pxx of [bx0 + 26, bx1 - 44]) {
      px(ctx, pxx, deckY - 48, 20, 57, "#4a5170");
      px(ctx, pxx - 3, deckY - 54, 26, 8, "#535a7c");
    }
    // Piers down to the water.
    px(ctx, bx0 + 8, deckY + 9, 16, waterTop - deckY - 9, p.mid);
    px(ctx, bx1 - 26, deckY + 9, 16, waterTop - deckY - 9, p.mid);

    // --- Opera House -------------------------------------------------------
    const ox = 620 + shift * 0.28;
    const oBase = waterTop + 4;
    // Podium.
    px(ctx, ox - 30, oBase - 16, 300, 18, "#3e4463");

    // Shells, largest at the back, stepping down to the front right.
    shell(ctx, ox + 150, oBase - 14, 120, 118, 0.16, "#e8eaf2", "#8f97b5");
    shell(ctx, ox + 92, oBase - 14, 108, 96, 0.14, "#dde0eb", "#8f97b5");
    shell(ctx, ox + 40, oBase - 14, 92, 76, 0.12, "#d2d6e4", "#8f97b5");
    shell(ctx, ox - 4, oBase - 14, 74, 58, 0.1, "#c7cbdc", "#8f97b5");
    // The small detached shell of the restaurant.
    shell(ctx, ox + 236, oBase - 14, 52, 40, 0.1, "#cdd1e0", "#8f97b5");

    // Warm light under the podium, spilling onto the water.
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = p.light;
    ctx.fillRect(ox - 30, oBase, 300, 8);
    ctx.restore();

    // --- water -------------------------------------------------------------
    water(ctx, waterTop, 84, time, "#1e2a48", "#0d1220", "#8ad4ff", 960);

    // Reflections of the shells.
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.translate(0, waterTop);
    ctx.scale(1, -0.35);
    ctx.translate(0, -waterTop);
    shell(ctx, ox + 150, oBase - 14, 120, 118, 0.16, "#e8eaf2", "#e8eaf2");
    shell(ctx, ox + 92, oBase - 14, 108, 96, 0.14, "#dde0eb", "#dde0eb");
    ctx.restore();

    // A ferry crossing, slowly.
    const fx = ((time * 26) % 1200) - 120 + shift * 0.4;
    px(ctx, fx, waterTop + 30, 46, 9, "#2b3350");
    px(ctx, fx + 12, waterTop + 22, 20, 9, "#333c5c");
    px(ctx, fx + 4, waterTop + 32, 4, 3, p.light, 0.8);
    px(ctx, fx + 38, waterTop + 32, 4, 3, "#ff8a8a", 0.8);
  },
};
