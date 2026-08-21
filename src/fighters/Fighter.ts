import {
  ATTACKS,
  COMBAT,
  PHYSICS,
  VIEW,
  type AttackKind,
  type AttackDef,
} from "../config/gameConfig.ts";
import type { FighterId } from "../config/secretConfig.ts";
import { baseStats, neutralModifiers, type StatModifiers } from "./FighterStats.ts";

export type FighterState =
  | "idle"
  | "walk"
  | "jump"
  | "attack"
  | "block"
  | "hit"
  | "ko"
  | "victory";

export type AttackPhase = "startup" | "active" | "recovery";

/** What a controller asks the fighter to do on a given frame. */
export interface FighterIntent {
  moveLeft: boolean;
  moveRight: boolean;
  jump: boolean;
  block: boolean;
  attack: AttackKind | null;
}

export function emptyIntent(): FighterIntent {
  return { moveLeft: false, moveRight: false, jump: false, block: false, attack: null };
}

interface ActiveAttack {
  def: AttackDef;
  phase: AttackPhase;
  /** Time left in the current phase. */
  phaseTimer: number;
  /** Scaled phase durations, captured when the attack started. */
  startupMs: number;
  activeMs: number;
  recoveryMs: number;
  /** An attack may only land once. */
  hasConnected: boolean;
}

export interface Hitbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Fighter {
  readonly id: FighterId;

  // --- transform ---
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  grounded = true;

  // --- combat ---
  health: number;
  state: FighterState = "idle";
  attack: ActiveAttack | null = null;
  blocking = false;
  /** True on the frame a block actually absorbed a hit (for sfx/vfx). */
  blockedThisFrame = false;
  hitstun = 0;
  invuln = 0;
  attackBuffer = 0;
  /** Counts up while the fighter is flashing white from a hit. */
  flash = 0;

  /** Applied by the balancing layer every frame. Never read by the UI. */
  modifiers: StatModifiers = neutralModifiers();

  // --- animation bookkeeping (visual only) ---
  animTime = 0;
  /** 0..1 progress through the current attack, for pose interpolation. */
  attackProgress = 0;
  lastAttackKind: AttackKind | null = null;

  // --- match statistics (safe to show, no hidden info) ---
  hitsLanded = 0;
  damageDealt = 0;

  constructor(id: FighterId, x: number, facing: 1 | -1) {
    this.id = id;
    this.x = x;
    this.y = VIEW.floorY;
    this.facing = facing;
    this.health = COMBAT.maxHealth;
  }

  get stats() {
    return baseStats(this.id);
  }

  get alive(): boolean {
    return this.health > 0;
  }

  get busy(): boolean {
    return this.attack !== null || this.hitstun > 0 || this.state === "ko";
  }

  /** Centre of the body, used for distance checks. */
  get centerY(): number {
    return this.y - PHYSICS.bodyHeight / 2;
  }

  resetForRound(x: number, facing: 1 | -1): void {
    this.x = x;
    this.y = VIEW.floorY;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.grounded = true;
    this.health = COMBAT.maxHealth;
    this.state = "idle";
    this.attack = null;
    this.blocking = false;
    this.blockedThisFrame = false;
    this.hitstun = 0;
    this.invuln = 0;
    this.attackBuffer = 0;
    this.flash = 0;
    this.animTime = 0;
    this.attackProgress = 0;
    this.lastAttackKind = null;
    this.hitsLanded = 0;
    this.damageDealt = 0;
    this.modifiers = neutralModifiers();
  }

