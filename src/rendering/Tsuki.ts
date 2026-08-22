import { VIEW } from "../config/gameConfig.ts";
import { Rng } from "../core/rng.ts";

/**
 * ============================================================================
 *  TSUKI
 * ============================================================================
 *
 *  A dark grey tabby who wanders through the arena from time to time, entirely
 *  ignoring the fight. An easter egg, so the rules are: never blocks the action,
 *  never affects gameplay, and rare enough that spotting her feels like a find.
 *
 *  She has a small behaviour loop rather than a fixed animation, because a cat
 *  that simply walks across the screen reads as a sprite, whereas one that stops
 *  to wash a paw, sits, thinks about it, then carries on reads as a cat:
 *
 *      walk -> sit -> groom / stretch / look around -> walk -> leave
 *
 *  She strolls along the back of the floor, behind the fighters, and is drawn a
 *  little smaller than life so she never competes for attention.
 * ============================================================================
 */

type CatState = "away" | "entering" | "walking" | "sitting" | "grooming" | "stretching" | "leaving";

/** Dark grey tabby coat. */
const COAT = {
  base: "#4a4a52",
  dark: "#33333a",
  stripe: "#26262c",
  light: "#5e5e68",
  belly: "#6e6e78",
  nose: "#c98a95",
  ear: "#7a5a62",
  eye: "#8fd98f",
} as const;

/** How far behind the fighters she walks. */
const WALK_Y_OFFSET = 26;

export class Tsuki {
  private state: CatState = "away";
  private x = -100;
  /** 1 walking right, -1 walking left. */
  private facing: 1 | -1 = 1;
  private stateTimer = 0;
  /** Seconds until she next considers appearing. */
  private cooldown = 0;
  private rng: Rng;
  private animTime = 0;
  /** Tail flick intensity, rises when she is alert. */
  private alert = 0;

  constructor(seed?: number) {
    this.rng = new Rng(seed);
    this.cooldown = this.rng.range(6, 14);
  }

  /** True when she is on screen, for the dev tools only. */
  get visible(): boolean {
    return this.state !== "away";
  }

  /**
   * Starts a fresh appearance schedule for a new fight.
   *
   * She turns up exactly once per fight, entering somewhere in the first stretch
   * of it rather than at a fixed moment, so it still feels like she wandered in
   * of her own accord. Called by the game when a match begins.
   */
  reset(): void {
    this.state = "away";
    this.x = -100;
    // Far enough in that the fight has started, early enough that a short match
    // does not finish before she shows up.
    this.cooldown = this.rng.range(5, 16);
  }

  update(dt: number): void {
    this.animTime += dt;
    if (this.alert > 0) this.alert = Math.max(0, this.alert - dt * 0.6);

    if (this.state === "away") {
      this.cooldown -= dt;
      if (this.cooldown <= 0) this.enter();
      return;
    }

    this.stateTimer -= dt;

    switch (this.state) {
      case "entering":
      case "walking":
      case "leaving": {
        const speed = this.state === "leaving" ? 62 : 38;
        this.x += this.facing * speed * dt;

        // Off the far side: that was her visit for this fight.
        if (this.x < -90 || this.x > VIEW.width + 90) {
          this.state = "away";
          // A very long cooldown rather than a hard stop: one appearance per
          // fight is the intent, but if a match runs unusually long she may
          // eventually stroll back, which is better than her being absent from
          // the second half of a five-minute round.
          this.cooldown = this.rng.range(95, 150);
          return;
        }

        if (this.stateTimer <= 0) {
          if (this.state === "leaving") return; // keep going until off screen
          // Pause somewhere along the way, or head off.
          if (this.rng.chance(0.55)) {
            this.state = "sitting";
            this.stateTimer = this.rng.range(1.2, 2.8);
          } else {
            this.state = this.rng.chance(0.55) ? "leaving" : "walking";
            this.stateTimer = this.rng.range(1.5, 4);
            // Occasionally change her mind about direction.
            if (this.state === "walking" && this.rng.chance(0.25)) {
              this.facing = this.facing === 1 ? -1 : 1;
            }
          }
        }
        break;
      }

      case "sitting": {
        if (this.stateTimer <= 0) {
          const r = this.rng.next();
          if (r < 0.4) {
            this.state = "grooming";
            this.stateTimer = this.rng.range(1.8, 3.4);
          } else if (r < 0.6) {
            this.state = "stretching";
            this.stateTimer = 1.4;
          } else {
            this.state = "walking";
            this.stateTimer = this.rng.range(1.5, 3.5);
            if (this.rng.chance(0.35)) this.facing = this.facing === 1 ? -1 : 1;
          }
        }
        break;
      }

      case "grooming":
      case "stretching": {
        if (this.stateTimer <= 0) {
          this.state = this.rng.chance(0.6) ? "leaving" : "walking";
          this.stateTimer = this.rng.range(1.5, 3.5);
        }
        break;
      }
    }
  }

