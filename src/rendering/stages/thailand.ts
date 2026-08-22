import { Rng } from "../../core/rng.ts";
import { palm, px, poly, water } from "./draw.ts";
import type { StageTheme } from "./types.ts";

/**
 * THAILAND - a temple on the water at dusk, lanterns rising.
 *
 * Two recognisable shapes combined: the tiered, steeply-pitched roofs with
 * upswept finials of a wat, and the limestone karst towers of the southern bays.
 * Floating lanterns drift upward, which gives the stage its movement without
 * pulling the eye away from the fighters.
 */

const TEMPLE = "#8a3f2e";
const TEMPLE_ROOF = "#c8622c";

/** Tiered temple roof: stacked pitches, each narrower than the last. */
function templeRoof(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  w: number,
  tiers: number,
  roof: string,
  trim: string,
): void {
  let y = baseY;
  let width = w;
  for (let i = 0; i < tiers; i++) {
    const h = 30 - i * 3;
    poly(ctx, [cx - width / 2, y, cx, y - h, cx + width / 2, y], roof);
    // Gold trim along the eaves.
    px(ctx, cx - width / 2, y - 3, width, 4, trim, 0.85);
    // Upswept finials at each end: the detail that makes it read as Thai.
    poly(
      ctx,
      [cx - width / 2, y, cx - width / 2 - 12, y - 20, cx - width / 2 + 4, y - 5],
      trim,
    );
    poly(
      ctx,
      [cx + width / 2, y, cx + width / 2 + 12, y - 20, cx + width / 2 - 4, y - 5],
      trim,
    );
    y -= h - 4;
    width *= 0.74;
  }
  // Spire crowning the stack.
  px(ctx, cx - 3, y - 46, 6, 48, trim);
  for (let i = 0; i < 4; i++) {
    px(ctx, cx - 7 + i, y - 20 - i * 9, 14 - i * 2, 4, trim);
  }
}

export const THAILAND: StageTheme = {
  id: "thailand",
  name: "THAÏLANDE",
  palette: {
    skyTop: "#1c1636",
    skyMid: "#4a2a54",
    skyHorizon: "#d96a48",
    glow: "rgba(255,150,90,0.34)",
    far: "#3a2a48",
    mid: "#4e3050",
    near: TEMPLE,
    light: "#ffc861",
    lightAlt: "#fff0b8",
    floorTop: "#4a3038",
    floorMid: "#281a24",
    floorDeep: "#100a12",
    floorEdge: "#ffb45e",
    floorLine: "#5e3c48",
  },

  drawBackdrop(ctx, time, shift, floorY) {
    const p = THAILAND.palette;
    const gold = "#f0b95e";

    // --- karst towers on the horizon --------------------------------------
    const rng = new Rng(0x7ba17);
    for (let i = 0; i < 6; i++) {
      const kx = 40 + i * 175 + shift * 0.12;
      const kh = rng.range(90, 180);
      const kw = rng.range(46, 78);
      // Limestone towers are wider at the top than the base, undercut by water.
      poly(
        ctx,
        [
          kx, floorY - 92, kx - 6, floorY - 92 - kh * 0.5,
          kx + kw * 0.2, floorY - 92 - kh,
          kx + kw * 0.8, floorY - 92 - kh * 0.92,
          kx + kw + 8, floorY - 92 - kh * 0.4,
          kx + kw, floorY - 92,
        ],
        p.far,
        0.9,
      );
    }

    // --- water ------------------------------------------------------------
    water(ctx, floorY - 92, 92, time, "#3d2a48", "#241830", "#ffb45e", 960);

    // --- the temple -------------------------------------------------------
    const cx = 480 + shift * 0.3;
    const baseY = floorY - 88;
    // Platform standing in the water.
    px(ctx, cx - 130, baseY - 6, 260, 12, "#5e3428");
    // Body of the building.
    px(ctx, cx - 96, baseY - 92, 192, 92, TEMPLE);
    // Columns and doorway.
    for (let i = 0; i < 5; i++) {
      px(ctx, cx - 84 + i * 42, baseY - 84, 12, 84, "#6e3324");
    }
    px(ctx, cx - 22, baseY - 66, 44, 66, "#1e0e10");
    ctx.save();
    ctx.globalAlpha = 0.28 + 0.08 * Math.sin(time * 1.6);
    ctx.fillStyle = p.light;
    ctx.fillRect(cx - 17, baseY - 60, 34, 60);
    ctx.restore();

    templeRoof(ctx, cx, baseY - 92, 224, 3, TEMPLE_ROOF, gold);

    // Smaller shrines either side, for depth.
    for (const sx of [cx - 190, cx + 190]) {
      px(ctx, sx - 34, baseY - 54, 68, 54, "#73362a");
      templeRoof(ctx, sx, baseY - 54, 84, 2, "#a85228", gold);
    }

    // Reflection of the temple, wobbling.
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.translate(0, floorY - 92);
    ctx.scale(1, -0.4);
    ctx.translate(0, -(floorY - 92));
    px(ctx, cx - 96, baseY - 92, 192, 92, TEMPLE_ROOF);
    ctx.restore();

    // --- floating lanterns ------------------------------------------------
    const lrng = new Rng(0x1a17e);
    for (let i = 0; i < 18; i++) {
      const speed = lrng.range(9, 22);
      const startX = lrng.range(-40, 1000);
      // Loop the rise so lanterns keep coming.
      const cycle = 26;
      const t = ((time * speed) / cycle + lrng.next()) % 1;
      const ly = floorY - 60 - t * 420;
      const lx = startX + Math.sin(time * 0.35 + i) * 22 + shift * 0.45;
      const a = Math.min(1, t * 4) * (1 - t * 0.65);
      // Glow.
      ctx.save();
      ctx.globalAlpha = a * 0.22;
      ctx.fillStyle = p.light;
      ctx.beginPath();
      ctx.arc(lx, ly, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      px(ctx, lx - 3.5, ly - 5, 7, 10, p.lightAlt, a);
    }
  },

  drawForeground(ctx, time, shift, floorY) {
    palm(ctx, 30 + shift * 0.95, floorY + 8, 200, 0.28, "#241a14", "#1b3520", time, 0.4);
    palm(ctx, 930 + shift * 0.95, floorY + 8, 176, -0.3, "#241a14", "#1b3520", time, 2.1);
  },
};
