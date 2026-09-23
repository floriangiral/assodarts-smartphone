import functionsTest from "firebase-functions-test";
import {
  MockTimestamp as mockTimestamp,
  firestoreDoc,
  firestoreSnapshot,
  makeCallableRequest,
} from "./testSupport";

const testEnv = functionsTest();

const makeRequest = (email: string | undefined, uid?: string) =>
  makeCallableRequest({}, { uid, token: email ? { email } : {} });

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
  Timestamp: mockTimestamp,
}));

import { acceptInvitation } from "./invitations";

afterAll(() => testEnv.cleanup());

describe("acceptInvitation", () => {
  const wrapped = testEnv.wrap(acceptInvitation);

  const invitationDoc = (
    data: Record<string, unknown>,
    ref = { set: mockInvitationSet },
  ) => firestoreDoc(data, { ref });

  const memberDoc = (
    id: string,
    data: Record<string, unknown> = { clubId: null },
  ) => firestoreDoc(data, { id, ref: { set: mockMemberSet } });

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
      .mockResolvedValueOnce(
        firestoreSnapshot([
          invitationDoc({
            clubId: "c1",
            role: "member",
            licenseNumber: "A123",
            status: "pending",
            expiresAt: Date.now() + 60_000,
          }),
        ]),
      )
      .mockResolvedValueOnce({ docs: [] });
    mockMembersGet.mockResolvedValue(firestoreSnapshot([memberDoc("m1")]));

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

  it("ignores an expired pending invitation", async () => {
    mockInvitationsGet
      .mockResolvedValueOnce(
        firestoreSnapshot([
          invitationDoc({
            clubId: "c1",
            role: "member",
            licenseNumber: null,
            status: "pending",
            expiresAt: Date.now() - 60_000,
          }),
        ]),
      )
      .mockResolvedValueOnce({ docs: [] });

    await expect(
      wrapped(makeRequest("user@example.com", "u1")),
    ).resolves.toEqual({ joinedClubId: null });
    expect(mockMembersGet).not.toHaveBeenCalled();
    expect(mockMembershipSet).not.toHaveBeenCalled();
    expect(mockInvitationSet).not.toHaveBeenCalled();
  });

  it("recovers an already accepted invitation for a recreated auth user", async () => {
    mockInvitationsGet
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce(
        firestoreSnapshot([
          invitationDoc({
            clubId: "c1",
            role: "member",
            licenseNumber: null,
            status: "accepted",
            acceptedByMemberId: "oldUid",
          }),
        ]),
      );
    mockMembersGet.mockResolvedValue(firestoreSnapshot([memberDoc("m2")]));

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
