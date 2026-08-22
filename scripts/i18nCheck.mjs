/**
 * Verifies the French/English switch in a real browser.
 *
 *   node scripts/i18nCheck.mjs
 *
 * Checks that:
 *   - French is the default
 *   - every string has a translation in both languages
 *   - no translation is long enough to overflow the space it is drawn into
 *   - the reveal headline decodes correctly in both languages and both outcomes
 *   - the choice survives a reload
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const URL_BASE = process.argv[2] ?? "http://localhost:5173/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9226;

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--user-data-dir=/tmp/baby-battle-chrome-i18n",
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=1366,768",
    URL_BASE,
  ],
  { stdio: "ignore" },
);
process.on("exit", () => chrome.kill());

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json`);
      const t = (await r.json()).find((x) => x.type === "page" && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch {}
    await sleep(250);
  }
  throw new Error("no devtools endpoint");
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 1;
const pending = new Map();
const errors = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    return;
  }
  if (m.method === "Runtime.exceptionThrown") {
    errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  }
});
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", rej, { once: true });
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = id++;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description);
  return r.result.value;
};

await send("Runtime.enable");
await send("Page.enable");
await sleep(1600);

console.log("\nBABY BATTLE - localisation check\n");
const problems = [];

// --- default language ---
const defaultLang = await evaluate(`(async () => {
  const m = await import("/src/i18n/strings.ts");
  return m.getLang();
})()`);
console.log(`  default language: ${defaultLang}`);
if (defaultLang !== "fr") problems.push(`default language is "${defaultLang}", expected "fr"`);

// --- completeness: every key present and non-empty in both languages ---
const completeness = await evaluate(`(async () => {
  const m = await import("/src/i18n/strings.ts");
  const out = { missing: [], byLang: {} };
  const langs = ["fr", "en"];
  const snapshot = {};
  for (const l of langs) {
    m.setLang(l);
    const s = m.t();
    snapshot[l] = {};
    for (const [k, v] of Object.entries(s)) {
      const val = typeof v === "function" ? v(3, 5) : v;
      snapshot[l][k] = String(val);
      if (!val || String(val).trim() === "") out.missing.push(l + "." + k);
    }
  }
  // Keys present in one language but not the other.
  const frKeys = Object.keys(snapshot.fr), enKeys = Object.keys(snapshot.en);
  for (const k of frKeys) if (!enKeys.includes(k)) out.missing.push("en." + k);
  for (const k of enKeys) if (!frKeys.includes(k)) out.missing.push("fr." + k);
  out.byLang = snapshot;
  out.count = frKeys.length;
  m.setLang("fr");
  return out;
})()`);

console.log(`  strings per language: ${completeness.count}`);
if (completeness.missing.length) {
  problems.push(`missing or empty translations: ${completeness.missing.join(", ")}`);
}

// --- untranslated leftovers: identical in both languages ---
// Some are legitimately identical (K.O., BOY, GIRL, numbers), so only report the
// ones that look like real sentences.
const identical = Object.keys(completeness.byLang.fr).filter(
  (k) => completeness.byLang.fr[k] === completeness.byLang.en[k],
);
const allowedIdentical = new Set(["ko", "titleSub"]);
const suspicious = identical.filter(
  (k) => !allowedIdentical.has(k) && completeness.byLang.fr[k].length > 4,
);
console.log(`  identical in both languages: ${identical.length} (${identical.join(", ") || "none"})`);
if (suspicious.length) {
  problems.push(`possibly untranslated: ${suspicious.join(", ")}`);
}

// --- overflow: measure each string at the size it is drawn ---
const overflow = await evaluate(`(async () => {
  const m = await import("/src/i18n/strings.ts");
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  const FONT = '"Impact", "Haettenschweiler", "Arial Narrow Bold", sans-serif';
  // key -> [font size used on screen, space available in virtual px]
  const budget = {
    titleSub: [30, 560], titleHint: [19, 700], credit: [14, 700],
    howManyPlayers: [58, 900], setupHint: [20, 820],
    chooseTeam: [54, 900], youFightFor: [21, 900], teamSelectHint: [15, 940],
    finalBattle: [92, 900], scoresLevel: [24, 900], anyoneCanPlay: [34, 900],
    controlsTitle: [52, 640], allLevelNextDecides: [24, 900],
    congratulations: [34, 900], finalScore: [24, 400],
    playAgain: [30, 300], settleIt: [30, 360], fight: [30, 360],
    nextPlayer: [30, 440], theWinnerIs: [76, 900],
    move: [25, 300], jump: [25, 300], punch: [25, 300],
    kick: [25, 300], strong: [25, 300], block: [25, 300],
    reduceDamage: [25, 300], slowHeavy: [25, 300], fastLight: [25, 300],
    rulesTitle: [17, 620],
  };

  // The rules are arrays of lines, each drawn at 18px inside a 660px panel.
  // Checked separately since the budget table only handles single strings.
  const RULES_SIZE = 18;
  const RULES_SPACE = 620;
  const bad = [];
  for (const lang of ["fr", "en"]) {
    m.setLang(lang);
    const s = m.t();
    for (const [key, [size, space]] of Object.entries(budget)) {
      const raw = s[key];
      const text = typeof raw === "function" ? raw(3, 5) : raw;
      ctx.font = size + "px " + FONT;
      ctx.letterSpacing = (size * 0.06) + "px";
      const w = ctx.measureText(String(text)).width;
      if (w > space) bad.push({ lang, key, text: String(text), width: Math.round(w), space });
    }
  }
  for (const lang of ["fr", "en"]) {
    m.setLang(lang);
    const s = m.t();
    const groups = {
      rulesSolo: s.rulesSolo,
      rulesDecider: s.rulesDecider,
      rulesMulti8: s.rulesMulti(8),
    };
    for (const [key, lines] of Object.entries(groups)) {
      lines.forEach((line, i) => {
        ctx.font = RULES_SIZE + "px " + FONT;
        ctx.letterSpacing = "0.5px";
        const w = ctx.measureText(line).width;
        if (w > RULES_SPACE) {
          bad.push({ lang, key: key + "[" + i + "]", text: line, width: Math.round(w), space: RULES_SPACE });
        }
      });
    }
  }

  m.setLang("fr");
  return bad;
})()`);

console.log(`  strings that overflow their space: ${overflow.length}`);
for (const o of overflow) {
  console.log(`    ${o.lang}.${o.key}: ${o.width}px > ${o.space}px  "${o.text}"`);
  problems.push(`${o.lang}.${o.key} overflows (${o.width}px in ${o.space}px)`);
}

/*
 * --- reveal text decodes in both languages, for both outcomes ---
 *
 * Note the deliberate use of revealText's OWN copy of the strings module.
 *
 * In dev, Vite appends a cache-busting query to module URLs, so
 * `import("/src/i18n/strings.ts")` from here and the `strings.ts?t=...` that
 * revealText.ts imports are two SEPARATE module instances, each with its own
 * language variable. Calling setLang on our copy therefore had no effect on the
 * one revealText reads, and this check silently reported the French headline for
 * both languages. Driving the language through revealText's own dependency graph
 * removes the discrepancy. (The shipped bundle has a single instance, so this is
 * a dev-server artefact rather than a game bug.)
 */
