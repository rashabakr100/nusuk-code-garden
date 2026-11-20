import { describe, expect, it } from "vitest";
import { PINNED_CODES, nextCodeToUse, nusukOpenUrl, orderCodes } from "@/lib/code-order";

const row = (id: string, code: string) => ({ id, code });

describe("pinned codes and the next-code card", () => {
  it("pins the six codes at the top in the requested order", () => {
    expect(PINNED_CODES).toEqual([
      "NG-LLTIwaG5",
      "NG-hzp5YN9q",
      "NG-YZu7cgO8",
      "NG-Q581g6xH",
      "NG-wyEroUQ4",
      "NG-JUDdJorK",
    ]);
    const newestFirst = [
      row("n1", "NG-newest"),
      row("p6", "NG-JUDdJorK"),
      row("p1", "NG-LLTIwaG5"),
      row("n2", "NG-older"),
      row("p3", "NG-YZu7cgO8"),
    ];
    expect(orderCodes(newestFirst).map((c) => c.id)).toEqual(["p1", "p3", "p6", "n1", "n2"]);
  });
  it("the card shows the first code this visitor hasn't used, then moves on", () => {
    const ordered = [row("p1", "NG-LLTIwaG5"), row("p2", "NG-hzp5YN9q"), row("n1", "NG-x")];
    expect(nextCodeToUse(ordered, new Set())?.id).toBe("p1");
    expect(nextCodeToUse(ordered, new Set(["p1"]))?.id).toBe("p2");
    expect(nextCodeToUse(ordered, new Set(["p1", "p2", "n1"]))).toBeNull();
  });
  it("Open links to the Nusuk app with the code in the link", () => {
    expect(nusukOpenUrl("NG-bwtEes55")).toBe("https://services.nusuk.sa/app/?p=27&id=NG-bwtEes55");
    expect(nusukOpenUrl("NG-LLTIwaG5")).toBe("https://services.nusuk.sa/app/?p=27&id=NG-LLTIwaG5");
  });
});
