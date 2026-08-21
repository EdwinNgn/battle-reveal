import { PHYSICS } from "../config/gameConfig.ts";
import type { Fighter, Hitbox } from "../fighters/Fighter.ts";

export function overlaps(a: Hitbox, b: Hitbox): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/**
 * Keeps the two fighters from occupying the same space. Both are pushed apart
 * equally unless one is pinned against a wall, in which case the other takes
 * the full displacement.
 */
export function resolveBodyOverlap(a: Fighter, b: Fighter, minX: number, maxX: number): void {
  const dx = b.x - a.x;
  const dist = Math.abs(dx);
  if (dist >= PHYSICS.minSeparation || dist === 0) return;

  const push = (PHYSICS.minSeparation - dist) / 2;
  const dir = dx >= 0 ? 1 : -1;

  let aTarget = a.x - dir * push;
  let bTarget = b.x + dir * push;

  if (aTarget < minX) {
    const spill = minX - aTarget;
    aTarget = minX;
    bTarget += spill;
  } else if (aTarget > maxX) {
    const spill = aTarget - maxX;
    aTarget = maxX;
    bTarget -= spill;
  }

  if (bTarget < minX) {
    const spill = minX - bTarget;
    bTarget = minX;
    aTarget += spill;
  } else if (bTarget > maxX) {
    const spill = bTarget - maxX;
    bTarget = maxX;
    aTarget -= spill;
  }

  a.x = Math.max(minX, Math.min(maxX, aTarget));
  b.x = Math.max(minX, Math.min(maxX, bTarget));
}
