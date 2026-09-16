const mockConstructEvent = jest.fn();
const mockItemSet = jest.fn();
const mockBankAccountsGet = jest.fn();
const mockClubSet = jest.fn();
const mockClubsQueryGet = jest.fn();
const clubDocIds: string[] = [];

jest.mock("./shared/stripe", () => {
  const actual = jest.requireActual("./shared/stripe");
  return {
    ...actual,
    stripeSecretKey: { value: () => "sk_test_123" },
    stripeWebhookSecret: { value: () => "whsec_test_123" },
    stripeClient: () => ({
      webhooks: { constructEvent: mockConstructEvent },
    }),
  };
});

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "payment_call_items") {
        return { doc: () => ({ set: mockItemSet }) };
      }
      if (name === "club_bank_accounts") {
        return {
          where: () => ({ get: mockBankAccountsGet }),
        };
      }
      if (name === "clubs") {
        return {
          doc: (id: string) => {
            clubDocIds.push(id);
            return { set: mockClubSet };
          },
          where: () => ({ limit: () => ({ get: mockClubsQueryGet }) }),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
  Timestamp: { fromMillis: (ms: number) => ({ __ms: ms }) },
}));

import { stripeWebhook } from "./stripeWebhook";

type MockRequest = {
  headers: Record<string, string | undefined>;
  rawBody: Buffer;
  query: Record<string, unknown>;
};

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
  set: jest.Mock;
  send: jest.Mock;
  on: jest.Mock;
};

function makeRequest(signature = "sig_test"): MockRequest {
  return {
    headers: signature ? { "stripe-signature": signature } : {},
    rawBody: Buffer.from("raw-body"),
    query: {},
  };
}

function makeResponse(): MockResponse {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
    set: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
  };
  response.status.mockReturnValue(response);
  response.set.mockReturnValue(response);
  return response;
}

const handler = stripeWebhook as unknown as (
  req: unknown,
  res: unknown,
) => Promise<void>;

beforeEach(() => {
  mockConstructEvent.mockReset();
  mockItemSet.mockReset();
  mockBankAccountsGet.mockReset();
  mockClubSet.mockReset();
  mockClubsQueryGet.mockReset();
  clubDocIds.length = 0;
  mockItemSet.mockResolvedValue(undefined);
  mockBankAccountsGet.mockResolvedValue({ docs: [] });
  mockClubSet.mockResolvedValue(undefined);
  mockClubsQueryGet.mockResolvedValue({ empty: true, docs: [] });
});

describe("stripeWebhook", () => {
  it("rejects a request without a signature without writing Firestore", async () => {
    const response = makeResponse();

    await handler(makeRequest(""), response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: "Missing signature" });
    expect(mockConstructEvent).not.toHaveBeenCalled();
    expect(mockItemSet).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature without writing Firestore", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const response = makeResponse();

    await handler(makeRequest(), response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: "Invalid signature" });
    expect(mockItemSet).not.toHaveBeenCalled();
  });

  it.each([
    ["pi_string", "pi_string"],
    [{ id: "pi_object" }, "pi_object"],
  ])(
    "settles a paid checkout with payment_intent %p",
    async (paymentIntent, expectedIntent) => {
      mockConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            payment_status: "paid",
            payment_intent: paymentIntent,
            metadata: { item_id: "item1" },
          },
        },
      });
      const response = makeResponse();

      await handler(makeRequest(), response);

      expect(mockItemSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isPaid: true,
          paidAt: "SERVER_TIMESTAMP",
          declaredAt: null,
          method: "card",
          stripePaymentIntentId: expectedIntent,
          updatedAt: "SERVER_TIMESTAMP",
        }),
        { merge: true },
      );
      expect(response.json).toHaveBeenCalledWith({ received: true });
    },
  );

  it.each([
    ["unpaid", { payment_status: "unpaid", metadata: { item_id: "item1" } }],
    ["without item metadata", { payment_status: "paid", metadata: {} }],
  ])(
    "does not write a checkout event when it is %s",
    async (_label, object) => {
      mockConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: { object },
      });
      const response = makeResponse();

      await handler(makeRequest(), response);

      expect(mockItemSet).not.toHaveBeenCalled();
      expect(response.json).toHaveBeenCalledWith({ received: true });
    },
  );

  it.each([
    ["with metadata", { item_id: "item1" }, 1],
    ["without metadata", {}, 0],
  ])("handles a refunded charge %s", async (_label, metadata, writes) => {
    mockConstructEvent.mockReturnValue({
      type: "charge.refunded",
      data: { object: { metadata } },
    });
    const response = makeResponse();

    await handler(makeRequest(), response);

    expect(mockItemSet).toHaveBeenCalledTimes(writes);
    if (writes) {
      expect(mockItemSet).toHaveBeenCalledWith(
        expect.objectContaining({ isPaid: false, paidAt: null }),
        { merge: true },
      );
    }
  });

  it.each([
    [false, false, "pending"],
    [false, true, "pending"],
    [true, false, "pending"],
    [true, true, "verified"],
  ])(
    "sets account status to %s/%s => %s",
    async (chargesEnabled, detailsSubmitted, status) => {
      const firstSet = jest.fn().mockResolvedValue(undefined);
      const secondSet = jest.fn().mockResolvedValue(undefined);
      mockBankAccountsGet.mockResolvedValue({
        docs: [{ ref: { set: firstSet } }, { ref: { set: secondSet } }],
      });
      mockConstructEvent.mockReturnValue({
        type: "account.updated",
        data: {
          object: {
            id: "acct_1",
            charges_enabled: chargesEnabled,
            details_submitted: detailsSubmitted,
          },
        },
      });
      const response = makeResponse();

      await handler(makeRequest(), response);

      for (const set of [firstSet, secondSet]) {
        expect(set).toHaveBeenCalledWith(
          expect.objectContaining({
            stripeStatus: status,
            stripeChargesEnabled: chargesEnabled,
            stripeDetailsSubmitted: detailsSubmitted,
          }),
          { merge: true },
        );
      }
    },
  );

  it.each([0, 1, 2])(
    "updates all %i matching bank account documents",
    async (count) => {
      const setters = Array.from({ length: count }, () =>
        jest.fn().mockResolvedValue(undefined),
      );
      mockBankAccountsGet.mockResolvedValue({
        docs: setters.map((set) => ({ ref: { set } })),
      });
      mockConstructEvent.mockReturnValue({
        type: "account.updated",
        data: {
          object: {
            id: "acct_1",
            charges_enabled: true,
            details_submitted: true,
          },
        },
      });
      const response = makeResponse();

      await handler(makeRequest(), response);

      expect(setters.every((set) => set.mock.calls.length === 1)).toBe(true);
    },
  );

  it("acknowledges an unhandled event without touching Firestore", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.updated",
      data: { object: {} },
    });
    const response = makeResponse();

    await handler(makeRequest(), response);

    expect(response.json).toHaveBeenCalledWith({ received: true });
    expect(mockItemSet).not.toHaveBeenCalled();
    expect(mockBankAccountsGet).not.toHaveBeenCalled();
  });

  it("returns 500 and logs when event processing fails", async () => {
    const error = new Error("Firestore unavailable");
    mockConstructEvent.mockReturnValue({
      type: "charge.refunded",
      data: { object: { metadata: { item_id: "item1" } } },
    });
    mockItemSet.mockRejectedValue(error);
    const response = makeResponse();
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await handler(makeRequest(), response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ error: "Handler failed" });
    expect(consoleError).toHaveBeenCalledWith("Webhook handling failed", error);
    consoleError.mockRestore();
  });
});

