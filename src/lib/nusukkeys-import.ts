import { isValidNgCode } from "@/lib/ng-code";

/** Where imported codes come from. One request per run, newest codes first. */
export const NUSUKKEYS_SOURCE = "nusukkeys.xyz";
export const NUSUKKEYS_URL = "https://nusukkeys.xyz/wp-json/nkc/v1/codes?page=1&per_page=50";

/** After this many failed runs in a row, only try again every BACKOFF_MS. */
export const MAX_FAILURES_BEFORE_BACKOFF = 5;
export const BACKOFF_MS = 6 * 60 * 60 * 1000;
// Scheduled runs can start a little early or late; don't miss a 6-hour slot by a few minutes.
const BACKOFF_SLACK_MS = 5 * 60 * 1000;

export type ImportCandidate = { code: string; createdAt: string | null };

/**
 * Reads the other site's answer and keeps only codes that pass our validator.
 * Never throws: anything unexpected just gives an empty list (treated as a failed sync).
 */
export function parseNusukKeysResponse(body: unknown, now: Date = new Date()): ImportCandidate[] {
  if (!body || typeof body !== "object") return [];
  const list = (body as { codes?: unknown }).codes;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: ImportCandidate[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const raw = (item as { code?: unknown }).code;
    if (typeof raw !== "string") continue;
    const code = raw.trim();
    if (!isValidNgCode(code) || seen.has(code)) continue;
    seen.add(code);
    const age = (item as { age_s?: unknown }).age_s;
    const createdAt =
      typeof age === "number" && Number.isFinite(age) && age >= 0 && age < 10 * 365 * 24 * 3600
        ? new Date(now.getTime() - age * 1000).toISOString()
        : null;
    out.push({ code, createdAt });
  }
  return out;
}

/** True when a scheduled run should be skipped because recent runs kept failing. */
export function shouldWaitForBackoff(
  state: { consecutive_failures: number; last_attempt_at: string | null } | null,
  now: Date = new Date(),
) {
  if (!state || state.consecutive_failures < MAX_FAILURES_BEFORE_BACKOFF || !state.last_attempt_at) return false;
  const since = now.getTime() - new Date(state.last_attempt_at).getTime();
  return since < BACKOFF_MS - BACKOFF_SLACK_MS;
}
