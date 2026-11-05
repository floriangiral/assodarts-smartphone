const mockState: Record<string, unknown> = {};
const mockRunTransaction = jest.fn();
let transactionTail: Promise<void> = Promise.resolve();

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ runTransaction: mockRunTransaction }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

import type Stripe from "stripe";
import type { DocumentReference } from "firebase-admin/firestore";
import { createOrReuseCheckoutSession } from "./checkoutSession";

function makeReference(): DocumentReference {
  return {
    get: async () => ({ data: () => ({ ...mockState }) }),
  } as unknown as DocumentReference;
}

function makeStripe() {
  const sessions = new Map<string, Stripe.Checkout.Session>();
  let nextId = 1;
  const create = jest.fn(
    async (
      _params: Stripe.Checkout.SessionCreateParams,
      options?: Stripe.RequestOptions,
    ) => {
      const key = options?.idempotencyKey ?? "";
      const existing = sessions.get(key);
      if (existing) return existing;
      const session = {
        id: `cs_${nextId++}`,
        status: "open",
        url: `https://stripe.test/${key}`,
      } as Stripe.Checkout.Session;
      sessions.set(key, session);
      return session;
    },
  );
  const retrieve = jest.fn(async (id: string) => {
    if (id === "cs_expired") {
      return {
        id,
        status: "expired",
        url: null,
      } as Stripe.Checkout.Session;
    }
    const session = [...sessions.values()].find((item) => item.id === id);
    if (!session) throw new Error(`Unknown session ${id}`);
    return session;
  });
  return {
    client: {
      checkout: { sessions: { create, retrieve } },
    } as unknown as Stripe,
    create,
    retrieve,
  };
}

beforeEach(() => {
  for (const key of Object.keys(mockState)) delete mockState[key];
  transactionTail = Promise.resolve();
  mockRunTransaction.mockImplementation(
    async (operation: (transaction: unknown) => Promise<unknown>) => {
      let release!: () => void;
      const preceding = transactionTail;
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await preceding;
      try {
        return await operation({
          get: async () => ({ data: () => ({ ...mockState }) }),
          set: (_reference: unknown, value: Record<string, unknown>) =>
            Object.assign(mockState, value),
        });
      } finally {
        release();
      }
    },
  );
});

describe("createOrReuseCheckoutSession", () => {
  it("shares one Stripe idempotency key across concurrent calls and reuses the open session", async () => {
    const stripe = makeStripe();
    const ref = makeReference();
    const params = { mode: "payment" } as Stripe.Checkout.SessionCreateParams;

    const [first, second] = await Promise.all([
      createOrReuseCheckoutSession(ref, stripe.client, params, "payment-item"),
      createOrReuseCheckoutSession(ref, stripe.client, params, "payment-item"),
    ]);

    expect(first.id).toBe(second.id);
    expect(stripe.create).toHaveBeenCalledTimes(2);
    expect(stripe.create.mock.calls[0][1]?.idempotencyKey).toBe(
      stripe.create.mock.calls[1][1]?.idempotencyKey,
    );
    expect(mockState.stripeCheckoutSessionId).toBe(first.id);

    const reused = await createOrReuseCheckoutSession(
      ref,
      stripe.client,
      params,
      "payment-item",
    );
    expect(reused.id).toBe(first.id);
    expect(stripe.create).toHaveBeenCalledTimes(2);
  });

  it("rotates the idempotency key after the previous session expires", async () => {
    mockState.stripeCheckoutSessionId = "cs_expired";
    mockState.stripeCheckoutIdempotencyKey = "old-key";
    const stripe = makeStripe();

    const session = await createOrReuseCheckoutSession(
      makeReference(),
      stripe.client,
      { mode: "payment" } as Stripe.Checkout.SessionCreateParams,
      "payment-item",
    );

    expect(session.status).toBe("open");
    expect(session.id).not.toBe("cs_expired");
    expect(stripe.create.mock.calls[0][1]?.idempotencyKey).not.toBe("old-key");
    expect(mockState.stripeCheckoutSessionId).toBe(session.id);
  });

  it("does not create a checkout when the payment is already settled", async () => {
    mockState.isPaid = true;
    const stripe = makeStripe();

    await expect(
      createOrReuseCheckoutSession(
        makeReference(),
        stripe.client,
        { mode: "payment" } as Stripe.Checkout.SessionCreateParams,
        "payment-item",
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(stripe.create).not.toHaveBeenCalled();
  });
});