describe("stripeWebhook — club subscriptions", () => {
  it("activates the club on a completed subscription checkout", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          customer: "cus_1",
          subscription: "sub_1",
          metadata: { club_id: "club-1" },
        },
      },
    });
    const response = makeResponse();

    await handler(makeRequest(), response);

    expect(clubDocIds).toContain("club-1");
    expect(mockClubSet).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionStatus: "active",
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
      }),
      { merge: true },
    );
    // The membership-fee path must not be touched by a subscription event.
    expect(mockItemSet).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ received: true });
  });

  it("still settles a membership fee checkout, which carries item_id", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
          payment_status: "paid",
          payment_intent: "pi_1",
          metadata: { item_id: "item-1" },
        },
      },
    });
    const response = makeResponse();

    await handler(makeRequest(), response);

    expect(mockItemSet).toHaveBeenCalledWith(
      expect.objectContaining({ isPaid: true }),
      { merge: true },
    );
    expect(mockClubSet).not.toHaveBeenCalled();
  });

  it("keeps the club active and records the period end on invoice.paid", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.paid",
      data: {
        object: {
          subscription: "sub_1",
          metadata: { club_id: "club-1" },
          lines: { data: [{ period: { end: 1800000000 } }] },
        },
      },
    });
    const response = makeResponse();

    await handler(makeRequest(), response);

    expect(mockClubSet).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionStatus: "active",
        currentPeriodEnd: { __ms: 1800000000 * 1000 },
      }),
      { merge: true },
    );
  });

  it("finds the club by subscription id when the invoice has no metadata", async () => {
    mockClubsQueryGet.mockResolvedValue({
      empty: false,
      docs: [{ ref: { set: mockClubSet } }],
    });
    mockConstructEvent.mockReturnValue({
      type: "invoice.paid",
      data: { object: { subscription: "sub_lookup", metadata: {} } },
    });
    const response = makeResponse();

    await handler(makeRequest(), response);

    expect(mockClubSet).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionStatus: "active" }),
      { merge: true },
    );
  });

  it("moves the club to grace on a failed renewal, never straight to expired", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: {
        object: { subscription: "sub_1", metadata: { club_id: "club-1" } },
      },
    });
    const response = makeResponse();

    await handler(makeRequest(), response);

    expect(mockClubSet).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionStatus: "grace",
        graceStartedAt: "SERVER_TIMESTAMP",
      }),
      { merge: true },
    );
  });

  it("expires the club when Stripe deletes the subscription", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", metadata: { club_id: "club-1" } } },
    });
    const response = makeResponse();

    await handler(makeRequest(), response);

    expect(mockClubSet).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionStatus: "expired",
        stripeSubscriptionId: null,
      }),
      { merge: true },
    );
  });

  it("ignores a subscription event whose club cannot be resolved", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: { object: { subscription: "sub_unknown", metadata: {} } },
    });
    const response = makeResponse();

    await handler(makeRequest(), response);

    expect(mockClubSet).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ received: true });
  });
});
