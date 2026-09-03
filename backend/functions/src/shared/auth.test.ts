import { HttpsError } from "firebase-functions/v2/https";

const mockGet = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockGet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ collection: mockCollection }),
}));

import { requireClubBoard } from "./auth";

describe("requireClubBoard", () => {
  it("allows an active board member", async () => {
    mockGet.mockResolvedValue({
      data: () => ({ status: "active", role: "board" }),
    });
    await expect(requireClubBoard("club1", "user1")).resolves.toBeUndefined();
    expect(mockCollection).toHaveBeenCalledWith("memberships");
    expect(mockDoc).toHaveBeenCalledWith("club1_user1");
  });

  it("allows an active admin", async () => {
    mockGet.mockResolvedValue({
      data: () => ({ status: "active", role: "admin" }),
    });
    await expect(requireClubBoard("club1", "user1")).resolves.toBeUndefined();
  });

  it("rejects a plain member", async () => {
    mockGet.mockResolvedValue({
      data: () => ({ status: "active", role: "member" }),
    });
    await expect(requireClubBoard("club1", "user1")).rejects.toBeInstanceOf(
      HttpsError,
    );
  });

  it("rejects an inactive membership", async () => {
    mockGet.mockResolvedValue({
      data: () => ({ status: "invited", role: "admin" }),
    });
    await expect(requireClubBoard("club1", "user1")).rejects.toBeInstanceOf(
      HttpsError,
    );
  });

  it("rejects when no membership exists", async () => {
    mockGet.mockResolvedValue({ data: () => undefined });
    await expect(requireClubBoard("club1", "user1")).rejects.toBeInstanceOf(
      HttpsError,
    );
  });
});
