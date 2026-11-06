import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ platform: false, site: false, profile: false, fail: false, memberships: [] as Array<Record<string, string>> }));
vi.mock("@/lib/firebase/client", () => ({ clientDb: () => ({}), clientFunctions: () => ({}) }));
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => name,
  doc: (_db: unknown, name: string, id: string) => ({ name, id }),
  query: (name: string) => name,
  where: vi.fn(),
  getDocFromServer: async (ref: { name: string; id: string }) => {
    if (state.fail) throw new Error("server unavailable");
    if (ref.name === "site_editors") return { exists: () => state.site };
    return ref.name === "platform_admins"
      ? { exists: () => state.platform }
      : { exists: () => true, id: ref.id, data: () => ({ name: ref.id, subscriptionStatus: "trial" }) };
  },
  getDocsFromServer: async (name: string) => name === "members"
    ? { docs: state.profile ? [{ id: "member-1", data: () => ({ firstName: "Alex", lastName: "Test", defaultClubId: "club-a" }) }] : [] }
    : { empty: state.memberships.length === 0, docs: state.memberships.map((data) => ({ data: () => data })) },
}));
import { resolveClubSession } from "./data";
import type { User } from "firebase/auth";

const user = { uid: "user-1", email: "test@example.test" } as User;
beforeEach(() => { state.platform = false; state.site = false; state.profile = false; state.fail = false; state.memberships = []; });

describe("session permissions", () => {
  it("keeps a platform-only account separate from club access", async () => {
    state.platform = true;
    expect(await resolveClubSession(user)).toEqual({ kind: "platform-admin", uid: user.uid, email: user.email, siteEditor: false });
  });
  it("retains both permissions for a platform administrator with an active club membership", async () => {
    state.platform = true;
    state.profile = true;
    state.memberships = [{ clubId: "club-a", role: "member" }];
    expect(await resolveClubSession(user)).toMatchObject({ kind: "club-member", platformAdmin: true, clubs: [{ id: "club-a", role: "membre" }] });
  });
  it("does not grant platform access to an ordinary member", async () => {
    state.profile = true;
    state.memberships = [{ clubId: "club-a", role: "admin" }];
    expect(await resolveClubSession(user)).toMatchObject({ kind: "club-member", platformAdmin: false, clubs: [{ id: "club-a", role: "admin" }] });
  });
  it("retains platform access when the member has no active membership", async () => {
    state.platform = true;
    state.profile = true;
    expect(await resolveClubSession(user)).toMatchObject({ kind: "platform-admin" });
  });
  it("reports a missing profile without granting access", async () => {
    expect(await resolveClubSession(user)).toMatchObject({ kind: "no-profile" });
  });
  it("fails closed when server-side permissions cannot be checked", async () => {
    state.fail = true;
    await expect(resolveClubSession(user)).rejects.toThrow("server unavailable");
  });
  it("grants site editing without implying platform or club access", async () => {
    state.site = true;
    expect(await resolveClubSession(user)).toEqual({ kind: "site-editor", uid: user.uid, email: user.email });
  });
});
