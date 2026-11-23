/** Codes that always stay at the top of the list, in this exact order. */
export const PINNED_CODES = [
  "NG-LLTIwaG5",
  "NG-hzp5YN9q",
  "NG-YZu7cgO8",
  "NG-Q581g6xH",
  "NG-wyEroUQ4",
  "NG-JUDdJorK",
] as const;

export function pinnedRank(code: string) {
  return (PINNED_CODES as readonly string[]).indexOf(code);
}

function newestFirst<T extends { created_at?: string }>(a: T, b: T) {
  const ta = a.created_at ? Date.parse(a.created_at) : NaN;
  const tb = b.created_at ? Date.parse(b.created_at) : NaN;
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  return tb - ta;
}

/**
 * Codes this visitor hasn't copied come first: pinned codes (in pinned order), then the rest in the order
 * they came (newest first). Codes this visitor has copied go to the bottom, newest first, pinned or not.
 * With no copied set, this is simply pinned first, then everything else.
 */
export function orderCodes<T extends { code: string; id?: string; created_at?: string }>(
  codes: T[],
  copied?: ReadonlySet<string>,
): T[] {
  const isCopied = (c: T) => !!copied && c.id !== undefined && copied.has(c.id);
  const fresh = codes.filter((c) => !isCopied(c));
  const pinned = fresh
    .filter((c) => pinnedRank(c.code) !== -1)
    .sort((a, b) => pinnedRank(a.code) - pinnedRank(b.code));
  const rest = fresh.filter((c) => pinnedRank(c.code) === -1);
  const used = codes.filter(isCopied).sort(newestFirst);
  return [...pinned, ...rest, ...used];
}

/** The code the "next code" card should show: the first one in list order this visitor hasn't used yet. */
export function nextCodeToUse<T extends { id: string }>(ordered: T[], used: Set<string>): T | null {
  return ordered.find((c) => !used.has(c.id)) ?? null;
}

/** Link that opens the Nusuk app with the referral code filled in. */
export function nusukOpenUrl(code: string) {
  return `https://services.nusuk.sa/app/?p=27&id=${encodeURIComponent(code)}`;
}
