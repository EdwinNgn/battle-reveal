import { VIEW } from "../config/gameConfig.ts";
import { Rng } from "../core/rng.ts";

type ParticleKind = "spark" | "confetti" | "ring" | "star";

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  spin: number;
  angle: number;
  gravity: number;
}

/**
 * One pooled particle system covering hit sparks, confetti and shockwave rings.
 * Deliberately allocation-light: dead particles are recycled in place.
 */
export class ParticleSystem {
  private pool: Particle[] = [];
  private rng = new Rng();

  clear(): void {
    this.pool.length = 0;
  }

  private spawn(p: Particle): void {
    // Cap so a long celebration cannot grow without bound.
    if (this.pool.length > 900) {
      const dead = this.pool.findIndex((q) => q.life <= 0);
      if (dead >= 0) {
        this.pool[dead] = p;
        return;
      }
      return;
    }
    this.pool.push(p);
  }

  /** Impact sparks radiating from a hit. */
  burst(x: number, y: number, count: number, colors: readonly string[]): void {
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(60, 420);
      this.spawn({
        kind: "spark",
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 60,
        life: this.rng.range(0.22, 0.55),
        maxLife: 0.55,
        size: this.rng.range(2, 6),
        color: this.rng.pick(colors),
        spin: 0,
        angle: 0,
        gravity: 900,
      });
    }
  }

  /** Expanding shockwave ring, used on the heavy attack and on the KO. */
  ring(x: number, y: number, color: string, size = 90): void {
    this.spawn({
      kind: "ring",
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.34,
      maxLife: 0.34,
      size,
      color,
      spin: 0,
      angle: 0,
      gravity: 0,
    });
  }

  /** Celebration confetti raining from above. */
  confetti(count: number, colors: readonly string[]): void {
    for (let i = 0; i < count; i++) {
      this.spawn({
        kind: "confetti",
        x: this.rng.range(-40, VIEW.width + 40),
        y: this.rng.range(-VIEW.height, -10),
        vx: this.rng.range(-70, 70),
        vy: this.rng.range(70, 230),
        life: this.rng.range(2.6, 5.2),
        maxLife: 5.2,
        size: this.rng.range(5, 12),
        color: this.rng.pick(colors),
        spin: this.rng.range(-9, 9),
        angle: this.rng.range(0, Math.PI * 2),
        gravity: 30,
      });
    }
  }

  /** A firework shell bursting at a point. */
  firework(x: number, y: number, colors: readonly string[]): void {
    const color = this.rng.pick(colors);
    const count = 34;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.rng.range(-0.1, 0.1);
      const speed = this.rng.range(150, 330);
      this.spawn({
        kind: "star",
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: this.rng.range(0.7, 1.4),
        maxLife: 1.4,
        size: this.rng.range(3, 7),
        color,
        spin: 0,
        angle: 0,
        gravity: 180,
      });
    }
    this.ring(x, y, color, 60);
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.angle += p.spin * dt;
      if (p.kind === "confetti") {
        // Gentle flutter.
        p.vx += Math.sin(p.angle * 2) * 24 * dt;
        p.vx *= 0.995;
      } else if (p.kind === "spark" || p.kind === "star") {
        p.vx *= 0.94;
        p.vy *= 0.96;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      const t = Math.max(0, p.life / p.maxLife);

      if (p.kind === "ring") {
        const grow = 1 - t;
        ctx.save();
        ctx.globalAlpha = t * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 + t * 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * grow, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.fillStyle = p.color;

      if (p.kind === "confetti") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.kind === "star") {
        ctx.globalCompositeOperation = "lighter";
        const s = p.size * (0.5 + t);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else {
        const s = p.size * (0.4 + t * 0.9);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.restore();
    }
  }
}
