/**
 * Generates the app icon as a PNG, with no image libraries.
 *
 *   node scripts/genIcon.mjs
 *
 * iOS ignores SVG icons for "Add to Home Screen", so a real raster file is
 * required for the game to launch fullscreen from the home screen. Rather than
 * add a dependency or commit a binary blob nobody can regenerate, this encodes
 * the PNG by hand: raw RGBA rows, zlib-deflated, wrapped in the three chunks a
 * valid PNG needs (IHDR, IDAT, IEND).
 *
 * The artwork matches the game: dark neon background, two fighter silhouettes in
 * their team colours, drawn with the same chunky pixel feel.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const SIZE = 512;

// --- palette, matching src/rendering/palette.ts -----------------------------
const BG_DEEP = [10, 7, 20];
const BG_MID = [29, 18, 64];
const PINK = [255, 61, 129];
const BLUE = [61, 139, 255];
const CYAN = [61, 240, 255];
const YELLOW = [255, 210, 61];
const WHITE = [253, 247, 255];

/** RGBA canvas as a flat array. */
const px = new Uint8Array(SIZE * SIZE * 4);

function set(x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  // Simple source-over blend so glows can be layered.
  const sa = a / 255;
  px[i] = Math.round(px[i] * (1 - sa) + r * sa);
  px[i + 1] = Math.round(px[i + 1] * (1 - sa) + g * sa);
  px[i + 2] = Math.round(px[i + 2] * (1 - sa) + b * sa);
  px[i + 3] = 255;
}

function rect(x, y, w, h, color, a = 255) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, color, a);
}

// --- background: radial glow from the centre --------------------------------
const cx = SIZE / 2;
const cy = SIZE / 2;
const maxD = Math.hypot(cx, cy);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const d = Math.hypot(x - cx, y - cy) / maxD;
    const t = Math.min(1, d * 1.15);
    const c = [
      Math.round(BG_MID[0] * (1 - t) + BG_DEEP[0] * t),
      Math.round(BG_MID[1] * (1 - t) + BG_DEEP[1] * t),
      Math.round(BG_MID[2] * (1 - t) + BG_DEEP[2] * t),
    ];
    set(x, y, c);
  }
}

// --- neon frame -------------------------------------------------------------
const M = 26;
const BW = 10;
rect(M, M, SIZE - M * 2, BW, PINK);
rect(M, SIZE - M - BW, SIZE - M * 2, BW, PINK);
rect(M, M, BW, SIZE - M * 2, CYAN);
rect(SIZE - M - BW, M, BW, SIZE - M * 2, CYAN);
// Soft outer glow.
for (let g = 1; g <= 10; g++) {
  const a = 26 - g * 2;
  rect(M - g, M - g, SIZE - (M - g) * 2, 1, PINK, a);
  rect(M - g, SIZE - M + g, SIZE - (M - g) * 2, 1, PINK, a);
}

/**
 * Draws a compact fighter silhouette: head, torso, arms, legs, in the chunky
 * block style the in-game sprites use.
 */
