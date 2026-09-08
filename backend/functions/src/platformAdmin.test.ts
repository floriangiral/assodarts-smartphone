const mockRequirePlatformAdmin = jest.fn();
const mockAnnouncementSet = jest.fn();
const mockCouponQueryGet = jest.fn();
const mockCouponDocGet = jest.fn();
const mockCouponSet = jest.fn();
const mockCouponDelete = jest.fn();
const mockClubSnapshots = new Map<
  string,
  { exists: boolean; data: () => Record<string, unknown> }
>();
const mockClubSets = new Map<string, jest.Mock>();

jest.mock("./shared/auth", () => ({
  requirePlatformAdmin: mockRequirePlatformAdmin,
}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "platform_announcements") {
        return { doc: () => ({ set: mockAnnouncementSet }) };
      }
      if (name === "coupons") {
        return {
          doc: (id: string) => ({
            path: `coupons/${id}`,
            kind: "doc",
            set: mockCouponSet,
            delete: mockCouponDelete,
          }),
          where: () => ({
            limit: () => ({ kind: "query" }),
          }),
        };
      }
      if (name === "clubs") {
        return {
          doc: (id: string) => ({
            path: `clubs/${id}`,
            kind: "doc",
          }),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
    runTransaction: async (callback: (transaction: unknown) => Promise<void>) =>
      callback({
        get: async (ref: { kind: string; path?: string }) => {
          if (ref.kind === "query") return mockCouponQueryGet();
          if (ref.path === "coupons/coupon-1") return mockCouponDocGet();
          return (
            mockClubSnapshots.get(ref.path ?? "") ?? {
              exists: true,
              data: () => ({}),
            }
          );
        },
        set: (ref: { path?: string }, value: unknown, options?: unknown) => {
          if (ref.path?.startsWith("coupons/")) {
            mockCouponSet(ref.path, value, options);
          } else if (ref.path?.startsWith("clubs/")) {
            if (!mockClubSets.has(ref.path))
              mockClubSets.set(ref.path, jest.fn());
            mockClubSets.get(ref.path)?.(value, options);
          }
        },
        delete: (ref: { path?: string }) => mockCouponDelete(ref.path),
      }),
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

import type { CallableRequest } from "firebase-functions/v2/https";
import {
  broadcastAnnouncement,
  createCoupon,
  deleteCoupon,
} from "./platformAdmin";

function makeRequest(
  data: Record<string, unknown>,
  uid?: string,
): CallableRequest<Record<string, unknown>> {
  return {
    data,
    auth: uid ? { uid, token: {} } : undefined,
  } as unknown as CallableRequest<Record<string, unknown>>;
}

const handlers = {
  broadcast: broadcastAnnouncement.run.bind(broadcastAnnouncement),
  create: createCoupon.run.bind(createCoupon),
  delete: deleteCoupon.run.bind(deleteCoupon),
};

beforeEach(() => {
  mockRequirePlatformAdmin.mockResolvedValue(undefined);
  mockAnnouncementSet.mockResolvedValue(undefined);
  mockCouponQueryGet.mockResolvedValue({ empty: true });
  mockCouponDocGet.mockResolvedValue({
    exists: true,
    data: () => ({ code: "SPRING", clubIds: ["club-1"] }),
  });
  mockCouponSet.mockClear();
  mockCouponDelete.mockClear();
  mockClubSnapshots.clear();
  mockClubSets.clear();
});

describe("platform admin callables", () => {
  it.each([
    ["broadcast", handlers.broadcast],
    ["create coupon", handlers.create],
    ["delete coupon", handlers.delete],
  ])("rejects unauthenticated %s calls", async (_name, handler) => {
    await expect(handler(makeRequest({}))).rejects.toThrow();
  });

  it("rejects non-platform admins", async () => {
    mockRequirePlatformAdmin.mockRejectedValue(
      new Error("not a platform admin"),
    );

    await expect(
      handlers.broadcast(
        makeRequest({ title: "T", body: "B", audience: "all" }, "u1"),
      ),
    ).rejects.toThrow("not a platform admin");
    expect(mockRequirePlatformAdmin).toHaveBeenCalledWith("u1");
  });

  it("publishes a broadcast for all members", async () => {
    const result = await handlers.broadcast(
      makeRequest(
        { title: "  News  ", body: "  Welcome  ", audience: "all" },
        "admin1",
      ),
    );

    expect(mockAnnouncementSet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "News",
        body: "Welcome",
        audience: "all",
        publishedAt: "SERVER_TIMESTAMP",
        publishedBy: "admin1",
      }),
    );
    expect(result).toEqual({ id: expect.any(String) });
  });

  it("rejects a coupon percent outside 1 through 100", async () => {
    await expect(
      handlers.create(
        makeRequest(
          { code: "BAD", percent: 101, expiresAt: "2030-01-01" },
          "admin1",
        ),
      ),
    ).rejects.toThrow();
  });

  it("rejects a duplicate coupon code", async () => {
    mockCouponQueryGet.mockResolvedValue({ empty: false });

    await expect(
      handlers.create(
        makeRequest(
          { code: "SPRING", percent: 25, expiresAt: "2030-01-01" },
          "admin1",
        ),
      ),
    ).rejects.toThrow();
  });

  it("creates a coupon and applies its code to existing clubs", async () => {
    mockClubSnapshots.set("clubs/club-1", { exists: true, data: () => ({}) });

    const result = await handlers.create(
      makeRequest(
        {
          code: " spring ",
          percent: 25,
          expiresAt: "2030-01-01",
          clubIds: ["club-1", "missing-club"],
          autoRenew: true,
        },
        "admin1",
      ),
    );

    expect(mockCouponSet).toHaveBeenCalledWith(
      expect.stringMatching(/^coupons\//),
      expect.objectContaining({
        code: "SPRING",
        percent: 25,
        clubIds: ["club-1", "missing-club"],
        autoRenew: true,
      }),
      undefined,
    );
    expect(mockClubSets.get("clubs/club-1")).toHaveBeenCalledWith(
      { couponCode: "SPRING" },
      { merge: true },
    );
    expect(result).toEqual({ couponId: expect.any(String) });
  });

  it("deletes a coupon and clears matching club codes", async () => {
    mockClubSnapshots.set("clubs/club-1", {
      exists: true,
      data: () => ({ couponCode: "SPRING" }),
    });

    const result = await handlers.delete(
      makeRequest({ couponId: "coupon-1" }, "admin1"),
    );

    expect(mockCouponDelete).toHaveBeenCalledWith("coupons/coupon-1");
    expect(mockClubSets.get("clubs/club-1")).toHaveBeenCalledWith(
      { couponCode: null },
      { merge: true },
    );
    expect(result).toEqual({ deleted: true });
  });
});