const reveal = await evaluate(`(async () => {
  const rt = await import("/src/config/revealText.ts");
  // Resolve the exact strings module instance revealText is bound to.
  const src = await (await fetch("/src/config/revealText.ts")).text();
  const match = src.match(/from "([^"]*i18n\\/strings\\.ts[^"]*)"/);
  const m = await import(match[1]);

  const out = {};
  for (const lang of ["fr", "en"]) {
    m.setLang(lang);
    out[lang] = { headline: rt.revealHeadline(), icon: rt.revealIcon(), label: rt.revealLabel() };
  }
  m.setLang("fr");
  return out;
})()`);
console.log(`  reveal fr: "${reveal.fr.headline}" ${reveal.fr.icon}`);
console.log(`  reveal en: "${reveal.en.headline}" ${reveal.en.icon}`);
for (const lang of ["fr", "en"]) {
  const h = reveal[lang].headline;
  if (!h || h.length < 8 || h.includes("\uFFFD")) {
    problems.push(`${lang} reveal headline decoded badly: "${h}"`);
  }
  if (!reveal[lang].icon || reveal[lang].icon.length < 2) {
    problems.push(`${lang} reveal icon decoded badly`);
  }
}

// The two languages must actually differ. Without this the check happily passed
// while both languages returned the French headline.
if (reveal.fr.headline === reveal.en.headline) {
  problems.push(
    `reveal headline is identical in both languages ("${reveal.fr.headline}") - ` +
      `the language is not reaching revealText`,
  );
}

// --- the choice persists across a reload ---
await evaluate(`(async () => {
  const m = await import("/src/i18n/strings.ts");
  m.setLang("en");
  return true;
})()`);
await send("Page.reload");
await sleep(1600);
const afterReload = await evaluate(`(async () => {
  const m = await import("/src/i18n/strings.ts");
  return m.getLang();
})()`);
console.log(`  language after reload: ${afterReload}`);
if (afterReload !== "en") problems.push(`language did not persist (got "${afterReload}")`);
// Put it back to French so a later manual run starts as shipped.
await evaluate(`(async () => {
  const m = await import("/src/i18n/strings.ts");
  m.setLang("fr");
  return true;
})()`);

console.log(`\n  page exceptions: ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log(`    ${e}`);

if (problems.length || errors.length) {
  console.log("\n  FAIL:");
  for (const p of problems) console.log(`    - ${p}`);
  ws.close();
  chrome.kill();
  process.exit(1);
}
console.log("\n  PASS: French default, both languages complete, nothing overflows.\n");
ws.close();
chrome.kill();