function fighter(baseX, baseY, scale, colors, facing) {
  const u = scale;
  const [primary, secondary, skin, hair] = colors;

  // Legs, angled outwards for a planted stance.
  for (let i = 0; i < 7; i++) {
    rect(baseX - u * 2 - i * u * 0.4 * facing, baseY - i * u, u * 1.8, u * 1.2, secondary);
    rect(baseX + u * 1 + i * u * 0.3 * facing, baseY - i * u, u * 1.8, u * 1.2, secondary);
  }
  // Torso.
  rect(baseX - u * 3, baseY - u * 15, u * 6.5, u * 8, primary);
  // Chest highlight.
  rect(baseX - u * 2, baseY - u * 13.5, u * 4.5, u * 1.2, colors[4] ?? WHITE);
  // Shoulders.
  rect(baseX - u * 4, baseY - u * 15, u * 2, u * 2.6, secondary);
  rect(baseX + u * 2.5, baseY - u * 15, u * 2, u * 2.6, secondary);
  // Punching arm, extended forward.
  for (let i = 0; i < 6; i++) {
    rect(baseX + facing * (u * 3 + i * u * 1.5), baseY - u * 14 + i * u * 0.2, u * 1.7, u * 1.7, skin);
  }
  // Glove at the end.
  rect(baseX + facing * (u * 3 + 6 * u * 1.5), baseY - u * 13, u * 2.4, u * 2.4, primary);
  // Rear arm, tucked.
  for (let i = 0; i < 3; i++) {
    rect(baseX - facing * (u * 3 + i * u), baseY - u * 13 + i * u, u * 1.6, u * 1.6, skin);
  }
  // Head.
  rect(baseX - u * 2.2, baseY - u * 21, u * 4.6, u * 5, skin);
  // Hair.
  rect(baseX - u * 2.4, baseY - u * 22.2, u * 5, u * 1.8, hair);
  // Headband in the accent colour.
  rect(baseX - u * 2.4, baseY - u * 19.4, u * 5, u * 1.1, YELLOW);
}

// Two fighters facing each other.
const groundY = SIZE - 128;
fighter(cx - 104, groundY, 7.0, [BLUE, [28, 79, 184], [232, 176, 136], [43, 27, 20], CYAN], 1);
fighter(cx + 104, groundY, 7.0, [PINK, [184, 28, 90], [240, 187, 150], [74, 16, 48], [255, 158, 196]], -1);

// --- clash spark between them ----------------------------------------------
const sparkY = groundY - 96;
for (let r = 0; r < 34; r++) {
  const a = Math.max(0, 200 - r * 6);
  for (let ang = 0; ang < 360; ang += 6) {
    const rad = (ang * Math.PI) / 180;
    set(Math.round(cx + Math.cos(rad) * r), Math.round(sparkY + Math.sin(rad) * r * 0.7), YELLOW, a * 0.35);
  }
}
// Spiky star.
for (let i = 0; i < 8; i++) {
  const rad = (i * Math.PI) / 4;
  for (let d = 0; d < 52; d++) {
    const w = Math.max(1, 5 - Math.floor(d / 12));
    rect(
      Math.round(cx + Math.cos(rad) * d - w / 2),
      Math.round(sparkY + Math.sin(rad) * d * 0.75 - w / 2),
      w,
      w,
      d < 22 ? WHITE : YELLOW,
      255 - d * 3,
    );
  }
}

// --- "VS" mark at the top ---------------------------------------------------
function glyphV(x, y, s, color) {
  for (let i = 0; i < 6; i++) {
    rect(x + i * s * 0.5, y + i * s, s, s, color);
    rect(x + s * 5 - i * s * 0.5, y + i * s, s, s, color);
  }
  rect(x + s * 2.2, y + s * 6, s * 1.6, s, color);
}
function glyphS(x, y, s, color) {
  rect(x, y, s * 5, s, color);
  rect(x, y + s, s, s * 2, color);
  rect(x, y + s * 3, s * 5, s, color);
  rect(x + s * 4, y + s * 4, s, s * 2, color);
  rect(x, y + s * 6, s * 5, s, color);
}
const gs = 11;
glyphV(cx - gs * 6, 76, gs, WHITE);
glyphS(cx + gs * 1.5, 76, gs, WHITE);

// --- encode as PNG ----------------------------------------------------------

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// IHDR: width, height, bit depth 8, colour type 6 (RGBA).
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;

// Each scanline is prefixed with a filter byte (0 = none).
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (SIZE * 4 + 1);
  raw[rowStart] = 0;
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, rowStart + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync("public", { recursive: true });
writeFileSync("public/icon-512.png", png);
console.log(`public/icon-512.png written, ${(png.length / 1024).toFixed(1)} kB`);
