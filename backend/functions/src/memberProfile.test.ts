import functionsTest from "firebase-functions-test";
import type { CallableRequest } from "firebase-functions/v2/https";

const testEnv = functionsTest();

const mockRequireClubBoard = jest.fn();
const mockRequireClubAdmin = jest.fn();
const mockRequireNotPlatformAdmin = jest.fn();
const mockMemberSet = jest.fn();
const mockMembershipSet = jest.fn();
const mockCreatedMemberSet = jest.fn();
const mockBatchCommit = jest.fn();

let mockMemberData: Record<string, unknown>;
let mockMembershipData: Record<string, unknown>;
let mockExistingSelfMemberId: string | null;

function makeRequest(
  data: Record<string, unknown>,
  uid = "caller",
): CallableRequest<Record<string, unknown>> {
  return {
    data,
    auth: { uid, token: { email: "caller@example.com" } },
  } as unknown as CallableRequest<Record<string, unknown>>;
}

function makeUnauthenticatedRequest(
  data: Record<string, unknown>,
): CallableRequest<Record<string, unknown>> {
  return {
    data,
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
      doc: (id = "doc") => ({
        path: `${name}/${id}`,
        get: async () => {
          if (name === "members")
            return { exists: true, data: () => mockMemberData };
          if (name === "memberships")
            return { exists: true, data: () => mockMembershipData };
          throw new Error(`Unexpected collection ${name}`);
        },
        set: async (data: unknown, options?: unknown) => {
          mockCreatedMemberSet(id, data, options);
        },
      }),
      where: (field: string, op: string, value: string) => ({
        limit: () => ({
          get: async () => {
            if (
              name === "members" &&
              field === "authUid" &&
              op === "==" &&
              value === "caller"
            ) {
              return {
                empty: mockExistingSelfMemberId === null,
                docs: mockExistingSelfMemberId
                  ? [{ id: mockExistingSelfMemberId }]
                  : [],
              };
            }
            throw new Error(`Unexpected query ${name}.${field}`);
          },
        }),
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

import { createSelfMember, updateMemberProfile } from "./memberProfile";

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
    mockExistingSelfMemberId = null;
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

    expect(mockRequireClubBoard).toHaveBeenCalledWith("c1", "caller");
    expect(mockRequireClubAdmin).toHaveBeenCalledWith("c1", "caller");
    expect(mockMembershipSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ role: "board" }),
      { merge: true },
    );
    expect(mockRequireNotPlatformAdmin).toHaveBeenCalledWith("self");
  });

  it("does not write role changes when the caller is not a club admin", async () => {
    mockRequireClubAdmin.mockRejectedValue(
      new Error("Only the club admin can do this"),
    );

    await expect(
      wrapped(makeRequest({ memberId: "m1", clubId: "c1", role: "admin" })),
    ).rejects.toThrow("Only the club admin can do this");
    expect(mockRequireClubBoard).toHaveBeenCalledWith("c1", "caller");
    expect(mockRequireClubAdmin).toHaveBeenCalledWith("c1", "caller");
    expect(mockMembershipSet).not.toHaveBeenCalled();
  });

  it("rejects assigning a platform admin to a club role", async () => {
    mockRequireNotPlatformAdmin.mockRejectedValue(
      new Error("Platform admin accounts cannot belong to a club"),
    );

    await expect(
      wrapped(makeRequest({ memberId: "m1", clubId: "c1", role: "board" })),
    ).rejects.toThrow("Platform admin accounts cannot belong to a club");
    expect(mockMembershipSet).not.toHaveBeenCalled();
  });
});

describe("createSelfMember", () => {
  const wrapped = testEnv.wrap(createSelfMember);

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistingSelfMemberId = null;
  });

  it("rejects an unauthenticated call", async () => {
    await expect(
      wrapped(
        makeUnauthenticatedRequest({ firstName: "Alex", lastName: "Smith" }),
      ),
    ).rejects.toThrow();
  });

  it("creates the authenticated member profile server-side", async () => {
    const response = await wrapped(
      makeRequest({
        firstName: " Alex ",
        lastName: " Smith ",
        phone: " 0612345678 ",
      }),
    );

    expect(response).toEqual({
      memberId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      created: true,
    });
    expect(mockCreatedMemberSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        authUid: "caller",
        clubId: null,
        defaultClubId: null,
        firstName: "Alex",
        lastName: "Smith",
        displayName: "Alex Smith",
        email: "caller@example.com",
        phone: "0612345678",
        status: "active",
      }),
      undefined,
    );
  });

  it("returns the existing profile instead of creating a duplicate", async () => {
    mockExistingSelfMemberId = "11111111-1111-4111-8111-111111111111";

    await expect(
      wrapped(makeRequest({ firstName: "Alex", lastName: "Smith" })),
    ).resolves.toEqual({
      memberId: "11111111-1111-4111-8111-111111111111",
      created: false,
    });
    expect(mockCreatedMemberSet).not.toHaveBeenCalled();
  });
});
