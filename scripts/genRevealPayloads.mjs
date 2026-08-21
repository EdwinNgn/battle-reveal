/**
 * Generates the XOR-encoded reveal payloads for src/config/revealText.ts.
 *
 *   node scripts/genRevealPayloads.mjs
 *
 * Run this only to change the reveal wording. Paste the output into
 * revealText.ts. The plain strings live here, in a file that is never imported
 * by the app and therefore never reaches the bundle.
 *
 * Four payloads are needed: two outcomes x two languages. All four ship in every
 * build, encoded, so nothing about the answer can be read out of the JavaScript.
 */

const KEY = 0x5a;

const encodeUnits = (s) => {
  const out = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) ^ KEY);
  return out;
};

const variants = {
  fr: {
    girl: { headline: "C'EST UNE FILLE !", icon: "🎀", label: "FILLE" },
    boy: { headline: "C'EST UN GARÇON !", icon: "💙", label: "GARÇON" },
  },
  en: {
    girl: { headline: "IT'S A GIRL!", icon: "🎀", label: "GIRL" },
    boy: { headline: "IT'S A BOY!", icon: "💙", label: "BOY" },
  },
};

const fmt = (arr) => `[${arr.join(", ")}]`;

for (const [lang, byOutcome] of Object.entries(variants)) {
  console.log(`  // ---- ${lang} ----`);
  // Index 1 = boy, index 2 = girl, matching WINNER_CODE.
  for (const outcome of ["boy", "girl"]) {
    const v = byOutcome[outcome];
    console.log(`  // ${outcome}`);
    console.log(`  { headline: ${fmt(encodeUnits(v.headline))},`);
    console.log(`    icon: ${fmt(encodeUnits(v.icon))},`);
    console.log(`    label: ${fmt(encodeUnits(v.label))} },`);
  }
  console.log("");
}

// Round-trip check, so a bad payload is caught here rather than on the night.
const decode = (bytes) => bytes.map((b) => String.fromCharCode(b ^ KEY)).join("");
let ok = true;
for (const byOutcome of Object.values(variants)) {
  for (const v of Object.values(byOutcome)) {
    for (const field of ["headline", "icon", "label"]) {
      if (decode(encodeUnits(v[field])) !== v[field]) {
        console.error(`ROUND TRIP FAILED for ${v[field]}`);
        ok = false;
      }
    }
  }
}
console.log(ok ? "// round-trip verified" : "// ROUND TRIP FAILED");
