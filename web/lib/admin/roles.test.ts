import { describe, expect, it } from "vitest";
import {
  canManageClub,
  canManageRoles,
  chooseInitialClub,
  roleFromMembership,
  roleRank,
} from "./roles";

describe("iOS club role mapping", () => {
  it.each([
    ["admin", "admin"],
    ["board", "bureau"],
    ["bureau", "bureau"],
    ["treasurer", "bureau"],
    ["member", "membre"],
    ["unknown", "membre"],
  ])("maps %s", (remote, expected) => {
    expect(roleFromMembership(remote)).toBe(expected);
  });

  it("keeps management and role assignment permissions distinct", () => {
    expect(canManageClub("membre")).toBe(false);
    expect(canManageClub("bureau")).toBe(true);
    expect(canManageClub("admin")).toBe(true);
    expect(canManageRoles("membre")).toBe(false);
    expect(canManageRoles("bureau")).toBe(false);
    expect(canManageRoles("admin")).toBe(true);
  });

  it("ranks the role used for the default club choice", () => {
    expect(roleRank("admin")).toBeGreaterThan(roleRank("bureau"));
    expect(roleRank("bureau")).toBeGreaterThan(roleRank("membre"));
  });

  it("prefers a valid local club, then the member default, then the highest role", () => {
    const clubs = [
      { id: "member-club", role: "membre" as const },
      { id: "board-club", role: "bureau" as const },
      { id: "admin-club", role: "admin" as const },
    ];
    expect(chooseInitialClub(clubs, "member-club", "admin-club")).toBe("member-club");
    expect(chooseInitialClub(clubs, "unknown-club", "board-club")).toBe("board-club");
    expect(chooseInitialClub(clubs, null, null)).toBe("admin-club");
    expect(chooseInitialClub([], null, null)).toBeNull();
  });
});