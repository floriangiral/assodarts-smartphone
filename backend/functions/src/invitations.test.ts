import functionsTest from "firebase-functions-test";
import {
  MockTimestamp as mockTimestamp,
  makeCallableRequest,
} from "./testSupport";

const testEnv = functionsTest();
const makeRequest = makeCallableRequest;

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
  Timestamp: mockTimestamp,
}));

import { createInvitation, revokeInvitation } from "./invitations";

afterAll(() => testEnv.cleanup());

describe("createInvitation", () => {
  const wrapped = testEnv.wrap(createInvitation);

  const mockMembership = (role: string) =>
    mockMembershipGet.mockResolvedValue({
      data: () => ({ status: "active", role }),
    });

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
    mockMembership("member");
    await expect(
      wrapped(makeRequest({ clubId: "c1", email: "a@b.com" }, "u1")),
    ).rejects.toThrow();
  });

  it("creates the invitation for a board member", async () => {
    mockMembership("board");
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
        inviteUrl: expect.stringContaining("email=a%40b.com"),
        expiresAt: expect.objectContaining({ toMillis: expect.any(Function) }),
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
      inviteUrl: expect.stringContaining("email=a%40b.com"),
      expiresAtMillis: expect.any(Number),
    });
  });

  it("rejects a board member inviting someone as board", async () => {
    mockMembership("board");

    await expect(
      wrapped(
        makeRequest({ clubId: "c1", email: "a@b.com", role: "board" }, "u1"),
      ),
    ).rejects.toThrow("Only the club admin can do this");
    expect(mockInvitationSet).not.toHaveBeenCalled();
    expect(mockMailAdd).not.toHaveBeenCalled();
  });

  it("rejects a board member inviting someone as admin", async () => {
    mockMembership("board");

    await expect(
      wrapped(
        makeRequest({ clubId: "c1", email: "a@b.com", role: "admin" }, "u1"),
      ),
    ).rejects.toThrow("Only the club admin can do this");
    expect(mockInvitationSet).not.toHaveBeenCalled();
    expect(mockMailAdd).not.toHaveBeenCalled();
  });

  it("lets a club admin invite someone as board", async () => {
    mockMembership("admin");
    mockInvitationSet.mockResolvedValue(undefined);
    mockMailAdd.mockResolvedValue({ id: "mail1" });

    await wrapped(
      makeRequest({ clubId: "c1", email: "a@b.com", role: "board" }, "u1"),
    );

    expect(mockInvitationSet).toHaveBeenCalledWith(
      expect.objectContaining({ role: "board" }),
      { merge: true },
    );
  });

  it("allows a club board to invite a platform administrator", async () => {
    mockMembership("board");
    mockPlatformAdminEmailGet.mockResolvedValue({ empty: false });

    mockInvitationSet.mockResolvedValue(undefined);
    mockMailAdd.mockResolvedValue({ id: "mail1" });
    await wrapped(makeRequest({ clubId: "c1", email: "platform-admin@assodarts.test" }, "u1"));
    expect(mockInvitationSet).toHaveBeenCalledWith(expect.objectContaining({ email: "platform-admin@assodarts.test", role: "member" }), { merge: true });
  });
});

describe("revokeInvitation", () => {
  const wrapped = testEnv.wrap(revokeInvitation);

  const mockMembership = (role: string) =>
    mockMembershipGet.mockResolvedValue({
      data: () => ({ status: "active", role }),
    });

  it("rejects a non-board caller", async () => {
    mockMembership("member");
    await expect(
      wrapped(makeRequest({ clubId: "c1", email: "a@b.com" }, "u1")),
    ).rejects.toThrow();
  });

  it("deletes the invitation for a board member", async () => {
    mockMembership("admin");
    mockInvitationDelete.mockResolvedValue(undefined);

    await wrapped(makeRequest({ clubId: "c1", email: "A@B.com" }, "u1"));

    expect(mockInvitationDelete).toHaveBeenCalled();
  });
});
