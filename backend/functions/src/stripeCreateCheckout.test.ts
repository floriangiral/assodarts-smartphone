const mockItemGet = jest.fn();
const mockItemSet = jest.fn();
const mockPaymentCallGet = jest.fn();
const mockBankAccountGet = jest.fn();
const mockCheckoutCreate = jest.fn();

jest.mock("./shared/stripe", () => {
  const actual = jest.requireActual("./shared/stripe");
  return {
    ...actual,
    stripeSecretKey: { value: () => "sk_test_123" },
    stripeClient: () => ({
      checkout: { sessions: { create: mockCheckoutCreate } },
    }),
  };
});

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "payment_call_items") {
        return { doc: () => ({ get: mockItemGet, set: mockItemSet }) };
      }
      if (name === "payment_calls") {
        return { doc: () => ({ get: mockPaymentCallGet }) };
      }
      if (name === "club_bank_accounts") {
        return { doc: () => ({ get: mockBankAccountGet }) };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

import { stripeCreateCheckout } from "./stripeCreateCheckout";
import type { CallableRequest } from "firebase-functions/v2/https";

function makeRequest(
  data: Record<string, unknown>,
  uid?: string,
): CallableRequest<Record<string, unknown>> {
  return {
    data,
    auth: uid ? { uid, token: { email: "member@example.com" } } : undefined,
  } as unknown as CallableRequest<Record<string, unknown>>;
}

const handler = stripeCreateCheckout.run.bind(stripeCreateCheckout);

beforeEach(() => {
  mockItemGet.mockResolvedValue({
    data: () => ({
      memberId: "u1",
      paymentCallId: "call1",
      clubId: "c1",
      isPaid: false,
    }),
  });
  mockPaymentCallGet.mockResolvedValue({
    data: () => ({
      amountCents: 4200,
      currency: "EUR",
      title: "Licence",
      detail: "2026",
    }),
  });
  mockBankAccountGet.mockResolvedValue({
    data: () => ({ stripeAccountId: "acct_club", stripeStatus: "verified" }),
  });
  mockCheckoutCreate.mockResolvedValue({
    id: "cs_123",
    url: "https://stripe.test/checkout",
  });
  mockItemSet.mockResolvedValue(undefined);
});

describe("stripeCreateCheckout", () => {
  it("rejects unauthenticated calls", async () => {
    await expect(handler(makeRequest({ itemId: "i1" }))).rejects.toThrow();
  });

  it("rejects calls without itemId", async () => {
    await expect(handler(makeRequest({}, "u1"))).rejects.toThrow();
  });

  it.each([
    ["missing", undefined],
    ["owned by another auth uid", { memberId: "u2", isPaid: false }],
    ["already paid", { memberId: "u1", isPaid: true }],
  ])("rejects a %s payment line", async (_label, item) => {
    mockItemGet.mockResolvedValue({ data: item });
    await expect(
      handler(makeRequest({ itemId: "i1" }, "u1")),
    ).rejects.toThrow();
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["pending", { stripeAccountId: "acct_club", stripeStatus: "pending" }],
  ])("rejects when the club Stripe account is %s", async (_label, bank) => {
    mockBankAccountGet.mockResolvedValue({ data: () => bank });
    await expect(
      handler(makeRequest({ itemId: "i1" }, "u1")),
    ).rejects.toThrow();
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("rejects a valid member document id when it differs from the auth uid", async () => {
    mockItemGet.mockResolvedValue({
      data: () => ({
        memberId: "member-document-1",
        paymentCallId: "call1",
        clubId: "c1",
        isPaid: false,
      }),
    });

    await expect(
      handler(makeRequest({ itemId: "i1" }, "auth-uid-1")),
    ).rejects.toThrow();
  });

  it("creates a checkout session from server payment data and persists its id", async () => {
    const result = await handler(
      makeRequest({ itemId: "i1", amountCents: 1 }, "u1"),
    );

    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: "eur",
              unit_amount: 4200,
            }),
          }),
        ],
        payment_intent_data: expect.objectContaining({
          transfer_data: { destination: "acct_club" },
          metadata: { item_id: "i1", club_id: "c1", member_id: "u1" },
        }),
        metadata: { item_id: "i1", club_id: "c1", member_id: "u1" },
      }),
    );
    expect(mockItemSet).toHaveBeenCalledWith(
      { stripeCheckoutSessionId: "cs_123", updatedAt: "SERVER_TIMESTAMP" },
      { merge: true },
    );
    expect(result).toEqual({
      url: "https://stripe.test/checkout",
      sessionId: "cs_123",
    });
  });
});
