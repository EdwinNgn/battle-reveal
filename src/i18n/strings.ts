/**
 * ============================================================================
 *  Localisation
 * ============================================================================
 *
 *  French is the default. English is available from the flag button on the title
 *  screen and in the settings, and the choice is remembered between sessions.
 *
 *  The game title itself is deliberately NOT translated: "BABY BATTLE - THE
 *  ULTIMATE GENDER REVEAL" is the name of the thing, not a sentence.
 *
 *  One important exclusion: the reveal headline ("C'EST UNE FILLE !" and so on)
 *  is NOT in this file. It lives XOR-encoded in src/config/revealText.ts,
 *  because any plain-text copy of it in the bundle would let a curious guest
 *  find the answer by searching the JavaScript. That file holds both languages
 *  and both outcomes, all encoded.
 *
 *  Text is drawn to a canvas at fixed sizes, so translations need to be roughly
 *  as short as the original or they will overflow their space. Where French is
 *  unavoidably longer, the layout was adjusted rather than the wording
 *  abbreviated into something awkward.
 * ============================================================================
 */

export type Lang = "fr" | "en";

/** Every translatable string in the game. */
export interface Strings {
  // title screen
  titleSub: string;
  play: string;
  settings: string;
  titleHint: string;
  credit: string;

  // settings
  settingsTitle: string;
  music: string;
  sfx: string;
  rounds: string;
  bestOf: string;
  language: string;
  back: string;
  on: string;
  off: string;

  // player setup
  howManyPlayers: string;
  setupHint: string;
  player: string;
  players: string;
  playerSelected: string;
  playersSelected: string;
  start: string;

  // team select
  chooseTeam: string;
  youFightFor: string;
  allPlayersFightFor: (n: number) => string;
  team: string;
  teamSelectHint: string;

  // player turn
  playerN: (n: number) => string;
  fightingFor: (team: string) => string;
  fightXofY: (x: number, y: number) => string;
  fight: string;
  finalBattle: string;
  scoresLevel: string;
  anyoneCanPlay: string;
  forTeam: (team: string) => string;
  settleIt: string;

  // controls
  controlsTitle: string;
  move: string;
  jump: string;
  punch: string;
  kick: string;
  strong: string;
  block: string;
  fastLight: string;
  medium: string;
  slowHeavy: string;
  reduceDamage: string;

  // in fight
  round: (n: number) => string;
  ready: string;
  fightNow: string;
  ko: string;
  youWin: string;
  cpuWins: string;
  cpu: string;
  playerLabel: string;

  // result
  pointForTeam: (team: string) => string;
  playerWinsFight: (n: number) => string;
  playerKnockedOut: (n: number) => string;
  allLevelNextDecides: string;
  fightsLeft: (n: number) => string;
  allFightsComplete: string;
  nextPlayer: string;
  /** Button on the last result card, leading into the celebration. */
  seeTheResult: string;

  // reveal
  finalScore: string;
  congratulations: string;
  playAgain: string;

  // rotate overlay (DOM, not canvas)
  rotatePhone: string;
}

const FR: Strings = {
  titleSub: "LE GRAND JEU DU GENDER REVEAL",
  play: "JOUER",
  settings: "OPTIONS",
  titleHint: "Choisissez votre équipe. Une seule peut gagner.",
  credit: "INSÉREZ DE LA JOIE  •  1 CRÉDIT",

  settingsTitle: "OPTIONS",
  music: "MUSIQUE",
  sfx: "EFFETS SONORES",
  rounds: "MANCHES",
  bestOf: "AU MEILLEUR DES",
  language: "LANGUE",
  back: "RETOUR",
  on: "OUI",
  off: "NON",

  howManyPlayers: "COMBIEN DE JOUEURS ?",
  setupHint: "Chacun affronte l'ordinateur à son tour",
  player: "JOUEUR",
  players: "JOUEURS",
  playerSelected: "1 JOUEUR SÉLECTIONNÉ",
  playersSelected: "JOUEURS SÉLECTIONNÉS",
  start: "COMMENCER",

  chooseTeam: "CHOISISSEZ VOTRE ÉQUIPE",
  youFightFor: "VOUS COMBATTEZ POUR CETTE ÉQUIPE",
  allPlayersFightFor: (n) => `LES ${n} JOUEURS COMBATTENT POUR CETTE ÉQUIPE`,
  team: "ÉQUIPE",
  teamSelectHint: "L'ORDINATEUR JOUE L'AUTRE ÉQUIPE  •  CHAQUE VICTOIRE VAUT 1 POINT",

  playerN: (n) => `JOUEUR ${n}`,
  fightingFor: (team) => `COMBAT POUR L'ÉQUIPE ${team}`,
  fightXofY: (x, y) => `COMBAT ${x} SUR ${y}`,
  fight: "COMBATTRE !",
  finalBattle: "COMBAT FINAL",
  scoresLevel: "ÉGALITÉ PARFAITE  •  TOUT SE JOUE ICI",
  anyoneCanPlay: "N'IMPORTE QUI PEUT JOUER CELUI-LÀ",
  forTeam: (team) => `POUR L'ÉQUIPE ${team}`,
  settleIt: "TOUT DONNER !",

  controlsTitle: "COMMANDES",
  move: "SE DÉPLACER",
  jump: "SAUTER",
  punch: "COUP DE POING",
  kick: "COUP DE PIED",
  strong: "COUP PUISSANT",
  block: "GARDE",
  fastLight: "RAPIDE, LÉGER",
  medium: "MOYEN",
  slowHeavy: "LENT, PUISSANT",
  reduceDamage: "RÉDUIT LES DÉGÂTS",

  round: (n) => `MANCHE ${n}`,
  ready: "PRÊT ?",
  fightNow: "COMBATTEZ !",
  ko: "K.O.",
  youWin: "VOUS GAGNEZ",
  cpuWins: "L'ORDI GAGNE",
  cpu: "ORDI",
  playerLabel: "JOUEUR",

  pointForTeam: (team) => `POINT POUR L'ÉQUIPE ${team}`,
  playerWinsFight: (n) => `LE JOUEUR ${n} REMPORTE LE COMBAT`,
  playerKnockedOut: (n) => `LE JOUEUR ${n} EST K.O.`,
  allLevelNextDecides: "ÉGALITÉ  •  LE PROCHAIN COMBAT DÉCIDE TOUT",
  fightsLeft: (n) => (n === 1 ? "1 COMBAT RESTANT" : `${n} COMBATS RESTANTS`),
  allFightsComplete: "TOUS LES COMBATS SONT JOUÉS",
  nextPlayer: "JOUEUR SUIVANT",
  seeTheResult: "VOIR LE RÉSULTAT !",

  finalScore: "SCORE FINAL",
  congratulations: "FÉLICITATIONS !",
  playAgain: "REJOUER",

  rotatePhone: "TOURNEZ VOTRE\nTÉLÉPHONE",
};

