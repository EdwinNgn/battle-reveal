import type { FighterId } from "../config/secretConfig.ts";
import { simulateMatch } from "./simulate.ts";
import { ALL_PROFILES, type PlayerProfile } from "./SyntheticPlayer.ts";

/**
 * In-browser testing panel.
 *
 * Guarded by `import.meta.env.DEV`, so Vite drops this module entirely from the
 * production build. It is never reachable from the normal UI: the organizer
 * opens it during `npm run dev` by pressing Ctrl+Shift+D, or by visiting
 * `?devtest=1`.
 *
 * It runs the real match simulation for both possible settings and reports
 * whether the designated fighter won every time.
 */

const PANEL_ID = "dev-test-panel";

function styleSheet(): string {
  return `
  #${PANEL_ID}{position:fixed;inset:0;z-index:999;background:rgba(4,3,10,.96);
    color:#dcd2f5;font:13px/1.5 ui-monospace,Menlo,monospace;padding:18px;
    overflow:auto}
  #${PANEL_ID} h2{font:600 18px/1.3 ui-monospace,monospace;color:#3df0ff;margin-bottom:4px}
  #${PANEL_ID} .hint{color:#8a7cb0;margin-bottom:14px}
  #${PANEL_ID} button{font:inherit;background:#241a44;color:#fdf7ff;border:2px solid #a94dff;
    padding:7px 14px;margin-right:8px;margin-bottom:12px;cursor:pointer;border-radius:4px}
  #${PANEL_ID} button:hover{background:#33265e}
  #${PANEL_ID} table{border-collapse:collapse;margin-top:10px;width:100%}
  #${PANEL_ID} th,#${PANEL_ID} td{border:1px solid #33265e;padding:4px 8px;text-align:left}
  #${PANEL_ID} th{color:#ffd23d}
  #${PANEL_ID} .ok{color:#4dffa3}
  #${PANEL_ID} .bad{color:#ff5f6d;font-weight:700}
  #${PANEL_ID} .close{position:absolute;top:14px;right:16px;border-color:#ff3d81}
  #${PANEL_ID} pre{white-space:pre-wrap;margin-top:10px;color:#b9a6e0}
  `;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function secs(ms: number): string {
  return `${(ms / 1000).toFixed(0)}s`;
}

function median(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function mean(v: number[]): number {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

/** Runs the full grid and renders it into the panel. */
function runSuite(out: HTMLElement, perCombo: number): void {
  out.innerHTML = "<p>Running…</p>";

  // Let the browser paint the "Running" state before the blocking work.
  setTimeout(() => {
    const rows: string[] = [];
    let failures = 0;
    let total = 0;
    const allDur: number[] = [];
    const allLoserLow: number[] = [];
    const allLead: number[] = [];

    for (const expectedWinner of ["female", "male"] as FighterId[]) {
      for (const picked of ["male", "female"] as FighterId[]) {
        for (const profile of ALL_PROFILES as PlayerProfile[]) {
          const durations: number[] = [];
          const loserLow: number[] = [];
          const leads: number[] = [];
          let correct = 0;

          for (let i = 0; i < perCombo; i++) {
            const seed = (0x2f6ec3 + i * 2654435761 + profile.length * 131) >>> 0;
            const o = simulateMatch(picked, profile, seed, expectedWinner);
            if (o.winner === expectedWinner) correct++;
            durations.push(o.durationMs);
            loserLow.push(o.loserLowestHealth);
            leads.push(o.playerLeadFraction);
          }

          total += perCombo;
          const bad = perCombo - correct;
          failures += bad;
          allDur.push(...durations);
          allLoserLow.push(...loserLow);
          allLead.push(...leads);

          rows.push(
            `<tr>
              <td>${expectedWinner === "female" ? "GIRL" : "BOY"}</td>
              <td>${picked}${picked === expectedWinner ? " (must win)" : " (must lose)"}</td>
              <td>${profile}</td>
              <td class="${bad ? "bad" : "ok"}">${correct}/${perCombo}</td>
              <td>${secs(median(durations))}</td>
              <td>${pct(mean(loserLow))}</td>
              <td>${pct(mean(leads))}</td>
            </tr>`,
          );
        }
      }
    }

    const verdict = failures
      ? `<p class="bad">FAIL — ${failures} of ${total} matches produced the wrong winner.</p>`
      : `<p class="ok">PASS — the designated fighter won all ${total} matches.</p>`;

    out.innerHTML = `
      ${verdict}
      <pre>median duration ${secs(median(allDur))}   in 90-210s window ${pct(
        allDur.filter((d) => d >= 90_000 && d <= 210_000).length / allDur.length,
      )}
loser's lowest health ${pct(mean(allLoserLow))} avg   losses within 15% ${pct(
      allLoserLow.filter((h) => h <= 0.15).length / allLoserLow.length,
    )}
time player spent ahead ${pct(mean(allLead))} avg</pre>
      <table>
        <tr><th>setting</th><th>player picked</th><th>style</th><th>correct</th>
        <th>median</th><th>loser got to</th><th>player ahead</th></tr>
        ${rows.join("")}
      </table>`;
  }, 30);
}

function build(): HTMLElement {
  const panel = document.createElement("div");
  panel.id = PANEL_ID;

  const style = document.createElement("style");
  style.textContent = styleSheet();
  panel.appendChild(style);

  panel.insertAdjacentHTML(
    "beforeend",
    `<h2>BABY BATTLE — outcome verification</h2>
     <p class="hint">Simulates real matches for both possible settings against six
     styles of player, including experts, button-mashers and people who barely
     press anything. Development build only.</p>`,
  );

  const close = document.createElement("button");
  close.className = "close";
  close.textContent = "CLOSE";
  close.onclick = () => panel.remove();
  panel.appendChild(close);

  const out = document.createElement("div");

  for (const n of [10, 25, 60] as const) {
    const b = document.createElement("button");
    b.textContent = `RUN ${n} PER CASE (${n * 24} matches)`;
    b.onclick = () => runSuite(out, n);
    panel.appendChild(b);
  }

  panel.appendChild(out);
  return panel;
}

/** Installs the keyboard shortcut and the query-string entry point. */
export function installDevPanel(): void {
  const open = (): void => {
    if (document.getElementById(PANEL_ID)) return;
    document.body.appendChild(build());
  };

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === "KeyD") {
      e.preventDefault();
      open();
    }
  });

  if (new URLSearchParams(location.search).has("devtest")) open();

  // Quietly available in the dev console too.
  (window as unknown as { openDevTest: () => void }).openDevTest = open;
}
