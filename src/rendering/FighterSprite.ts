import type { AttackKind } from "../config/gameConfig.ts";
import type { Fighter, FighterState } from "../fighters/Fighter.ts";
import { FIGHTER_COLORS, type FighterColors } from "./palette.ts";

/**
 * Procedural fighter art.
 *
 * Everything is drawn from rectangles on a chunky virtual grid, which gives a
 * pixel-art feel without needing any sprite sheets. The two fighters share one
 * skeleton and differ by proportions, colours, hair and a few silhouette
 * details, so their hitboxes stay honest and their animations stay in sync.
 *
 * All art here is original.
 */

/** One unit of the pixel grid, in canvas pixels. */
const U = 4;

interface Pose {
  /** Vertical bob of the whole body. */
  bodyY: number;
  /** Forward lean, positive is toward the facing direction. */
  lean: number;
  /** Shoulder angle of the front arm, radians. 0 = down. */
  frontArm: number;
  backArm: number;
  /** Extension of the front arm, 0..1.5. */
  frontArmLen: number;
  backArmLen: number;
  /** Leg splay. */
  frontLeg: number;
  backLeg: number;
  /** Knee bend, 0..1. */
  crouch: number;
  /** Head tilt. */
  headTilt: number;
}

function basePose(): Pose {
  return {
    bodyY: 0,
    lean: 0,
    frontArm: 2.5,
    backArm: 2.5,
    frontArmLen: 0.55,
    backArmLen: 0.55,
    frontLeg: 0.5,
    backLeg: -0.5,
    crouch: 0,
    headTilt: 0,
  };
}

/** Builds the pose for a fighter's current state and animation time. */
function poseFor(f: Fighter): Pose {
  const p = basePose();
  const t = f.animTime;

  switch (f.state as FighterState) {
    case "idle": {
      // Slow breathing bob plus a small guard sway.
      p.bodyY = Math.sin(t * 3.1) * 1.6;
      p.frontArm = 2.35 + Math.sin(t * 3.1) * 0.08;
      p.backArm = 2.6 + Math.sin(t * 3.1 + 0.5) * 0.08;
      p.frontArmLen = 0.6;
      p.backArmLen = 0.5;
      p.lean = 0.6;
      break;
    }
    case "walk": {
      // Stepping cycle. Legs swing out of phase, arms counter-swing.
      const c = Math.sin(t * 11);
      p.bodyY = Math.abs(Math.cos(t * 11)) * -2.2;
      p.frontLeg = 0.5 + c * 0.85;
      p.backLeg = -0.5 - c * 0.85;
      p.frontArm = 2.4 - c * 0.22;
      p.backArm = 2.6 + c * 0.22;
      p.lean = 1.4;
      break;
    }
    case "jump": {
      // Tucked legs, arms up for balance.
      p.crouch = 0.55;
      p.frontLeg = 1.1;
      p.backLeg = -0.35;
      p.frontArm = 1.6;
      p.backArm = 3.3;
      p.frontArmLen = 0.75;
      p.lean = 1.2;
      break;
    }
    case "block": {
      // Both arms tucked across the body, weight back, braced.
      p.frontArm = 1.75;
      p.backArm = 1.95;
      p.frontArmLen = 0.42;
      p.backArmLen = 0.38;
      p.crouch = 0.28;
      p.lean = -1.6;
      p.headTilt = -0.06;
      p.bodyY = Math.sin(t * 18) * 0.5;
      break;
    }
    case "hit": {
      // Snapped backwards, arms flailing.
      p.lean = -4.2;
      p.frontArm = 3.5;
      p.backArm = 3.8;
      p.frontArmLen = 0.75;
      p.backArmLen = 0.7;
      p.headTilt = -0.22;
      p.crouch = 0.2;
      break;
    }
    case "ko": {
      // Falling backwards. Handled mostly by the caller's rotation.
      p.lean = -6;
      p.frontArm = 4.2;
      p.backArm = 4.4;
      p.frontArmLen = 0.9;
      p.backArmLen = 0.9;
      p.crouch = 0.5;
      p.headTilt = -0.4;
      break;
    }
    case "victory": {
      // Arms raised, triumphant bounce.
      const b = Math.abs(Math.sin(t * 5));
      p.bodyY = -b * 5;
      p.frontArm = 0.5 - b * 0.3;
      p.backArm = 0.35 - b * 0.3;
      p.frontArmLen = 1.05;
      p.backArmLen = 1.05;
      p.crouch = b * 0.2;
      break;
    }
    case "attack": {
      applyAttackPose(p, f.lastAttackKind, f.attackProgress);
      break;
    }
  }

  return p;
}

/**
 * Attack poses are keyed off progress through the whole attack, so the windup,
 * the strike and the recovery all read clearly at a glance.
 */
