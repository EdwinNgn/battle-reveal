import { getLang, t } from "./strings.ts";

/**
 * Applies translations to the few pieces of text that live in the DOM rather
 * than on the canvas: currently just the portrait rotate prompt.
 *
 * Called once at startup and again whenever the language changes.
 */
export function applyDomStrings(): void {
  const prompt = document.querySelector<HTMLElement>("#rotate-overlay p");
  if (prompt) {
    // The string carries a newline to control where it wraps.
    prompt.innerHTML = t()
      .rotatePhone.split("\n")
      .map((line) => escapeHtml(line))
      .join("<br />");
  }

  // Keep the document language accurate for screen readers and spell checkers.
  document.documentElement.lang = getLang();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
