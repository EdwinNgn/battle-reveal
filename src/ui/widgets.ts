import { VIEW } from "../config/gameConfig.ts";
import { PALETTE } from "../rendering/palette.ts";
import { drawText, measureText } from "../rendering/text.ts";

/**
 * Minimal canvas widget layer.
 *
 * Screens declare their buttons every frame; this module handles hover, press
 * animation, hit testing and keyboard focus. Keeping it inside the canvas means
 * one consistent visual language and no DOM churn during gameplay.
 */

export interface Button {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Cosmetic accent, defaults to cyan. */
  color?: string;
  /** Smaller text under the label. */
  sub?: string;
  disabled?: boolean;
}

export interface PointerState {
  x: number;
  y: number;
  down: boolean;
  /** True on the frame the pointer was released. */
  clicked: boolean;
}

export function hitTest(b: Button, p: PointerState): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

/** Draws a chunky arcade button. */
export function drawButton(
  ctx: CanvasRenderingContext2D,
  b: Button,
  opts: { hovered: boolean; focused: boolean; pressed: boolean; time: number },
): void {
  const color = b.color ?? PALETTE.neonCyan;
  const active = opts.hovered || opts.focused;
  const lift = opts.pressed ? 0 : active ? 5 : 3;
  const pulse = active ? 0.5 + 0.5 * Math.sin(opts.time * 6) : 0;

  ctx.save();
  ctx.globalAlpha = b.disabled ? 0.35 : 1;

  // Drop shadow / 3D body.
  ctx.fillStyle = PALETTE.black;
  ctx.fillRect(b.x, b.y + lift, b.w, b.h);

  // Face.
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  if (active) {
    g.addColorStop(0, "#3a2668");
    g.addColorStop(1, "#20143d");
  } else {
    g.addColorStop(0, "#241a44");
    g.addColorStop(1, "#150d2a");
  }
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);

  // Neon border, brighter when active.
  ctx.strokeStyle = color;
  ctx.lineWidth = active ? 4 : 2.5;
  if (active) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 + pulse * 12;
  }
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.shadowBlur = 0;

  // Corner ticks.
  ctx.fillStyle = color;
  const t = 7;
  ctx.fillRect(b.x - 1, b.y - 1, t, 3);
  ctx.fillRect(b.x - 1, b.y - 1, 3, t);
  ctx.fillRect(b.x + b.w - t + 1, b.y - 1, t, 3);
  ctx.fillRect(b.x + b.w - 2, b.y - 1, 3, t);
  ctx.fillRect(b.x - 1, b.y + b.h - 2, t, 3);
  ctx.fillRect(b.x - 1, b.y + b.h - t + 1, 3, t);
  ctx.fillRect(b.x + b.w - t + 1, b.y + b.h - 2, t, 3);
  ctx.fillRect(b.x + b.w - 2, b.y + b.h - t + 1, 3, t);

  const cy = b.y + b.h / 2 + (b.sub ? -8 : 0);
  drawText(ctx, b.label, b.x + b.w / 2, cy, {
    size: Math.min(34, b.h * 0.46),
    color: active ? PALETTE.white : "#cbb8ee",
    glow: active ? color : null,
    glowSize: 10,
    depth: 2,
  });

  if (b.sub) {
    drawText(ctx, b.sub, b.x + b.w / 2, b.y + b.h / 2 + 16, {
      size: 15,
      color: color,
      stroke: null,
      letterSpacing: 1.5,
    });
  }

  ctx.restore();
}

/** Scanline + vignette overlay, applied over every screen. */
export function drawCrtOverlay(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save();
  // Scanlines.
  ctx.globalAlpha = 0.11;
  ctx.fillStyle = "#000000";
  for (let y = 0; y < VIEW.height; y += 3) {
    ctx.fillRect(0, y, VIEW.width, 1.4);
  }
  // Slow rolling brightness band, very subtle.
  ctx.globalAlpha = 0.03;
  const bandY = ((time * 40) % (VIEW.height + 200)) - 100;
  const bg = ctx.createLinearGradient(0, bandY, 0, bandY + 160);
  bg.addColorStop(0, "rgba(255,255,255,0)");
  bg.addColorStop(0.5, "rgba(255,255,255,1)");
  bg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, bandY, VIEW.width, 160);
  ctx.globalAlpha = 1;

  // Vignette.
  const v = ctx.createRadialGradient(
    VIEW.width / 2,
    VIEW.height / 2,
    VIEW.height * 0.35,
    VIEW.width / 2,
    VIEW.height / 2,
    VIEW.height * 0.85,
  );
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.restore();
}

/** Centred panel with a neon frame, used by most menu screens. */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color = PALETTE.neonPurple,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(10,7,20,0.82)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

/** Layout helper: evenly spaced row of equal-width buttons. */
export function rowLayout(
  count: number,
  y: number,
  buttonW: number,
  h: number,
  gap = 24,
): Array<{ x: number; y: number; w: number; h: number }> {
  const total = count * buttonW + (count - 1) * gap;
  const startX = (VIEW.width - total) / 2;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: startX + i * (buttonW + gap), y, w: buttonW, h });
  }
  return out;
}

export { measureText };
