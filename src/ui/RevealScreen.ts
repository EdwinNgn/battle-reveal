import { FIGHTER_FLAVOR, VIEW } from "../config/gameConfig.ts";
import { WINNER_CODE, WINNING_FIGHTER } from "../config/secretConfig.ts";
import { revealHeadline, revealIcon } from "../config/revealText.ts";
import { Fighter } from "../fighters/Fighter.ts";
import { drawFighter } from "../rendering/FighterSprite.ts";
import { FIGHTER_COLORS, PALETTE } from "../rendering/palette.ts";
import type { ParticleSystem } from "../rendering/ParticleSystem.ts";
import { drawText } from "../rendering/text.ts";
import { t as tr } from "../i18n/strings.ts";
import { audio } from "../audio/AudioManager.ts";
import type { Button } from "./widgets.ts";

/**
 * The final reveal.
 *
 * This is the only place in the whole application that turns the organizer's
 * setting into something visible, and it does so after the last match of the
 * last participant. Up to this point the value has had no observable effect
 * other than through ordinary combat outcomes.
 *
 * Beats:
 *   0.0s  brief fade to black
 *   0.7s  flash, then the headline with the winning fighter, confetti, fireworks
 *
 * There used to be a "THE WINNER IS..." beat and a spotlight walk-on before the
 * headline, about four and a half seconds of build-up. Both were cut: the
 * fighters are called BOY and GIRL, so the K.O. has already told the room the
 * answer, and stringing out suspense for something everyone can see lands flat.
 * The celebration now starts almost immediately, which is where the energy is.
 */

type Beat = "fade" | "reveal";

const BEATS: Array<{ beat: Beat; at: number }> = [
  { beat: "fade", at: 0 },
  { beat: "reveal", at: 0.7 },
];

const GIRL_COLORS = ["#ff3d81", "#ff9ec4", "#ffd23d", "#fff0f6", "#ff5fa2"] as const;
const BOY_COLORS = ["#3d8bff", "#7fd0ff", "#ffd23d", "#eaf4ff", "#5fa2ff"] as const;

export class RevealScreen {
  private time = 0;
  private fighter: Fighter;
  private lastBeat: Beat | null = null;
  private nextFirework = 0;
  /** Full-screen white flash, 0..1. */
  private flash = 0;
  private shake = 0;

  constructor() {
    this.fighter = new Fighter(WINNING_FIGHTER, VIEW.width / 2, 1);
    this.fighter.celebrate();
  }

  reset(): void {
    this.time = 0;
    this.lastBeat = null;
    this.nextFirework = 0;
    this.flash = 0;
    this.shake = 0;
    this.fighter = new Fighter(WINNING_FIGHTER, VIEW.width / 2, 1);
    this.fighter.celebrate();
  }

  private currentBeat(): Beat {
    let beat: Beat = "fade";
    for (const b of BEATS) {
      if (this.time >= b.at) beat = b.beat;
    }
    return beat;
  }

  get isRevealed(): boolean {
    return this.currentBeat() === "reveal";
  }

  /** Index of the reveal beat, so timings stay correct if the list changes. */
  private static get revealAt(): number {
    return BEATS[BEATS.length - 1].at;
  }

  buttons(): Button[] {
    // Hold the button back until the celebration has had a moment to land.
    if (this.time < RevealScreen.revealAt + 3) return [];
    return [
      {
        id: "again",
        label: tr().playAgain,
        x: (VIEW.width - 300) / 2,
        y: VIEW.height - 86,
        w: 300,
        h: 58,
        color: PALETTE.white,
      },
    ];
  }

  update(dt: number, particles: ParticleSystem): void {
    this.time += dt;
    this.fighter.animTime += dt;

    const beat = this.currentBeat();
    const colors = WINNER_CODE === 2 ? GIRL_COLORS : BOY_COLORS;

    if (beat !== this.lastBeat) {
      if (beat === "reveal") {
        audio.playMusic("reveal");
        audio.play("reveal");
        this.flash = 1;
        this.shake = 16;
        particles.confetti(240, colors);
        for (let i = 0; i < 5; i++) {
          particles.firework(
            VIEW.width * (0.15 + 0.175 * i),
            VIEW.height * (0.2 + (i % 2) * 0.14),
            colors,
          );
        }
      }
      this.lastBeat = beat;
    }

    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);

