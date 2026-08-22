import { Rng } from "../../core/rng.ts";
import { AUSTRALIA } from "./australia.ts";
import { INDONESIA } from "./indonesia.ts";
import { LILLE } from "./lille.ts";
import { MAURITIUS } from "./mauritius.ts";
import { NEWYORK } from "./newyork.ts";
import { PETRA } from "./petra.ts";
import { SINGAPORE } from "./singapore.ts";
import { THAILAND } from "./thailand.ts";
import type { StageId, StageTheme } from "./types.ts";

export type { StageId, StageTheme, StagePalette } from "./types.ts";

/**
 * The travel stages, in the order they were visited.
 *
 * LILLE is the home stage and always comes first: it is what shows behind the
 * menus and in the opening fight. The remaining seven are shuffled, so the order
 * differs every session while still covering every destination.
 */
export const LILLE_STAGE = LILLE;

export const TRAVEL_STAGES: readonly StageTheme[] = [
  PETRA,
  INDONESIA,
  THAILAND,
  MAURITIUS,
  NEWYORK,
  AUSTRALIA,
  SINGAPORE,
];

export const ALL_STAGES: readonly StageTheme[] = [LILLE, ...TRAVEL_STAGES];

export function stageById(id: StageId): StageTheme {
  return ALL_STAGES.find((s) => s.id === id) ?? LILLE;
}

/**
 * Deals out stages for a session so that no backdrop repeats until the whole set
 * has been used.
 *
 * The first fight is always Lille - home turf, and the stage the audience has
 * already seen behind the menus. After that the seven travel stages are shuffled
 * and handed out one per fight. With eight fights that means every destination
 * appears exactly once, which is what makes a full party feel like a tour.
 *
 * Beyond eight fights the deck reshuffles and starts again (excluding Lille, so
 * the second lap stays varied). Fewer than eight and you simply see a random
 * subset, different every session.
 */
export class StageRotation {
  private deck: StageTheme[] = [];
  private rng: Rng;
  private dealt = 0;

  constructor(seed?: number) {
    this.rng = new Rng(seed);
    this.reset();
  }

  reset(seed?: number): void {
    if (seed !== undefined) this.rng = new Rng(seed);
    this.dealt = 0;
    this.deck = this.shuffledTravel();
  }

  private shuffledTravel(): StageTheme[] {
    const out = [...TRAVEL_STAGES];
    // Fisher-Yates, so every ordering is equally likely.
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** The stage for the next fight. */
  next(): StageTheme {
    // Fight 1 is always home.
    if (this.dealt === 0) {
      this.dealt++;
      return LILLE;
    }
    if (this.deck.length === 0) this.deck = this.shuffledTravel();
    this.dealt++;
    return this.deck.shift() ?? LILLE;
  }

  /** How many fights have been dealt a stage so far. */
  get count(): number {
    return this.dealt;
  }
}
