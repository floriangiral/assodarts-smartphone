const mockRequireClubAdmin = jest.fn();
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
  requireClubAdmin: mockRequireClubAdmin,
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
import {
  describeClubAdminCallableGuards,
  firestoreDoc,
  makeCommitteeCallableRequest as makeRequest,
} from "./testSupport";

const handler = stripeCreateClubSubscriptionCheckout.run.bind(
  stripeCreateClubSubscriptionCheckout,
);

/** Firestore query snapshots only need `size` for the member count. */
function membershipsOfSize(size: number) {
  return { size, docs: [] };
}

function clubData(overrides: Record<string, unknown> = {}) {
  return firestoreDoc({ name: "FC Test", ...overrides });
}

function couponData(overrides: Record<string, unknown>) {
  return {
    empty: false,
    docs: [
      firestoreDoc({
        percent: 50,
        autoRenew: false,
        clubIds: [],
        expiresAt: { toDate: () => new Date(Date.now() + 86_400_000) },
        ...overrides,
      }),
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireClubAdmin.mockResolvedValue(undefined);
  mockClubGet.mockResolvedValue(clubData());
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
  describeClubAdminCallableGuards({
    handler,
    makeRequest,
    requireClubAdminMock: mockRequireClubAdmin,
    downstreamMock: mockCheckoutCreate,
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
    mockClubGet.mockResolvedValue(
      clubData({ stripeSubscriptionId: "sub_live" }),
    );
    mockSubscriptionsRetrieve.mockResolvedValue({ status: "active" });

    await expect(
      handler(makeRequest({ clubId: "c1" }, "u1")),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("lets a club re-subscribe when its previous subscription is dead", async () => {
    mockClubGet.mockResolvedValue(
      clubData({ stripeSubscriptionId: "sub_old" }),
    );
    mockSubscriptionsRetrieve.mockResolvedValue({ status: "canceled" });

    const result = await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(result).toEqual({
      url: "https://stripe.test/subscribe",
      sessionId: "cs_sub_1",
    });
  });

  it("reuses the club's existing Stripe customer", async () => {
    mockClubGet.mockResolvedValue(
      clubData({ stripeCustomerId: "cus_existing" }),
    );

    await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" }),
    );
  });

  it("applies a valid coupon as a Stripe discount, not a discounted price", async () => {
    mockClubGet.mockResolvedValue(clubData({ couponCode: "WELCOME" }));
    mockCouponsGet.mockResolvedValue(
      couponData({ code: "WELCOME", percent: 25 }),
    );
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
    mockClubGet.mockResolvedValue(clubData({ couponCode: "PARTNER" }));
    mockCouponsGet.mockResolvedValue(
      couponData({
        code: "PARTNER",
        percent: 100,
        autoRenew: true,
        clubIds: ["c1"],
      }),
    );
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
    mockClubGet.mockResolvedValue(clubData({ couponCode: "OLD" }));
    mockCouponsGet.mockResolvedValue(
      couponData({
        code: "OLD",
        expiresAt: { toDate: () => new Date(Date.now() - 86_400_000) },
      }),
    );

    await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ discounts: undefined }),
    );
  });

  it("ignores a coupon that targets other clubs", async () => {
    mockClubGet.mockResolvedValue(clubData({ couponCode: "OTHER" }));
    mockCouponsGet.mockResolvedValue(
      couponData({ code: "OTHER", clubIds: ["someone-else"] }),
    );

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