    // Ongoing celebration.
    if (beat === "reveal") {
      this.nextFirework -= dt;
      if (this.nextFirework <= 0) {
        this.nextFirework = 0.55 + Math.random() * 0.7;
        particles.firework(
          VIEW.width * (0.1 + Math.random() * 0.8),
          VIEW.height * (0.12 + Math.random() * 0.4),
          colors,
        );
        audio.play("firework");
      }
      // Keep the confetti topped up so the screen stays festive.
      if (Math.random() < dt * 5) particles.confetti(14, colors);
    }
  }

  /** Screen shake offset for the renderer. */
  get shakeAmount(): number {
    return this.shake;
  }

  /**
   * Final TEAM BOY vs TEAM GIRL score.
   *
   * Both teams are drawn identically, with no highlight on the winner: the
   * numbers speak for themselves and the reveal is still a beat away.
   */
  private drawFinalScore(
    ctx: CanvasRenderingContext2D,
    scores: { boy: number; girl: number },
    cy: number,
    alpha: number,
  ): void {
    const cx = VIEW.width / 2;

    // Compact single line: "SCORE FINAL   ÉQUIPE BOY 3 - 4 ÉQUIPE GIRL". Sitting
    // under a full celebration, this has to stay out of the way.
    drawText(ctx, tr().finalScore, cx, cy - 26, {
      size: 19,
      color: "#b9a6e0",
      stroke: null,
      letterSpacing: 4,
      alpha: alpha * 0.8,
    });

    const boyColors = FIGHTER_COLORS.male;
    const girlColors = FIGHTER_COLORS.female;
    const gap = 118;

    drawText(
      ctx,
      `${FIGHTER_FLAVOR.male.name} ${scores.boy}`,
      cx - gap,
      cy + 14,
      {
        size: 34,
        color: boyColors.barGlow,
        glow: boyColors.primary,
        glowSize: 10,
        depth: 3,
        letterSpacing: 3,
        align: "center",
        alpha,
      },
    );

    drawText(ctx, "-", cx, cy + 12, {
      size: 30,
      color: "#8a7cb0",
      stroke: null,
      alpha: alpha * 0.9,
    });

    drawText(
      ctx,
      `${scores.girl} ${FIGHTER_FLAVOR.female.name}`,
      cx + gap,
      cy + 14,
      {
        size: 34,
        color: girlColors.barGlow,
        glow: girlColors.primary,
        glowSize: 10,
        depth: 3,
        letterSpacing: 3,
        align: "center",
        alpha,
      },
    );
  }

  /**
   * @param scores final team scores, or null in solo mode / single player
   */
  draw(
    ctx: CanvasRenderingContext2D,
    particles: ParticleSystem,
    scores: { boy: number; girl: number } | null = null,
  ): void {
    const cx = VIEW.width / 2;
    const beat = this.currentBeat();
    const t = this.time;
    const isGirl = WINNER_CODE === 2;
    const themeColor = isGirl ? PALETTE.neonPink : "#3d8bff";
    const themeGlow = isGirl ? "#ff9ec4" : "#7fd0ff";

    // --- background ---
    if (beat === "reveal") {
      // Radiant celebration backdrop with rotating light rays.
      const since = t - RevealScreen.revealAt;
      const g = ctx.createRadialGradient(cx, VIEW.height / 2, 40, cx, VIEW.height / 2, 620);
      g.addColorStop(0, isGirl ? "#5c1030" : "#0d2a5c");
      g.addColorStop(1, PALETTE.black);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);

      ctx.save();
      ctx.translate(cx, VIEW.height / 2);
      ctx.rotate(since * 0.22);
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = themeGlow;
      for (let i = 0; i < 14; i++) {
        ctx.rotate((Math.PI * 2) / 14);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(760, -46);
        ctx.lineTo(760, 46);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else {
      ctx.fillStyle = PALETTE.black;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    // --- the winning fighter, celebrating under a spotlight ---
    if (beat === "reveal") {
      const since = t - RevealScreen.revealAt;
      const appear = Math.min(1, since * 2.2);
      const colors = FIGHTER_COLORS[WINNING_FIGHTER];
      const groundY = VIEW.height - 132;

      // Spotlight cone.
      ctx.save();
      ctx.globalAlpha = appear * 0.4;
      const spot = ctx.createLinearGradient(0, 60, 0, groundY);
      spot.addColorStop(0, "rgba(255,255,255,0)");
      spot.addColorStop(1, colors.barGlow);
      ctx.fillStyle = spot;
      ctx.beginPath();
      ctx.moveTo(cx - 60, 60);
      ctx.lineTo(cx + 60, 60);
      ctx.lineTo(cx + 190, groundY);
      ctx.lineTo(cx - 190, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // The fighter, rising into place then bouncing in victory.
      ctx.save();
      ctx.globalAlpha = appear;
      ctx.translate(cx, groundY + (1 - appear) * 60);
      ctx.scale(1.7, 1.7);
      drawFighter(ctx, this.fighter, { flash: 0, rotation: 0 });
      ctx.restore();
    }

    // --- particles behind the headline ---
    particles.draw(ctx);

    // --- the reveal itself ---
    if (beat === "reveal") {
      const since = t - RevealScreen.revealAt;
      const pop = Math.min(1, since * 2.6);
      // Overshoot for a satisfying pop-in.
      const scale = pop < 1 ? 0.4 + 1.05 * pop : 1 + Math.sin((since - 0.38) * 5) * 0.022;
      const pulse = 0.5 + 0.5 * Math.sin(since * 4);

      ctx.save();
      ctx.translate(cx, 214);
      ctx.scale(scale, scale);

      // Icon.
      drawText(ctx, revealIcon(), 0, -104, {
        size: 96,
        stroke: null,
        glow: themeGlow,
        glowSize: 26,
      });

      // Headline.
      const headline = revealHeadline();
      drawText(ctx, headline, 0, 6, {
        size: 116,
        color: PALETTE.white,
        glow: themeColor,
        glowSize: 30 + pulse * 30,
        depth: 8,
        strokeWidth: 10,
        letterSpacing: 6,
      });

      drawText(ctx, headline, 0, 6, {
        size: 116,
        color: themeGlow,
        stroke: null,
        glow: themeColor,
        glowSize: 46,
        letterSpacing: 6,
        alpha: 0.35 + pulse * 0.3,
      });

      ctx.restore();

      if (since > 1.2) {
        drawText(ctx, tr().congratulations, cx, 306, {
          size: 32,
          color: PALETTE.neonYellow,
          glow: PALETTE.neonYellow,
          glowSize: 14,
          depth: 3,
          letterSpacing: 6,
          alpha: Math.min(1, (since - 1.2) * 2),
        });
      }

      // Final score, folded into the celebration rather than shown beforehand.
      // How close the session was is worth seeing, but it is a footnote to the
      // announcement now, not a drum roll before it.
      if (scores && since > 1.8) {
        this.drawFinalScore(ctx, scores, 392, Math.min(1, (since - 1.8) * 2));
      }
    }

    // --- full-screen flash ---
    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.restore();
    }
  }
}
