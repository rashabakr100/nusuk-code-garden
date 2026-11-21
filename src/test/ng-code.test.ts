import { describe, expect, it } from "vitest";
import { cleanTypedCode, isValidNgCode } from "@/lib/ng-code";

describe('codes must start with "NG-"', () => {
  it('does not add "NG-" for the person — a code typed without it is rejected', () => {
    expect(cleanTypedCode("kVaLRiYA")).toBe("kVaLRiYA");
    expect(isValidNgCode(cleanTypedCode("kVaLRiYA"))).toBe(false);
  });
  it('accepts a full code typed with "NG-"', () => {
    expect(cleanTypedCode("NG-kVaLRiYA")).toBe("NG-kVaLRiYA");
    expect(isValidNgCode(cleanTypedCode("NG-kVaLRiYA"))).toBe(true);
  });
  it('removes spaces and capitalises a lowercase "ng-" start', () => {
    expect(cleanTypedCode(" ng-kVaL RiYA ")).toBe("NG-kVaLRiYA");
  });
  it('rejects codes without "NG-" or with nothing after it', () => {
    expect(isValidNgCode("XX-kVaLRiYA")).toBe(false);
    expect(isValidNgCode("NG-")).toBe(false);
    expect(isValidNgCode("NG-ab cd")).toBe(false);
  });
});
