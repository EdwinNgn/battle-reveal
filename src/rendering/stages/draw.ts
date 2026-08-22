import { Rng } from "../../core/rng.ts";

/**
 * Shared drawing helpers for the stage backdrops.
 *
 * Each theme generates its layout from a FIXED seed, so a stage looks the same
 * every time it appears. That is deliberate: a randomly rearranged skyline reads
 * as noise, whereas a stable one reads as a place. Randomness is used to author
 * the layout once, not to shuffle it per frame.
 */

/** Snapped rectangle, for crisp pixel edges. */
export function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.restore();
}

/** Filled polygon from a flat list of points. */
export function poly(
  ctx: CanvasRenderingContext2D,
  pts: number[],
  color: string,
  alpha = 1,
): void {
  if (pts.length < 6) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A mountain or hill ridge, drawn as a jagged silhouette. */
export function ridge(
  ctx: CanvasRenderingContext2D,
  baseY: number,
  seed: number,
  color: string,
  opts: {
    peaks: number;
    minH: number;
    maxH: number;
    shift: number;
    width: number;
    alpha?: number;
    /** Adds a lighter cap, for snow or sunlit stone. */
    capColor?: string | null;
  },
): void {
  const rng = new Rng(seed);
  const { peaks, minH, maxH, shift, width } = opts;
  const step = width / peaks;
  const pts: number[] = [-80, baseY];
  const heights: number[] = [];

  for (let i = 0; i <= peaks; i++) {
    const h = rng.range(minH, maxH);
    heights.push(h);
    pts.push(-80 + i * step + shift, baseY - h);
  }
  pts.push(width + 80, baseY);

  poly(ctx, pts, color, opts.alpha ?? 1);

  if (opts.capColor) {
    // Small caps on the tallest peaks only.
    for (let i = 0; i <= peaks; i++) {
      if (heights[i] < maxH * 0.72) continue;
      const cx = -80 + i * step + shift;
      const cy = baseY - heights[i];
      poly(
        ctx,
        [cx, cy, cx - 16, cy + 22, cx + 16, cy + 22],
        opts.capColor,
        (opts.alpha ?? 1) * 0.9,
      );
    }
  }
}

/** A grid of lit windows on a building face. */
export function windows(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  colors: readonly string[],
  time: number,
  density = 0.34,
): void {
  const rng = new Rng(seed);
  const cols = Math.max(1, Math.floor(w / 13));
  const rows = Math.max(1, Math.floor(h / 17));
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      if (!rng.chance(density)) continue;
      let alpha = 0.55;
      // A few windows flicker, which makes the whole skyline feel alive.
      if (rng.chance(0.12)) {
        alpha *= 0.4 + 0.6 * (Math.sin(time * 3 + cx * 2.1 + cy) > 0.4 ? 1 : 0.2);
      }
      px(
        ctx,
        x + 5 + cx * 13,
        y + 7 + cy * 17,
        5,
        7,
        rng.pick(colors),
        alpha,
      );
    }
  }
}

/** Stars, for the night stages. Twinkle is subtle on purpose. */
export function stars(
  ctx: CanvasRenderingContext2D,
  seed: number,
  time: number,
  count: number,
  maxY: number,
  width: number,
): void {
  const rng = new Rng(seed);
  for (let i = 0; i < count; i++) {
    const x = rng.range(0, width);
    const y = rng.range(6, maxY);
    const base = rng.range(0.25, 0.85);
    const tw = 0.75 + 0.25 * Math.sin(time * rng.range(0.8, 2.4) + i);
    const s = rng.chance(0.12) ? 3 : 2;
    px(ctx, x, y, s, s, "#ffffff", base * tw);
  }
}

/** Sun or moon disc with a soft halo. */
export function celestial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  core: string,
  halo: string,
): void {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, r * 0.35, x, y, r * 4);
  g.addColorStop(0, halo);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Reflective water band, with drifting highlights. */
export function water(
  ctx: CanvasRenderingContext2D,
  y: number,
  h: number,
  time: number,
  top: string,
  bottom: string,
  highlight: string,
  width: number,
): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, y, width, h);

  // Horizontal glints, spaced out and slowly drifting.
  const rng = new Rng(0x5ea51de);
  for (let i = 0; i < 34; i++) {
    const ly = y + rng.range(2, h - 2);
    const lw = rng.range(18, 90);
    const drift = Math.sin(time * rng.range(0.3, 0.9) + i) * 14;
    px(ctx, rng.range(-40, width) + drift, ly, lw, 2, highlight, rng.range(0.12, 0.4));
  }
}

/** A palm tree: curved trunk plus drooping fronds. */
export function palm(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  height: number,
  lean: number,
  trunk: string,
  leaf: string,
  time: number,
  phase: number,
): void {
  // Trunk, as a stack of blocks following a gentle curve.
  const segs = Math.round(height / 9);
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const x = baseX + lean * t * t * height * 0.4;
    const y = baseY - i * 9;
    const w = 9 - t * 3.5;
    px(ctx, x - w / 2, y - 9, w, 10, trunk);
  }

  const topX = baseX + lean * height * 0.4;
  const topY = baseY - height;
  const sway = Math.sin(time * 1.1 + phase) * 0.09;

  // Fronds radiating out and drooping down.
  for (let f = 0; f < 7; f++) {
    const a = (-Math.PI * 0.9) + (f / 6) * Math.PI * 0.8 + sway;
    const len = height * (0.42 + (f % 2 === 0 ? 0.1 : 0));
    for (let d = 0; d < 12; d++) {
      const p = d / 12;
      // Droop grows with distance from the crown.
      const fx = topX + Math.cos(a) * len * p;
      const fy = topY + Math.sin(a) * len * p * 0.55 + p * p * len * 0.42;
      const s = 7 - p * 4;
      px(ctx, fx - s / 2, fy - s / 2, s, s, leaf, 1 - p * 0.25);
    }
  }
}
