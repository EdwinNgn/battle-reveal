import { FIGHTER_FLAVOR, VIEW } from "../config/gameConfig.ts";
import type { FighterId } from "../config/secretConfig.ts";
import { Fighter } from "../fighters/Fighter.ts";
import { FIGHTER_COLORS, PALETTE } from "../rendering/palette.ts";
import { drawFighter } from "../rendering/FighterSprite.ts";
import { drawText } from "../rendering/text.ts";
import { t as tr, getLang, otherFlag, otherLangName } from "../i18n/strings.ts";
import type { GameState } from "../game/GameState.ts";
import { drawPanel, rowLayout, type Button } from "./widgets.ts";

/**
 * Screen painters and their button layouts.
 *
 * Each screen exposes a `layout` function returning its buttons (so input and
 * drawing agree by construction) and a `draw` function for the decoration.
 * The Game class owns focus, hover and click dispatch.
 */

// ------------------------------------------------------------------ title ----

export function titleButtons(): Button[] {
  const [play, settings] = rowLayout(2, 392, 260, 68, 36);
  return [
    { id: "play", label: tr().play, ...play, color: PALETTE.neonPink },
    { id: "settings", label: tr().settings, ...settings, color: PALETTE.neonCyan },
    // Flag shortcut in the corner, so the language can be set without going
    // into the options at all.
    {
      id: "language",
      label: otherFlag(),
      x: VIEW.width - 92,
      y: 24,
      w: 68,
      h: 52,
      color: PALETTE.neonYellow,
    },
  ];
}

export function drawTitle(ctx: CanvasRenderingContext2D, time: number): void {
  const cx = VIEW.width / 2;

  // Big stacked logo with a pulsing glow.
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
  const bob = Math.sin(time * 1.6) * 4;

  drawText(ctx, "BABY", cx, 140 + bob, {
    size: 116,
    color: PALETTE.neonYellow,
    glow: PALETTE.neonPink,
    glowSize: 26 + pulse * 22,
    depth: 7,
    strokeWidth: 9,
    letterSpacing: 10,
  });
  drawText(ctx, "BATTLE", cx, 244 + bob, {
    size: 128,
    color: PALETTE.neonPink,
    glow: PALETTE.neonPurple,
    glowSize: 28 + pulse * 24,
    depth: 7,
    strokeWidth: 9,
    letterSpacing: 8,
  });

  // Subtitle on a neon rule.
  ctx.save();
  ctx.strokeStyle = PALETTE.neonCyan;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(cx - 250, 306);
  ctx.lineTo(cx + 250, 306);
  ctx.stroke();
  ctx.restore();

  drawText(ctx, tr().titleSub, cx, 332, {
    size: 30,
    color: PALETTE.neonCyan,
    glow: PALETTE.neonCyan,
    glowSize: 12,
    depth: 2,
    letterSpacing: 5,
  });

  drawText(ctx, tr().titleHint, cx, 490, {
    size: 19,
    color: "#b9a6e0",
    stroke: null,
    letterSpacing: 1.5,
    alpha: 0.75 + pulse * 0.25,
  });

  drawText(ctx, tr().credit, cx, 520, {
    size: 14,
    color: PALETTE.neonYellow,
    stroke: null,
    letterSpacing: 3,
    alpha: 0.5,
  });
}

// --------------------------------------------------------------- settings ----

export function settingsButtons(state: GameState, music: boolean, sfx: boolean): Button[] {
  const w = 420;
  const x = (VIEW.width - w) / 2;
  return [
    {
      id: "music",
      label: `${tr().music}: ${music ? tr().on : tr().off}`,
      x,
      y: 152,
      w,
      h: 54,
      color: PALETTE.neonCyan,
    },
    {
      id: "sfx",
      label: `${tr().sfx}: ${sfx ? tr().on : tr().off}`,
      x,
      y: 214,
      w,
      h: 54,
      color: PALETTE.neonCyan,
    },
    {
      id: "rounds",
      label: `${tr().rounds}: ${tr().bestOf} ${state.roundMode}`,
      x,
      y: 276,
      w,
      h: 54,
      color: PALETTE.neonPurple,
    },
    {
      // Shows the flag of the language you would switch TO, which is the
      // clearest signal on a button that is itself in the current language.
      id: "language",
      label: `${otherFlag()}  ${otherLangName()}`,
      x,
      y: 338,
      w,
      h: 58,
      color: PALETTE.neonYellow,
    },
    {
      id: "back",
      label: tr().back,
      x,
      y: 412,
      w,
      h: 54,
      color: PALETTE.neonPink,
    },
  ];
}

