const TOKEN_KEY = "nusuk-owner-token";
const OWNED_KEY = "nusuk-owned-codes";

/** A private random key for this device; proves which codes were added from here. */
export function getDeviceToken(): string {
  try {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
      localStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  } catch {
    return "";
  }
}

export function loadOwned(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(OWNED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function save(next: Set<string>) {
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify([...next]));
  } catch {}
  return next;
}

export function addOwned(prev: Set<string>, id: string) {
  return save(new Set(prev).add(id));
}

export function removeOwned(prev: Set<string>, id: string) {
  const next = new Set(prev);
  next.delete(id);
  return save(next);
}
