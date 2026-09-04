const mockRequireClubBoard = jest.fn();
const mockBankAccountGet = jest.fn();
const mockBankAccountSet = jest.fn();
const mockAccountsRetrieve = jest.fn();

jest.mock("./shared/auth", () => ({
  requireClubBoard: mockRequireClubBoard,
}));

jest.mock("./shared/stripe", () => {
  const actual = jest.requireActual("./shared/stripe");
  return {
    ...actual,
    stripeSecretKey: { value: () => "sk_test_123" },
    stripeClient: () => ({
      accounts: { retrieve: mockAccountsRetrieve },
    }),
  };
});

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "club_bank_accounts") {
        return {
          doc: () => ({ get: mockBankAccountGet, set: mockBankAccountSet }),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

import { stripeConnectStatus } from "./stripeConnectStatus";
import type { CallableRequest } from "firebase-functions/v2/https";

function makeRequest(
  data: Record<string, unknown>,
  uid?: string,
): CallableRequest<Record<string, unknown>> {
  return {
    data,
    auth: uid ? { uid, token: {} } : undefined,
  } as unknown as CallableRequest<Record<string, unknown>>;
}

// `onCall` handlers are invoked directly through `.run()` in tests, same as Firestore triggers.
const handler = stripeConnectStatus.run.bind(stripeConnectStatus);

beforeEach(() => {
  mockRequireClubBoard.mockResolvedValue(undefined);
});

describe("stripeConnectStatus", () => {
  it("rejects unauthenticated calls", async () => {
    await expect(handler(makeRequest({ clubId: "c1" }))).rejects.toThrow();
  });

  it("rejects when clubId is missing", async () => {
    await expect(handler(makeRequest({}, "u1"))).rejects.toThrow();
  });

  it("reports not_connected when the club has no Stripe account yet", async () => {
    mockBankAccountGet.mockResolvedValue({ data: () => undefined });

    const result = await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(mockRequireClubBoard).toHaveBeenCalledWith("c1", "u1");
    expect(result).toEqual({
      status: "not_connected",
      chargesEnabled: false,
      detailsSubmitted: false,
    });
    expect(mockAccountsRetrieve).not.toHaveBeenCalled();
  });

  it("mirrors a verified Stripe account into Firestore", async () => {
    mockBankAccountGet.mockResolvedValue({
      data: () => ({ stripeAccountId: "acct_123" }),
    });
    mockAccountsRetrieve.mockResolvedValue({
      charges_enabled: true,
      details_submitted: true,
    });
    mockBankAccountSet.mockResolvedValue(undefined);

    const result = await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(mockAccountsRetrieve).toHaveBeenCalledWith("acct_123");
    expect(result).toEqual({
      status: "verified",
      chargesEnabled: true,
      detailsSubmitted: true,
    });
    expect(mockBankAccountSet).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeStatus: "verified",
        stripeChargesEnabled: true,
        stripeDetailsSubmitted: true,
      }),
      { merge: true },
    );
  });

  it("mirrors a pending Stripe account into Firestore", async () => {
    mockBankAccountGet.mockResolvedValue({
      data: () => ({ stripeAccountId: "acct_456" }),
    });
    mockAccountsRetrieve.mockResolvedValue({
      charges_enabled: false,
      details_submitted: true,
    });
    mockBankAccountSet.mockResolvedValue(undefined);

    const result = await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(result).toEqual({
      status: "pending",
      chargesEnabled: false,
      detailsSubmitted: true,
    });
  });
});
