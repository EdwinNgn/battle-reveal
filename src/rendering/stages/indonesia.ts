import { Rng } from "../../core/rng.ts";
import { celestial, palm, px, poly, ridge } from "./draw.ts";
import type { StageTheme } from "./types.ts";

/**
 * INDONESIA - Borobudur at sunrise, with a volcano behind.
 *
 * The temple is built from stacked square terraces topped with rows of small
 * bell-shaped stupas, which is the shape everyone recognises. Mount Merapi sits
 * on the horizon trailing a slow plume, and mist pools between the two: the
 * sunrise view the site is famous for.
 */

const STONE = "#5f5a55";
const STONE_LIT = "#8a8078";
const VOLCANO = "#3a3040";

/** One bell-shaped stupa. */
function stupa(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  size: number,
  color: string,
): void {
  // Square plinth.
  px(ctx, x - size * 0.6, baseY - size * 0.3, size * 1.2, size * 0.3, color);
  // Bell body.
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, baseY - size * 0.3, size * 0.5, Math.PI, 0);
  ctx.fill();
  ctx.restore();
  // Finial.
  px(ctx, x - size * 0.09, baseY - size * 1.05, size * 0.18, size * 0.28, color);
}

export const INDONESIA: StageTheme = {
  id: "indonesia",
  name: "INDONÉSIE",
  palette: {
    skyTop: "#241a3d",
    skyMid: "#6b3550",
    skyHorizon: "#e08a52",
    glow: "rgba(255,190,110,0.4)",
    far: VOLCANO,
    mid: "#4a4048",
    near: STONE,
    light: "#ffd9a0",
    lightAlt: "#fff3d4",
    floorTop: "#4c4136",
    floorMid: "#2b241f",
    floorDeep: "#120e0c",
    floorEdge: "#ffc078",
    floorLine: "#615243",
  },

  drawBackdrop(ctx, time, shift, floorY) {
    // Rising sun low on the horizon.
    celestial(ctx, 720 + shift * 0.08, 190, 30, "#ffe0a8", "rgba(255,160,90,0.6)");

    // --- distant jungle ridges --------------------------------------------
    ridge(ctx, floorY - 60, 0x1d0e51, "#4a3a52", {
      peaks: 9,
      minH: 60,
      maxH: 130,
      shift: shift * 0.1,
      width: 960,
      alpha: 0.85,
    });

    // --- the volcano ------------------------------------------------------
    const vx = 190 + shift * 0.16;
    const vBase = floorY - 40;
    poly(ctx, [vx - 210, vBase, vx, vBase - 260, vx + 210, vBase], VOLCANO);
    // Truncated crater.
    poly(ctx, [vx - 30, vBase - 232, vx - 14, vBase - 262, vx + 14, vBase - 262, vx + 30, vBase - 232], "#2c2434");
    // Sunlit flank.
    poly(ctx, [vx, vBase - 260, vx + 210, vBase, vx + 96, vBase], "#463a4e", 0.8);

    // Plume, drifting slowly. Kept faint so it never distracts.
    const rng = new Rng(0x9101);
    for (let i = 0; i < 16; i++) {
      const t = i / 16;
      const drift = Math.sin(time * 0.25 + i * 0.5) * (12 + t * 40);
      px(
        ctx,
        vx - 12 + drift + rng.range(-8, 8),
        vBase - 268 - t * 130,
        18 + t * 40,
        14 + t * 18,
        "#8a7a88",
        0.16 * (1 - t * 0.7),
      );
    }

    // --- Borobudur: stacked terraces --------------------------------------
    const cx = 560 + shift * 0.34;
    const base = floorY;
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const w = 380 - i * 58;
      const h = 30;
      const y = base - (i + 1) * h;
      px(ctx, cx - w / 2, y, w, h, i % 2 === 0 ? STONE : STONE_LIT);
      // Shadowed step edge, which gives the stack its depth.
      px(ctx, cx - w / 2, y + h - 5, w, 5, "#3d3833", 0.6);

      // Rows of stupas on the upper terraces.
      if (i >= 2) {
        const count = Math.max(3, 9 - i);
        for (let s = 0; s < count; s++) {
          const sx = cx - w / 2 + (w / (count + 1)) * (s + 1);
          stupa(ctx, sx, y, 17, STONE_LIT);
        }
      }
    }
    // The great central stupa.
    stupa(ctx, cx, base - tiers * 30, 40, STONE_LIT);

    // Stairway up the front face.
    for (let i = 0; i < tiers * 3; i++) {
      px(ctx, cx - 16, base - 6 - i * 5, 32, 4, "#4e4944", 0.85);
    }

    // --- morning mist between temple and volcano --------------------------
    for (let i = 0; i < 4; i++) {
      const my = floorY - 54 - i * 15;
      const drift = Math.sin(time * 0.2 + i) * 26;
      px(ctx, -60 + drift, my, 1080, 13, "#d8c0b0", 0.09);
    }
  },

  drawForeground(ctx, time, shift, floorY) {
    // A couple of palms framing the edges, close to the camera.
    palm(ctx, -6 + shift * 0.9, floorY + 6, 168, 0.3, "#2b2018", "#1f3a22", time, 0);
    palm(ctx, 966 + shift * 0.9, floorY + 6, 190, -0.34, "#2b2018", "#1f3a22", time, 1.6);
  },
};
