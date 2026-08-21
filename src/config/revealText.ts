import { WINNER_CODE } from "./secretConfig.ts";
import { getLang, type Lang } from "../i18n/strings.ts";

/**
 * Obfuscated reveal copy, in every language and for both outcomes.
 *
 * Why this exists: the bundler is very good at its job. When the reveal strings
 * were written as a plain `BABY_GENDER === "girl" ? "IT'S A GIRL!" : ...` it
 * folded the constant and dropped the unused branch, so the shipped JavaScript
 * contained exactly one of the two headlines. Anyone who opened the bundle and
 * searched for "IT'S A" or "C'EST" would have had their answer.
 *
 * So every variant is stored XOR-encoded and decoded at runtime. No headline
 * appears as readable text anywhere in the build, all four are always present,
 * and the lookup is indexed at runtime so nothing can be tree-shaken away.
 *
 * This is obfuscation, not security. It defeats a casual look at the bundle,
 * which is the real risk at a party. Someone determined with the dev tools open
 * could still work it out, so the honest advice is not to hand your unlocked
 * laptop to the nosiest guest in the room.
 *
 * To change the wording, edit scripts/genRevealPayloads.mjs and re-run it; the
 * plain text lives there, in a file that never reaches the bundle.
 */

const KEY = 0x5a;

/** Decodes a byte array that was XOR'd with KEY. */
function decode(bytes: readonly number[]): string {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b ^ KEY);
  return out;
}

interface Payload {
  headline: number[];
  icon: number[];
  label: number[];
}

/**
 * Index 1 = boy, index 2 = girl, matching WINNER_CODE. Slot 0 is unused so the
 * indices line up directly.
 */
const PAYLOADS: Record<Lang, Payload[]> = {
  fr: [
    { headline: [], icon: [], label: [] },
    {
      headline: [25, 125, 31, 9, 14, 122, 15, 20, 122, 29, 27, 8, 157, 21, 20, 122, 123],
      icon: [55399, 56515],
      label: [29, 27, 8, 157, 21, 20],
    },
    {
      headline: [25, 125, 31, 9, 14, 122, 15, 20, 31, 122, 28, 19, 22, 22, 31, 122, 123],
      icon: [55398, 57306],
      label: [28, 19, 22, 22, 31],
    },
  ],
  en: [
    { headline: [], icon: [], label: [] },
    {
      headline: [19, 14, 125, 9, 122, 27, 122, 24, 21, 3, 123],
      icon: [55399, 56515],
      label: [24, 21, 3],
    },
    {
      headline: [19, 14, 125, 9, 122, 27, 122, 29, 19, 8, 22, 123],
      icon: [55398, 57306],
      label: [29, 19, 8, 22],
    },
  ],
};

/**
 * Resolved at call time rather than at module load, so switching language on the
 * settings screen takes effect immediately, and so the lookup cannot be folded
 * away by the bundler.
 */
function active(): Payload {
  return PAYLOADS[getLang()][Number(WINNER_CODE)];
}

/** The celebratory announcement line. */
export function revealHeadline(): string {
  return decode(active().headline);
}

/** The emoji shown above the headline. */
export function revealIcon(): string {
  return decode(active().icon);
}

/** Short word form, used by the dev tools only. */
export function revealLabel(): string {
  return decode(active().label);
}
