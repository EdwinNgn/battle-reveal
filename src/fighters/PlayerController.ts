import { emptyIntent, type FighterIntent } from "./Fighter.ts";

/** Logical actions the player can perform, independent of the input device. */
export type GameAction =
  | "left"
  | "right"
  | "jump"
  | "block"
  | "punch"
  | "kick"
  | "strong";

/** Anything that can report which actions are currently held. */
export interface ActionSource {
  isDown(action: GameAction): boolean;
  /** True only on the frame the action was newly pressed. */
  wasPressed(action: GameAction): boolean;
}

/**
 * Translates held/pressed actions from any number of input sources into a
 * fighter intent. Keyboard and touch are simply two sources that get OR'd
 * together, so a player can use either at any time.
 */
export class PlayerController {
  private sources: ActionSource[] = [];

  addSource(source: ActionSource): void {
    this.sources.push(source);
  }

  private down(action: GameAction): boolean {
    return this.sources.some((s) => s.isDown(action));
  }

  private pressed(action: GameAction): boolean {
    return this.sources.some((s) => s.wasPressed(action));
  }

  update(): FighterIntent {
    const intent = emptyIntent();
    intent.moveLeft = this.down("left");
    intent.moveRight = this.down("right");
    intent.jump = this.pressed("jump");
    intent.block = this.down("block");

    // Attacks are edge-triggered so holding a button does not auto-fire.
    // Heavier attacks win if two buttons land on the same frame.
    if (this.pressed("strong")) intent.attack = "strong";
    else if (this.pressed("kick")) intent.attack = "kick";
    else if (this.pressed("punch")) intent.attack = "punch";

    return intent;
  }
}
