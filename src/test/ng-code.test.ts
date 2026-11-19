import { describe, expect, it } from "vitest";
import { isValidNgCode, toNgCode } from "@/lib/ng-code";

describe('codes must start with "NG-"', () => {
  it('adds "NG-" in front of what was typed', () => {
    expect(toNgCode("kVaLRiYA")).toBe("NG-kVaLRiYA");
  });
  it('does not double the prefix when someone pastes a full "NG-" code', () => {
    expect(toNgCode("NG-kVaLRiYA")).toBe("NG-kVaLRiYA");
    expect(toNgCode("ng-kVaLRiYA")).toBe("NG-kVaLRiYA");
  });
  it('accepts codes that start with "NG-" followed by the code', () => {
    expect(isValidNgCode("NG-kVaLRiYA")).toBe(true);
  });
  it('rejects codes without "NG-" or with nothing after it', () => {
    expect(isValidNgCode("kVaLRiYA")).toBe(false);
    expect(isValidNgCode("XX-kVaLRiYA")).toBe(false);
    expect(isValidNgCode("NG-")).toBe(false);
    expect(isValidNgCode("NG-ab cd")).toBe(false);
  });
});