export function drawSettings(ctx: CanvasRenderingContext2D): void {
  drawPanel(ctx, 200, 78, 560, 418, PALETTE.neonPurple);
  drawText(ctx, tr().settingsTitle, VIEW.width / 2, 118, {
    size: 46,
    color: PALETTE.neonYellow,
    glow: PALETTE.neonPink,
    glowSize: 16,
    depth: 4,
    letterSpacing: 6,
  });
}

// ------------------------------------------------------------ playerSetup ----

export function playerSetupButtons(total: number): Button[] {
  const out: Button[] = [];
  const cols = 4;
  const bw = 116;
  const bh = 74;
  const gap = 18;
  const startX = (VIEW.width - (cols * bw + (cols - 1) * gap)) / 2;

  for (let i = 0; i < 8; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const n = i + 1;
    out.push({
      id: `players-${n}`,
      label: `${n}`,
      sub: n === 1 ? tr().player : tr().players,
      x: startX + col * (bw + gap),
      y: 208 + row * (bh + gap),
      w: bw,
      h: bh,
      color: n === total ? PALETTE.neonYellow : PALETTE.neonCyan,
    });
  }

  out.push({
    id: "start",
    label: tr().start,
    x: (VIEW.width - 260) / 2,
    y: 432,
    w: 260,
    h: 62,
    color: PALETTE.neonPink,
  });
  return out;
}

export function drawPlayerSetup(ctx: CanvasRenderingContext2D, total: number): void {
  drawText(ctx, tr().howManyPlayers, VIEW.width / 2, 116, {
    size: 58,
    color: PALETTE.neonYellow,
    glow: PALETTE.neonPink,
    glowSize: 18,
    depth: 5,
    letterSpacing: 4,
  });
  drawText(
    ctx,
    tr().setupHint,
    VIEW.width / 2,
    164,
    { size: 20, color: "#b9a6e0", stroke: null, letterSpacing: 1.5 },
  );
  drawText(
    ctx,
    total === 1 ? tr().playerSelected : `${total} ${tr().playersSelected}`,
    VIEW.width / 2,
    404,
    {
      size: 22,
      color: PALETTE.neonCyan,
      glow: PALETTE.neonCyan,
      glowSize: 10,
      letterSpacing: 3,
    },
  );
}

// ------------------------------------------------------------- playerTurn ----

export function playerTurnButtons(state: GameState): Button[] {
  const decider = state.isDecidingTurn && state.totalTurns > 1;
  return [
    {
      id: "go",
      label: decider ? tr().settleIt : tr().fight,
      x: (VIEW.width - 360) / 2,
      y: 438,
      w: 360,
      h: 72,
      color: decider ? PALETTE.neonYellow : PALETTE.neonPink,
    },
  ];
}