  /**
   * Advances the fighter one step.
   * @param dt seconds
   * @param intent what the controller wants
   * @param opponentX used only to keep fighters facing each other
   */
  update(dt: number, intent: FighterIntent, opponentX: number): void {
    const ms = dt * 1000;
    this.animTime += dt;
    this.blockedThisFrame = false;

    if (this.invuln > 0) this.invuln -= ms;
    if (this.attackBuffer > 0) this.attackBuffer -= ms;
    if (this.flash > 0) this.flash -= ms;

    if (this.state === "ko") {
      this.applyPhysics(dt);
      return;
    }
    if (this.state === "victory") {
      this.vx = 0;
      this.applyPhysics(dt);
      return;
    }

    // Face the opponent whenever we are free to turn.
    if (!this.busy) {
      this.facing = opponentX >= this.x ? 1 : -1;
    }

    if (this.hitstun > 0) {
      this.hitstun -= ms;
      this.state = "hit";
      this.vx *= 0.88;
      this.applyPhysics(dt);
      if (this.hitstun <= 0) {
        this.hitstun = 0;
        this.state = this.grounded ? "idle" : "jump";
      }
      return;
    }

    if (this.attack) {
      this.advanceAttack(ms);
      // Attacks have a little forward drift but no free movement.
      this.vx *= 0.82;
      this.applyPhysics(dt);
      return;
    }

    // --- free to act ---
    this.blocking = intent.block && (!COMBAT.blockRequiresGround || this.grounded);

    if (intent.attack && this.attackBuffer <= 0 && !this.blocking) {
      this.startAttack(intent.attack);
      this.applyPhysics(dt);
      return;
    }

    if (this.blocking) {
      this.state = "block";
      this.vx = 0;
      this.applyPhysics(dt);
      return;
    }

    if (intent.jump && this.grounded) {
      this.vy = -this.stats.jumpVelocity;
      this.grounded = false;
      this.state = "jump";
    }

    const speed = this.stats.walkSpeed * this.modifiers.speed;
    let dir = 0;
    if (intent.moveLeft) dir -= 1;
    if (intent.moveRight) dir += 1;

    if (this.grounded) {
      this.vx = dir * speed;
      this.state = dir !== 0 ? "walk" : "idle";
    } else {
      // Reduced air control keeps jumps committal, like a classic arcade game.
      if (dir !== 0) this.vx = dir * speed * 0.85;
      this.state = "jump";
    }

    this.applyPhysics(dt);
  }

  private applyPhysics(dt: number): void {
    this.x += this.vx * dt;

    if (!this.grounded || this.vy !== 0) {
      this.vy += PHYSICS.gravity * dt;
      this.y += this.vy * dt;
      if (this.y >= VIEW.floorY) {
        this.y = VIEW.floorY;
        this.vy = 0;
        if (!this.grounded) {
          this.grounded = true;
          if (this.state === "jump") this.state = "idle";
        }
      }
    }

    if (this.x < VIEW.minX) {
      this.x = VIEW.minX;
      if (this.vx < 0) this.vx = 0;
    }
    if (this.x > VIEW.maxX) {
      this.x = VIEW.maxX;
      if (this.vx > 0) this.vx = 0;
    }

    if (this.grounded && this.hitstun <= 0 && !this.attack) {
      // Friction only matters for knockback slide.
      if (this.state !== "walk") this.vx *= 0.8;
    }
  }

  private startAttack(kind: AttackKind): void {
    const def = ATTACKS[kind];
    // `recovery` below 1 means faster; it scales startup and recovery only, so
    // the active window (and therefore the feel of the hit) never changes.
    const scale = this.stats.recovery * this.modifiers.recovery;
    this.attack = {
      def,
      phase: "startup",
      phaseTimer: def.startupMs * scale,
      startupMs: def.startupMs * scale,
      activeMs: def.activeMs,
      recoveryMs: def.recoveryMs * scale,
      hasConnected: false,
    };
    this.state = "attack";
    this.lastAttackKind = kind;
    this.attackProgress = 0;
    this.blocking = false;
    this.attackBuffer = COMBAT.attackBufferMs;
    // A small forward lunge, strongest on the heavy attack.
    const lunge = kind === "strong" ? 90 : kind === "kick" ? 55 : 35;
    if (this.grounded) this.vx = this.facing * lunge;
  }

