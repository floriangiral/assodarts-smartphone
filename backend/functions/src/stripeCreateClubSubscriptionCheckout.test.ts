const mockRequireClubBoard = jest.fn();
const mockClubGet = jest.fn();
const mockClubSet = jest.fn();
const mockMembershipsGet = jest.fn();
const mockCouponsGet = jest.fn();
const mockCheckoutCreate = jest.fn();
const mockCustomersCreate = jest.fn();
const mockSubscriptionsRetrieve = jest.fn();
const mockCouponsRetrieve = jest.fn();
const mockStripeCouponsCreate = jest.fn();

jest.mock("./shared/auth", () => ({
  requireClubBoard: mockRequireClubBoard,
}));

jest.mock("./shared/stripe", () => {
  const actual = jest.requireActual("./shared/stripe");
  return {
    ...actual,
    stripeSecretKey: { value: () => "sk_test_123" },
    stripeClient: () => ({
      checkout: { sessions: { create: mockCheckoutCreate } },
      customers: { create: mockCustomersCreate },
      subscriptions: { retrieve: mockSubscriptionsRetrieve },
      coupons: {
        retrieve: mockCouponsRetrieve,
        create: mockStripeCouponsCreate,
      },
    }),
  };
});

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "clubs") {
        return { doc: () => ({ get: mockClubGet, set: mockClubSet }) };
      }
      if (name === "memberships") {
        return {
          where: () => ({ where: () => ({ get: mockMembershipsGet }) }),
        };
      }
      if (name === "coupons") {
        return { where: () => ({ limit: () => ({ get: mockCouponsGet }) }) };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

import { stripeCreateClubSubscriptionCheckout } from "./stripeCreateClubSubscriptionCheckout";
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

const handler = stripeCreateClubSubscriptionCheckout.run.bind(
  stripeCreateClubSubscriptionCheckout,
);

/** Firestore query snapshots only need `size` for the member count. */
function membershipsOfSize(size: number) {
  return { size, docs: [] };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireClubBoard.mockResolvedValue(undefined);
  mockClubGet.mockResolvedValue({
    data: () => ({ name: "FC Test" }),
  });
  mockClubSet.mockResolvedValue(undefined);
  mockMembershipsGet.mockResolvedValue(membershipsOfSize(12));
  mockCouponsGet.mockResolvedValue({ empty: true, docs: [] });
  mockCustomersCreate.mockResolvedValue({ id: "cus_new" });
  mockCheckoutCreate.mockResolvedValue({
    id: "cs_sub_1",
    url: "https://stripe.test/subscribe",
  });
});