export function drawPlayerTurn(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time: number,
  scores?: { boy: number; girl: number },
): void {
  const cx = VIEW.width / 2;
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);

  const teamColors = FIGHTER_COLORS[state.playerTeam];
  const teamName = FIGHTER_FLAVOR[state.playerTeam].name;
  const decider = state.isDecidingTurn && state.totalTurns > 1;

  if (decider) {
    // The scores are level and this single fight settles everything. Make the
    // moment as loud as the game can manage.
    drawText(ctx, tr().finalBattle, cx, 108, {
      size: 92,
      color: PALETTE.neonYellow,
      glow: PALETTE.neonPink,
      glowSize: 24 + pulse * 24,
      depth: 7,
      letterSpacing: 7,
    });
    drawText(ctx, tr().scoresLevel, cx, 162, {
      size: 24,
      color: PALETTE.white,
      stroke: null,
      letterSpacing: 3,
      alpha: 0.8 + pulse * 0.2,
    });
    drawText(
      ctx,
      state.isExtraFinalTurn ? tr().anyoneCanPlay : tr().playerN(state.currentPlayer),
      cx,
      206,
      {
        size: 34,
        color: PALETTE.neonCyan,
        glow: PALETTE.neonCyan,
        glowSize: 12,
        depth: 3,
        letterSpacing: 4,
      },
    );
  } else {
    drawText(ctx, tr().playerN(state.currentPlayer), cx, 118, {
      size: 82,
      color: PALETTE.neonCyan,
      glow: PALETTE.neonCyan,
      glowSize: 18 + pulse * 16,
      depth: 5,
      letterSpacing: 6,
    });
  }

  // Remind each participant which side they are fighting for.
  if (!decider) {
    drawText(ctx, tr().fightingFor(teamName), cx, 178, {
      size: 34,
      color: teamColors.barGlow,
      glow: teamColors.primary,
      glowSize: 12,
      depth: 3,
      letterSpacing: 4,
    });

    // "FIGHT 2 OF 4" - counted against the number of participants, since each
    // one takes a turn. See GameState.announcedFights for the parity details.
    if (state.announcedFights > 1) {
      drawText(
        ctx,
        tr().fightXofY(state.currentPlayer, state.announcedFights),
        cx,
        216,
        { size: 20, color: PALETTE.neonYellow, stroke: null, letterSpacing: 3 },
      );
    }
  } else {
    drawText(ctx, tr().forTeam(teamName), cx, 246, {
      size: 26,
      color: teamColors.barGlow,
      glow: teamColors.primary,
      glowSize: 10,
      depth: 2,
      letterSpacing: 3,
    });
  }

  // Running score, so everyone knows what is at stake.
  if (scores && state.history.length > 0) {
    drawTeamScore(ctx, scores, 320, time);
  }
}

// -------------------------------------------------------- characterSelect ----

const CARD_W = 268;
const CARD_H = 300;
const CARD_Y = 150;

/**
 * Team selection. Chosen once for the whole room, before anybody fights.
 *
 * The button ids are reused from the old per-player character select, so the
 * existing keyboard and pointer handling applies unchanged.
 */
export function teamSelectButtons(): Button[] {
  return characterSelectButtons();
}

export function drawTeamSelect(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  preview: SelectPreview,
  hoveredId: string | null,
  time: number,
): void {
  const cx = VIEW.width / 2;

  drawText(ctx, tr().chooseTeam, cx, 66, {
    size: 54,
    color: PALETTE.neonYellow,
    glow: PALETTE.neonPink,
    glowSize: 18,
    depth: 4,
    letterSpacing: 5,
  });

  drawText(
    ctx,
    state.totalPlayers === 1
      ? tr().youFightFor
      : tr().allPlayersFightFor(state.totalPlayers),
    cx,
    108,
    { size: 21, color: PALETTE.neonCyan, stroke: null, letterSpacing: 2 },
  );

  const gap = 90;
  const totalW = CARD_W * 2 + gap;
  const startX = (VIEW.width - totalW) / 2;

  const cards: Array<{ id: FighterId; x: number; btn: string }> = [
    { id: "male", x: startX, btn: "pick-male" },
    { id: "female", x: startX + CARD_W + gap, btn: "pick-female" },
  ];

  for (const card of cards) {
    const colors = FIGHTER_COLORS[card.id];
    const flavor = FIGHTER_FLAVOR[card.id];
    const active = hoveredId === card.btn;
    const f = card.id === "male" ? preview.male : preview.female;

    ctx.save();
    const g = ctx.createLinearGradient(0, CARD_Y, 0, CARD_Y + CARD_H);
    g.addColorStop(0, active ? "#2b1d52" : "#1b1236");
    g.addColorStop(1, "#0d0820");
    ctx.fillStyle = g;
    ctx.fillRect(card.x, CARD_Y, CARD_W, CARD_H);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = active ? 5 : 2.5;
    if (active) {
      ctx.shadowColor = colors.primary;
      ctx.shadowBlur = 22;
    }
    ctx.strokeRect(card.x, CARD_Y, CARD_W, CARD_H);
    ctx.restore();

    // Fighter portrait, clipped to the card.
    ctx.save();
    ctx.beginPath();
    ctx.rect(card.x, CARD_Y, CARD_W, CARD_H);
    ctx.clip();
    ctx.translate(card.x + CARD_W / 2, CARD_Y + CARD_H - 42);
    const bob = Math.sin(time * 2 + (card.id === "male" ? 0 : 1)) * 3;
    ctx.scale(1.35, 1.35);
    ctx.translate(0, bob);
    f.facing = card.id === "male" ? 1 : -1;
    drawFighter(ctx, f, { flash: 0, rotation: 0 });
    ctx.restore();

    drawText(ctx, `${tr().team} ${flavor.name}`, card.x + CARD_W / 2, CARD_Y + 48, {
      size: 46,
      color: colors.barGlow,
      glow: colors.primary,
      glowSize: 16,
      depth: 4,
      letterSpacing: 4,
    });
  }

  drawText(
    ctx,
    tr().teamSelectHint,
    cx,
    522,
    { size: 15, color: "#9b8ac4", stroke: null, letterSpacing: 2 },
  );
}

