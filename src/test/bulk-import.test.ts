import { describe, expect, it } from "vitest";
import { MAX_BULK_NEW, parsePastedCodes, planBulkImport } from "@/lib/bulk-import";

describe("bulk import: finding codes in pasted text", () => {
  it("takes exactly 8 characters after NG-, even with a name stuck after them", () => {
    expect(parsePastedCodes("NG-xejzYNqLFajar").codes).toEqual(["NG-xejzYNqL"]);
  });
  it("accepts any case of ng- but saves it as NG- and keeps the 8 characters' case", () => {
    expect(parsePastedCodes("code: ng-AbCdEf12 🙏").codes).toEqual(["NG-AbCdEf12"]);
  });
  it("ignores the placeholder, short codes and codes with spaces", () => {
    const r = parsePastedCodes("NG-XXXXXXXX\nNG-abc12\nNG-abcd 1234\nNG-ab!d1234");
    expect(r.codes).toEqual([]);
    expect(r.ignored).toBe(4);
  });
  it("removes repeats inside the text", () => {
    const r = parsePastedCodes("NG-aaaaaaa1 NG-aaaaaaa1, NG-bbbbbbb2");
    expect(r.codes).toEqual(["NG-aaaaaaa1", "NG-bbbbbbb2"]);
    expect(r.repeats).toBe(1);
  });
  it("skips codes the site already has", () => {
    const p = planBulkImport(["NG-aaaaaaa1", "NG-bbbbbbb2"], new Set(["NG-aaaaaaa1"]));
    expect(p.toAdd).toEqual(["NG-bbbbbbb2"]);
    expect(p.alreadyHad).toBe(1);
  });
  it("caps one import at 500 new codes and reports how many were left over", () => {
    const codes = Array.from({ length: 503 }, (_, i) => `NG-${String(i).padStart(8, "0")}`);
    const p = planBulkImport(codes, new Set());
    expect(MAX_BULK_NEW).toBe(500);
    expect(p.toAdd).toHaveLength(500);
    expect(p.overCap).toBe(3);
  });
});

describe("bulk import: codes glued to other words", () => {
  it("finds all 3 codes in the copied page text, including one glued after 'Copy'", () => {
    const text = "NG-Blir2HLi\nCopy\nCopy and open\n\nNG-NoCgZQSf CopyNG-48G29od4\nCopy and open";
    expect(parsePastedCodes(text).codes).toEqual(["NG-Blir2HLi", "NG-NoCgZQSf", "NG-48G29od4"]);
  });
  it("cuts a name stuck after the 8 characters", () => {
    expect(parsePastedCodes("NG-xejzYNqLFajar").codes).toEqual(["NG-xejzYNqL"]);
  });
  it("ordinary words with -ng- never become codes", () => {
    expect(parsePastedCodes("pending-approval and long-term").codes).toEqual([]);
  });
  it("lower-case ng- at the start of a line counts", () => {
    expect(parsePastedCodes("hello\nng-abcd1234").codes).toEqual(["NG-abcd1234"]);
  });
  it("ignores the placeholder and codes shorter than 8 characters", () => {
    const r = parsePastedCodes("NG-XXXXXXXX NG-abc");
    expect(r.codes).toEqual([]);
    expect(r.ignored).toBe(2);
  });
  it("pasting the same text twice never creates duplicates", () => {
    const text = "NG-Blir2HLi NG-NoCgZQSf";
    const twice = parsePastedCodes(`${text}\n${text}`);
    expect(twice.codes).toEqual(["NG-Blir2HLi", "NG-NoCgZQSf"]);
    const again = planBulkImport(twice.codes, new Set(twice.codes));
    expect(again.toAdd).toEqual([]);
    expect(again.alreadyHad).toBe(2);
  });
});