function applyAttackPose(p: Pose, kind: AttackKind | null, progress: number): void {
  // Strike happens around 35% of the way through.
  const strike = 0.35;
  // 0 during windup, peaks at the strike, decays through recovery.
  const ext =
    progress < strike
      ? Math.pow(progress / strike, 0.6)
      : Math.max(0, 1 - (progress - strike) / (1 - strike) / 0.8);

  switch (kind) {
    case "punch": {
      // Straight lead punch, shoulder rotating through.
      p.frontArm = 1.55;
      p.frontArmLen = 0.45 + ext * 1.05;
      p.backArm = 2.5 + ext * 0.3;
      p.backArmLen = 0.45;
      p.lean = 1 + ext * 4;
      p.frontLeg = 0.6 + ext * 0.5;
      p.backLeg = -0.7 - ext * 0.3;
      break;
    }
    case "kick": {
      // Rising round kick. The front leg does the work.
      p.frontLeg = 0.5 + ext * 2.6;
      p.backLeg = -0.4;
      p.crouch = 0.1 + ext * 0.15;
      p.frontArm = 2.2 - ext * 0.5;
      p.backArm = 3.1 + ext * 0.5;
      p.frontArmLen = 0.5;
      p.lean = 0.8 + ext * 2.4;
      p.bodyY = -ext * 3;
      break;
    }
    case "strong": {
      // Big overhand hook: deep windup, whole body turns into it.
      const windup = progress < strike ? progress / strike : 1;
      p.frontArm = 0.9 + ext * 1.3;
      p.frontArmLen = 0.4 + ext * 1.15;
      p.backArm = 2.4 + ext * 0.6;
      p.lean = -2.5 * (1 - windup) + ext * 6.5;
      p.crouch = 0.3 - ext * 0.25;
      p.frontLeg = 0.7 + ext * 0.7;
      p.backLeg = -0.9 - ext * 0.4;
      p.bodyY = ext * -2;
      p.headTilt = ext * 0.12;
      break;
    }
    default:
      break;
  }
}

/** Filled rectangle snapped to the pixel grid, for crisp chunky edges. */
function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/**
 * Draws a limb as a thick tapered line of blocks.
 *
 * Angle convention, which every pose in this file relies on:
 *
 *     0      straight UP
 *     PI/2   straight FORWARD (in the direction the fighter faces)
 *     PI     straight DOWN
 *
 * Because the sprite is drawn inside a `scale(facing, 1)`, "forward" is always
 * +x here and mirroring is handled for free by the caller.
 */
function limb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  thickness: number,
  color: string,
  handColor?: string,
): void {
  const steps = Math.max(2, Math.round(length / (U * 0.8)));
  const dx = Math.sin(angle) * (length / steps);
  // Canvas y grows downward, so angle 0 (up) needs a negative dy. cos(0) = 1,
  // hence the negation; cos(PI) = -1 then correctly points down.
  const dy = -Math.cos(angle) * (length / steps);
  let cx = x;
  let cy = y;
  for (let i = 0; i < steps; i++) {
    const th = thickness * (1 - (i / steps) * 0.22);
    px(ctx, cx - th / 2, cy - th / 2, th, th, color);
    cx += dx;
    cy += dy;
  }
  if (handColor) {
    const th = thickness * 1.15;
    px(ctx, cx - th / 2, cy - th / 2, th, th, handColor);
  }
}

export interface DrawOptions {
  /** White flash intensity, 0..1. */
  flash: number;
  /** Extra rotation, used for the KO topple. */
  rotation: number;
}

/**
 * Renders one fighter. The origin is the fighter's feet at (f.x, f.y).
 */
