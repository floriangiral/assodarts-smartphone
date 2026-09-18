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
const mockMailAdd = jest.fn();
const mockPlatformAdminEmailGet = jest.fn();

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
      if (name === "mail") {
        return { add: mockMailAdd };
      }
      if (name === "platform_admins") {
        return {
          where: () => ({
            limit: () => ({ get: mockPlatformAdminEmailGet }),
          }),
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformAdminEmailGet.mockResolvedValue({ empty: true });
  });

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
    mockMailAdd.mockResolvedValue({ id: "mail1" });

    const result = await wrapped(
      makeRequest({ clubId: "c1", email: "A@B.com", role: "member" }, "u1"),
    );

    expect(mockInvitationSet).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: "c1",
        email: "a@b.com",
        role: "member",
        inviteCode: expect.any(String),
        inviteUrl: expect.stringContaining("email=a%40b.com"),
        status: "pending",
      }),
      { merge: true },
    );
    expect(mockMailAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["a@b.com"],
        invitationId: "c1_a@b.com",
      }),
    );
    expect(result).toEqual({
      inviteCode: expect.any(String),
      inviteUrl: expect.stringContaining("email=a%40b.com"),
    });
  });

  it("rejects the platform admin email", async () => {
    mockMembershipGet.mockResolvedValue({
      data: () => ({ status: "active", role: "board" }),
    });
    mockPlatformAdminEmailGet.mockResolvedValue({ empty: false });

    await expect(
      wrapped(
        makeRequest(
          { clubId: "c1", email: "platform-admin@assodarts.test" },
          "u1",
        ),
      ),
    ).rejects.toThrow("Platform admin accounts cannot belong to a club");
    expect(mockInvitationSet).not.toHaveBeenCalled();
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
