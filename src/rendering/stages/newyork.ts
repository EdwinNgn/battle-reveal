import { Rng } from "../../core/rng.ts";
import { px, poly, windows } from "./draw.ts";
import type { StageTheme } from "./types.ts";

/**
 * NEW YORK - Manhattan at night from across the water.
 *
 * A dense skyline of flat-topped towers with two recognisable shapes rising out
 * of it: the stepped art-deco crown of the Empire State and the tapered spire of
 * One World Trade. Water in front carries the city lights as a broken reflection.
 */

interface Tower {
  x: number;
  w: number;
  h: number;
  layer: number;
  seed: number;
  /** 0 flat, 1 stepped setbacks, 2 water tank on top. */
  cap: number;
}

const TOWERS: Tower[] = (() => {
  const rng = new Rng(0x4e77c1747);
  const out: Tower[] = [];
  for (let layer = 0; layer < 3; layer++) {
    let x = -70;
    while (x < 1030) {
      const w = rng.range(34, 76);
      out.push({
        x,
        w,
        h: layer === 0 ? rng.range(90, 170) : layer === 1 ? rng.range(140, 240) : rng.range(180, 300),
        layer,
        seed: rng.int(1, 99999),
        cap: rng.int(0, 2),
      });
      x += w + rng.range(3, 12);
    }
  }
  return out;
})();

export const NEWYORK: StageTheme = {
  id: "newyork",
  name: "NEW YORK",
  stars: true,
  palette: {
    skyTop: "#080a1c",
    skyMid: "#141a34",
    skyHorizon: "#2e2a4a",
    glow: "rgba(255,190,120,0.2)",
    far: "#1b2038",
    mid: "#232a44",
    near: "#2c3450",
    light: "#ffd98a",
    lightAlt: "#bfe4ff",
    floorTop: "#2a3048",
    floorMid: "#161a28",
    floorDeep: "#080a12",
    floorEdge: "#7fd0ff",
    floorLine: "#3c4664",
  },

  drawBackdrop(ctx, time, shift, floorY) {
    const p = NEWYORK.palette;
    const waterTop = floorY - 74;

    // --- skyline, back to front -------------------------------------------
    for (let layer = 2; layer >= 0; layer--) {
      const factor = 0.06 + layer * 0.07;
      const off = shift * factor;
      const color = layer === 2 ? p.far : layer === 1 ? p.mid : p.near;

      for (const t of TOWERS) {
        if (t.layer !== layer) continue;
        const x = t.x + off;
        if (x + t.w < -80 || x > 1040) continue;
        const topY = waterTop - t.h;

        px(ctx, x, topY, t.w, t.h, color);

        if (t.cap === 1) {
          // Art-deco setbacks.
          px(ctx, x + t.w * 0.18, topY - 14, t.w * 0.64, 15, color);
          px(ctx, x + t.w * 0.34, topY - 24, t.w * 0.32, 11, color);
        } else if (t.cap === 2) {
          // Rooftop water tank, a very New York silhouette.
          px(ctx, x + t.w * 0.3, topY - 12, t.w * 0.26, 12, color);
          px(ctx, x + t.w * 0.26, topY - 15, t.w * 0.34, 4, color);
        }

        // Only the nearest two layers get lit windows, to keep depth readable.
        if (layer <= 1) {
          windows(
            ctx,
            x,
            topY + 6,
            t.w,
            t.h - 10,
            t.seed,
            [p.light, p.lightAlt],
            time,
            layer === 0 ? 0.42 : 0.3,
          );
        }
      }
    }

    // --- Empire State ------------------------------------------------------
    const ex = 330 + shift * 0.18;
    const eBase = waterTop;
    px(ctx, ex - 34, eBase - 260, 68, 260, "#28304c");
    // Stepped shoulders.
    px(ctx, ex - 46, eBase - 190, 92, 70, "#28304c");
    px(ctx, ex - 58, eBase - 130, 116, 60, "#28304c");
    // Crown and mast, lit.
    px(ctx, ex - 20, eBase - 296, 40, 38, "#2e3856");
    px(ctx, ex - 12, eBase - 320, 24, 26, "#2e3856");
    px(ctx, ex - 2.5, eBase - 366, 5, 46, "#3a4668");
    // Beacon at the top, slow blink.
    const blink = Math.sin(time * 2.2) > 0.3 ? 1 : 0.25;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.fillStyle = "#ff6a6a";
    ctx.beginPath();
    ctx.arc(ex, eBase - 370, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    windows(ctx, ex - 34, eBase - 254, 68, 240, 0xe5b, [p.light, p.lightAlt], time, 0.5);
    // Floodlit crown, the way it is lit at night.
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#7fd0ff";
    ctx.fillRect(ex - 20, eBase - 296, 40, 38);
    ctx.restore();

    // --- One World Trade ---------------------------------------------------
    const wx = 700 + shift * 0.18;
    // Tapering shaft: narrower at the top, drawn as a trapezoid.
    poly(
      ctx,
      [wx - 30, waterTop, wx - 20, waterTop - 330, wx + 20, waterTop - 330, wx + 30, waterTop],
      "#2a3350",
    );
    px(ctx, wx - 1.5, waterTop - 412, 3, 84, "#3a4668");
    windows(ctx, wx - 24, waterTop - 320, 48, 300, 0x1c0de, [p.lightAlt], time, 0.36);

    // --- water and reflections --------------------------------------------
    const g = ctx.createLinearGradient(0, waterTop, 0, floorY);
    g.addColorStop(0, "#16203a");
    g.addColorStop(1, "#0a0e1a");
    ctx.fillStyle = g;
    ctx.fillRect(0, waterTop, 960, 74);

    // Broken vertical smears of light: the city on the water.
    const rr = new Rng(0x8a7e2);
    for (let i = 0; i < 70; i++) {
      const rx = rr.range(-20, 980);
      const rh = rr.range(10, 60);
      const wob = Math.sin(time * 1.4 + i) * 1.6;
      px(
        ctx,
        rx + wob,
        waterTop + rr.range(0, 74 - 10),
        rr.range(2, 5),
        Math.min(rh, 22),
        rr.chance(0.25) ? p.lightAlt : p.light,
        rr.range(0.08, 0.3),
      );
    }
  },
};
