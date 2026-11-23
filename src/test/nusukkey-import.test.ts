import { describe, expect, it } from "vitest";
import { parseCodesFromHtml, parseOpenLinkIds, planImport } from "@/lib/nusukkey-import";

describe("reading codes from nusukkey.xyz", () => {
  it("takes exactly the 8 characters after NG-, even with a name stuck after them", () => {
    expect(parseCodesFromHtml("<span>NG-xejzYNqLFajar</span>")).toEqual(["NG-xejzYNqL"]);
  });
  it("keeps upper and lower case exactly", () => {
    expect(parseCodesFromHtml("NG-aBcDeF12")).toEqual(["NG-aBcDeF12"]);
  });
  it("ignores the NG-XXXXXXXX placeholder, short codes and non letter/digit characters", () => {
    expect(parseCodesFromHtml('placeholder="NG-XXXXXXXX" NG-abc12 NG-ab_cdefg NG-abc"defgh')).toEqual([]);
  });
  it("does not count the same code twice", () => {
    expect(parseCodesFromHtml("NG-3MAzbnq5 copy NG-3MAzbnq5")).toEqual(["NG-3MAzbnq5"]);
  });
  it("reads Open link ids from the HTML for the cross-check", () => {
    const html = '<a href="https://services.nusuk.sa/app/?p=27&amp;id=NG-3MAzbnq5">Open</a>';
    expect(parseOpenLinkIds(html)).toEqual(["NG-3MAzbnq5"]);
  });
});

describe("import rules", () => {
  it("skips codes we already have and caps each tap at 50 new codes", () => {
    const found = Array.from({ length: 60 }, (_, i) => `NG-code${String(i).padStart(4, "0")}`);
    const plan = planImport(found, new Set([found[0]!, found[1]!]));
    expect(plan.alreadyHad).toBe(2);
    expect(plan.toAdd).toHaveLength(50);
    expect(plan.toAdd[0]).toBe(found[2]);
  });
});
