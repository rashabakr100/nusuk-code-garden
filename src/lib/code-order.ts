/** Codes that always stay at the top of the list, in this exact order. */
export const PINNED_CODES = [
  "NG-LLTIwaG5",
  "NG-hzp5YN9q",
  "NG-YZu7cgO8",
  "NG-Q581g6xH",
  "NG-wyEroUQ4",
  "NG-JUDdJorK",
] as const;

export const BULK_SOURCE = "bulk import";
/** Sources written by "Fetch more codes" (manual or automatic); the first is the old, wrong site. */
export const FETCHED_SOURCES = ["nusukkey.xyz", "nusukkeys.xyz"] as const;

export type CodeType = "pinned" | "shared" | "bulk" | "fetched";

export function pinnedRank(code: string) {
  return (PINNED_CODES as readonly string[]).indexOf(code);
}

/** Every code has exactly one type, checked in this order: pinned, bulk, fetched, otherwise shared. */
export function codeType(c: { code: string; source?: string | null }): CodeType {
  if (pinnedRank(c.code) !== -1) return "pinned";
  if (c.source === BULK_SOURCE) return "bulk";
  if (c.source && (FETCHED_SOURCES as readonly string[]).includes(c.source)) return "fetched";
  return "shared";
}

function time(iso?: string) {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

type Orderable = { code: string; id?: string; created_at?: string; source?: string | null };

export type OrderOptions = {
  /** When this visitor copied each code (ms). Codes copied with no known time count as copied earliest. */
  copiedAt?: Readonly<Record<string, number>>;
  /** Codes this visitor shared (their own). Ignored for the next-code card. */
  own?: ReadonlySet<string>;
};

/**
 * Part A, codes this visitor hasn't copied, in four separate blocks: pinned (pinned order), shared, bulk,
 * fetched (each newest first). Part B, codes this visitor has copied, all types mixed, by copy time with
 * the last copied code at the very bottom.
 * Own-code rule: this visitor's own uncopied shared codes that are still the newest shared codes
 * (no newer uncopied shared code above them) are lifted above the pinned block, for this visitor only.
 */
export function orderCodes<T extends Orderable>(codes: T[], copied?: ReadonlySet<string>, opts: OrderOptions = {}): T[] {
  const isCopied = (c: T) => !!copied && c.id !== undefined && copied.has(c.id);
  const newestFirst = (a: T, b: T) => time(b.created_at) - time(a.created_at);
  const fresh = codes.filter((c) => !isCopied(c));
  const of = (t: CodeType) => fresh.filter((c) => codeType(c) === t);

  const pinned = of("pinned").sort((a, b) => pinnedRank(a.code) - pinnedRank(b.code));
  const shared = of("shared").sort(newestFirst);
  const bulk = of("bulk").sort(newestFirst);
  const fetched = of("fetched").sort(newestFirst);

  const at = opts.copiedAt ?? {};
  const used = codes
    .filter(isCopied)
    .map((c, i) => ({ c, i, t: at[c.id as string] ?? 0 }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.c);

  let lifted = 0;
  const own = opts.own;
  if (own && own.size > 0) {
    while (lifted < shared.length && shared[lifted]?.id !== undefined && own.has(shared[lifted]!.id!)) lifted++;
  }
  return [...shared.slice(0, lifted), ...pinned, ...shared.slice(lifted), ...bulk, ...fetched, ...used];
}

/** The code the "next code" card should show: the first one in list order this visitor hasn't used yet. */
export function nextCodeToUse<T extends { id: string }>(ordered: T[], used: ReadonlySet<string>): T | null {
  return ordered.find((c) => !used.has(c.id)) ?? null;
}

/** Link that opens the Nusuk app with the referral code filled in. */
export function nusukOpenUrl(code: string) {
  return `https://services.nusuk.sa/app/?p=27&id=${encodeURIComponent(code)}`;
}
