import { VIEW } from "../config/gameConfig.ts";
import type { SecretBalanceSystem } from "../balancing/SecretBalanceSystem.ts";
import type { Fighter } from "../fighters/Fighter.ts";
import { overlaps, resolveBodyOverlap } from "./CollisionSystem.ts";

/** Reported back so the presentation layer can react to hits. */
export interface HitEvent {
  attacker: Fighter;
  victim: Fighter;
  damage: number;
  blocked: boolean;
  kind: "punch" | "kick" | "strong";
  /** Impact point in world space. */
  x: number;
  y: number;
  shake: number;
  particles: number;
  ko: boolean;
}

/**
 * Resolves attacks between the two fighters for one step.
 *
 * The balance system is consulted here for the incoming-damage multiplier. This
 * is the single point where the hidden layer touches combat, and it does so by
 * scaling a damage number that was already being calculated.
 */
export function resolveCombat(
  a: Fighter,
  b: Fighter,
  balance: SecretBalanceSystem,
): HitEvent[] {
  const events: HitEvent[] = [];

  for (const [attacker, victim] of [
    [a, b],
    [b, a],
  ] as const) {
    const hitbox = attacker.activeHitbox();
    if (!hitbox) continue;
    if (victim.state === "ko") continue;
    if (!overlaps(hitbox, victim.bodyBox())) continue;

    const def = attacker.attack!.def;
    const raw = attacker.outgoingDamage() * balance.incomingDamageScale(victim);
    const fromDirection: 1 | -1 = attacker.x <= victim.x ? 1 : -1;

    const result = victim.receiveHit(raw, def, fromDirection);
    attacker.markAttackConnected();

    if (result.damage > 0 || result.blocked) {
      attacker.hitsLanded++;
      attacker.damageDealt += result.damage;
    }

    balance.enforceFloor(a, b);

    events.push({
      attacker,
      victim,
      damage: result.damage,
      blocked: result.blocked,
      kind: def.kind,
      x: (hitbox.x + hitbox.w / 2 + victim.x) / 2,
      y: victim.y - def.heightOffset,
      shake: result.blocked ? def.shake * 0.4 : def.shake,
      particles: result.blocked ? Math.round(def.particles * 0.5) : def.particles,
      ko: victim.health <= 0,
    });
  }

  resolveBodyOverlap(a, b, VIEW.minX, VIEW.maxX);
  return events;
}
