import { MATCH, VIEW, type RoundMode } from "../config/gameConfig.ts";
import { audio } from "../audio/AudioManager.ts";
import { KeyboardInput } from "../input/KeyboardInput.ts";
import { TouchInput, isTouchDevice } from "../input/TouchInput.ts";
import { PlayerController } from "../fighters/PlayerController.ts";
import { emptyIntent } from "../fighters/Fighter.ts";
import { Renderer } from "../rendering/Renderer.ts";
import { Stage } from "../rendering/Stage.ts";
import { Tsuki } from "../rendering/Tsuki.ts";
import { StageRotation } from "../rendering/stages/index.ts";
import { ParticleSystem } from "../rendering/ParticleSystem.ts";
import { drawFighter } from "../rendering/FighterSprite.ts";
import { FIGHTER_COLORS, PALETTE } from "../rendering/palette.ts";
import { drawText } from "../rendering/text.ts";
import { HUD } from "../ui/HUD.ts";
import { RevealScreen } from "../ui/RevealScreen.ts";
import {
  SelectPreview,
  controlsButtons,
  drawControls,
  drawTeamSelect,
  teamSelectButtons,
  drawPlayerSetup,
  drawPlayerTurn,
  drawResult,
  drawSettings,
  drawTitle,
  playerSetupButtons,
  playerTurnButtons,
  resultButtons,
  settingsButtons,
  titleButtons,
} from "../ui/screens.ts";
import {
  drawButton,
  drawCrtOverlay,
  hitTest,
  type Button,
  type PointerState,
} from "../ui/widgets.ts";
import { GameState } from "./GameState.ts";
import { Match } from "./Match.ts";
import { ScoreDirector } from "../balancing/ScoreDirector.ts";
import { t as tr, toggleLang } from "../i18n/strings.ts";
import {
  enterFullscreen,
  fullscreenSupported,
  isFullscreen,
  isIos,
  isStandalone,
  lockLandscape,
} from "../input/fullscreen.ts";
import { applyDomStrings } from "../i18n/dom.ts";
import type { FighterId } from "../config/secretConfig.ts";


/** Fixed simulation timestep, decoupled from the display refresh rate. */
const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.25;

/**
 * Top-level application: owns the screen flow, the fixed-timestep loop, input
 * routing and all presentation. Match logic lives in Match; this class is the
 * shell around it.
 */
export class Game {
  private renderer: Renderer;
  /** Public so scripts/stageShots.mjs can force a stage for screenshots. */
  readonly stage = new Stage();
  /** Deals a different backdrop to each fight, no repeats until all are used. */
  private stages = new StageRotation();
  private particles = new ParticleSystem();
  /** A small easter egg who wanders through now and then. */
  private tsuki = new Tsuki();
  private hud = new HUD();
  private state = new GameState();
  private director = new ScoreDirector(1);
  private reveal = new RevealScreen();
  private preview = new SelectPreview();

  private keyboard = new KeyboardInput();
  private touch: TouchInput;
  private controller = new PlayerController();
  private usingTouch = isTouchDevice();

  private match: Match | null = null;

  private accumulator = 0;
  private lastTime = 0;
  private time = 0;
  private running = false;

  /** Pointer/mouse state in virtual coordinates. */
  private pointer: PointerState = { x: -1, y: -1, down: false, clicked: false };
  /** Button id awaiting activation, set on pointerup. */
  private pointerClickPending: string | null = null;
  /** Which button the pointer is currently pressing. */
  private pressedButtonId: string | null = null;
  /** Keyboard focus index into the current button list. */
  private focusIndex = 0;
  private currentButtons: Button[] = [];

  /** Fade-to-black transition, 0 = clear. */
  private fade = 0;
  private fadeTarget = 0;
  private pendingAction: (() => void) | null = null;

  /** KO overlay timing. */
  private koTimer = 0;
  /** Freeze frame at the moment of the KO. */
  private hitFreeze = 0;

  constructor(canvas: HTMLCanvasElement, touchRoot: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.touch = new TouchInput(touchRoot);

    this.keyboard.attach();
    this.controller.addSource(this.keyboard);
    this.controller.addSource(this.touch);

    this.keyboard.onAnyKey = (code) => {
      audio.unlock();
      this.handleMenuKey(code);
    };
    this.touch.onFirstTouch = () => audio.unlock();

    this.attachPointer(canvas);
  }

