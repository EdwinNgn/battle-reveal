/**
 * Stage themes: one fighting arena per destination.
 *
 * Every backdrop is drawn procedurally from rectangles, arcs and gradients, in
 * the same chunky style as the fighters. No image files, so the whole set costs
 * nothing to download and scales to any resolution.
 *
 * The overriding constraint is READABILITY. A busy or bright backdrop makes the
 * fighters hard to follow, which matters more than any landmark being pretty. So
 * every theme keeps its silhouettes low-contrast against the sky, holds detail
 * above the action line, and finishes with a dark floor.
 */

export type StageId =
  | "lille"
  | "petra"
  | "indonesia"
  | "thailand"
  | "mauritius"
  | "newyork"
  | "australia"
  | "singapore";

export interface StagePalette {
  /** Sky gradient, top to horizon. */
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  /** Warm or cool haze sitting on the horizon. */
  glow: string;
  /** Silhouette fills, furthest layer first. */
  far: string;
  mid: string;
  near: string;
  /** Lit windows, lanterns, stars. */
  light: string;
  lightAlt: string;
  /** Ground. */
  floorTop: string;
  floorMid: string;
  floorDeep: string;
  /** The bright line where the floor meets the backdrop. */
  floorEdge: string;
  floorLine: string;
}

export interface StageTheme {
  id: StageId;
  /** Shown briefly at the start of the fight. Not translated: place names. */
  name: string;
  palette: StagePalette;
  /**
   * Draws everything behind the fighters, excluding sky and floor.
   *
   * @param ctx    canvas, already in virtual 960x540 space
   * @param time   seconds since the stage appeared, for animation
   * @param shift  parallax offset in pixels, driven by the camera
   * @param floorY y coordinate of the arena floor
   */
  drawBackdrop(
    ctx: CanvasRenderingContext2D,
    time: number,
    shift: number,
    floorY: number,
  ): void;
  /** Optional foreground touches drawn over the floor but behind the fighters. */
  drawForeground?(
    ctx: CanvasRenderingContext2D,
    time: number,
    shift: number,
    floorY: number,
  ): void;
  /** Stars are only appropriate on the night stages. */
  stars?: boolean;
}