const EN: Strings = {
  titleSub: "THE ULTIMATE GENDER REVEAL",
  play: "PLAY",
  settings: "SETTINGS",
  titleHint: "Choose your team. Only one can win.",
  credit: "INSERT JOY  •  1 CREDIT",

  settingsTitle: "SETTINGS",
  music: "MUSIC",
  sfx: "SOUND FX",
  rounds: "ROUNDS",
  bestOf: "BEST OF",
  language: "LANGUAGE",
  back: "BACK",
  on: "ON",
  off: "OFF",

  howManyPlayers: "HOW MANY PLAYERS?",
  setupHint: "Everyone takes a turn against the computer",
  player: "PLAYER",
  players: "PLAYERS",
  playerSelected: "1 PLAYER SELECTED",
  playersSelected: "PLAYERS SELECTED",
  start: "START",

  chooseTeam: "CHOOSE YOUR TEAM",
  youFightFor: "YOU FIGHT FOR THIS TEAM",
  allPlayersFightFor: (n) => `ALL ${n} PLAYERS FIGHT FOR THIS TEAM`,
  team: "TEAM",
  teamSelectHint: "THE COMPUTER PLAYS THE OTHER TEAM  •  EVERY WIN SCORES A POINT",

  playerN: (n) => `PLAYER ${n}`,
  fightingFor: (team) => `FIGHTING FOR TEAM ${team}`,
  fightXofY: (x, y) => `FIGHT ${x} OF ${y}`,
  fight: "FIGHT!",
  finalBattle: "FINAL BATTLE",
  scoresLevel: "SCORES ARE LEVEL  •  WINNER TAKES ALL",
  anyoneCanPlay: "ANYONE CAN PLAY THIS ONE",
  forTeam: (team) => `FOR TEAM ${team}`,
  settleIt: "SETTLE IT!",

  controlsTitle: "CONTROLS",
  move: "MOVE",
  jump: "JUMP",
  punch: "PUNCH",
  kick: "KICK",
  strong: "STRONG",
  block: "BLOCK",
  fastLight: "FAST, LIGHT",
  medium: "MEDIUM",
  slowHeavy: "SLOW, HEAVY",
  reduceDamage: "REDUCE DAMAGE",

  round: (n) => `ROUND ${n}`,
  ready: "READY?",
  fightNow: "FIGHT!",
  ko: "K.O.",
  youWin: "YOU WIN",
  cpuWins: "CPU WINS",
  cpu: "CPU",
  playerLabel: "PLAYER",

  pointForTeam: (team) => `POINT FOR TEAM ${team}`,
  playerWinsFight: (n) => `PLAYER ${n} WINS THE FIGHT`,
  playerKnockedOut: (n) => `PLAYER ${n} IS KNOCKED OUT`,
  allLevelNextDecides: "ALL LEVEL  •  NEXT FIGHT DECIDES EVERYTHING",
  fightsLeft: (n) => (n === 1 ? "1 FIGHT LEFT" : `${n} FIGHTS LEFT`),
  allFightsComplete: "ALL FIGHTS COMPLETE",
  nextPlayer: "NEXT PLAYER",
  seeTheResult: "SEE THE RESULT!",

  finalScore: "FINAL SCORE",
  congratulations: "CONGRATULATIONS!",
  playAgain: "PLAY AGAIN",

  rotatePhone: "PLEASE ROTATE\nYOUR PHONE",
};

const TABLE: Record<Lang, Strings> = { fr: FR, en: EN };

const STORAGE_KEY = "bb.lang";

/** French unless the organizer previously chose otherwise. */
function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch {
    // Private browsing can throw on localStorage; the default is fine.
  }
  return "fr";
}

let current: Lang = loadLang();

/** The active string table. Read fresh on each use so switching is instant. */
export function t(): Strings {
  return TABLE[current];
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not being able to remember the choice is not worth failing over.
  }
}

export function toggleLang(): Lang {
  setLang(current === "fr" ? "en" : "fr");
  return current;
}

/** Flag shown on the language button: the flag of the language you'd switch TO. */
export function otherFlag(): string {
  return current === "fr" ? "🇬🇧" : "🇫🇷";
}

/** Flag of the language currently active. */
export function currentFlag(): string {
  return current === "fr" ? "🇫🇷" : "🇬🇧";
}

export function otherLangName(): string {
  return current === "fr" ? "ENGLISH" : "FRANÇAIS";
}
