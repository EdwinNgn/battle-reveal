import { Rng } from "../../core/rng.ts";
import { px, poly, windows } from "./draw.ts";
import type { StageTheme } from "./types.ts";

/**
 * LILLE - the default stage.
 *
 * Flemish town square at dusk: stepped gables, tall narrow brick facades in warm
 * red and ochre, and the belfry rising behind. The Grand Place has that
 * distinctive roofline of stacked triangles and half-rounds, which reads
 * beautifully as a silhouette.
 *
 * Warmer and cosier than the other stages, and the one people will see first.
 */

interface Facade {
  x: number;
  w: number;
  h: number;
  /** 0 stepped gable, 1 triangular, 2 rounded. */
  gable: number;
  layer: number;
  seed: number;
}

const FACADES: Facade[] = (() => {
  const rng = new Rng(0x11e11e);
  const out: Facade[] = [];
  // Two rows of townhouses, the back row taller and dimmer.
  for (let layer = 0; layer < 2; layer++) {
    let x = -60;
    while (x < 1020) {
      const w = rng.range(52, 84);
      out.push({
        x,
        w,
        h: layer === 0 ? rng.range(150, 205) : rng.range(105, 155),
        gable: rng.int(0, 2),
        layer,
        seed: rng.int(1, 99999),
      });
      x += w + rng.range(2, 7);
    }
  }
  return out;
})();

/** Stepped gable: the stacked-block roofline typical of Flemish facades. */
function steppedGable(
  ctx: CanvasRenderingContext2D,
  x: number,
  topY: number,
  w: number,
  color: string,
): void {
  const steps = 4;
  const stepH = 9;
  for (let i = 0; i < steps; i++) {
    const inset = (w / 2) * (i / steps) * 0.8;
    px(ctx, x + inset, topY - i * stepH, w - inset * 2, stepH + 1, color);
  }
  // Finial on top.
  px(ctx, x + w / 2 - 2.5, topY - steps * stepH - 8, 5, 9, color);
}

export const LILLE: StageTheme = {
  id: "lille",
  name: "LILLE",
  stars: true,
  palette: {
    skyTop: "#160f2e",
    skyMid: "#2a1a3f",
    skyHorizon: "#5d3350",
    glow: "rgba(255,150,90,0.26)",
    far: "#33203f",
    mid: "#44273f",
    near: "#57303c",
    light: "#ffcf7a",
    lightAlt: "#ffe7b8",
    floorTop: "#3a2436",
    floorMid: "#241628",
    floorDeep: "#100a16",
    floorEdge: "#ffb35e",
    floorLine: "#5c3a52",
  },

  drawBackdrop(ctx, time, shift, floorY) {
    const p = LILLE.palette;

    // --- belfry, the tall tower that anchors the square -------------------
    const bx = 700 + shift * 0.35;
    const byBase = floorY - 4;
    const bw = 62;
    const bh = 330;
    px(ctx, bx, byBase - bh, bw, bh, p.far);
    // Slightly narrower upper stage.
    px(ctx, bx + 8, byBase - bh - 46, bw - 16, 48, p.far);
    // Spire.
    poly(
      ctx,
      [bx + 8, byBase - bh - 46, bx + bw / 2, byBase - bh - 118, bx + bw - 8, byBase - bh - 46],
      p.far,
    );
    // Clock face, lit.
    const cxx = bx + bw / 2;
    const cyy = byBase - bh + 34;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = p.lightAlt;
    ctx.beginPath();
    ctx.arc(cxx, cyy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    px(ctx, cxx - 1, cyy - 8, 2, 9, "#2a1a3f");
    // Minute hand sweeping, slow enough to be a detail rather than a distraction.
    const ang = time * 0.35;
    px(ctx, cxx + Math.sin(ang) * 4 - 1, cyy - Math.cos(ang) * 4 - 1, 2, 2, "#2a1a3f");
    // Belfry windows.
    windows(ctx, bx + 6, byBase - bh + 60, bw - 12, bh - 90, 0x0be1, [p.light], time, 0.3);

    // --- townhouse rows ---------------------------------------------------
    for (let layer = 1; layer >= 0; layer--) {
      const factor = layer === 0 ? 0.5 : 0.28;
      const off = shift * factor;
      const color = layer === 0 ? p.near : p.mid;

      for (const f of FACADES) {
        if (f.layer !== layer) continue;
        const x = f.x + off;
        if (x + f.w < -70 || x > 1030) continue;
        const topY = floorY - f.h;

        px(ctx, x, topY, f.w, f.h, color);

        // Roofline varies by house, which is what makes the row feel real.
        if (f.gable === 0) {
          steppedGable(ctx, x, topY, f.w, color);
        } else if (f.gable === 1) {
          poly(ctx, [x, topY, x + f.w / 2, topY - 34, x + f.w, topY], color);
        } else {
          ctx.save();
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x + f.w / 2, topY, f.w / 2, Math.PI, 0);
          ctx.fill();
          ctx.restore();
        }

        // Lit windows only on the front row, so the back stays quiet.
        if (layer === 0) {
          windows(ctx, x, topY + 12, f.w, f.h - 20, f.seed, [p.light, p.lightAlt], time, 0.4);
        }
      }
    }
  },

  drawForeground(ctx, time, shift, floorY) {
    const p = LILLE.palette;
    // Wrought-iron street lamps along the square, casting a warm pool of light.
    for (let i = 0; i < 4; i++) {
      const lx = 90 + i * 260 + shift * 0.75;
      if (lx < -40 || lx > 1000) continue;
      const top = floorY - 132;
      px(ctx, lx - 2, top, 4, 132, "#1a1020");
      px(ctx, lx - 12, top - 4, 24, 5, "#1a1020");
      // Lantern, gently pulsing like gaslight.
      const flick = 0.78 + 0.22 * Math.sin(time * 2.4 + i * 1.7);
      for (const [r, a] of [
        [15, 0.16],
        [9, 0.3],
        [5, 0.95],
      ] as const) {
        ctx.save();
        ctx.globalAlpha = a * flick;
        ctx.fillStyle = p.light;
        ctx.beginPath();
        ctx.arc(lx, top + 4, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  },
};
