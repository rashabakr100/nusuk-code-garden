const KEY = "nusuk-copied-codes";

/** Codes this visitor already used (copied or opened), remembered on this device. */
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

/** Adds codes used from the person's account (other devices, earlier visits) without dropping any used here. */
export function mergeCopied(prev: Set<string>, ids: Iterable<string>): Set<string> {
  const next = new Set(prev);
  for (const id of ids) next.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {}
  return next;
}

/** A code can be copied by a single tap only if this visitor hasn't used it yet. */
export function canTapToCopy(copied: Set<string>, id: string) {
  return !copied.has(id);
}

export function normalizeCode(raw: string) {
  return raw.trim();
}