  // ------------------------------------------------------------- lifecycle --

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    const rawDt = Math.min(MAX_FRAME_DT, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.time += rawDt;

    // Fixed-step simulation so gameplay is identical at any refresh rate.
    this.accumulator += rawDt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 6) {
      this.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === 6) this.accumulator = 0;

    this.draw(rawDt);

    // Only clear the "pressed this frame" edges if the simulation actually ran.
    //
    // This matters more than it looks. The display can refresh faster than the
    // 60Hz simulation - 120Hz phones and laptops are common - and on those
    // machines roughly half of all animation frames complete without stepping
    // the simulation at all. Clearing unconditionally meant any attack pressed
    // during one of those frames was discarded before update() ever saw it, so
    // on a 120Hz screen about 50% of punches silently did nothing (59% at
    // 144Hz). Holding the edge until it has been consumed fixes it.
    if (steps > 0) {
      this.keyboard.endFrame();
      this.touch.endFrame();
      this.pointer.clicked = false;
    }

    requestAnimationFrame(this.frame);
  };

  // ----------------------------------------------------------------- input --

  private attachPointer(canvas: HTMLCanvasElement): void {
    const move = (e: PointerEvent): void => {
      const v = this.renderer.toVirtual(e.clientX, e.clientY);
      this.pointer.x = v.x;
      this.pointer.y = v.y;
    };

    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerdown", (e) => {
      audio.unlock();
      move(e);
      this.pointer.down = true;
      const btn = this.currentButtons.find((b) => !b.disabled && hitTest(b, this.pointer));
      this.pressedButtonId = btn?.id ?? null;
    });
    canvas.addEventListener("pointerup", (e) => {
      move(e);
      this.pointer.down = false;
      // Only counts as a click if it started and ended on the same button.
      if (this.pressedButtonId) {
        const btn = this.currentButtons.find(
          (b) => b.id === this.pressedButtonId && hitTest(b, this.pointer),
        );
        // Resolve to the id here rather than leaving it on this.pressedButtonId:
        // on a touchscreen `pointerleave` fires immediately after `pointerup`
        // (the finger leaves the surface) and would otherwise clear the press
        // before the next frame gets a chance to act on it.
        if (btn) this.pointerClickPending = btn.id;
      }
      this.pressedButtonId = null;
    });
    canvas.addEventListener("pointerleave", () => {
      this.pointer.down = false;
      this.pressedButtonId = null;
      this.pointer.x = -1;
      this.pointer.y = -1;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** Menu navigation and confirmation via keyboard. */
  private handleMenuKey(code: string): void {
    if (this.state.screen === "fight") return;
    if (this.fade > 0.01 || this.pendingAction) return;
    const buttons = this.currentButtons.filter((b) => !b.disabled);
    if (!buttons.length) return;

    // Arrows, Tab and Enter/Space only. These have stable `code` values on every
    // keyboard layout, unlike letter keys: on AZERTY the key printed Q reports
    // "KeyA", so navigating on letters would behave differently per layout.
    const next = code === "ArrowRight" || code === "ArrowDown" || code === "Tab";
    const prev = code === "ArrowLeft" || code === "ArrowUp";
    const confirm = code === "Enter" || code === "Space" || code === "NumpadEnter";

    if (next) {
      this.focusIndex = (this.focusIndex + 1) % buttons.length;
      audio.play("select");
    } else if (prev) {
      this.focusIndex = (this.focusIndex - 1 + buttons.length) % buttons.length;
      audio.play("select");
    } else if (confirm) {
      const btn = buttons[Math.min(this.focusIndex, buttons.length - 1)];
      if (btn) this.activate(btn.id);
    }
  }

  // ------------------------------------------------------------ transitions --

  /** Fades out, runs the action, then fades back in. */
  private transition(action: () => void): void {
    if (this.pendingAction) return;
    this.fadeTarget = 1;
    this.pendingAction = action;
  }

  private goto(screen: GameState["screen"]): void {
    this.state.screen = screen;
    this.focusIndex = 0;
    this.pointer.x = -1;
    this.pointer.y = -1;
    this.pressedButtonId = null;

    // Touch pad is only relevant during a fight.
    this.touch.setVisible(this.usingTouch && screen === "fight");

    if (screen === "title") audio.playMusic("menu");
    if (screen === "fight") audio.playMusic("fight");
  }

  // -------------------------------------------------------------- update ----

  private update(dt: number): void {
    // Fade handling drives all screen changes.
    if (this.fadeTarget > this.fade) {
      this.fade = Math.min(1, this.fade + dt * 3.4);
      if (this.fade >= 1 && this.pendingAction) {
        this.pendingAction();
        this.pendingAction = null;
        this.fadeTarget = 0;
      }
    } else if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt * 3.4);
    }

    this.stage.update(dt);
    this.tsuki.update(dt);
    this.particles.update(dt);
    this.renderer.updateShake(dt);
    if (this.hitFreeze > 0) this.hitFreeze -= dt;

    // Rebuild the button list for the active screen.
    this.currentButtons = this.buttonsForScreen();

    // Dispatch a pending pointer click.
    if (this.pointerClickPending) {
      const id = this.pointerClickPending;
      this.pointerClickPending = null;
      if (!this.fadeTarget && !this.pendingAction) this.activate(id);
    }

    switch (this.state.screen) {
      case "teamSelect":
        this.preview.update(dt);
        break;
      case "fight":
        this.updateFight(dt);
        break;
      case "reveal":
        this.reveal.update(dt, this.particles);
        this.renderer.addShake(this.reveal.shakeAmount * 0.2);
        break;
      default:
        break;
    }
  }

  private updateFight(dt: number): void {
    const match = this.match;
    if (!match) return;

    // Freeze the action for a beat on the KO for impact.
    if (this.hitFreeze > 0) return;

    const intent = match.acceptsInput ? this.controller.update() : emptyIntent();
    const wasPhase = match.phase;
    match.step(dt, intent);

    // Intro stingers.
    if (wasPhase === "intro" && match.phase === "fighting") {
      audio.play("fight");
    }

    // Effects for anything that landed this step.
    for (const hit of match.lastHits) {
      const colors = FIGHTER_COLORS[hit.victim.id];
      if (hit.blocked) {
        audio.play("block");
        this.particles.burst(hit.x, hit.y, hit.particles, [
          PALETTE.neonCyan,
          PALETTE.white,
          colors.trim,
        ]);
      } else {
        audio.play(hit.kind);
        this.particles.burst(hit.x, hit.y, hit.particles, [
          PALETTE.neonYellow,
          PALETTE.white,
          PALETTE.neonPink,
          colors.barGlow,
        ]);
        if (hit.kind === "strong") {
          this.particles.ring(hit.x, hit.y, PALETTE.neonYellow, 78);
        }
      }
      this.renderer.addShake(hit.shake);

      // A solid blow landing close by sends her off: ears back, tail up.
      if (hit.kind === "strong" || hit.ko) this.tsuki.startle(hit.x);

      if (hit.ko) {
        audio.play("ko");
        this.hitFreeze = MATCH.koFreezeMs / 1000;
        this.renderer.addShake(20);
        this.particles.ring(hit.x, hit.y, PALETTE.neonPink, 150);
        this.particles.burst(hit.x, hit.y, 40, [
          PALETTE.neonYellow,
          PALETTE.white,
          PALETTE.neonPink,
        ]);
        this.koTimer = 0;
      }
    }

    this.hud.update(dt, match.player, match.cpu);

    if (match.phase === "ko" || match.phase === "over") {
      this.koTimer += dt;
    }

    if (match.isOver) {
      this.finishRound();
    }
  }

  /** Called once the KO sequence has played out. */
  private finishRound(): void {
    const match = this.match;
    if (!match?.result) return;
    const state = this.state;
    const result = match.result;

    if (result.playerWon) state.playerRoundWins++;
    else state.cpuRoundWins++;

    this.match = null;

    if (state.roundMode === 3 && !state.matchDecided) {
      // Another round for the same participant.
      state.currentRound++;
      this.transition(() => {
        this.startMatch();
      });
      return;
    }

    const playerWon = state.playerRoundWins >= state.roundsNeeded;
    state.recordTurn(playerWon, result.durationMs);

    // The point goes to the players' team if they won, otherwise to the CPU's.
    const winningFighter: FighterId = playerWon ? state.playerTeam : state.cpuFighter;
    this.director.record(winningFighter);

    // The decider has just been played, so the session is over. Go straight to
    // the reveal: the fighters are called BOY and GIRL, so a result card here
    // would sit between the audience and an answer already on screen.
    if (state.isDecidingTurn) {
      this.transition(() => this.enterReveal());
      return;
    }

    this.transition(() => {
      this.goto("result");
    });
  }

  /**
   * Read-only view of the current match, for the development test harness in
   * scripts/. Not used by the game itself.
   */
  get currentMatch(): Match | null {
    return this.match;
  }

  /** Round label for the HUD, translated. Null outside best-of-3. */
  private roundLabel(): string | null {
    return this.state.roundMode === 3 ? tr().round(this.state.currentRound) : null;
  }

  /** Clears the arena and starts the final reveal sequence. */
  private enterReveal(): void {
    this.particles.clear();
    this.reveal.reset();
    audio.stopMusic();
    this.goto("reveal");
  }

  /**
   * Asks for fullscreen on touch devices, from inside a user gesture.
   *
   * Called when a button is activated, because browsers only grant fullscreen
   * during a real interaction. On Android this hides the address bar and tab
   * strip; on iOS Safari it does nothing, since there fullscreen is only
   * available by adding the page to the home screen.
   */
  private requestFullscreenIfUseful(): void {
    if (!this.usingTouch) return;
    if (isStandalone() || isFullscreen()) return;
    if (!fullscreenSupported()) return;
    void enterFullscreen().then((ok) => {
      // Landscape lock only works once fullscreen, so chain it.
      if (ok) void lockLandscape();
    });
  }

  private startMatch(): void {
    // In team mode the director decides how much this particular match may be
    // steered; most early matches come back "fair" and run completely honestly.
    // In solo mode every match is decided, as before.
    // The director decides how much this fight may be steered, and which side to
    // help. Early fights usually come back "fair" and run completely honestly.
    const plan = this.director.plan();

    // A new destination for every fight.
    this.stage.setTheme(this.stages.next());
    // Tsuki turns up once per fight, at a slightly different moment each time.
    this.tsuki.reset();

    this.match = new Match(
      this.state.selectedFighter,
      undefined,
      plan.favour,
      plan.mode,
    );
    this.hud.reset();
    this.particles.clear();
    this.koTimer = 0;
    this.hitFreeze = 0;
    this.goto("fight");
    audio.play("round");
  }

  // -------------------------------------------------------------- buttons ----

  private buttonsForScreen(): Button[] {
    const s = this.state;
    switch (s.screen) {
      case "title":
        return titleButtons();
      case "settings":
        return settingsButtons(s, audio.musicEnabled, audio.sfxEnabled);
      case "playerSetup":
        return playerSetupButtons(s.totalPlayers);
      case "teamSelect":
        return teamSelectButtons();
      case "playerTurn":
        return playerTurnButtons(s);
      case "controls":
        return controlsButtons();
      case "result":
        return resultButtons(s.isFinalPlayer);
      case "reveal":
        return this.reveal.buttons();
      case "fight":
        return [];
    }
  }

  private activate(id: string): void {
    audio.unlock();
    // Every button press is a user gesture, which is the only moment a browser
    // will grant fullscreen. Cheap to attempt and a no-op once already there.
    this.requestFullscreenIfUseful();
    const s = this.state;

    // Settings toggles happen in place, with no transition.
    if (id === "music") {
      audio.setMusicEnabled(!audio.musicEnabled);
      if (audio.musicEnabled) audio.playMusic("menu");
      else audio.stopMusic();
      audio.play("select");
      return;
    }
    if (id === "sfx") {
      audio.setSfxEnabled(!audio.sfxEnabled);
      audio.play("confirm");
      return;
    }
    if (id === "rounds") {
      s.roundMode = (s.roundMode === 1 ? 3 : 1) as RoundMode;
      audio.play("select");
      return;
    }
    if (id === "language") {
      toggleLang();
      // The rotate overlay is DOM rather than canvas, so it needs telling.
      applyDomStrings();
      audio.play("select");
      return;
    }

    if (id.startsWith("players-")) {
      s.totalPlayers = Number(id.split("-")[1]);
      audio.play("select");
      return;
    }

    audio.play("confirm");

    switch (id) {
      case "play":
        this.transition(() => this.goto("playerSetup"));
        break;
      case "settings":
        this.transition(() => this.goto("settings"));
        break;
      case "back":
        this.transition(() => this.goto("title"));
        break;
      case "start":
        s.currentPlayer = 1;
        s.history = [];
        s.resetRounds();
        // Fresh shuffle of destinations for this session.
        this.stages.reset();
        // The whole room picks one team before anybody fights.
        this.transition(() => this.goto("teamSelect"));
        break;
      case "pick-male":
      case "pick-female":
        s.playerTeam = id === "pick-male" ? "male" : "female";
        // One fight per participant, which is what the director paces against.
        this.director.reset(s.totalPlayers, s.playerTeam);
        this.transition(() => this.goto("playerTurn"));
        break;
      case "go":
        this.transition(() => {
          // Show the controls primer once per session, before the first fight.
          if (!s.controlsShown) {
            s.controlsShown = true;
            this.goto("controls");
          } else {
            this.startMatch();
          }
        });
        break;
      case "fight":
        this.transition(() => this.startMatch());
        break;
      case "next":
        // Always advance: the decider itself is a turn, and finishRound sends us
        // straight to the reveal once it has been played.
        s.advancePlayer();
        // The team is already chosen for the whole session, so go straight to
        // the next participant's turn card.
        this.transition(() => this.goto("playerTurn"));
        break;
      case "again":
        this.transition(() => {
          s.reset();
          this.particles.clear();
          this.goto("title");
        });
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- draw ----

  private draw(rawDt: number): void {
    const ctx = this.renderer.ctx;
    this.renderer.begin();

    switch (this.state.screen) {
      case "fight":
        this.drawFight(ctx);
        break;
      case "reveal":
        // Show the final scoreboard whenever there was more than one fight.
        this.reveal.draw(
          ctx,
          this.particles,
          this.state.totalPlayers > 1 ? this.director.scores : null,
        );
        break;
      default:
        this.drawMenuScreen(ctx, rawDt);
        break;
    }

    // Buttons on top of everything except the fight.
    if (this.state.screen !== "fight") {
      const enabled = this.currentButtons.filter((b) => !b.disabled);
      for (const b of this.currentButtons) {
        const hovered = hitTest(b, this.pointer) && !b.disabled;
        const focusedBtn = enabled[Math.min(this.focusIndex, enabled.length - 1)];
        drawButton(ctx, b, {
          hovered,
          focused: !this.usingTouch && focusedBtn?.id === b.id,
          pressed: this.pressedButtonId === b.id && this.pointer.down,
          time: this.time,
        });
      }
    }

    if (this.state.screen !== "reveal") {
      drawCrtOverlay(ctx, this.time);
    }

    // Fade overlay last.
    if (this.fade > 0.001) {
      ctx.save();
      ctx.globalAlpha = this.fade;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.restore();
    }
  }

  private drawMenuScreen(ctx: CanvasRenderingContext2D, rawDt: number): void {
    // Menus share the arena backdrop, dimmed, so the whole app feels of a piece.
    this.stage.draw(ctx, VIEW.width / 2);
    // She wanders through the menus too, drawn before the dimming layer so she
    // sits back in the scene rather than on top of the interface.
    this.tsuki.draw(ctx, VIEW.floorY);
    ctx.fillStyle = "rgba(6,4,14,0.62)";
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const s = this.state;
    switch (s.screen) {
      case "title":
        // iOS cannot hide the browser bars, so suggest Add to Home Screen there.
        drawTitle(ctx, this.time, this.usingTouch && isIos() && !isStandalone());
        break;
      case "settings":
        drawSettings(ctx);
        break;
      case "playerSetup":
        drawPlayerSetup(ctx, s.totalPlayers);
        break;
      case "playerTurn":
        drawPlayerTurn(ctx, s, this.time, this.director.scores);
        break;
      case "teamSelect": {
        const hovered = this.currentButtons.find(
          (b) => hitTest(b, this.pointer) && !b.disabled,
        );
        drawTeamSelect(ctx, s, this.preview, hovered?.id ?? null, this.time);
        break;
      }
      case "controls":
        drawControls(ctx, this.usingTouch, this.time);
        break;
      case "result": {
        const last = s.history[s.history.length - 1];
        drawResult(ctx, s, last?.won ?? false, this.time, this.director.scores);
        break;
      }
      default:
        break;
    }
    void rawDt;
  }

  private drawFight(ctx: CanvasRenderingContext2D): void {
    const match = this.match;
    if (!match) return;

    const cameraX = (match.player.x + match.cpu.x) / 2;
    this.stage.draw(ctx, cameraX);

    // Tsuki strolls along the back of the floor, so she is drawn before the
    // fighters and can never obscure the action.
    this.tsuki.draw(ctx, VIEW.floorY);

    // Draw the fighter further from the camera first for a sane overlap order.
    const order =
      match.player.y <= match.cpu.y
        ? [match.player, match.cpu]
        : [match.cpu, match.player];

    for (const f of order) {
      const flash = Math.max(0, Math.min(1, f.flash / 130));
      // KO topple: rotate as the fighter falls.
      let rotation = 0;
      if (f.state === "ko") {
        rotation = Math.min(1.35, this.koTimer * 2.4) * (f.facing === 1 ? -1 : 1);
      }
      drawFighter(ctx, f, { flash, rotation });
    }

    this.particles.draw(ctx);
    this.hud.draw(ctx, match.player, match.cpu, this.roundLabel());

    // Round intro overlay.
    if (match.phase === "intro") {
      const p = match.introProgress;
      const cx = VIEW.width / 2;
      if (this.state.roundMode === 3 && p < 0.55) {
        const a = Math.min(1, p * 4);
        drawText(ctx, tr().round(this.state.currentRound), cx, 210, {
          size: 84,
          color: PALETTE.neonYellow,
          glow: PALETTE.neonPink,
          glowSize: 22,
          depth: 6,
          letterSpacing: 6,
          alpha: a,
        });
      }
      // Name the destination during the intro, so the change of scenery is part
      // of the moment rather than something people only half-notice.
      drawText(ctx, this.stage.current.name, cx, 152, {
        size: 44,
        color: PALETTE.white,
        glow: PALETTE.neonCyan,
        glowSize: 16,
        depth: 3,
        letterSpacing: 8,
        alpha: Math.min(1, p * 3) * (p > 0.8 ? Math.max(0, (1 - p) * 5) : 1),
      });

      if (p >= 0.4) {
        const a = Math.min(1, (p - 0.4) * 5);
        const scale = 0.7 + Math.min(1, (p - 0.4) * 4) * 0.3;
        ctx.save();
        ctx.translate(cx, 268);
        ctx.scale(scale, scale);
        drawText(ctx, tr().ready, 0, 0, {
          size: 76,
          color: PALETTE.white,
          glow: PALETTE.neonCyan,
          glowSize: 20,
          depth: 5,
          letterSpacing: 6,
          alpha: a,
        });
        ctx.restore();
      }
    }

    // FIGHT! flash right after the intro.
    if (match.phase === "fighting" && match.elapsedMs < MATCH.fightFlashMs) {
      const p = match.elapsedMs / MATCH.fightFlashMs;
      const scale = p < 0.25 ? 0.5 + p * 3 : 1.25 - (p - 0.25) * 0.33;
      ctx.save();
      ctx.translate(VIEW.width / 2, 250);
      ctx.scale(scale, scale);
      drawText(ctx, tr().fightNow, 0, 0, {
        size: 104,
        color: PALETTE.neonYellow,
        glow: PALETTE.neonPink,
        glowSize: 30,
        depth: 8,
        letterSpacing: 8,
        alpha: 1 - Math.pow(p, 3),
      });
      ctx.restore();
    }

    // KO overlay.
    if (match.phase === "ko" || match.phase === "over") {
      const t = this.koTimer;
      const scale = t < 0.2 ? 0.3 + t * 6 : 1.5 - Math.min(0.5, (t - 0.2) * 1.2);
      ctx.save();
      ctx.translate(VIEW.width / 2, 220);
      ctx.scale(scale, scale);
      drawText(ctx, tr().ko, 0, 0, {
        size: 128,
        color: PALETTE.white,
        glow: PALETTE.neonPink,
        glowSize: 34,
        depth: 9,
        strokeWidth: 11,
        letterSpacing: 10,
      });
      ctx.restore();

      if (t > 1.2) {
        const winner = match.result?.playerWon ? match.player : match.cpu;
        drawText(
          ctx,
          match.result?.playerWon ? tr().youWin : tr().cpuWins,
          VIEW.width / 2,
          330,
          {
            size: 44,
            color: FIGHTER_COLORS[winner.id].barGlow,
            glow: FIGHTER_COLORS[winner.id].primary,
            glowSize: 16,
            depth: 4,
            letterSpacing: 6,
            alpha: Math.min(1, (t - 1.2) * 2),
          },
        );
      }
    }
  }
}
