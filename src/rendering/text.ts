import { PALETTE } from "./palette.ts";

/**
 * Arcade typography helpers.
 *
 * Uses a stack of widely available condensed/monospace faces rather than a web
 * font, so there is no network dependency and no layout shift on load.
 */
export const ARCADE_FONT =
  '"Impact", "Haettenschweiler", "Arial Narrow Bold", "Franklin Gothic Bold", sans-serif';
export const PIXEL_FONT =
  '"Courier New", "Lucida Console", Monaco, monospace';

export interface TextOptions {
  size: number;
  color?: string;
  /** Outline colour. Set to null to skip the outline. */
  stroke?: string | null;
  strokeWidth?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** Neon glow colour. */
  glow?: string | null;
  glowSize?: number;
  font?: string;
  letterSpacing?: number;
  /** Extra vertical shadow offset for a chunky arcade look. */
  depth?: number;
  depthColor?: string;
  alpha?: number;
}

/** Draws arcade-styled text with outline, glow and optional 3D depth. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: TextOptions,
): void {
  const {
    size,
    color = PALETTE.white,
    stroke = PALETTE.black,
    strokeWidth = Math.max(2, size * 0.09),
    align = "center",
    baseline = "middle",
    glow = null,
    glowSize = size * 0.5,
    font = ARCADE_FONT,
    letterSpacing = size * 0.06,
    depth = 0,
    depthColor = PALETTE.black,
    alpha = 1,
  } = opts;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  // letterSpacing is supported in all current target browsers; harmless if not.
  ctx.letterSpacing = `${letterSpacing}px`;

  if (depth > 0) {
    ctx.fillStyle = depthColor;
    for (let i = depth; i > 0; i--) {
      ctx.fillText(text, x, y + i);
    }
  }

  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = glowSize;
  }

  if (stroke) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(text, x, y);
  }

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);

  // A second pass makes the glow bloom more strongly.
  if (glow) {
    ctx.shadowBlur = glowSize * 1.8;
    ctx.fillText(text, x, y);
  }

  ctx.restore();
}

/** Measures text using the same font stack, for layout and hit testing. */
export function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  font = ARCADE_FONT,
  letterSpacing = size * 0.06,
): number {
  ctx.save();
  ctx.font = `${size}px ${font}`;
  ctx.letterSpacing = `${letterSpacing}px`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

/** A vertical gradient fill for large display text. */
export function displayGradient(
  ctx: CanvasRenderingContext2D,
  y: number,
  size: number,
  top: string,
  bottom: string,
): CanvasGradient {
  const g = ctx.createLinearGradient(0, y - size * 0.6, 0, y + size * 0.6);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}
