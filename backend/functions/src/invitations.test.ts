import functionsTest from "firebase-functions-test";
import type { CallableRequest } from "firebase-functions/v2/https";

const testEnv = functionsTest();

/** Minimal fake callable request — only the fields our handlers actually read. */
function makeRequest(
  data: Record<string, unknown>,
  uid?: string,
): CallableRequest<Record<string, unknown>> {
  return {
    data,
    auth: uid ? { uid, token: {} } : undefined,
  } as unknown as CallableRequest<Record<string, unknown>>;
}

const mockMembershipGet = jest.fn();
const mockInvitationSet = jest.fn();
const mockInvitationDelete = jest.fn();

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "memberships") {
        return { doc: () => ({ get: mockMembershipGet }) };
      }
      if (name === "invitations") {
        return {
          doc: () => ({ set: mockInvitationSet, delete: mockInvitationDelete }),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

import { createInvitation, revokeInvitation } from "./invitations";

afterAll(() => testEnv.cleanup());

describe("createInvitation", () => {
  const wrapped = testEnv.wrap(createInvitation);

  it("rejects unauthenticated calls", async () => {
    await expect(
      wrapped(makeRequest({ clubId: "c1", email: "a@b.com" })),
    ).rejects.toThrow();
  });

  it("rejects when clubId or email is missing", async () => {
    await expect(
      wrapped(makeRequest({ clubId: "c1" }, "u1")),
    ).rejects.toThrow();
  });

  it("rejects an invalid email", async () => {
    await expect(
      wrapped(makeRequest({ clubId: "c1", email: "not-an-email" }, "u1")),
    ).rejects.toThrow();
  });

  it("rejects a non-board caller", async () => {
    mockMembershipGet.mockResolvedValue({
      data: () => ({ status: "active", role: "member" }),
    });
    await expect(
      wrapped(makeRequest({ clubId: "c1", email: "a@b.com" }, "u1")),
    ).rejects.toThrow();
  });

  it("creates the invitation for a board member", async () => {
    mockMembershipGet.mockResolvedValue({
      data: () => ({ status: "active", role: "board" }),
    });
    mockInvitationSet.mockResolvedValue(undefined);

    await wrapped(
      makeRequest({ clubId: "c1", email: "A@B.com", role: "member" }, "u1"),
    );

    expect(mockInvitationSet).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: "c1",
        email: "a@b.com",
        role: "member",
        status: "pending",
      }),
      { merge: true },
    );
  });
});

describe("revokeInvitation", () => {
  const wrapped = testEnv.wrap(revokeInvitation);

  it("rejects a non-board caller", async () => {
    mockMembershipGet.mockResolvedValue({
      data: () => ({ status: "active", role: "member" }),
    });
    await expect(
      wrapped(makeRequest({ clubId: "c1", email: "a@b.com" }, "u1")),
    ).rejects.toThrow();
  });

  it("deletes the invitation for a board member", async () => {
    mockMembershipGet.mockResolvedValue({
      data: () => ({ status: "active", role: "admin" }),
    });
    mockInvitationDelete.mockResolvedValue(undefined);

    await wrapped(makeRequest({ clubId: "c1", email: "A@B.com" }, "u1"));

    expect(mockInvitationDelete).toHaveBeenCalled();
  });
});
