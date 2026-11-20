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

/** Pinned codes first (in pinned order), then everything else in the order it came (newest first). */
export function orderCodes<T extends { code: string }>(codes: T[]): T[] {
  const pinned = codes
    .filter((c) => pinnedRank(c.code) !== -1)
    .sort((a, b) => pinnedRank(a.code) - pinnedRank(b.code));
  const rest = codes.filter((c) => pinnedRank(c.code) === -1);
  return [...pinned, ...rest];
}

/** The code the "next code" card should show: the first one in list order this visitor hasn't used yet. */
export function nextCodeToUse<T extends { id: string }>(ordered: T[], used: Set<string>): T | null {
  return ordered.find((c) => !used.has(c.id)) ?? null;
}

/** Link that opens the Nusuk app with the referral code filled in. */
export function nusukOpenUrl(code: string) {
  return `https://services.nusuk.sa/app/?p=27&id=${encodeURIComponent(code)}`;
}
