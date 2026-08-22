import { Rng } from "../../core/rng.ts";
import { celestial, palm, px, poly, water } from "./draw.ts";
import type { StageTheme } from "./types.ts";

/**
 * ÎLE MAURICE - lagoon at golden hour, Le Morne behind.
 *
 * The brightest stage of the set: turquoise water, pale sand, and the blunt
 * basalt wedge of Le Morne Brabant on the right. Because it is so much lighter
 * than the others, the floor is kept deliberately dark and the sky desaturated
 * towards the horizon, so the fighters still read clearly.
 */

export const MAURITIUS: StageTheme = {
  id: "mauritius",
  name: "ÎLE MAURICE",
  palette: {
    skyTop: "#2b3a6b",
    skyMid: "#7a6a8e",
    skyHorizon: "#f0a86a",
    glow: "rgba(255,200,130,0.4)",
    far: "#4a5570",
    mid: "#3d6b74",
    near: "#2e5a63",
    light: "#fff0c0",
    lightAlt: "#ffffff",
    // Wet sand, darker than it looks in photos so the fighters stay legible.
    floorTop: "#6e5a44",
    floorMid: "#3e3227",
    floorDeep: "#1a1410",
    floorEdge: "#ffe0a0",
    floorLine: "#8a7256",
  },

  drawBackdrop(ctx, time, shift, floorY) {
    // Low sun over the water, with a long reflected column.
    const sunX = 300 + shift * 0.08;
    celestial(ctx, sunX, 176, 30, "#fff2c4", "rgba(255,190,110,0.6)");

    // --- Le Morne Brabant --------------------------------------------------
    const mx = 760 + shift * 0.18;
    const mBase = floorY - 96;
    // Steep basalt block with a flat-ish crown.
    poly(
      ctx,
      [
        mx - 150, mBase, mx - 120, mBase - 90, mx - 70, mBase - 168,
        mx - 20, mBase - 196, mx + 40, mBase - 190, mx + 96, mBase - 130,
        mx + 140, mBase - 40, mx + 165, mBase,
      ],
      "#3c4258",
    );
    // Sunlit left flank.
    poly(
      ctx,
      [mx - 150, mBase, mx - 120, mBase - 90, mx - 70, mBase - 168, mx - 40, mBase - 150, mx - 60, mBase],
      "#4d5470",
      0.85,
    );
    // Vegetation on the lower slopes.
    const vr = new Rng(0x1e307);
    for (let i = 0; i < 40; i++) {
      const t = vr.next();
      px(
        ctx,
        mx - 140 + t * 290 + vr.range(-8, 8),
        mBase - vr.range(4, 60),
        vr.range(6, 14),
        vr.range(5, 10),
        "#2c4a3a",
        0.5,
      );
    }

    // --- lagoon ------------------------------------------------------------
    water(ctx, floorY - 96, 96, time, "#48b8b0", "#1d5f68", "#c8fff4", 960);

    // Sun column on the water.
    ctx.save();
    ctx.globalAlpha = 0.3;
    const colGrad = ctx.createLinearGradient(0, floorY - 96, 0, floorY);
    colGrad.addColorStop(0, "rgba(255,230,160,0.8)");
    colGrad.addColorStop(1, "rgba(255,230,160,0)");
    ctx.fillStyle = colGrad;
    ctx.fillRect(sunX - 34, floorY - 96, 68, 96);
    ctx.restore();

    // --- reef line: where the waves break ----------------------------------
    for (let i = 0; i < 3; i++) {
      const ry = floorY - 70 + i * 8;
      const phase = time * 0.6 + i;
      const rr = new Rng(0x2ee5 + i);
      for (let s = 0; s < 26; s++) {
        const sx = rr.range(-40, 1000) + Math.sin(phase + s) * 8;
        px(ctx, sx, ry, rr.range(20, 60), 3, "#ffffff", 0.24);
      }
    }

    // Gentle shorebreak lapping the sand.
    for (let i = 0; i < 5; i++) {
      const w = 0.5 + 0.5 * Math.sin(time * 1.1 + i * 1.3);
      px(ctx, -40 + i * 220 + w * 24, floorY - 6 - i % 2, 200, 4, "#ffffff", 0.2 * w);
    }
  },

  drawForeground(ctx, time, shift, floorY) {
    // Leaning palms and a couple of shells, close in.
    palm(ctx, 62 + shift * 0.95, floorY + 10, 214, 0.36, "#3a2a1c", "#245c34", time, 0.9);
    palm(ctx, 140 + shift * 0.95, floorY + 14, 150, 0.2, "#3a2a1c", "#1e5230", time, 2.4);
    palm(ctx, 902 + shift * 0.95, floorY + 10, 186, -0.32, "#3a2a1c", "#245c34", time, 1.4);
  },
};
