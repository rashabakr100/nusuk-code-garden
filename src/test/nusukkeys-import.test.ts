import { describe, expect, it } from "vitest";
import { parseNusukKeysResponse, shouldWaitForBackoff } from "@/lib/nusukkeys-import";

const now = new Date("2026-11-22T10:00:00Z");

describe("importing codes from nusukkeys.xyz", () => {
  it("keeps only codes that pass the NG- validator, without duplicates", () => {
    const body = {
      codes: [
        { code: "NG-TY9MxRCa", age_s: 60 },
        { code: "kVaLRiYA" },
        { code: "NG-" },
        { code: "NG-ab cd" },
        { code: "NG-TY9MxRCa" },
        { code: 42 },
      ],
    };
    expect(parseNusukKeysResponse(body, now).map((c) => c.code)).toEqual(["NG-TY9MxRCa"]);
  });
  it("an empty, broken or changed answer gives no codes (counted as a failed sync)", () => {
    expect(parseNusukKeysResponse(null, now)).toEqual([]);
    expect(parseNusukKeysResponse({ codes: [] }, now)).toEqual([]);
    expect(parseNusukKeysResponse({ items: [{ code: "NG-x" }] }, now)).toEqual([]);
    expect(parseNusukKeysResponse("<html>blocked</html>", now)).toEqual([]);
  });
  it("after 5 failures in a row, scheduled runs wait 6 hours", () => {
    const at = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
    expect(shouldWaitForBackoff({ consecutive_failures: 4, last_attempt_at: at(0.5) }, now)).toBe(false);
    expect(shouldWaitForBackoff({ consecutive_failures: 5, last_attempt_at: at(0.5) }, now)).toBe(true);
    expect(shouldWaitForBackoff({ consecutive_failures: 5, last_attempt_at: at(5) }, now)).toBe(true);
    expect(shouldWaitForBackoff({ consecutive_failures: 5, last_attempt_at: at(6) }, now)).toBe(false);
    expect(shouldWaitForBackoff(null, now)).toBe(false);
  });
});
