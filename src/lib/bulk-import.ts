import { isValidNgCode } from "@/lib/ng-code";

export const BULK_IMPORT_SOURCE = "bulk import";
export const MAX_BULK_NEW = 500;
export const MAX_BULK_TEXT = 200_000;

// "NG-" in any case, then the next 8 characters. The "NG-" must not be the end of a longer word (e.g. "ping-pong").
const NG_IN_TEXT = /(?<![A-Za-z0-9])ng-/gi;
const EIGHT_LETTERS_OR_DIGITS = /^[A-Za-z0-9]{8}$/;

export type ParsedPaste = { codes: string[]; repeats: number; ignored: number };

/**
 * Finds codes in pasted text: each "NG-" (any case) followed by exactly 8 letters/digits, kept exactly as written,
 * even when other text is stuck right after them. Placeholders, short codes and codes with spaces are ignored.
 * Returns unique codes in the order they appear.
 */
export function parsePastedCodes(text: string): ParsedPaste {
  const codes: string[] = [];
  const seen = new Set<string>();
  let repeats = 0;
  let ignored = 0;
  for (const m of text.matchAll(NG_IN_TEXT)) {
    const start = (m.index ?? 0) + m[0].length;
    const tail = text.slice(start, start + 8);
    const code = `NG-${tail}`;
    if (!EIGHT_LETTERS_OR_DIGITS.test(tail) || tail.toUpperCase() === "XXXXXXXX" || !isValidNgCode(code)) {
      ignored++;
      continue;
    }
    if (seen.has(code)) {
      repeats++;
      continue;
    }
    seen.add(code);
    codes.push(code);
  }
  return { codes, repeats, ignored };
}

/** Splits unique pasted codes into ones to add (at most 500) and ones the site already has. */
export function planBulkImport(codes: string[], existing: Set<string>) {
  const fresh = codes.filter((c) => !existing.has(c));
  return {
    toAdd: fresh.slice(0, MAX_BULK_NEW),
    alreadyHad: codes.length - fresh.length,
    overCap: Math.max(0, fresh.length - MAX_BULK_NEW),
  };
}
