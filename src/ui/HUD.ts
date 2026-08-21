import { COMBAT, VIEW } from "../config/gameConfig.ts";
import { FIGHTER_FLAVOR } from "../config/gameConfig.ts";
import type { Fighter } from "../fighters/Fighter.ts";
import { FIGHTER_COLORS, PALETTE } from "../rendering/palette.ts";
import { drawText } from "../rendering/text.ts";
import { t as tr } from "../i18n/strings.ts";

/**
 * The in-match heads-up display: two health bars, fighter names and the round
 * label. Shows nothing but the health values both fighters already have, so
 * there is no way to infer the hidden balancing from it.
 *
 * The bars lag behind the real value slightly, which is a standard arcade touch
 * and makes damage read more clearly.
 */

const BAR_W = 340;
const BAR_H = 26;
const BAR_Y = 34;
const MARGIN = 40;

export class HUD {
  /** Smoothed bar values, 0..1. */
  private displayed = { player: 1, cpu: 1 };
  /** Trailing "recent damage" markers, 0..1. */
  private trail = { player: 1, cpu: 1 };

  reset(): void {
    this.displayed.player = 1;
    this.displayed.cpu = 1;
    this.trail.player = 1;
    this.trail.cpu = 1;
  }

  update(dt: number, player: Fighter, cpu: Fighter): void {
    const targets = {
      player: player.health / COMBAT.maxHealth,
      cpu: cpu.health / COMBAT.maxHealth,
    };
    for (const key of ["player", "cpu"] as const) {
      const target = targets[key];
      // Main bar snaps down fast.
      const d = this.displayed[key];
      this.displayed[key] = d + (target - d) * Math.min(1, dt * 16);
      // Trail drains slowly, showing how much was just taken.
      if (this.trail[key] > this.displayed[key]) {
        this.trail[key] = Math.max(
          this.displayed[key],
          this.trail[key] - dt * 0.42,
        );
      } else {
        this.trail[key] = this.displayed[key];
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    player: Fighter,
    cpu: Fighter,
    roundLabel: string | null,
  ): void {
    this.drawBar(
      ctx,
      MARGIN,
      this.displayed.player,
      this.trail.player,
      player,
      false,
      tr().playerLabel,
    );
    this.drawBar(
      ctx,
      VIEW.width - MARGIN - BAR_W,
      this.displayed.cpu,
      this.trail.cpu,
      cpu,
      true,
      tr().cpu,
    );

    if (roundLabel) {
      drawText(ctx, roundLabel, VIEW.width / 2, BAR_Y + BAR_H / 2, {
        size: 26,
        color: PALETTE.neonYellow,
        glow: PALETTE.neonYellow,
        glowSize: 12,
        depth: 2,
      });
    }
  }

  private drawBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    value: number,
    trail: number,
    fighter: Fighter,
    mirrored: boolean,
    label: string,
  ): void {
    const colors = FIGHTER_COLORS[fighter.id];
    const y = BAR_Y;

    // Chunky frame.
    ctx.fillStyle = PALETTE.black;
    ctx.fillRect(x - 4, y - 4, BAR_W + 8, BAR_H + 8);
    ctx.fillStyle = "#2a1f42";
    ctx.fillRect(x, y, BAR_W, BAR_H);

    const fillW = Math.max(0, BAR_W * value);
    const trailW = Math.max(0, BAR_W * trail);

    // Trail marker, drawn behind the main fill.
    if (trailW > fillW) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      if (mirrored) ctx.fillRect(x + BAR_W - trailW, y, trailW - fillW, BAR_H);
      else ctx.fillRect(x + fillW, y, trailW - fillW, BAR_H);
    }

    // Main fill, with a warning tint when low.
    const low = value < 0.25;
    const grad = ctx.createLinearGradient(0, y, 0, y + BAR_H);
    if (low) {
      // Pulses when critical. Applies to whichever fighter is low, so it never
      // signals anything about the outcome.
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 90);
      grad.addColorStop(0, `rgba(255,90,60,${pulse})`);
      grad.addColorStop(1, "#a01414");
    } else {
      grad.addColorStop(0, colors.barGlow);
      grad.addColorStop(1, colors.bar);
    }
    ctx.fillStyle = grad;
    if (mirrored) ctx.fillRect(x + BAR_W - fillW, y, fillW, BAR_H);
    else ctx.fillRect(x, y, fillW, BAR_H);

    // Highlight along the top of the fill.
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    if (mirrored) ctx.fillRect(x + BAR_W - fillW, y, fillW, 4);
    else ctx.fillRect(x, y, fillW, 4);

    // Segment ticks, for that mechanical arcade look.
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    for (let i = 1; i < 10; i++) {
      const tx = x + (BAR_W / 10) * i;
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.lineTo(tx, y + BAR_H);
      ctx.stroke();
    }

    // Outer edge.
    ctx.strokeStyle = PALETTE.white;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, BAR_W, BAR_H);

    // The fighter name is the prominent label, sitting under the outer end of
    // its own bar. The PLAYER / CPU role is kept small alongside it, so it is
    // still obvious which fighter you are controlling.
    const flavor = FIGHTER_FLAVOR[fighter.id];
    const nameX = mirrored ? x + BAR_W : x;
    drawText(ctx, flavor.name, nameX, y + BAR_H + 22, {
      size: 30,
      align: mirrored ? "right" : "left",
      color: colors.barGlow,
      glow: colors.bar,
      glowSize: 10,
      depth: 3,
      letterSpacing: 3,
    });

    drawText(ctx, label, mirrored ? x : x + BAR_W, y + BAR_H + 20, {
      size: 17,
      align: mirrored ? "left" : "right",
      color: "#b9a6e0",
      stroke: null,
      letterSpacing: 2,
      alpha: 0.8,
    });
  }
}