describe("stripeCreateClubSubscriptionCheckout", () => {
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
    expect(mockRequireClubBoard).toHaveBeenCalledWith("c1", "u1");
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it.each([
    [12, 4900, "essentiel"],
    [20, 4900, "essentiel"],
    [21, 8900, "club"],
    [50, 8900, "club"],
    [80, 14900, "federal"],
    [150, 22900, "ligue"],
  ])(
    "charges the tier matching %i active members",
    async (members, expectedCents, tierId) => {
      mockMembershipsGet.mockResolvedValue(membershipsOfSize(members));

      await handler(makeRequest({ clubId: "c1" }, "u1"));

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                unit_amount: expectedCents,
                currency: "eur",
                recurring: { interval: "year" },
              }),
            }),
          ],
          subscription_data: {
            metadata: { club_id: "c1", tier_id: tierId },
          },
        }),
      );
    },
  );

  it("refuses to bill a club that is above the last tier", async () => {
    mockMembershipsGet.mockResolvedValue(membershipsOfSize(240));

    await expect(
      handler(makeRequest({ clubId: "c1" }, "u1")),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("refuses to start a second checkout when a live subscription exists", async () => {
    mockClubGet.mockResolvedValue({
      data: () => ({ name: "FC Test", stripeSubscriptionId: "sub_live" }),
    });
    mockSubscriptionsRetrieve.mockResolvedValue({ status: "active" });

    await expect(
      handler(makeRequest({ clubId: "c1" }, "u1")),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("lets a club re-subscribe when its previous subscription is dead", async () => {
    mockClubGet.mockResolvedValue({
      data: () => ({ name: "FC Test", stripeSubscriptionId: "sub_old" }),
    });
    mockSubscriptionsRetrieve.mockResolvedValue({ status: "canceled" });

    const result = await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(result).toEqual({
      url: "https://stripe.test/subscribe",
      sessionId: "cs_sub_1",
    });
  });

  it("reuses the club's existing Stripe customer", async () => {
    mockClubGet.mockResolvedValue({
      data: () => ({ name: "FC Test", stripeCustomerId: "cus_existing" }),
    });

    await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" }),
    );
  });

  it("applies a valid coupon as a Stripe discount, not a discounted price", async () => {
    mockClubGet.mockResolvedValue({
      data: () => ({ name: "FC Test", couponCode: "WELCOME" }),
    });
    mockCouponsGet.mockResolvedValue({
      empty: false,
      docs: [
        {
          data: () => ({
            code: "WELCOME",
            percent: 25,
            autoRenew: false,
            clubIds: [],
            expiresAt: { toDate: () => new Date(Date.now() + 86_400_000) },
          }),
        },
      ],
    });
    mockCouponsRetrieve.mockRejectedValue(new Error("not found"));
    mockStripeCouponsCreate.mockResolvedValue({
      id: "assodarts_WELCOME_25_once",
    });

    await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(mockStripeCouponsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ percent_off: 25, duration: "once" }),
    );
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        discounts: [{ coupon: "assodarts_WELCOME_25_once" }],
        // The full price is still charged as the line item; Stripe applies
        // the discount, so renewals keep the right base amount.
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 4900 }),
          }),
        ],
      }),
    );
  });

  it("makes an auto-renewing coupon a forever discount", async () => {
    mockClubGet.mockResolvedValue({
      data: () => ({ name: "FC Test", couponCode: "PARTNER" }),
    });
    mockCouponsGet.mockResolvedValue({
      empty: false,
      docs: [
        {
          data: () => ({
            code: "PARTNER",
            percent: 100,
            autoRenew: true,
            clubIds: ["c1"],
            expiresAt: { toDate: () => new Date(Date.now() + 86_400_000) },
          }),
        },
      ],
    });
    mockCouponsRetrieve.mockRejectedValue(new Error("not found"));
    mockStripeCouponsCreate.mockResolvedValue({
      id: "assodarts_PARTNER_100_forever",
    });

    await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(mockStripeCouponsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ percent_off: 100, duration: "forever" }),
    );
    // A 100% coupon still goes through Stripe Checkout so a card stays on file.
    expect(mockCheckoutCreate).toHaveBeenCalled();
  });

  it("ignores an expired coupon", async () => {
    mockClubGet.mockResolvedValue({
      data: () => ({ name: "FC Test", couponCode: "OLD" }),
    });
    mockCouponsGet.mockResolvedValue({
      empty: false,
      docs: [
        {
          data: () => ({
            code: "OLD",
            percent: 50,
            autoRenew: false,
            clubIds: [],
            expiresAt: { toDate: () => new Date(Date.now() - 86_400_000) },
          }),
        },
      ],
    });

    await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ discounts: undefined }),
    );
  });

  it("ignores a coupon that targets other clubs", async () => {
    mockClubGet.mockResolvedValue({
      data: () => ({ name: "FC Test", couponCode: "OTHER" }),
    });
    mockCouponsGet.mockResolvedValue({
      empty: false,
      docs: [
        {
          data: () => ({
            code: "OTHER",
            percent: 50,
            autoRenew: false,
            clubIds: ["someone-else"],
            expiresAt: { toDate: () => new Date(Date.now() + 86_400_000) },
          }),
        },
      ],
    });

    await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ discounts: undefined }),
    );
  });

  it("never routes the subscription to a connected account", async () => {
    await handler(makeRequest({ clubId: "c1" }, "u1"));

    const params = mockCheckoutCreate.mock.calls[0][0];
    expect(params).not.toHaveProperty("payment_intent_data");
    expect(JSON.stringify(params)).not.toContain("transfer_data");
  });
});
