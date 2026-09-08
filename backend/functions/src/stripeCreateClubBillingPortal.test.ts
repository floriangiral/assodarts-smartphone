const mockRequireClubBoard = jest.fn();
const mockClubGet = jest.fn();
const mockPortalCreate = jest.fn();

jest.mock("./shared/auth", () => ({
  requireClubBoard: mockRequireClubBoard,
}));

jest.mock("./shared/stripe", () => {
  const actual = jest.requireActual("./shared/stripe");
  return {
    ...actual,
    stripeSecretKey: { value: () => "sk_test_123" },
    stripeClient: () => ({
      billingPortal: { sessions: { create: mockPortalCreate } },
    }),
  };
});

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "clubs") return { doc: () => ({ get: mockClubGet }) };
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
}));

import { stripeCreateClubBillingPortal } from "./stripeCreateClubBillingPortal";
import type { CallableRequest } from "firebase-functions/v2/https";

function makeRequest(
  data: Record<string, unknown>,
  uid?: string,
): CallableRequest<Record<string, unknown>> {
  return {
    data,
    auth: uid ? { uid, token: { email: "board@example.com" } } : undefined,
  } as unknown as CallableRequest<Record<string, unknown>>;
}

const handler = stripeCreateClubBillingPortal.run.bind(
  stripeCreateClubBillingPortal,
);

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireClubBoard.mockResolvedValue(undefined);
  mockClubGet.mockResolvedValue({
    data: () => ({ stripeCustomerId: "cus_1" }),
  });
  mockPortalCreate.mockResolvedValue({ url: "https://stripe.test/portal" });
});

describe("stripeCreateClubBillingPortal", () => {
  it("rejects unauthenticated calls", async () => {
    await expect(handler(makeRequest({ clubId: "c1" }))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects calls without clubId", async () => {
    await expect(handler(makeRequest({}, "u1"))).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects a caller who is not on the committee", async () => {
    mockRequireClubBoard.mockRejectedValue(new Error("permission denied"));

    await expect(handler(makeRequest({ clubId: "c1" }, "u1"))).rejects.toThrow(
      "permission denied",
    );
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });

  it("rejects an unknown club", async () => {
    mockClubGet.mockResolvedValue({ data: () => undefined });

    await expect(
      handler(makeRequest({ clubId: "c1" }, "u1")),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("rejects a club that never paid, so has no Stripe customer", async () => {
    mockClubGet.mockResolvedValue({ data: () => ({}) });

    await expect(
      handler(makeRequest({ clubId: "c1" }, "u1")),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });

  it("returns the hosted portal URL for the club's customer", async () => {
    const result = await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1" }),
    );
    expect(result).toEqual({ url: "https://stripe.test/portal" });
  });
});