export function drawFighter(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  opts: DrawOptions,
): void {
  const c: FighterColors = FIGHTER_COLORS[f.id];
  const pose = poseFor(f);
  const female = f.id === "female";

  // Proportions: the female fighter is slightly shorter and leaner, the male
  // slightly broader. Both keep the same overall silhouette height budget.
  const torsoW = female ? U * 6.5 : U * 7.5;
  const torsoH = female ? U * 11 : U * 11.5;
  const hipW = female ? U * 6 : U * 6.5;
  const headR = U * 3.4;
  const legLen = female ? U * 12.5 : U * 12;
  const armLen = female ? U * 10.5 : U * 10.5;
  const limbTh = female ? U * 2.1 : U * 2.5;

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.facing, 1);
  if (opts.rotation) ctx.rotate(opts.rotation);

  const lean = pose.lean;
  const bodyY = pose.bodyY;
  const crouchDrop = pose.crouch * U * 3.5;

  // --- shadow on the floor ---
  const airHeight = Math.max(0, -(f.y - f.y)); // fighters draw at their own feet
  const shadowScale = f.grounded ? 1 : 0.7;
  ctx.save();
  ctx.scale(1, 0.28);
  ctx.beginPath();
  ctx.arc(0, 6 / 0.28, U * 6 * shadowScale, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fill();
  ctx.restore();
  void airHeight;

  // Key vertical anchors, measured up from the feet.
  const hipY = -legLen + crouchDrop + bodyY;
  const shoulderY = hipY - torsoH;
  const headY = shoulderY - headR * 0.9;

  // Legs hang DOWN (angle PI) and swing FORWARD as their pose value grows, so
  // a kick rotates the leg up toward the horizontal instead of behind the body.
  const legAngle = (splay: number): number => Math.PI - splay * 0.55;

  // --- back leg ---
  limb(
    ctx,
    -U * 0.5,
    hipY,
    legAngle(pose.backLeg),
    legLen * (1 - pose.crouch * 0.25),
    limbTh,
    c.secondary,
    c.outline,
  );

  // --- back arm ---
  limb(
    ctx,
    -U * 1,
    shoulderY + U,
    pose.backArm,
    armLen * pose.backArmLen * 1.5,
    limbTh * 0.9,
    c.skinShadow,
    c.secondary,
  );

  // --- front leg ---
  limb(
    ctx,
    U * 0.8,
    hipY,
    legAngle(pose.frontLeg),
    legLen * (1 - pose.crouch * 0.25),
    limbTh,
    c.primary,
    c.outline,
  );

  // --- torso ---
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean * 0.014);
  // hips / belt
  px(ctx, -hipW / 2, -U * 1.5, hipW, U * 3, c.secondary);
  px(ctx, -hipW / 2, -U * 1.5, hipW, U * 0.8, c.accent);
  // chest
  px(ctx, -torsoW / 2, -torsoH, torsoW, torsoH - U * 1.2, c.primary);
  // shading down one side for volume
  px(ctx, torsoW / 2 - U * 1.4, -torsoH, U * 1.4, torsoH - U * 1.2, c.secondary);
  // chest trim stripe, a different shape per fighter
  if (female) {
    px(ctx, -torsoW / 2 + U, -torsoH + U * 1.2, torsoW - U * 2, U * 1.1, c.trim);
    px(ctx, -U * 0.8, -torsoH + U * 2.6, U * 1.6, U * 4, c.trim);
  } else {
    px(ctx, -torsoW / 2 + U * 0.8, -torsoH + U * 2, torsoW - U * 1.6, U * 1.3, c.trim);
  }
  // shoulders
  px(ctx, -torsoW / 2 - U * 0.9, -torsoH, U * 2.2, U * 3.2, c.secondary);
  px(ctx, torsoW / 2 - U * 1.3, -torsoH, U * 2.2, U * 3.2, c.secondary);
  ctx.restore();

  // --- head ---
  ctx.save();
  ctx.translate(lean * 0.5, headY);
  ctx.rotate(pose.headTilt + lean * 0.01);
  // neck
  px(ctx, -U * 1.2, headR * 0.5, U * 2.4, U * 2, c.skinShadow);
  // skull
  px(ctx, -headR, -headR, headR * 2, headR * 2, c.skin);
  px(ctx, headR - U * 1.1, -headR, U * 1.1, headR * 2, c.skinShadow);
  // eye, facing forward
  px(ctx, U * 0.6, -U * 0.9, U * 1.1, U * 1.1, c.outline);
  // brow
  px(ctx, U * 0.2, -U * 2.1, U * 2.2, U * 0.7, c.hair);
  // hair: distinct silhouette per fighter
  if (female) {
    // High ponytail streaming backwards.
    px(ctx, -headR, -headR - U * 1.3, headR * 2, U * 2.2, c.hair);
    px(ctx, -headR - U * 0.8, -headR - U * 0.6, U * 1.6, headR * 1.4, c.hair);
    const sway = Math.sin(f.animTime * 6) * U * 0.8;
    px(ctx, -headR - U * 3.6, -headR - U * 0.2 + sway, U * 3.2, U * 1.9, c.hair);
    px(ctx, -headR - U * 6.2, -headR + U * 1.4 + sway * 1.5, U * 3, U * 1.7, c.hair);
  } else {
    // Swept-back spiked crop.
    px(ctx, -headR, -headR - U * 1.5, headR * 2, U * 2.4, c.hair);
    px(ctx, -headR - U * 1.2, -headR - U * 0.4, U * 1.8, U * 2.6, c.hair);
    px(ctx, -U * 1.2, -headR - U * 2.6, U * 1.5, U * 1.6, c.hair);
    px(ctx, U * 0.8, -headR - U * 2.2, U * 1.5, U * 1.4, c.hair);
  }
  // headband, in the accent colour
  px(ctx, -headR, -U * 3.2, headR * 2, U * 1.2, c.accent);
  ctx.restore();

  // --- front arm, drawn last so it reads on top ---
  limb(
    ctx,
    U * 1.2,
    shoulderY + U,
    pose.frontArm,
    armLen * pose.frontArmLen * 1.5,
    limbTh,
    c.skin,
    c.primary,
  );

  ctx.restore();

  // --- hit flash: silhouette the whole body in white ---
  if (opts.flash > 0) {
    ctx.save();
    ctx.globalAlpha = opts.flash * 0.75;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#ffffff";
    const b = f.bodyBox();
    ctx.fillRect(b.x - 2, b.y - 8, b.w + 4, b.h + 8);
    ctx.restore();
  }
}
