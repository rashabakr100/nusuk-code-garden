import { describe, expect, it } from "vitest";
import { canManageCode } from "@/lib/code-permissions";

const mine = { id: "c1", user_id: "me" };
const theirs = { id: "c2", user_id: "someone-else" };
const anonymous = { id: "c3", user_id: null };
const none = new Set<string>();

describe("who can edit or delete a code", () => {
  it("a signed-in user can manage the code they added", () => {
    expect(canManageCode(mine, { id: "me", isAdmin: false }, none)).toBe(true);
  });
  it("a signed-in user cannot manage someone else's code", () => {
    expect(canManageCode(theirs, { id: "me", isAdmin: false }, none)).toBe(false);
    expect(canManageCode(anonymous, { id: "me", isAdmin: false }, none)).toBe(false);
  });
  it("an admin can manage any code", () => {
    expect(canManageCode(theirs, { id: "admin", isAdmin: true }, none)).toBe(true);
    expect(canManageCode(anonymous, { id: "admin", isAdmin: true }, none)).toBe(true);
  });
  it("someone who added a code without signing in can manage it from the same device", () => {
    expect(canManageCode(anonymous, null, new Set(["c3"]))).toBe(true);
  });
  it("visitors cannot manage codes they didn't add", () => {
    expect(canManageCode(anonymous, null, none)).toBe(false);
    expect(canManageCode(mine, null, none)).toBe(false);
  });
});
