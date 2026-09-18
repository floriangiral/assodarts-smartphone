import functionsTest from "firebase-functions-test";
import type { CallableRequest } from "firebase-functions/v2/https";

const testEnv = functionsTest();

function makeRequest(
  email: string | undefined,
  uid?: string,
): CallableRequest<Record<string, unknown>> {
  return {
    data: {},
    auth: uid ? { uid, token: email ? { email } : {} } : undefined,
  } as unknown as CallableRequest<Record<string, unknown>>;
}

const mockPlatformAdminGet = jest.fn();
const mockInvitationsGet = jest.fn();
const mockMembersGet = jest.fn();
const mockMembershipSet = jest.fn();
const mockMembershipDelete = jest.fn();
const mockInvitationSet = jest.fn();
const mockMemberSet = jest.fn();

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "platform_admins") {
        return {
          doc: () => ({ get: mockPlatformAdminGet }),
        };
      }
      if (name === "invitations") {
        return {
          where: () => ({
            where: () => ({ get: mockInvitationsGet }),
          }),
        };
      }
      if (name === "members") {
        return {
          where: () => ({
            limit: () => ({ get: mockMembersGet }),
          }),
        };
      }
      if (name === "memberships") {
        return {
          doc: () => ({ set: mockMembershipSet, delete: mockMembershipDelete }),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

import { acceptInvitation } from "./invitations";

afterAll(() => testEnv.cleanup());

describe("acceptInvitation", () => {
  const wrapped = testEnv.wrap(acceptInvitation);

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformAdminGet.mockResolvedValue({ exists: false });
    mockMembershipSet.mockResolvedValue(undefined);
    mockMembershipDelete.mockResolvedValue(undefined);
    mockInvitationSet.mockResolvedValue(undefined);
    mockMemberSet.mockResolvedValue(undefined);
  });

  it("joins a pending invitation and links the member's first club", async () => {
    mockInvitationsGet
      .mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              clubId: "c1",
              role: "member",
              licenseNumber: "A123",
              status: "pending",
            }),
            ref: { set: mockInvitationSet },
          },
        ],
      })
      .mockResolvedValueOnce({ docs: [] });
    mockMembersGet.mockResolvedValue({
      docs: [
        {
          id: "m1",
          data: () => ({ clubId: null }),
          ref: { set: mockMemberSet },
        },
      ],
    });

    const result = await wrapped(makeRequest("USER@EXAMPLE.COM", "u1"));

    expect(result).toEqual({ joinedClubId: "c1" });
    expect(mockMembershipSet).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: "c1",
        memberId: "m1",
        authUid: "u1",
        role: "member",
        status: "active",
        licenseNumber: "A123",
      }),
      { merge: true },
    );
    expect(mockInvitationSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "accepted",
        acceptedByMemberId: "u1",
      }),
      { merge: true },
    );
    expect(mockMemberSet).toHaveBeenCalledWith(
      { clubId: "c1", defaultClubId: "c1" },
      { merge: true },
    );
  });

  it("recovers an already accepted invitation for a recreated auth user", async () => {
    mockInvitationsGet
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              clubId: "c1",
              role: "member",
              licenseNumber: null,
              status: "accepted",
              acceptedByMemberId: "oldUid",
            }),
            ref: { set: mockInvitationSet },
          },
        ],
      });
    mockMembersGet.mockResolvedValue({
      docs: [
        {
          id: "m2",
          data: () => ({ clubId: null }),
          ref: { set: mockMemberSet },
        },
      ],
    });

    const result = await wrapped(makeRequest("user@example.com", "u2"));

    expect(result).toEqual({ joinedClubId: "c1" });
    expect(mockMembershipSet).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: "c1",
        memberId: "m2",
        authUid: "u2",
        status: "active",
      }),
      { merge: true },
    );
    expect(mockInvitationSet).toHaveBeenCalledWith(
      expect.objectContaining({ acceptedByMemberId: "u2" }),
      { merge: true },
    );
    expect(mockMembershipDelete).toHaveBeenCalled();
  });
});