  private enter(): void {
    // Comes in from whichever side, at the back of the floor.
    this.facing = this.rng.chance(0.5) ? 1 : -1;
    this.x = this.facing === 1 ? -70 : VIEW.width + 70;
    this.state = "entering";
    this.stateTimer = this.rng.range(1.4, 2.6);
  }

  /**
   * A nearby hit startles her: ears back, tail up, and she scurries off. Called
   * by the game when a heavy blow lands.
   */
  startle(hitX: number): void {
    if (this.state === "away") return;
    // Deliberately short range. Now that she only visits once per fight, a wide
    // startle radius meant a single early hit could chase her off before anyone
    // had a chance to notice her. She now only reacts to a blow landing close by,
    // which is also more believable: a scrap across the arena is not her problem.
    if (Math.abs(hitX - this.x) > 130) return;
    this.alert = 1;
    // Run away from the impact.
    this.facing = hitX > this.x ? -1 : 1;
    this.state = "leaving";
    this.stateTimer = 3;
  }

  /**
   * Draws her behind the fighters.
   *
   * @param floorY the arena floor line
   */
  draw(ctx: CanvasRenderingContext2D, floorY: number): void {
    if (this.state === "away") return;

    const baseY = floorY - WALK_Y_OFFSET;
    const t = this.animTime;
    // Slightly smaller than a real cat relative to the fighters, so she sits in
    // the scene without drawing the eye away from the action.
    const s = 1.15;

    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(baseY));
    ctx.scale(this.facing * s, s);

    // Soft shadow anchoring her to the floor.
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.ellipse(0, 1, 17, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const sitting = this.state === "sitting" || this.state === "grooming";
    if (this.state === "stretching") this.drawStretch(ctx, t);
    else if (sitting) this.drawSitting(ctx, t, this.state === "grooming");
    else this.drawWalking(ctx, t);

    ctx.restore();
  }