export function characterSelectButtons(): Button[] {
  const gap = 90;
  const totalW = CARD_W * 2 + gap;
  const startX = (VIEW.width - totalW) / 2;
  return [
    {
      id: "pick-male",
      label: "SELECT",
      x: startX,
      y: CARD_Y + CARD_H + 18,
      w: CARD_W,
      h: 58,
      color: FIGHTER_COLORS.male.primary,
    },
    {
      id: "pick-female",
      label: "SELECT",
      x: startX + CARD_W + gap,
      y: CARD_Y + CARD_H + 18,
      w: CARD_W,
      h: 58,
      color: FIGHTER_COLORS.female.primary,
    },
  ];
}

/** Preview fighters, kept alive so their idle animations run. */
export class SelectPreview {
  readonly male = new Fighter("male", 0, 1);
  readonly female = new Fighter("female", 0, -1);

  update(dt: number): void {
    this.male.animTime += dt;
    this.female.animTime += dt;
  }
}

export function drawCharacterSelect(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  preview: SelectPreview,
  hoveredId: string | null,
  time: number,
): void {
  const cx = VIEW.width / 2;

  drawText(ctx, "SELECT YOUR FIGHTER", cx, 74, {
    size: 54,
    color: PALETTE.neonYellow,
    glow: PALETTE.neonPink,
    glowSize: 18,
    depth: 4,
    letterSpacing: 5,
  });

  drawText(ctx, tr().playerN(state.currentPlayer), cx, 118, {
    size: 22,
    color: PALETTE.neonCyan,
    stroke: null,
    letterSpacing: 4,
  });

  const gap = 90;
  const totalW = CARD_W * 2 + gap;
  const startX = (VIEW.width - totalW) / 2;

  const cards: Array<{ id: FighterId; x: number; btn: string }> = [
    { id: "male", x: startX, btn: "pick-male" },
    { id: "female", x: startX + CARD_W + gap, btn: "pick-female" },
  ];

  for (const card of cards) {
    const colors = FIGHTER_COLORS[card.id];
    const flavor = FIGHTER_FLAVOR[card.id];
    const active = hoveredId === card.btn || state.selectedFighter === card.id;
    const f = card.id === "male" ? preview.male : preview.female;

    // Card frame.
    ctx.save();
    const g = ctx.createLinearGradient(0, CARD_Y, 0, CARD_Y + CARD_H);
    g.addColorStop(0, active ? "#2b1d52" : "#1b1236");
    g.addColorStop(1, "#0d0820");
    ctx.fillStyle = g;
    ctx.fillRect(card.x, CARD_Y, CARD_W, CARD_H);

    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = active ? 5 : 2.5;
    if (active) {
      ctx.shadowColor = colors.primary;
      ctx.shadowBlur = 22;
    }
    ctx.strokeRect(card.x, CARD_Y, CARD_W, CARD_H);
    ctx.restore();

    // Fighter portrait. Scaled up and clipped to the card.
    ctx.save();
    ctx.beginPath();
    ctx.rect(card.x, CARD_Y, CARD_W, CARD_H);
    ctx.clip();
    ctx.translate(card.x + CARD_W / 2, CARD_Y + CARD_H - 42);
    const bob = Math.sin(time * 2 + (card.id === "male" ? 0 : 1)) * 3;
    ctx.scale(1.35, 1.35);
    ctx.translate(0, bob);
    // Face the fighters toward each other across the gap.
    f.facing = card.id === "male" ? 1 : -1;
    drawFighter(ctx, f, { flash: 0, rotation: 0 });
    ctx.restore();

    // Name plate. Larger now that it stands alone, with no tagline beneath it.
    drawText(ctx, flavor.name, card.x + CARD_W / 2, CARD_Y + 48, {
      size: 60,
      color: colors.barGlow,
      glow: colors.primary,
      glowSize: 16,
      depth: 4,
      letterSpacing: 6,
    });
  }

  drawText(ctx, "TAP A FIGHTER  •  ← →  THEN  ENTER", cx, 522, {
    size: 15,
    color: "#9b8ac4",
    stroke: null,
    letterSpacing: 2,
  });
}

