import type { ActionSource, GameAction } from "../fighters/PlayerController.ts";

/**
 * On-screen controls for phones and tablets.
 *
 * Implemented as DOM buttons layered over the canvas rather than drawn into it,
 * which gives correct multi-touch behaviour and lets CSS handle the sizing for
 * different screens. Movement lives on the left, attacks on the right.
 *
 * Pointer events are used throughout, with touch-action disabled so dragging a
 * thumb never scrolls or zooms the page.
 */

interface ButtonSpec {
  action: GameAction;
  label: string;
  cls: string;
}

const LEFT_BUTTONS: ButtonSpec[] = [
  { action: "left", label: "◀", cls: "tb-left" },
  { action: "right", label: "▶", cls: "tb-right" },
  { action: "jump", label: "JUMP", cls: "tb-jump" },
];

const RIGHT_BUTTONS: ButtonSpec[] = [
  { action: "punch", label: "PUNCH", cls: "tb-punch" },
  { action: "kick", label: "KICK", cls: "tb-kick" },
  { action: "strong", label: "STRONG", cls: "tb-strong" },
  { action: "block", label: "BLOCK", cls: "tb-block" },
];

export class TouchInput implements ActionSource {
  private held = new Set<GameAction>();
  private pressedThisFrame = new Set<GameAction>();
  /** Maps a pointer id to the action it is currently holding. */
  private pointers = new Map<number, GameAction>();
  private root: HTMLElement;
  private buttons: HTMLElement[] = [];
  private visible = false;

  onFirstTouch: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.build();
  }

  private build(): void {
    const left = document.createElement("div");
    left.className = "touch-cluster touch-left";
    const right = document.createElement("div");
    right.className = "touch-cluster touch-right";

    for (const spec of LEFT_BUTTONS) this.makeButton(spec, left);
    for (const spec of RIGHT_BUTTONS) this.makeButton(spec, right);

    this.root.appendChild(left);
    this.root.appendChild(right);
    this.setVisible(false);
  }

  private makeButton(spec: ButtonSpec, parent: HTMLElement): void {
    const el = document.createElement("button");
    el.className = `touch-btn ${spec.cls}`;
    el.textContent = spec.label;
    el.setAttribute("aria-label", spec.action);
    // Keep the on-screen pad out of the tab order; it is for touch only.
    el.tabIndex = -1;

    const press = (e: PointerEvent): void => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, spec.action);
      this.held.add(spec.action);
      this.pressedThisFrame.add(spec.action);
      el.classList.add("is-active");
      this.onFirstTouch?.();
    };

    const release = (e: PointerEvent): void => {
      e.preventDefault();
      this.pointers.delete(e.pointerId);
      // Only clear if no other finger is holding the same action.
      if (![...this.pointers.values()].includes(spec.action)) {
        this.held.delete(spec.action);
      }
      el.classList.remove("is-active");
    };

    el.addEventListener("pointerdown", press);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    // Sliding a thumb off a button should release it.
    el.addEventListener("pointerleave", (e) => {
      if (this.pointers.has(e.pointerId)) release(e);
    });
    // Belt and braces against long-press menus and double-tap zoom.
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });

    parent.appendChild(el);
    this.buttons.push(el);
  }

  /** Shown only during a fight, and only on touch-capable devices. */
  setVisible(on: boolean): void {
    if (this.visible === on) return;
    this.visible = on;
    this.root.classList.toggle("touch-visible", on);
    if (!on) {
      this.held.clear();
      this.pointers.clear();
      for (const b of this.buttons) b.classList.remove("is-active");
    }
  }

  isDown(action: GameAction): boolean {
    return this.held.has(action);
  }

  wasPressed(action: GameAction): boolean {
    return this.pressedThisFrame.has(action);
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
  }
}

/** Heuristic for whether to show the on-screen pad at all. */
export function isTouchDevice(): boolean {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}
