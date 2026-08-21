/**
 * ============================================================================
 *  ORGANIZER CONFIGURATION
 * ============================================================================
 *
 *  CHANGE BABY_GENDER BEFORE DEPLOYING THE GAME.
 *
 *  This single value decides which fighter is guaranteed to win the final
 *  match. Set it, run `npm run build`, deploy the `dist/` folder, and don't
 *  open this file in front of the guests.
 *
 *      "girl"  ->  the female fighter always ends up winning  ->  IT'S A GIRL!
 *      "boy"   ->  the male fighter always ends up winning    ->  IT'S A BOY!
 *
 *  That is the only line you need to touch. Everything below is derived.
 * ============================================================================
 *
 *  A note on why this file looks slightly convoluted:
 *
 *  `BABY_GENDER` is deliberately NOT exported. If it were, the bundler would
 *  keep the literal string "girl" (or "boy") in the shipped JavaScript, and
 *  anyone who opened the bundle and searched for it would have their answer.
 *  Because it is a module-local constant used only in the comparison below,
 *  the build folds it into a number and the word disappears from the output
 *  entirely. The rest of the app works from `WINNER_CODE`, which reveals
 *  nothing on its own.
 *
 *  This defeats a casual look at the source, which is the realistic risk at a
 *  party. It is obfuscation, not encryption, so don't hand your unlocked
 *  laptop to the nosiest guest in the room.
 * ============================================================================
 */

export type BabyGender = "boy" | "girl";
export type FighterId = "male" | "female";

// ⬇⬇⬇  THE ONE LINE TO CHANGE  ⬇⬇⬇
const BABY_GENDER = "girl" as BabyGender;
// ⬆⬆⬆  THE ONE LINE TO CHANGE  ⬆⬆⬆

/**
 * Opaque selector used everywhere else in the codebase.
 * 2 = the female fighter must win, 1 = the male fighter must win.
 */
export const WINNER_CODE: 1 | 2 = BABY_GENDER === "girl" ? 2 : 1;

/** Derived automatically. Do not edit. */
export const WINNING_FIGHTER: FighterId = WINNER_CODE === 2 ? "female" : "male";

/** Derived automatically. Do not edit. */
export const LOSING_FIGHTER: FighterId = WINNER_CODE === 2 ? "male" : "female";