  private advanceAttack(ms: number): void {
    const a = this.attack;
    if (!a) return;
    a.phaseTimer -= ms;

    const total = a.startupMs + a.activeMs + a.recoveryMs;
    let elapsed = 0;
    if (a.phase === "startup") elapsed = a.startupMs - a.phaseTimer;
    else if (a.phase === "active") elapsed = a.startupMs + (a.activeMs - a.phaseTimer);
    else elapsed = a.startupMs + a.activeMs + (a.recoveryMs - a.phaseTimer);
    this.attackProgress = Math.max(0, Math.min(1, elapsed / total));

    if (a.phaseTimer > 0) return;

    if (a.phase === "startup") {
      a.phase = "active";
      a.phaseTimer = a.activeMs;
    } else if (a.phase === "active") {
      a.phase = "recovery";
      a.phaseTimer = a.recoveryMs;
    } else {
      this.attack = null;
      this.state = this.grounded ? "idle" : "jump";
      this.attackProgress = 0;
    }
  }

  /** The live hitbox, or null when no attack is in its active window. */
  activeHitbox(): Hitbox | null {
    const a = this.attack;
    if (!a || a.phase !== "active" || a.hasConnected) return null;
    const def = a.def;
    const front = this.x + this.facing * (PHYSICS.bodyWidth / 2);
    const x = this.facing === 1 ? front : front - def.reach;
    return {
      x,
      y: this.y - def.heightOffset - def.hitboxHeight / 2,
      w: def.reach,
      h: def.hitboxHeight,
    };
  }

  bodyBox(): Hitbox {
    return {
      x: this.x - PHYSICS.bodyWidth / 2,
      y: this.y - PHYSICS.bodyHeight,
      w: PHYSICS.bodyWidth,
      h: PHYSICS.bodyHeight,
    };
  }

  markAttackConnected(): void {
    if (this.attack) this.attack.hasConnected = true;
  }

  /** Outgoing damage for the current attack, after all multipliers. */
  outgoingDamage(): number {
    const a = this.attack;
    if (!a) return 0;
    return a.def.damage * this.stats.power * this.modifiers.damage;
  }

  /**
   * Applies an incoming hit. Returns what actually happened so the caller can
   * spawn the right effects and sounds.
   */
  receiveHit(
    rawDamage: number,
    def: AttackDef,
    fromDirection: 1 | -1,
  ): { damage: number; blocked: boolean } {
    if (this.invuln > 0 || this.state === "ko") return { damage: 0, blocked: false };

    const facingAttacker = this.facing === -fromDirection;
    const canBlock =
      this.blocking &&
      (!COMBAT.blockRequiresFacing || facingAttacker) &&
      (!COMBAT.blockRequiresGround || this.grounded);

    let damage = rawDamage / (this.stats.defense * this.modifiers.defense);
    let knockback = def.knockback;
    let stun = def.hitstunMs;

    if (canBlock) {
      damage *= COMBAT.blockDamageMultiplier * this.modifiers.blockLeak;
      knockback *= COMBAT.blockKnockbackMultiplier;
      stun *= 0.45;
      this.blockedThisFrame = true;
    } else if (!this.grounded) {
      damage *= COMBAT.airHitMultiplier;
    }

    this.health = Math.max(0, this.health - damage);
    this.invuln = COMBAT.hitInvulnMs;
    this.vx = fromDirection * knockback;
    this.flash = canBlock ? 70 : 130;

    if (this.health <= 0) {
      this.state = "ko";
      this.attack = null;
      this.blocking = false;
      this.hitstun = 0;
      this.vy = -320;
      this.grounded = false;
      this.vx = fromDirection * (knockback + 90);
    } else if (!canBlock) {
      this.state = "hit";
      this.hitstun = stun;
      this.attack = null;
      // Small pop-up on the heavy attack for extra impact.
      if (def.kind === "strong" && this.grounded) {
        this.vy = -240;
        this.grounded = false;
      }
    } else {
      this.hitstun = Math.max(this.hitstun, stun);
      this.state = "block";
    }

    return { damage, blocked: canBlock };
  }

  celebrate(): void {
    this.state = "victory";
    this.attack = null;
    this.blocking = false;
    this.hitstun = 0;
    this.animTime = 0;
  }
}
