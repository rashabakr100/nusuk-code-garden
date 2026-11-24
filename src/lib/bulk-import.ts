import { isValidNgCode } from "@/lib/ng-code";

export const BULK_IMPORT_SOURCE = "bulk import";
export const MAX_BULK_NEW = 500;
export const MAX_BULK_TEXT = 200_000;

// Capital "NG-" counts anywhere (even glued to a word before it, e.g. "CopyNG-48G29od4"); lower/mixed case "ng-"
// only at the start of a line or after a space, so words like "pending-approval" never produce fake codes.
const CODE_IN_TEXT = /NG-([A-Za-z0-9]{8})|(?<=^|\s)[Nn][Gg]-([A-Za-z0-9]{8})/gm;
// Same starts without the 8 characters, used only to count starts that weren't followed by a valid code.
const START_IN_TEXT = /NG-|(?<=^|\s)[Nn][Gg]-/gm;

export type ParsedPaste = { codes: string[]; repeats: number; ignored: number };

/**
 * Finds codes in pasted text: "NG-" followed by exactly 8 letters/digits, kept exactly as written, even when other
 * text is stuck right before or after them. Placeholders, short codes and codes with spaces are ignored.
 * Returns unique codes in the order they appear.
 */
export function parsePastedCodes(text: string): ParsedPaste {
  const codes: string[] = [];
  const seen = new Set<string>();
  let repeats = 0;
  let matched = 0;
  let ignored = 0;
  for (const m of text.matchAll(CODE_IN_TEXT)) {
    matched++;
    const tail = m[1] ?? m[2] ?? "";
    const code = `NG-${tail}`;
    if (tail.toUpperCase() === "XXXXXXXX" || !isValidNgCode(code)) {
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
  ignored += Math.max(0, [...text.matchAll(START_IN_TEXT)].length - matched);
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
