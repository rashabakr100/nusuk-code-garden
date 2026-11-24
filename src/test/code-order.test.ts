import { describe, expect, it } from "vitest";
import { PINNED_CODES, codeType, nextCodeToUse, nusukOpenUrl, orderCodes } from "@/lib/code-order";

type C = { id: string; code: string; created_at: string; source: string | null };
const mk = (id: string, code: string, day: number, source: string | null = null): C => ({
  id,
  code,
  created_at: `2026-11-${String(day).padStart(2, "0")}T10:00:00Z`,
  source,
});
const P = (id: string, i: number, day: number) => mk(id, PINNED_CODES[i]!, day);
const S = (id: string, day: number) => mk(id, `NG-s${id}`, day);
const B = (id: string, day: number) => mk(id, `NG-b${id}`, day, "bulk import");
const F = (id: string, day: number) => mk(id, `NG-f${id}`, day, "nusukkey.xyz");
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("pinned list and links", () => {
  it("pins the six codes in the requested order", () => {
    expect(PINNED_CODES).toEqual(["NG-LLTIwaG5", "NG-hzp5YN9q", "NG-YZu7cgO8", "NG-Q581g6xH", "NG-wyEroUQ4", "NG-JUDdJorK"]);
  });
  it("Open links to the Nusuk app with the code in the link", () => {
    expect(nusukOpenUrl("NG-bwtEes55")).toBe("https://services.nusuk.sa/app/?p=27&id=NG-bwtEes55");
  });
  it("types: pinned wins, then bulk, then fetched (both sites), else shared", () => {
    expect(codeType({ code: PINNED_CODES[0], source: "bulk import" })).toBe("pinned");
    expect(codeType({ code: "NG-x", source: "bulk import" })).toBe("bulk");
    expect(codeType({ code: "NG-x", source: "nusukkey.xyz" })).toBe("fetched");
    expect(codeType({ code: "NG-x", source: "nusukkeys.xyz" })).toBe("fetched");
    expect(codeType({ code: "NG-x", source: null })).toBe("shared");
    expect(codeType({ code: "NG-x" })).toBe("shared");
  });
});

describe("part A: uncopied codes in four blocks", () => {
  const list = [F("f1", 23), B("b1", 22), S("s1", 10), P("p3", 2, 25), S("s2", 20), P("p1", 0, 1), F("f2", 5), B("b2", 3)];
  it("pinned in pinned order regardless of time, then shared, bulk, fetched, each newest first", () => {
    expect(ids(orderCodes(list))).toEqual(["p1", "p3", "s2", "s1", "b1", "b2", "f1", "f2"]);
  });
  it("new bulk or fetched codes never go above uncopied shared codes", () => {
    const more = [...list, B("b9", 30), F("f9", 30)];
    const order = ids(orderCodes(more));
    expect(order.slice(0, 4)).toEqual(["p1", "p3", "s2", "s1"]);
    expect(order.indexOf("b9")).toBe(4);
    expect(order.indexOf("f9")).toBe(7);
  });
});

describe("part B: copied codes at the bottom by copy time", () => {
  const list = [P("p1", 0, 1), P("p2", 1, 2), S("s1", 20), B("b1", 22), F("f1", 23)];
  it("every copied code is below all uncopied codes, types mixed, last copied at the very bottom", () => {
    const copied = new Set(["f1", "p1", "s1"]);
    const copiedAt = { s1: 100, p1: 300, f1: 200 };
    expect(ids(orderCodes(list, copied, { copiedAt }))).toEqual(["p2", "b1", "s1", "f1", "p1"]);
  });
  it("a copied pinned code loses its pinned priority", () => {
    const order = ids(orderCodes(list, new Set(["p1"]), { copiedAt: { p1: 1 } }));
    expect(order).toEqual(["p2", "s1", "b1", "f1", "p1"]);
  });
  it("copying again moves a code to the very bottom", () => {
    const copied = new Set(["s1", "b1"]);
    expect(ids(orderCodes(list, copied, { copiedAt: { s1: 1, b1: 2 } })).slice(-2)).toEqual(["s1", "b1"]);
    expect(ids(orderCodes(list, copied, { copiedAt: { s1: 3, b1: 2 } })).slice(-2)).toEqual(["b1", "s1"]);
  });
});

describe("own new shared code", () => {
  const base = [P("p1", 0, 1), P("p2", 1, 2), S("s1", 10), B("b1", 15), F("f1", 16)];
  const mine = S("me", 20);
  const own = new Set(["me"]);
  it("is at the very top for its owner only; others see the normal order", () => {
    expect(ids(orderCodes([...base, mine], new Set(), { own }))).toEqual(["me", "p1", "p2", "s1", "b1", "f1"]);
    expect(ids(orderCodes([...base, mine], new Set()))).toEqual(["p1", "p2", "me", "s1", "b1", "f1"]);
  });
  it("a newer shared code moves it down into the shared block, below the newer one", () => {
    expect(ids(orderCodes([...base, mine, S("s9", 21)], new Set(), { own }))).toEqual(["p1", "p2", "s9", "me", "s1", "b1", "f1"]);
  });
  it("new bulk or fetched codes, pinned changes and time passing do not move it", () => {
    const withMore = [...base, mine, B("b9", 25), F("f9", 26)];
    expect(ids(orderCodes(withMore, new Set(), { own })).slice(0, 1)).toEqual(["me"]);
    expect(ids(orderCodes([...base.slice(1), mine], new Set(), { own }))[0]).toBe("me");
    const order = ids(orderCodes(withMore, new Set(), { own }));
    expect(order.indexOf("me")).toBeLessThan(order.indexOf("b9"));
    expect(order.indexOf("me")).toBeLessThan(order.indexOf("f1"));
  });
  it("stays above bulk and fetched even after newer shared codes", () => {
    const order = ids(orderCodes([...base, mine, S("s9", 21), B("b9", 30)], new Set(), { own }));
    expect(order.indexOf("me")).toBeLessThan(order.indexOf("b9"));
    expect(order.indexOf("me")).toBeLessThan(order.indexOf("b1"));
  });
  it("stops being special once copied and goes to the bottom", () => {
    expect(ids(orderCodes([...base, mine], new Set(["me"]), { own, copiedAt: { me: 5 } }))).toEqual(["p1", "p2", "s1", "b1", "f1", "me"]);
  });
  it("never changes the relative order of other codes", () => {
    const withOwn = ids(orderCodes([...base, mine], new Set(), { own })).filter((x) => x !== "me");
    const normal = ids(orderCodes([...base, mine])).filter((x) => x !== "me");
    expect(withOwn).toEqual(normal);
  });
  it("several own codes stay newest first", () => {
    const two = [...base, S("me1", 20), S("me2", 21)];
    expect(ids(orderCodes(two, new Set(), { own: new Set(["me1", "me2"]) })).slice(0, 2)).toEqual(["me2", "me1"]);
  });
  it("the next-code card ignores it and uses the normal order", () => {
    const normal = orderCodes([...base, mine], new Set());
    expect(nextCodeToUse(normal, new Set())?.id).toBe("p1");
  });
});

describe("edge cases", () => {
  it("nothing crashes with no codes, all copied, no own codes or no source", () => {
    expect(orderCodes([])).toEqual([]);
    const list = [S("a", 1), { id: "b", code: "NG-b", created_at: "bad" }];
    const all = new Set(["a", "b"]);
    expect(ids(orderCodes(list, all, { own: new Set() }))).toEqual(["a", "b"]);
    expect(nextCodeToUse(orderCodes(list, all), all)).toBeNull();
  });
});
