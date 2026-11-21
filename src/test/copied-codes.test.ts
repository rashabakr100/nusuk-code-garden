import { describe, expect, it, beforeEach } from "vitest";
import { canTapToCopy, loadCopied, markCopied, mergeCopied } from "@/lib/copied-codes";

describe("copied codes", () => {
  beforeEach(() => localStorage.clear());
  it("a code can be tapped to copy before it was copied", () => {
    expect(canTapToCopy(new Set(), "a")).toBe(true);
  });
  it("after copying, the same code can no longer be tapped to copy, but others can right away", () => {
    const s = markCopied(new Set(), "a");
    expect(canTapToCopy(s, "a")).toBe(false);
    expect(canTapToCopy(s, "b")).toBe(true);
  });
  it("copied state is remembered on this device", () => {
    markCopied(new Set(), "a");
    expect(loadCopied().has("a")).toBe(true);
  });
  it("after signing in, codes used before stay used and the account's codes are added", () => {
    const before = markCopied(new Set(), "a");
    const after = mergeCopied(before, ["b"]);
    expect(canTapToCopy(after, "a")).toBe(false);
    expect(canTapToCopy(after, "b")).toBe(false);
    expect(loadCopied()).toEqual(new Set(["a", "b"]));
  });
});
