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

const at = (id: string, code: string, created_at: string) => ({ id, code, created_at });

describe("copied codes go to the bottom for this visitor", () => {
  const list = [
    at("n1", "NG-newest", "2026-11-23T10:00:00Z"),
    at("p2", "NG-hzp5YN9q", "2026-11-01T10:00:00Z"),
    at("p1", "NG-LLTIwaG5", "2026-11-02T10:00:00Z"),
    at("n2", "NG-middle", "2026-11-20T10:00:00Z"),
    at("p3", "NG-YZu7cgO8", "2026-11-03T10:00:00Z"),
    at("n3", "NG-oldest", "2026-10-01T10:00:00Z"),
  ];
  const ids = (copied?: Set<string>) => orderCodes(list, copied).map((c) => c.id);

  it("with no copied codes the order is exactly as before", () => {
    expect(ids(new Set())).toEqual(ids());
    expect(ids()).toEqual(["p1", "p2", "p3", "n1", "n2", "n3"]);
  });
  it("uncopied pinned codes stay first, and the rest keep pinned order when one is copied", () => {
    expect(ids(new Set(["p1"])).slice(0, 2)).toEqual(["p2", "p3"]);
  });
  it("a copied pinned code goes below all uncopied codes", () => {
    expect(ids(new Set(["p1"]))).toEqual(["p2", "p3", "n1", "n2", "n3", "p1"]);
  });
  it("copied codes are ordered newest first", () => {
    expect(ids(new Set(["n3", "p2", "n1", "p1"]))).toEqual(["p3", "n2", "n1", "p1", "p2", "n3"]);
  });
  it("with every code copied nothing crashes and the next-code card is empty", () => {
    const all = new Set(list.map((c) => c.id));
    const ordered = orderCodes(list, all);
    expect(ordered.map((c) => c.id)).toEqual(["n1", "n2", "p3", "p1", "p2", "n3"]);
    expect(nextCodeToUse(ordered, all)).toBeNull();
  });
  it("the next-code card shows the first uncopied code in the same order", () => {
    const copied = new Set(["p1"]);
    expect(nextCodeToUse(orderCodes(list, copied), copied)?.id).toBe("p2");
  });
});
