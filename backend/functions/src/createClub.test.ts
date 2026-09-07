import functionsTest from "firebase-functions-test";
import type { CallableRequest } from "firebase-functions/v2/https";

const testEnv = functionsTest();

function makeRequest(
  data: Record<string, unknown>,
  uid?: string,
): CallableRequest<Record<string, unknown>> {
  return {
    data,
    auth: uid ? { uid, token: { email: "user@example.com" } } : undefined,
  } as unknown as CallableRequest<Record<string, unknown>>;
}

const mockMemberDoc = { exists: true, id: "m1" };
const mockClubGet = jest.fn();
const mockMembershipSet = jest.fn();
const mockMemberSet = jest.fn();
let createdClubId = "";
const mockRunTransaction = jest.fn(async (updateFn) =>
  updateFn({
    get: async (ref: { path?: string }) => {
      if (ref.path === `clubs/${createdClubId}`) return { exists: false };
      if (ref.path === "members/m1")
        return { exists: true, data: () => ({ clubId: null }) };
      return { exists: false };
    },
    set: (ref: { path?: string }, value: unknown) => {
      if (ref.path?.startsWith("clubs/")) {
        createdClubId = ref.path.slice("clubs/".length);
        mockClubGet(value);
      }
      if (ref.path === `memberships/${createdClubId}_u1`)
        mockMembershipSet(value);
      if (ref.path === "members/m1") mockMemberSet(value);
      return undefined;
    },
  }),
);

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        path: `${name}/${id}`,
      }),
      where: () => ({
        limit: () => ({
          get: async () => ({ empty: false, docs: [mockMemberDoc] }),
        }),
      }),
    }),
    runTransaction: mockRunTransaction,
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
  Timestamp: { fromDate: (value: Date) => ({ value }) },
}));

import { createClub } from "./createClub";

afterAll(() => testEnv.cleanup());

describe("createClub", () => {
  const wrapped = testEnv.wrap(createClub);

  it("rejects an unauthenticated call", async () => {
    await expect(wrapped(makeRequest({ name: "Demo Club" }))).rejects.toThrow();
  });

  it("creates a club and membership for an authenticated member", async () => {
    const response = await wrapped(makeRequest({ name: "Demo Club" }, "u1"));
    expect(response).toEqual({
      clubId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    });
    expect(mockMembershipSet).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
        role: "admin",
        status: "active",
      }),
    );
    expect(mockClubGet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Demo Club",
        displayName: "Demo Club",
      }),
    );
  });
});
