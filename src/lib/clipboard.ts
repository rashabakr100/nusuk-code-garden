/**
 * Copies right away, inside the tap, so it still works when the same tap
 * then leaves the page (for example to open the Nusuk app).
 */
export function copyNow(text: string): boolean {
  let ok = false;
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "0";
    el.style.opacity = "0";
    el.style.fontSize = "16px";
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, text.length);
    ok = document.execCommand("copy");
    document.body.removeChild(el);
  } catch {
    ok = false;
  }
  if (!ok && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    ok = true;
  }
  return ok;
}
