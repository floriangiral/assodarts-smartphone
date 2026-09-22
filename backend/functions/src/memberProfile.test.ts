import functionsTest from "firebase-functions-test";
import type { CallableRequest } from "firebase-functions/v2/https";

const testEnv = functionsTest();

const mockRequireClubBoard = jest.fn();
const mockRequireClubAdmin = jest.fn();
const mockRequireNotPlatformAdmin = jest.fn();
const mockMemberSet = jest.fn();
const mockMembershipSet = jest.fn();
const mockBatchCommit = jest.fn();

let mockMemberData: Record<string, unknown>;
let mockMembershipData: Record<string, unknown>;

function makeRequest(
  data: Record<string, unknown>,
  uid = "caller",
): CallableRequest<Record<string, unknown>> {
  return {
    data,
    auth: { uid, token: {} },
  } as unknown as CallableRequest<Record<string, unknown>>;
}

jest.mock("./shared/auth", () => ({
  requireClubBoard: mockRequireClubBoard,
  requireClubAdmin: mockRequireClubAdmin,
  requireNotPlatformAdmin: mockRequireNotPlatformAdmin,
}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: () => ({
        get: async () => {
          if (name === "members")
            return { exists: true, data: () => mockMemberData };
          if (name === "memberships")
            return { exists: true, data: () => mockMembershipData };
          throw new Error(`Unexpected collection ${name}`);
        },
      }),
    }),
    batch: () => ({
      set: (ref: unknown, data: unknown, options: unknown) => {
        if ((data as Record<string, unknown>).role !== undefined) {
          mockMembershipSet(ref, data, options);
        } else if (
          (data as Record<string, unknown>).licenseNumber !== undefined
        ) {
          mockMembershipSet(ref, data, options);
        } else if ((data as Record<string, unknown>).status !== undefined) {
          mockMembershipSet(ref, data, options);
        } else {
          mockMemberSet(ref, data, options);
        }
      },
      commit: mockBatchCommit,
    }),
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

import { updateMemberProfile } from "./memberProfile";

afterAll(() => testEnv.cleanup());

describe("updateMemberProfile", () => {
  const wrapped = testEnv.wrap(updateMemberProfile);

  beforeEach(() => {
    jest.clearAllMocks();
    mockMemberData = {
      authUid: "self",
      firstName: "Alex",
      lastName: "Smith",
      email: "alex@example.com",
    };
    mockMembershipData = {
      memberId: "m1",
      role: "member",
      status: "active",
      licenseNumber: null,
    };
    mockRequireClubBoard.mockResolvedValue(undefined);
    mockRequireClubAdmin.mockResolvedValue(undefined);
    mockRequireNotPlatformAdmin.mockResolvedValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it("lets a member edit their own profile without board rights", async () => {
    await wrapped(
      makeRequest(
        {
          memberId: "m1",
          clubId: "c1",
          firstName: "Alexandre",
          role: "member",
          isActive: true,
          licenseNumber: null,
        },
        "self",
      ),
    );

    expect(mockRequireClubBoard).not.toHaveBeenCalled();
    expect(mockRequireClubAdmin).not.toHaveBeenCalled();
    expect(mockMemberSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ firstName: "Alexandre" }),
      { merge: true },
    );
    expect(mockMembershipSet).not.toHaveBeenCalled();
  });

  it("requires board rights when licence changes", async () => {
    await wrapped(
      makeRequest({
        memberId: "m1",
        clubId: "c1",
        licenseNumber: "FFD-42",
      }),
    );

    expect(mockRequireClubBoard).toHaveBeenCalledWith("c1", "caller");
    expect(mockMembershipSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ licenseNumber: "FFD-42" }),
      { merge: true },
    );
  });

  it("lets the board clear a licence number", async () => {
    mockMembershipData.licenseNumber = "FFD-42";

    await wrapped(
      makeRequest({
        memberId: "m1",
        clubId: "c1",
        licenseNumber: null,
      }),
    );

    expect(mockRequireClubBoard).toHaveBeenCalledWith("c1", "caller");
    expect(mockMembershipSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ licenseNumber: null }),
      { merge: true },
    );
  });

  it("requires admin rights when role changes", async () => {
    await wrapped(
      makeRequest({
        memberId: "m1",
        clubId: "c1",
        role: "board",
      }),
    );

    expect(mockRequireClubAdmin).toHaveBeenCalledWith("c1", "caller");
    expect(mockMembershipSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ role: "board" }),
      { merge: true },
    );
    expect(mockRequireNotPlatformAdmin).toHaveBeenCalledWith("self");
  });

  it("rejects assigning a platform admin to a club role", async () => {
    mockRequireNotPlatformAdmin.mockRejectedValue(
      new Error("Platform admin accounts cannot belong to a club"),
    );

    await expect(
      wrapped(
        makeRequest({ memberId: "m1", clubId: "c1", role: "board" }),
      ),
    ).rejects.toThrow("Platform admin accounts cannot belong to a club");
    expect(mockMembershipSet).not.toHaveBeenCalled();
  });
});
