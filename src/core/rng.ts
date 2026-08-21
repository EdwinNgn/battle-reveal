/**
 * Small deterministic RNG (mulberry32).
 *
 * A seedable generator keeps the headless simulations reproducible, which is
 * what makes the outcome tests in `src/dev` meaningful. In the real game the
 * seed comes from `Date.now()`, so every match plays differently.
 */
export class Rng {
  private state: number;

  constructor(seed: number = Date.now() >>> 0) {
    this.state = seed >>> 0;
    // Avoid the degenerate all-zero state.
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with the given probability (0..1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /**
   * Picks a key from a weight table. Weights do not need to sum to 1.
   * Returns the first key if every weight is zero.
   */
  weighted<K extends string>(weights: Record<K, number>): K {
    const keys = Object.keys(weights) as K[];
    let total = 0;
    for (const k of keys) total += Math.max(0, weights[k]);
    if (total <= 0) return keys[0];
    let roll = this.next() * total;
    for (const k of keys) {
      roll -= Math.max(0, weights[k]);
      if (roll <= 0) return k;
    }
    return keys[keys.length - 1];
  }
}
