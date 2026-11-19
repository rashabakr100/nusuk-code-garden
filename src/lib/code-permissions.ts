export type Viewer = { id: string; isAdmin: boolean } | null;

/**
 * Admins can edit or delete any code. Whoever added a code can edit or delete it:
 * a signed-in person through their account, a visitor from the device they added it on.
 * Nobody else can. (The database enforces the same rule; this only decides which buttons to show.)
 */
export function canManageCode(
  code: { id: string; user_id: string | null },
  viewer: Viewer,
  ownedOnThisDevice: Set<string>,
) {
  if (viewer?.isAdmin) return true;
  if (viewer && code.user_id !== null && code.user_id === viewer.id) return true;
  return ownedOnThisDevice.has(code.id);
}

/** Owners signed into their account and admins use their account; device owners use their device key. */
export function manageVia(code: { user_id: string | null }, viewer: Viewer): "account" | "device" {
  if (viewer?.isAdmin) return "account";
  if (viewer && code.user_id === viewer.id) return "account";
  return "device";
}
