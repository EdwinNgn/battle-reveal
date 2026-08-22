import { celestial, px, poly } from "./draw.ts";
import type { StageTheme } from "./types.ts";

/**
 * PETRA - the Treasury carved into the rose-red cliff.
 *
 * Drawn as a facade cut INTO stone rather than built on top of it: the canyon
 * wall fills the frame and the monument is a lighter recess within it, which is
 * what makes Al-Khazneh instantly recognisable. Two tiers, six columns below, the
 * broken pediment and central tholos above.
 *
 * Warm sandstone lit low and golden, with candle-lit urns on the ground.
 */

const CLIFF = "#6b3a2c";
const STONE = "#a45f42";
const STONE_LIT = "#c97b52";
const SHADOW = "#33170f";

export const PETRA: StageTheme = {
  id: "petra",
  name: "PETRA",
  palette: {
    skyTop: "#2a1424",
    skyMid: "#5a2a2c",
    skyHorizon: "#a8552f",
    glow: "rgba(255,170,80,0.34)",
    far: "#5c3226",
    mid: CLIFF,
    near: STONE,
    light: "#ffcf8a",
    lightAlt: "#fff0c9",
    floorTop: "#7a4a30",
    floorMid: "#43251a",
    floorDeep: "#1b0d09",
    floorEdge: "#ffb765",
    floorLine: "#8a5236",
  },

  drawBackdrop(ctx, time, shift, floorY) {
    // Low sun, sitting just above the canyon rim.
    celestial(ctx, 130 + shift * 0.1, 150, 26, "#ffd79a", "rgba(255,175,90,0.55)");

    // --- canyon walls framing the view ------------------------------------
    const off = shift * 0.2;
    // Left wall, irregular edge.
    poly(
      ctx,
      [
        -80, floorY, -80, 0, 150 + off, 0, 128 + off, 90, 168 + off, 210,
        140 + off, 330, 175 + off, floorY,
      ],
      CLIFF,
    );
    // Right wall.
    poly(
      ctx,
      [
        1040, floorY, 1040, 0, 800 + off, 0, 828 + off, 110, 790 + off, 250,
        822 + off, 360, 795 + off, floorY,
      ],
      CLIFF,
    );

    // --- the Treasury facade ----------------------------------------------
    const cx = 480 + shift * 0.28;
    const base = floorY;
    const w = 300;
    const x = cx - w / 2;

    // The rock face the monument is cut from, a shade darker.
    px(ctx, x - 46, base - 430, w + 92, 430, "#7c4432");

    // Recessed plane, lighter because it catches the sun.
    px(ctx, x, base - 400, w, 400, STONE);

    // --- lower tier: six columns ------------------------------------------
    const colW = 26;
    const colH = 168;
    const colY = base - colH;
    const gap = (w - colW * 6) / 7;
    for (let i = 0; i < 6; i++) {
      const colX = x + gap + i * (colW + gap);
      // Shadow behind each column reads as depth.
      px(ctx, colX - 3, colY, colW + 6, colH, SHADOW, 0.55);
      px(ctx, colX, colY, colW, colH, STONE_LIT);
      // Capital and base.
      px(ctx, colX - 4, colY - 12, colW + 8, 12, STONE_LIT);
      px(ctx, colX - 4, base - 10, colW + 8, 10, STONE_LIT);
      // Fluting.
      for (let f = 0; f < 3; f++) {
        px(ctx, colX + 5 + f * 7, colY + 6, 2, colH - 12, SHADOW, 0.3);
      }
    }

    // Dark doorway between the middle columns: the way in.
    const doorW = 58;
    px(ctx, cx - doorW / 2, base - 150, doorW, 150, "#180a06");
    // Faint warm light spilling from inside.
    ctx.save();
    ctx.globalAlpha = 0.2 + 0.06 * Math.sin(time * 1.4);
    ctx.fillStyle = "#ffb765";
    ctx.fillRect(cx - doorW / 2 + 6, base - 132, doorW - 12, 132);
    ctx.restore();

    // --- entablature ------------------------------------------------------
    px(ctx, x - 10, base - colH - 34, w + 20, 22, STONE_LIT);
    px(ctx, x - 6, base - colH - 12, w + 12, 12, STONE);

    // --- upper tier: broken pediment and central tholos -------------------
    const upY = base - colH - 34;
    // Left and right pediment halves, with the gap that defines the monument.
    poly(ctx, [x + 6, upY, x + 6, upY - 96, x + 104, upY - 96, x + 104, upY], STONE);
    poly(
      ctx,
      [x + w - 6, upY, x + w - 6, upY - 96, x + w - 104, upY - 96, x + w - 104, upY],
      STONE,
    );
    // Angled roof caps on each half.
    poly(ctx, [x + 6, upY - 96, x + 55, upY - 132, x + 104, upY - 96], STONE_LIT);
    poly(
      ctx,
      [x + w - 104, upY - 96, x + w - 55, upY - 132, x + w - 6, upY - 96],
      STONE_LIT,
    );

    // Tholos: the round pavilion in the centre.
    const tw = 74;
    px(ctx, cx - tw / 2, upY - 116, tw, 116, STONE_LIT);
    // Its own small columns.
    for (let i = 0; i < 3; i++) {
      px(ctx, cx - tw / 2 + 10 + i * 25, upY - 104, 9, 92, STONE);
    }
    // Conical cap and the urn on top.
    poly(ctx, [cx - tw / 2, upY - 116, cx, upY - 158, cx + tw / 2, upY - 116], STONE);
    px(ctx, cx - 7, upY - 176, 14, 20, STONE_LIT);
    px(ctx, cx - 4, upY - 184, 8, 9, STONE_LIT);

    // Upper columns flanking the tholos.
    for (const sx of [x + 30, x + w - 42]) {
      px(ctx, sx, upY - 92, 14, 92, STONE_LIT);
      px(ctx, sx - 3, upY - 104, 20, 12, STONE_LIT);
    }
  },

  drawForeground(ctx, time, shift, floorY) {
    // Candle-lit urns lining the approach, the way the site is lit at night.
    for (let i = 0; i < 6; i++) {
      const lx = 60 + i * 168 + shift * 0.8;
      if (lx < -30 || lx > 990) continue;
      px(ctx, lx - 7, floorY - 20, 14, 20, "#4a2618");
      px(ctx, lx - 9, floorY - 22, 18, 4, "#5c3020");
      const flick = 0.7 + 0.3 * Math.sin(time * 5 + i * 2.1);
      for (const [r, a] of [
        [14, 0.14],
        [7, 0.34],
        [3.5, 0.95],
      ] as const) {
        ctx.save();
        ctx.globalAlpha = a * flick;
        ctx.fillStyle = "#ffcf8a";
        ctx.beginPath();
        ctx.arc(lx, floorY - 26, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  },
};
