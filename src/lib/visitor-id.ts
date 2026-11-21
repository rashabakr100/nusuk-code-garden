const KEY = "nusuk-visitor-id";

/** An anonymous id for this device, used only to count how many different people used a code. */
export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
