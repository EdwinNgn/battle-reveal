import { VIEW } from "../config/gameConfig.ts";

/**
 * Owns the canvas, the device-pixel scaling and the letterboxing.
 *
 * The game is authored at a fixed 960x540 virtual resolution and scaled to fit
 * whatever viewport is available, preserving aspect ratio so fighters are never
 * stretched. Everything drawn by the rest of the code works in virtual pixels.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  /** Current scale factor from virtual to CSS pixels. */
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private dpr = 1;

  /** Screen shake, applied around the whole scene. */
  private shakeMag = 0;
  private shakeTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("orientationchange", this.resize);
  }

  resize = (): void => {
    // Cap DPR: past 2x the cost outweighs any visible gain on this art style.
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    const availW = window.innerWidth;
    const availH = window.innerHeight;
    const targetRatio = VIEW.width / VIEW.height;
    const availRatio = availW / availH;

    let cssW: number;
    let cssH: number;
    if (availRatio > targetRatio) {
      // Wider than needed: letterbox on the sides.
      cssH = availH;
      cssW = cssH * targetRatio;
    } else {
      cssW = availW;
      cssH = cssW / targetRatio;
    }

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);

    this.scale = cssW / VIEW.width;
    this.offsetX = (availW - cssW) / 2;
    this.offsetY = (availH - cssH) / 2;

    // Nearest-neighbour keeps the pixel-art crisp when scaled up.
    this.ctx.imageSmoothingEnabled = false;
  };

  /** Converts a viewport (client) coordinate into virtual game space. */
  toVirtual(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW.width,
      y: ((clientY - rect.top) / rect.height) * VIEW.height,
    };
  }

  addShake(magnitude: number): void {
    this.shakeMag = Math.min(30, Math.max(this.shakeMag, magnitude));
  }

  /** Call once per frame before drawing. */
  updateShake(dt: number): void {
    this.shakeTime += dt;
    if (this.shakeMag > 0) {
      this.shakeMag = Math.max(0, this.shakeMag - dt * 42);
    }
  }

  /** Begins a frame: clears and applies the virtual transform plus shake. */
  begin(): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, 0, 0);

    if (this.shakeMag > 0.2) {
      // Decaying oscillation rather than pure noise, which reads as impact
      // rather than as a glitch.
      const decay = this.shakeMag;
      const dx = Math.sin(this.shakeTime * 78) * decay;
      const dy = Math.cos(this.shakeTime * 61) * decay * 0.7;
      ctx.translate(dx, dy);
    }

    ctx.imageSmoothingEnabled = false;
  }

  get viewOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }
}
