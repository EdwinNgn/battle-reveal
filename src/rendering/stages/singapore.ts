import { Rng } from "../../core/rng.ts";
import { px, poly, water, windows } from "./draw.ts";
import type { StageTheme } from "./types.ts";

/**
 * SINGAPOUR - Marina Bay after dark.
 *
 * Three towers carrying a boat-shaped roof on top, and the tree-like steel
 * structures of the gardens beside them, lit violet. Both shapes are unique
 * enough to be read instantly even in silhouette.
 */

/** A Supertree: tapered trunk with a radiating canopy. */
function supertree(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  h: number,
  time: number,
  phase: number,
): void {
  const trunk = "#2a3040";
  // Trunk, widening towards the canopy.
  poly(ctx, [x - 7, baseY, x - 11, baseY - h * 0.82, x + 11, baseY - h * 0.82, x + 7, baseY], trunk);

  // Canopy spokes.
  const topY = baseY - h * 0.82;
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI * 0.94 + (i / 10) * Math.PI * 0.88;
    const len = h * (0.3 + (i % 2 === 0 ? 0.08 : 0));
    ctx.save();
    ctx.strokeStyle = trunk;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x + Math.cos(a) * len, topY + Math.sin(a) * len * 0.72);
    ctx.stroke();
    ctx.restore();
  }

  // Violet uplighting, breathing slowly. This is what makes the gardens
  // recognisable at night.
  const pulse = 0.55 + 0.45 * Math.sin(time * 0.9 + phase);
  for (const [r, a] of [
    [h * 0.42, 0.1],
    [h * 0.26, 0.16],
    [h * 0.14, 0.24],
  ] as const) {
    ctx.save();
    ctx.globalAlpha = a * pulse;
    ctx.fillStyle = "#b26aff";
    ctx.beginPath();
    ctx.ellipse(x, topY, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Bright core at the crown.
  px(ctx, x - 4, topY - 6, 8, 10, "#d9a6ff", 0.7 * pulse);
}

export const SINGAPORE: StageTheme = {
  id: "singapore",
  name: "SINGAPOUR",
  palette: {
    skyTop: "#0d1024",
    skyMid: "#1e1c42",
    skyHorizon: "#3d2a5c",
    glow: "rgba(180,120,255,0.24)",
    far: "#1c2138",
    mid: "#252b46",
    near: "#2f3654",
    light: "#ffe0a0",
    lightAlt: "#b7e8ff",
    floorTop: "#2b3050",
    floorMid: "#171a2c",
    floorDeep: "#080a14",
    floorEdge: "#b26aff",
    floorLine: "#3f4668",
  },

  drawBackdrop(ctx, time, shift, floorY) {
    const p = SINGAPORE.palette;
    const waterTop = floorY - 78;

    // --- background skyline -------------------------------------------------
    const rng = new Rng(0x51064);
    for (let i = 0; i < 20; i++) {
      const bx = -30 + i * 34 + shift * 0.08;
      const bw = rng.range(22, 40);
      const bh = rng.range(60, 170);
      px(ctx, bx, waterTop - bh, bw, bh, p.far);
      windows(ctx, bx, waterTop - bh + 4, bw, bh - 8, rng.int(1, 9999), [p.light, p.lightAlt], time, 0.28);
    }

    // --- Marina Bay Sands ---------------------------------------------------
    const mx = 300 + shift * 0.22;
    const towerH = 250;
    const towerW = 44;
    const baseY = waterTop;

    // Three towers, each leaning slightly, wider at the base.
    for (let i = 0; i < 3; i++) {
      const tx = mx + i * 86;
      poly(
        ctx,
        [
          tx - towerW / 2 - 8, baseY,
          tx - towerW / 2 + 4, baseY - towerH,
          tx + towerW / 2 - 4, baseY - towerH,
          tx + towerW / 2 + 8, baseY,
        ],
        "#2e3554",
      );
      windows(ctx, tx - towerW / 2, baseY - towerH + 8, towerW, towerH - 16, 0x5a5 + i, [p.lightAlt, p.light], time, 0.4);
    }

    // The SkyPark: a long boat sitting across all three towers.
    const deckY = baseY - towerH;
    const deckW = 86 * 2 + towerW + 60;
    px(ctx, mx - towerW / 2 - 30, deckY - 16, deckW, 17, "#3a4266");
    // Tapered prow overhanging one end.
    poly(
      ctx,
      [mx + deckW - 74, deckY - 16, mx + deckW + 6, deckY - 11, mx + deckW - 74, deckY + 1],
      "#3a4266",
    );
    // Lit edge along the deck.
    px(ctx, mx - towerW / 2 - 30, deckY - 18, deckW, 3, p.lightAlt, 0.5);
    // Palms up on the roof, suggested with small marks.
    const pr = new Rng(0x9ee1);
    for (let i = 0; i < 14; i++) {
      const lx = mx - 20 + i * 16 + pr.range(-4, 4);
      px(ctx, lx, deckY - 24, 3, 7, "#1e5236", 0.8);
      px(ctx, lx - 3, deckY - 26, 9, 3, "#245c3c", 0.8);
    }

    // --- Supertrees ---------------------------------------------------------
    supertree(ctx, 690 + shift * 0.34, waterTop + 6, 210, time, 0);
    supertree(ctx, 762 + shift * 0.34, waterTop + 6, 168, time, 1.2);
    supertree(ctx, 828 + shift * 0.34, waterTop + 6, 232, time, 2.4);
    supertree(ctx, 900 + shift * 0.34, waterTop + 6, 186, time, 3.6);

    // --- water --------------------------------------------------------------
    water(ctx, waterTop, 78, time, "#182246", "#0a0e1c", "#b7e8ff", 960);

    // Violet reflections under the trees, cool ones under the towers.
    const rr = new Rng(0x4e11);
    for (let i = 0; i < 54; i++) {
      const rx = rr.range(-20, 980);
      const violet = rx > 640;
      px(
        ctx,
        rx + Math.sin(time * 1.3 + i) * 1.8,
        waterTop + rr.range(2, 68),
        rr.range(2, 5),
        rr.range(6, 18),
        violet ? "#b26aff" : p.lightAlt,
        rr.range(0.1, 0.3),
      );
    }

    // Laser sweep from the SkyPark, very faint: the nightly light show.
    const sweep = Math.sin(time * 0.5);
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = "#7ef0d0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx + 60, deckY - 18);
    ctx.lineTo(mx + 60 + sweep * 420, waterTop - 260);
    ctx.stroke();
    ctx.restore();
  },
};