  /** Chunky filled rect, matching the pixel feel of the fighters. */
  private px(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  /** Tabby stripes across the back. */
  private stripes(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    count: number,
  ): void {
    for (let i = 0; i < count; i++) {
      this.px(ctx, x + 2 + i * (w / count), y, 1.6, 4.5, COAT.stripe);
    }
  }

  private drawWalking(ctx: CanvasRenderingContext2D, t: number): void {
    // Four legs in a simple two-phase gait.
    const cycle = Math.sin(t * 7.5);
    const cycle2 = Math.sin(t * 7.5 + Math.PI);

    // Back legs.
    this.px(ctx, -9 + cycle * 1.6, -6, 3, 6, COAT.dark);
    this.px(ctx, -5 + cycle2 * 1.6, -6, 3, 6, COAT.dark);
    // Front legs.
    this.px(ctx, 6 + cycle2 * 1.8, -6, 3, 6, COAT.dark);
    this.px(ctx, 10 + cycle * 1.8, -6, 3, 6, COAT.dark);

    // Body, with a gentle bob.
    const bob = Math.abs(Math.cos(t * 7.5)) * 0.7;
    this.px(ctx, -11, -14 - bob, 24, 8.5, COAT.base);
    // Belly is lighter.
    this.px(ctx, -9, -8 - bob, 20, 2, COAT.belly);
    this.stripes(ctx, -9, -14.5 - bob, 20, 5);

    // Tail: up and curved, swaying. Rises when she is alert.
    const sway = Math.sin(t * 3.4) * 0.5 + this.alert * 0.5;
    for (let i = 0; i < 7; i++) {
      const p = i / 6;
      const tx = -12 - i * 2.4;
      const ty = -14 - bob - p * 9 - Math.sin(p * 2.2 + sway) * 3;
      this.px(ctx, tx, ty, 2.6, 2.6, i % 2 === 0 ? COAT.base : COAT.stripe);
    }

    this.drawHead(ctx, 12, -20 - bob, t, false);
  }

  private drawSitting(ctx: CanvasRenderingContext2D, t: number, grooming: boolean): void {
    // Haunches on the ground, body upright.
    this.px(ctx, -8, -12, 15, 12, COAT.base);
    this.px(ctx, -9, -5, 7, 5, COAT.dark);
    this.stripes(ctx, -6, -12.5, 12, 4);

    // Chest and front legs.
    this.px(ctx, 4, -16, 8, 16, COAT.base);
    this.px(ctx, 5, -5, 3, 5, COAT.dark);
    this.px(ctx, 9, -5, 3, 5, COAT.dark);
    this.px(ctx, 4, -8, 8, 2, COAT.belly);

    // Tail curled around, tip flicking.
    const flick = Math.sin(t * 2.6) * 2;
    for (let i = 0; i < 8; i++) {
      const p = i / 7;
      this.px(
        ctx,
        -10 - i * 1.8,
        -3 + Math.sin(p * 2.6) * 2 + p * flick * 0.4,
        2.6,
        2.6,
        i % 2 === 0 ? COAT.base : COAT.stripe,
      );
    }

    if (grooming) {
      // Head down, one paw raised: the classic wash.
      const lick = Math.sin(t * 9) * 1.6;
      this.px(ctx, 9, -12 + lick * 0.3, 3, 5, COAT.light);
      this.drawHead(ctx, 11, -20 + lick * 0.5, t, true);
    } else {
      this.drawHead(ctx, 11, -23, t, false);
    }
  }

  private drawStretch(ctx: CanvasRenderingContext2D, t: number): void {
    // The long low stretch, front paws forward and back arched.
    const reach = Math.min(1, (1.4 - Math.max(0, this.stateTimer)) * 1.6);
    this.px(ctx, -12, -12, 16, 8, COAT.base);
    this.stripes(ctx, -10, -12.5, 14, 4);
    // Hindquarters raised.
    this.px(ctx, -13, -15, 6, 9, COAT.base);
    this.px(ctx, -12, -6, 3, 6, COAT.dark);
    this.px(ctx, -8, -6, 3, 6, COAT.dark);
    // Front legs reaching out.
    this.px(ctx, 4 + reach * 6, -7, 10, 3, COAT.base);
    this.px(ctx, 12 + reach * 6, -6, 4, 2.5, COAT.light);

    // Tail straight up: the stretch always comes with it.
    for (let i = 0; i < 7; i++) {
      this.px(ctx, -14, -16 - i * 2.6, 2.6, 2.8, i % 2 === 0 ? COAT.base : COAT.stripe);
    }

    this.drawHead(ctx, 8 + reach * 5, -10, t, false);
  }

  /** Head, ears, eyes and whiskers. */
  private drawHead(
    ctx: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    t: number,
    eyesClosed: boolean,
  ): void {
    // Ears. Flatten back when startled, which is the clearest cat tell.
    const earDroop = this.alert * 2.2;
    this.px(ctx, hx - 4, hy - 3 + earDroop, 3.4, 4, COAT.base);
    this.px(ctx, hx + 2, hy - 3 + earDroop, 3.4, 4, COAT.base);
    this.px(ctx, hx - 3.2, hy - 1.6 + earDroop, 1.8, 2, COAT.ear);
    this.px(ctx, hx + 2.8, hy - 1.6 + earDroop, 1.8, 2, COAT.ear);

    // Skull.
    this.px(ctx, hx - 5, hy, 11, 9, COAT.base);
    // Muzzle, lighter.
    this.px(ctx, hx + 1, hy + 4, 6, 5, COAT.light);
    // Forehead stripes.
    this.px(ctx, hx - 2, hy + 0.6, 1.4, 3, COAT.stripe);
    this.px(ctx, hx + 1, hy + 0.6, 1.4, 3, COAT.stripe);

    if (eyesClosed) {
      // Contented slits while grooming.
      this.px(ctx, hx - 1, hy + 4, 2.6, 1, COAT.stripe);
      this.px(ctx, hx + 3.4, hy + 4, 2.6, 1, COAT.stripe);
    } else {
      // Green eyes, with an occasional slow blink.
      const blink = Math.sin(t * 0.7) > 0.985 ? 0.25 : 1;
      this.px(ctx, hx - 1, hy + 3.4, 2.6, 2.4 * blink, COAT.eye);
      this.px(ctx, hx + 3.4, hy + 3.4, 2.6, 2.4 * blink, COAT.eye);
      if (blink > 0.5) {
        // Vertical pupils.
        this.px(ctx, hx - 0.2, hy + 3.6, 1, 2, "#1a1a1e");
        this.px(ctx, hx + 4.2, hy + 3.6, 1, 2, "#1a1a1e");
      }
    }

    // Nose.
    this.px(ctx, hx + 5.4, hy + 6, 1.8, 1.5, COAT.nose);

    // Whiskers, drawn as thin lines.
    ctx.save();
    ctx.strokeStyle = "rgba(230,230,240,0.45)";
    ctx.lineWidth = 0.7;
    for (const dy of [-1, 0.6, 2.2]) {
      ctx.beginPath();
      ctx.moveTo(hx + 6, hy + 6 + dy * 0.6);
      ctx.lineTo(hx + 13, hy + 5 + dy);
      ctx.stroke();
    }
    ctx.restore();
  }
}
