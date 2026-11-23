import { isValidNgCode } from "@/lib/ng-code";

/** Where "Fetch more codes" reads from: exactly these two pages, one request each. */
export const NUSUKKEY_SOURCE = "nusukkey.xyz";
export const NUSUKKEY_PAGES = ["https://www.nusukkey.xyz/", "https://www.nusukkey.xyz/codes"] as const;
export const PAUSE_BETWEEN_PAGES_MS = 3000;
export const MAX_NEW_PER_RUN = 50;
export const MIN_MS_BETWEEN_RUNS = 15_000;

const PLACEHOLDER = "NG-XXXXXXXX";
// "NG-" then exactly 8 letters/digits; anything stuck after them (like a name) is ignored.
// The "NG-" must not be the end of a longer word (e.g. "LOADING-...").
const CODE_IN_TEXT = /(?<![A-Za-z0-9])NG-([A-Za-z0-9]{8})/g;
const CODE_IN_OPEN_LINK = /services\.nusuk\.sa\/app\/\?p=27&(?:amp;)?id=NG-([A-Za-z0-9]{8})/g;

function collect(html: string, pattern: RegExp, into: string[], seen: Set<string>) {
  for (const m of html.matchAll(pattern)) {
    const code = `NG-${m[1]}`;
    if (code === PLACEHOLDER || !isValidNgCode(code) || seen.has(code)) continue;
    seen.add(code);
    into.push(code);
  }
}

/** Codes written in the page text, in the order they appear, without duplicates. Case is kept exactly. */
export function parseCodesFromHtml(html: string): string[] {
  const out: string[] = [];
  collect(html, CODE_IN_TEXT, out, new Set());
  return out;
}

/** Codes read from the page's "Open" links (only read from the HTML, never requested). */
export function parseOpenLinkIds(html: string): string[] {
  const out: string[] = [];
  collect(html, CODE_IN_OPEN_LINK, out, new Set());
  return out;
}

/** Splits found codes into ones to add (at most 50) and how many we already had. */
export function planImport(found: string[], existing: Set<string>) {
  const fresh = found.filter((c) => !existing.has(c));
  return { toAdd: fresh.slice(0, MAX_NEW_PER_RUN), alreadyHad: found.length - fresh.length };
}
