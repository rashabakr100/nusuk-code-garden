import { describe, expect, it, beforeEach } from "vitest";
import { COPY_COOLDOWN_MS, canTapToCopy, getCopyCooldownMs, loadCopied, markCopied } from "@/lib/copied-codes";

describe("copied codes", () => {
  beforeEach(() => localStorage.clear());
  it("a code can be tapped to copy before it was copied", () => {
    expect(canTapToCopy(new Set(), "a")).toBe(true);
  });
  it("after copying, the same code can no longer be tapped to copy", () => {
    const s = markCopied(new Set(), "a");
    expect(canTapToCopy(s, "a")).toBe(false);
    expect(canTapToCopy(s, "b")).toBe(true);
  });
  it("copied state is remembered on this device", () => {
    markCopied(new Set(), "a");
    expect(loadCopied().has("a")).toBe(true);
  });
  it("requires a three-second wait before another code can be copied", () => {
    const firstCopyAt = 1000;
    const nextCopyAt = firstCopyAt + COPY_COOLDOWN_MS;
    expect(COPY_COOLDOWN_MS).toBe(3000);
    expect(getCopyCooldownMs(nextCopyAt, firstCopyAt)).toBe(3000);
    expect(getCopyCooldownMs(nextCopyAt, firstCopyAt + 2999)).toBe(1);
    expect(getCopyCooldownMs(nextCopyAt, firstCopyAt + 3000)).toBe(0);
  });
});