// --------------------------------------------------------------- controls ----

export function controlsButtons(): Button[] {
  return [
    {
      id: "fight",
      label: tr().fight,
      x: (VIEW.width - 300) / 2,
      y: 452,
      w: 300,
      h: 66,
      color: PALETTE.neonPink,
    },
  ];
}

export function drawControls(
  ctx: CanvasRenderingContext2D,
  touch: boolean,
  time: number,
): void {
  const cx = VIEW.width / 2;
  drawPanel(ctx, 150, 60, 660, 366, PALETTE.neonCyan);

  drawText(ctx, tr().controlsTitle, cx, 104, {
    size: 52,
    color: PALETTE.neonYellow,
    glow: PALETTE.neonPink,
    glowSize: 16,
    depth: 4,
    letterSpacing: 6,
  });

  const s = tr();
  const rows: Array<[string, string]> = touch
    ? [
        ["◀ ▶", s.move],
        [s.jump, s.jump],
        [s.punch, s.fastLight],
        [s.kick, s.medium],
        [s.strong, s.slowHeavy],
        [s.block, s.reduceDamage],
      ]
    : [
        ["← →", s.move],
        ["↑", s.jump],
        ["S", s.punch],
        ["D", s.kick],
        ["F", s.strong],
        [getLang() === "fr" ? "ESPACE" : "SPACE", s.block],
      ];

  const startY = 158;
  const rowH = 42;
  rows.forEach(([key, label], i) => {
    const y = startY + i * rowH;
    const flash = 0.6 + 0.4 * Math.sin(time * 4 - i * 0.5);

    // Key cap.
    const capW = 148;
    const capX = cx - 210;
    ctx.save();
    ctx.fillStyle = "#0f0a20";
    ctx.fillRect(capX, y - 16, capW, 33);
    ctx.strokeStyle = PALETTE.neonCyan;
    ctx.lineWidth = 2;
    ctx.globalAlpha = flash;
    ctx.strokeRect(capX, y - 16, capW, 33);
    ctx.restore();

    drawText(ctx, key, capX + capW / 2, y, {
      size: 22,
      color: PALETTE.neonCyan,
      depth: 1,
      letterSpacing: 2,
    });

    drawText(ctx, label, cx + 30, y, {
      size: 25,
      color: PALETTE.white,
      align: "left",
      depth: 2,
      letterSpacing: 2,
    });
  });
}

// ----------------------------------------------------------------- result ----

export function resultButtons(isFinal: boolean): Button[] {
  return [
    {
      id: "next",
      label: isFinal ? tr().seeTheResult : tr().nextPlayer,
      x: (VIEW.width - 440) / 2,
      y: 420,
      w: 440,
      h: 72,
      color: isFinal ? PALETTE.neonYellow : PALETTE.neonCyan,
    },
  ];
}

