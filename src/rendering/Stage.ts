import { VIEW } from "../config/gameConfig.ts";
import { Rng } from "../core/rng.ts";
import { PALETTE } from "./palette.ts";

/**
 * "ARCADE NEON" - the one fighting stage.
 *
 * A night city skyline behind a lit arena floor, drawn procedurally. The layout
 * is generated once from a fixed seed so it looks designed rather than random,
 * then animated with subtle parallax and flickering signage. Kept low-contrast
 * on purpose so the fighters always read clearly against it.
 */

interface Building {
  x: number;
  w: number;
  h: number;
  layer: number;
  windowSeed: number;
}

interface Sign {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** Flicker phase offset. */
  phase: number;
  speed: number;
}

const SIGN_COLORS = [
  PALETTE.neonPink,
  PALETTE.neonCyan,
  PALETTE.neonPurple,
  PALETTE.neonYellow,
  PALETTE.neonGreen,
];

export class Stage {
  private buildings: Building[] = [];
  private signs: Sign[] = [];
  private time = 0;

  constructor() {
    const rng = new Rng(0xbabe17);

    // Three parallax layers, furthest first.
    for (let layer = 0; layer < 3; layer++) {
      let x = -120;
      const maxH = 120 + layer * 95;
      const minH = 60 + layer * 55;
      while (x < VIEW.width + 200) {
        const w = rng.range(46, 104) + layer * 12;
        this.buildings.push({
          x,
          w,
          h: rng.range(minH, maxH),
          layer,
          windowSeed: rng.int(1, 99999),
        });
        x += w + rng.range(6, 26);
      }
    }

    // Neon signage on the nearest layer.
    for (let i = 0; i < 14; i++) {
      const w = rng.range(14, 54);
      this.signs.push({
        x: rng.range(20, VIEW.width - 60),
        y: rng.range(70, 300),
        w,
        h: rng.range(6, 16),
        color: rng.pick(SIGN_COLORS),
        phase: rng.range(0, Math.PI * 2),
        speed: rng.range(0.6, 3.4),
      });
    }
  }

  update(dt: number): void {
    this.time += dt;
  }

  /**
   * @param cameraX average fighter position, drives the parallax
   */
  draw(ctx: CanvasRenderingContext2D, cameraX: number): void {
    const t = this.time;

    // --- sky gradient ---
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW.floorY);
    sky.addColorStop(0, PALETTE.bgDeep);
    sky.addColorStop(0.55, PALETTE.bgMid);
    sky.addColorStop(1, PALETTE.bgFar);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW.width, VIEW.floorY);

    // --- distant glow band on the horizon ---
    const glow = ctx.createLinearGradient(0, VIEW.floorY - 190, 0, VIEW.floorY);
    glow.addColorStop(0, "rgba(169,77,255,0)");
    glow.addColorStop(1, "rgba(255,61,129,0.22)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, VIEW.floorY - 190, VIEW.width, 190);

    // --- buildings, back to front ---
    const centre = VIEW.width / 2;
    for (let layer = 0; layer < 3; layer++) {
      // Nearer layers shift more with the camera.
      const factor = 0.008 + layer * 0.014;
      const offset = -(cameraX - centre) * factor;
      const shades = ["#191036", "#221545", "#2c1b57"];
      const baseY = VIEW.floorY - 6 + layer * 3;

      for (const b of this.buildings) {
        if (b.layer !== layer) continue;
        const x = b.x + offset;
        if (x + b.w < -40 || x > VIEW.width + 40) continue;

        ctx.fillStyle = shades[layer];
        ctx.fillRect(x, baseY - b.h, b.w, b.h);

        // Lit windows. Deterministic per building, with a few flickering.
        const rng = new Rng(b.windowSeed);
        const cols = Math.max(1, Math.floor(b.w / 13));
        const rows = Math.max(1, Math.floor(b.h / 17));
        for (let cx = 0; cx < cols; cx++) {
          for (let cy = 0; cy < rows; cy++) {
            if (!rng.chance(0.34)) continue;
            const flicker = rng.chance(0.12);
            let alpha = 0.5 + layer * 0.12;
            if (flicker) {
              alpha *= 0.45 + 0.55 * (Math.sin(t * 3 + cx * 2.1 + cy) > 0.4 ? 1 : 0.15);
            }
            ctx.fillStyle =
              rng.chance(0.22)
                ? `rgba(61,240,255,${alpha * 0.75})`
                : `rgba(255,210,120,${alpha * 0.7})`;
            ctx.fillRect(
              Math.round(x + 5 + cx * 13),
              Math.round(baseY - b.h + 7 + cy * 17),
              5,
              7,
            );
          }
        }
      }
    }

    // --- neon signs on the nearest layer ---
    const signOffset = -(cameraX - centre) * 0.05;
    for (const s of this.signs) {
      const pulse = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
      ctx.save();
      ctx.globalAlpha = 0.28 + pulse * 0.5;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x + signOffset, s.y, s.w, s.h);
      ctx.restore();
    }

    this.drawFloor(ctx, cameraX);
  }

  private drawFloor(ctx: CanvasRenderingContext2D, cameraX: number): void {
    const y = VIEW.floorY;

    // Floor slab.
    const g = ctx.createLinearGradient(0, y, 0, VIEW.height);
    g.addColorStop(0, "#2a1a52");
    g.addColorStop(0.25, PALETTE.floor);
    g.addColorStop(1, "#0d0820");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, VIEW.width, VIEW.height - y);

    // Bright edge where the floor meets the backdrop.
    ctx.fillStyle = PALETTE.neonCyan;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(0, y - 2, VIEW.width, 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(61,240,255,0.12)";
    ctx.fillRect(0, y, VIEW.width, 10);

    // Perspective floor lines, scrolling with the camera for a sense of space.
    const offset = -(cameraX - VIEW.width / 2) * 0.16;
    ctx.strokeStyle = PALETTE.floorLine;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    const spacing = 96;
    for (let i = -2; i < VIEW.width / spacing + 4; i++) {
      const lineX = i * spacing + (offset % spacing);
      ctx.beginPath();
      // Lines splay outwards as they come toward the viewer.
      const spread = (lineX - VIEW.width / 2) * 0.55;
      ctx.moveTo(lineX, y);
      ctx.lineTo(lineX + spread, VIEW.height);
      ctx.stroke();
    }

    // Horizontal depth bands.
    for (let i = 1; i < 5; i++) {
      const by = y + Math.pow(i / 5, 1.7) * (VIEW.height - y);
      ctx.globalAlpha = 0.35 - i * 0.05;
      ctx.beginPath();
      ctx.moveTo(0, by);
      ctx.lineTo(VIEW.width, by);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
