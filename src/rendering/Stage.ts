import { VIEW } from "../config/gameConfig.ts";
import { stars as drawStars } from "./stages/draw.ts";
import { LILLE_STAGE, type StageTheme } from "./stages/index.ts";

/**
 * Renders whichever stage theme is currently active.
 *
 * The sky, floor and star field are common to every stage and handled here; each
 * theme only supplies its palette and the silhouettes in between. That keeps the
 * themes short and guarantees a consistent look: same horizon line, same lit
 * floor edge, same perspective grid, so the fighters always read the same way
 * whatever the backdrop.
 */
export class Stage {
  private theme: StageTheme = LILLE_STAGE;
  private time = 0;
  /** Counts up while a newly set stage fades in. */
  private introFade = 0;

  get current(): StageTheme {
    return this.theme;
  }

  /** Switches stage and restarts its animation clock. */
  setTheme(theme: StageTheme): void {
    this.theme = theme;
    this.time = 0;
    this.introFade = 0;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.introFade < 1) this.introFade = Math.min(1, this.introFade + dt * 1.6);
  }

  /**
   * @param cameraX average fighter position, drives the parallax
   */
  draw(ctx: CanvasRenderingContext2D, cameraX: number): void {
    const p = this.theme.palette;
    const t = this.time;
    // Positive when the fighters are left of centre, so the backdrop slides the
    // opposite way. Scaled per layer by the themes.
    const shift = -(cameraX - VIEW.width / 2) * 0.14;

    // --- sky ---------------------------------------------------------------
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW.floorY);
    sky.addColorStop(0, p.skyTop);
    sky.addColorStop(0.55, p.skyMid);
    sky.addColorStop(1, p.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW.width, VIEW.floorY);

    // --- stars, night stages only -----------------------------------------
    if (this.theme.stars) {
      drawStars(ctx, 0x57a25, t, 90, VIEW.floorY - 180, VIEW.width);
    }

    // --- horizon haze ------------------------------------------------------
    const glow = ctx.createLinearGradient(0, VIEW.floorY - 200, 0, VIEW.floorY);
    glow.addColorStop(0, "rgba(0,0,0,0)");
    glow.addColorStop(1, p.glow);
    ctx.fillStyle = glow;
    ctx.fillRect(0, VIEW.floorY - 200, VIEW.width, 200);

    // --- the stage's own scenery -------------------------------------------
    this.theme.drawBackdrop(ctx, t, shift, VIEW.floorY);

    this.drawFloor(ctx, cameraX);

    // Foreground details sit over the floor but behind the fighters.
    this.theme.drawForeground?.(ctx, t, shift, VIEW.floorY);
  }

  private drawFloor(ctx: CanvasRenderingContext2D, cameraX: number): void {
    const p = this.theme.palette;
    const y = VIEW.floorY;

    const g = ctx.createLinearGradient(0, y, 0, VIEW.height);
    g.addColorStop(0, p.floorTop);
    g.addColorStop(0.25, p.floorMid);
    g.addColorStop(1, p.floorDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, y, VIEW.width, VIEW.height - y);

    // Bright line where the floor meets the backdrop: separates the fighters
    // from the scenery and gives every stage the same sense of a lit arena.
    ctx.fillStyle = p.floorEdge;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(0, y - 2, VIEW.width, 2);
    ctx.globalAlpha = 0.12;
    ctx.fillRect(0, y, VIEW.width, 10);
    ctx.globalAlpha = 1;

    // Perspective lines splaying towards the viewer.
    const offset = -(cameraX - VIEW.width / 2) * 0.16;
    ctx.strokeStyle = p.floorLine;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    const spacing = 96;
    for (let i = -2; i < VIEW.width / spacing + 4; i++) {
      const lineX = i * spacing + (offset % spacing);
      const spread = (lineX - VIEW.width / 2) * 0.55;
      ctx.beginPath();
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