/**
 * The TEAM BOY vs TEAM GIRL scoreboard.
 *
 * Shows the running score with both teams side by side. Note that a team being
 * ahead mid-session means nothing about the outcome: early matches are honest,
 * and the score is only steered towards the end.
 */
export function drawTeamScore(
  ctx: CanvasRenderingContext2D,
  scores: { boy: number; girl: number },
  cy: number,
  time: number,
): void {
  const cx = VIEW.width / 2;
  const gap = 190;
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.5);

  const sides: Array<{ team: "boy" | "girl"; id: FighterId; x: number }> = [
    { team: "boy", id: "male", x: cx - gap },
    { team: "girl", id: "female", x: cx + gap },
  ];

  for (const s of sides) {
    const colors = FIGHTER_COLORS[s.id];
    const value = scores[s.team];
    const leading = value > scores[s.team === "boy" ? "girl" : "boy"];

    drawText(ctx, `${tr().team} ${s.team === "boy" ? FIGHTER_FLAVOR.male.name : FIGHTER_FLAVOR.female.name}`, s.x, cy - 42, {
      size: 26,
      color: colors.barGlow,
      glow: colors.primary,
      glowSize: 10,
      depth: 2,
      letterSpacing: 3,
    });

    drawText(ctx, String(value), s.x, cy + 20, {
      size: 78,
      color: PALETTE.white,
      glow: colors.primary,
      glowSize: leading ? 18 + pulse * 16 : 10,
      depth: 5,
      letterSpacing: 2,
    });
  }

  drawText(ctx, "-", cx, cy + 12, {
    size: 54,
    color: "#8a7cb0",
    stroke: null,
  });
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  playerWon: boolean,
  time: number,
  scores?: { boy: number; girl: number },
): void {
  const cx = VIEW.width / 2;
  const pulse = 0.5 + 0.5 * Math.sin(time * 3.4);

  // The point goes to the players' team if they won, otherwise to the CPU's.
  const scoringFighter: FighterId = playerWon ? state.playerTeam : state.cpuFighter;
  const teamName = FIGHTER_FLAVOR[scoringFighter].name;
  const teamColors = FIGHTER_COLORS[scoringFighter];

  drawText(ctx, tr().pointForTeam(teamName), cx, 116, {
    size: 60,
    color: teamColors.barGlow,
    glow: teamColors.primary,
    glowSize: 18 + pulse * 16,
    depth: 5,
    letterSpacing: 4,
  });

  drawText(
    ctx,
    playerWon
      ? tr().playerWinsFight(state.currentPlayer)
      : tr().playerKnockedOut(state.currentPlayer),
    cx,
    166,
    { size: 24, color: PALETTE.white, stroke: null, letterSpacing: 3, alpha: 0.9 },
  );

  if (scores) drawTeamScore(ctx, scores, 276, time);

  // Count down against the advertised total, so this agrees with the
  // "FIGHT x OF y" counter on the turn cards.
  const played = Math.min(state.history.length, state.announcedFights);
  const remaining = state.announcedFights - played;
  const levelNow = scores ? scores.boy === scores.girl : false;

  // Everybody has played, the score is level, and a tie-breaker is still to come.
  // This only happens with an even number of participants; with an odd number the
  // last player's turn was itself the decider.
  const nextIsDecider = remaining === 0 && levelNow && !state.isDecidingTurn;
  const footer = nextIsDecider
    ? tr().allLevelNextDecides
    : remaining > 0
      ? tr().fightsLeft(remaining)
      : tr().allFightsComplete;

  drawText(ctx, footer, cx, 364, {
    size: nextIsDecider ? 24 : 22,
    color: PALETTE.neonYellow,
    glow: nextIsDecider ? PALETTE.neonYellow : null,
    glowSize: 10,
    stroke: null,
    letterSpacing: 3,
    alpha: 0.75 + pulse * 0.25,
  });
}
