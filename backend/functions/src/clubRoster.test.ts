import functionsTest from "firebase-functions-test";
import type { CallableRequest } from "firebase-functions/v2/https";

const testEnv = functionsTest();

type DocData = Record<string, unknown>;

let memberships: Array<{ id: string; data: DocData }> = [];
let members: Record<string, DocData> = {};

function makeRequest(
  data: Record<string, unknown>,
  uid?: string,
): CallableRequest<Record<string, unknown>> {
  return {
    data,
    auth: uid ? { uid, token: { email: "user@example.com" } } : undefined,
  } as unknown as CallableRequest<Record<string, unknown>>;
}

function doc(id: string, data: DocData) {
  return { id, data: () => data };
}

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    getAll: async (...refs: { id: string }[]) =>
      refs.map((ref) => {
        const found = members[ref.id];
        return found
          ? { exists: true, data: () => found }
          : { exists: false, data: () => undefined };
      }),
    collection: (name: string) => ({
      doc: (id: string) => ({
        id,
        get: async () => {
          if (name === "memberships") {
            const found = memberships.find((entry) => entry.id === id);
            return found
              ? { exists: true, data: () => found.data }
              : { exists: false, data: () => undefined };
          }
          if (name === "members") {
            const found = members[id];
            return found
              ? { exists: true, data: () => found }
              : { exists: false, data: () => undefined };
          }
          throw new Error(`Unexpected collection ${name}`);
        },
      }),
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => ({
          docs: memberships
            .filter((entry) => entry.data[field] === value)
            .map((entry) => doc(entry.id, entry.data)),
        }),
      }),
    }),
  }),
  Timestamp: class Timestamp {},
}));

import { clubRoster } from "./clubRoster";

afterAll(() => testEnv.cleanup());

describe("clubRoster", () => {
  const wrapped = testEnv.wrap(clubRoster);

  beforeEach(() => {
    memberships = [
      {
        id: "c1_caller",
        data: {
          clubId: "c1",
          memberId: "caller-member",
          authUid: "caller",
          role: "admin",
          status: "active",
          joinDate: 1_700_000_000_000,
          licenseNumber: null,
        },
      },
      {
        id: "c1_u1",
        data: {
          clubId: "c1",
          memberId: "m1",
          authUid: "u1",
          role: "member",
          status: "active",
          joinDate: 1_700_000_000_000,
          licenseNumber: "A123",
        },
      },
      {
        id: "c1_u2",
        data: {
          clubId: "c1",
          memberId: "m2",
          authUid: "u2",
          role: "board",
          status: "active",
          joinDate: 1_700_000_010_000,
          licenseNumber: null,
        },
      },
      {
        id: "c1_u3",
        data: {
          clubId: "c1",
          memberId: "m3",
          authUid: "u3",
          role: "member",
          status: "inactive",
          joinDate: 1_700_000_020_000,
          licenseNumber: null,
        },
      },
    ];
    members = {
      "caller-member": {
        authUid: "caller",
        clubId: "c1",
        defaultClubId: "c1",
        firstName: "Ada",
        lastName: "Admin",
        email: "ada@example.com",
        status: "active",
      },
      m1: {
        authUid: "u1",
        clubId: "other-club",
        defaultClubId: "other-club",
        firstName: "Zontave",
        lastName: "Giral",
        email: "zontave@example.com",
        status: "active",
      },
      m2: {
        authUid: "u2",
        clubId: "c1",
        defaultClubId: "c1",
        firstName: "Florian",
        lastName: "Giral",
        email: "florian@example.com",
        status: "active",
      },
      m3: {
        authUid: "u3",
        clubId: "c1",
        defaultClubId: "c1",
        firstName: "Florian",
        lastName: "Giral",
        email: "florian@example.com",
        status: "active",
      },
    };
  });

  it("rejects unauthenticated calls", async () => {
    await expect(wrapped(makeRequest({ clubId: "c1" }))).rejects.toThrow();
  });

  it("returns a server-built roster and deduplicates same-email profiles", async () => {
    const result = (await wrapped(makeRequest({ clubId: "c1" }, "caller"))) as {
      members: Array<Record<string, unknown>>;
      memberCount: number;
      duplicateMemberIds: string[];
    };

    expect(result.members.map((member) => member.email)).toEqual([
      "ada@example.com",
      "florian@example.com",
      "zontave@example.com",
    ]);
    expect(result.members).toContainEqual(
      expect.objectContaining({
        id: "m1",
        firstName: "Zontave",
        membershipStatus: "active",
        licenseNumber: "A123",
      }),
    );
    expect(result.memberCount).toBe(3);
    expect(result.duplicateMemberIds).toEqual(["m3"]);
  });
});
