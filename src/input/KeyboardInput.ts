import type { ActionSource, GameAction } from "../fighters/PlayerController.ts";

/**
 * Keyboard input.
 *
 * ---------------------------------------------------------------------------
 *  A note on keyboard layouts, because this is easy to get wrong.
 * ---------------------------------------------------------------------------
 *  `event.code` identifies a key by its PHYSICAL POSITION, using QWERTY names.
 *  On an AZERTY keyboard the key printed "Q" reports `code === "KeyA"`, because
 *  it sits where QWERTY has A. Mapping on `code` therefore breaks the moment
 *  somebody plays on a different layout, which at a party is likely.
 *
 *  So letters are matched on `event.key`, which is the CHARACTER the key
 *  actually produces. "Q" then means the key printed Q on every layout, which
 *  is what the on-screen controls promise.
 *
 *  Non-character keys (arrows, space, shift) have stable `code` values and no
 *  layout ambiguity, so those are matched on `code`.
 * ---------------------------------------------------------------------------
 */

/**
 * Letters, matched against the produced character (layout independent).
 *
 * PRIMARY SCHEME
 *   right hand on the arrows, left hand flat on the home row:
 *
 *     S  punch      D  kick      F  strong
 *
 *   S, D and F were chosen deliberately: they are three adjacent keys, they sit
 *   in the SAME physical position on AZERTY and QWERTY (only Q/A and W/Z swap
 *   between those layouts), and the damage rises left to right. Block lives on
 *   the space bar, under the left thumb, so it can be held while attacking.
 *
 * FALLBACKS
 *   The older WASD / JKL habits keep working, so nobody who guesses is stuck.
 *   Where a letter is claimed by the primary scheme it is NOT reused as a
 *   fallback - S means punch, never "move down".
 */
const LETTER_MAP: Record<string, GameAction> = {
  // --- primary ---
  S: "punch",
  D: "kick",
  F: "strong",

  // --- fallbacks: movement ---
  A: "left", // QWERTY's WASD-left, and AZERTY's Q position
  Q: "left", // AZERTY's printed Q, left of Z on that layout
  W: "jump", // QWERTY WASD-up
  Z: "jump", // AZERTY ZQSD-up
  // Note: "right" has no letter fallback. On QWERTY that would be D, which is
  // already kick here. The arrow keys cover movement, and A/Q plus the arrows
  // are enough for anyone reaching for a familiar key.

  // --- fallbacks: attacks ---
  J: "punch",
  K: "kick",
  L: "strong",
  X: "kick",
  C: "strong",
};

/** Non-character keys, matched on physical code. */
const CODE_MAP: Record<string, GameAction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "jump",
  ArrowDown: "block",
  // Block on the space bar: easy to hold under the thumb while the fingers
  // attack, and impossible to miss.
  Space: "block",
  ShiftLeft: "block",
  ShiftRight: "block",
};

/** Codes we swallow so the page never scrolls mid-fight. */
const SWALLOW_CODES = new Set([
  ...Object.keys(CODE_MAP),
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

export class KeyboardInput implements ActionSource {
  private held = new Set<GameAction>();
  private pressedThisFrame = new Set<GameAction>();
  /** Physical codes currently down, used to ignore OS auto-repeat. */
  private rawDown = new Set<string>();
  /** code -> action resolved at keydown, so keyup releases the right thing. */
  private activeByCode = new Map<string, GameAction>();

  /** Fires on any key, used to unlock audio and to drive menus. */
  onAnyKey: ((code: string) => void) | null = null;

  attach(target: Window = window): void {
    target.addEventListener("keydown", this.handleDown, { passive: false });
    target.addEventListener("keyup", this.handleUp);
    target.addEventListener("blur", this.handleBlur);
  }

  detach(target: Window = window): void {
    target.removeEventListener("keydown", this.handleDown);
    target.removeEventListener("keyup", this.handleUp);
    target.removeEventListener("blur", this.handleBlur);
  }

  /** Resolves an event to a game action, letters first then physical keys. */
  private resolve(e: KeyboardEvent): GameAction | undefined {
    const letter = e.key.length === 1 ? e.key.toUpperCase() : "";
    if (letter && LETTER_MAP[letter]) return LETTER_MAP[letter];
    return CODE_MAP[e.code];
  }

  private handleDown = (e: KeyboardEvent): void => {
    if (SWALLOW_CODES.has(e.code)) e.preventDefault();

    // Ignore auto-repeat so attacks stay edge-triggered.
    if (e.repeat || this.rawDown.has(e.code)) {
      this.onAnyKey?.(e.code);
      return;
    }
    this.rawDown.add(e.code);

    const action = this.resolve(e);
    if (action) {
      this.activeByCode.set(e.code, action);
      this.held.add(action);
      this.pressedThisFrame.add(action);
    }
    this.onAnyKey?.(e.code);
  };

  private handleUp = (e: KeyboardEvent): void => {
    this.rawDown.delete(e.code);
    const action = this.activeByCode.get(e.code);
    if (!action) return;
    this.activeByCode.delete(e.code);
    // Only release if no other held key maps to the same action.
    if (![...this.activeByCode.values()].includes(action)) {
      this.held.delete(action);
    }
  };

  /** Losing focus must not leave a fighter walking forever. */
  private handleBlur = (): void => {
    this.held.clear();
    this.rawDown.clear();
    this.activeByCode.clear();
    this.pressedThisFrame.clear();
  };

  isDown(action: GameAction): boolean {
    return this.held.has(action);
  }

  wasPressed(action: GameAction): boolean {
    return this.pressedThisFrame.has(action);
  }

  /** Called at the end of every frame to clear edge state. */
  endFrame(): void {
    this.pressedThisFrame.clear();
  }
}
