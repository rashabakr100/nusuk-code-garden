const KEY = "nusuk-copied-codes";

export function loadCopied(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function markCopied(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  next.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {}
  return next;
}

/** A code can be copied by a single tap only if this visitor hasn't copied it yet. */
export function canTapToCopy(copied: Set<string>, id: string) {
  return !copied.has(id);
}

export function normalizeCode(raw: string) {
  return raw.trim();
}
