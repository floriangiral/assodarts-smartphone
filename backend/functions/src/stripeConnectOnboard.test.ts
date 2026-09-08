const mockRequireClubBoard = jest.fn();
const mockClubGet = jest.fn();
const mockBankAccountGet = jest.fn();
const mockBankAccountSet = jest.fn();
const mockAccountsCreate = jest.fn();
const mockAccountsRetrieve = jest.fn();
const mockAccountLinksCreate = jest.fn();

jest.mock("./shared/auth", () => ({
  requireClubBoard: mockRequireClubBoard,
}));

jest.mock("./shared/stripe", () => {
  const actual = jest.requireActual("./shared/stripe");
  return {
    ...actual,
    stripeSecretKey: { value: () => "sk_test_123" },
    stripeClient: () => ({
      accounts: {
        create: mockAccountsCreate,
        retrieve: mockAccountsRetrieve,
      },
      accountLinks: { create: mockAccountLinksCreate },
    }),
  };
});

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "clubs") {
        return { doc: () => ({ get: mockClubGet }) };
      }
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

import { stripeConnectOnboard } from "./stripeConnectOnboard";
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

const handler = stripeConnectOnboard.run.bind(stripeConnectOnboard);

beforeEach(() => {
  mockRequireClubBoard.mockResolvedValue(undefined);
  mockClubGet.mockResolvedValue({ data: () => ({ name: "Club Paris" }) });
  mockBankAccountGet.mockResolvedValue({ data: () => undefined });
  mockBankAccountSet.mockResolvedValue(undefined);
  mockAccountsCreate.mockResolvedValue({ id: "acct_new" });
  mockAccountsRetrieve.mockResolvedValue({
    charges_enabled: true,
    details_submitted: true,
  });
  mockAccountLinksCreate.mockResolvedValue({
    url: "https://stripe.test/onboard",
  });
});

describe("stripeConnectOnboard", () => {
  it("rejects unauthenticated calls", async () => {
    await expect(handler(makeRequest({ clubId: "c1" }))).rejects.toThrow();
  });

  it("rejects calls without clubId", async () => {
    await expect(handler(makeRequest({}, "u1"))).rejects.toThrow();
  });

  it("checks board access with the club and caller ids", async () => {
    mockRequireClubBoard.mockRejectedValue(new Error("not allowed"));

    await expect(handler(makeRequest({ clubId: "c1" }, "u1"))).rejects.toThrow(
      "not allowed",
    );
    expect(mockRequireClubBoard).toHaveBeenCalledWith("c1", "u1");
  });

  it("resumes an existing account without creating another one", async () => {
    mockClubGet.mockResolvedValue({ data: () => ({ name: "Club Paris" }) });
    mockBankAccountGet.mockResolvedValue({
      data: () => ({ stripeAccountId: "acct_existing" }),
    });

    const result = await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(mockAccountsCreate).not.toHaveBeenCalled();
    expect(mockAccountLinksCreate).toHaveBeenCalledWith({
      account: "acct_existing",
      refresh_url:
        "https://us-central1-undefined.cloudfunctions.net/stripeReturn?state=refresh",
      return_url:
        "https://us-central1-undefined.cloudfunctions.net/stripeReturn?state=done",
      type: "account_onboarding",
    });
    expect(result).toEqual({
      url: "https://stripe.test/onboard",
      accountId: "acct_existing",
      status: "verified",
    });
  });

  it.each([
    [{ country: "be" }, "BE"],
    [{}, "FR"],
  ])("creates an Express account with country %s", async (club, country) => {
    mockClubGet.mockResolvedValue({
      data: () => ({ name: "Club Paris", ...club }),
    });

    const result = await handler(makeRequest({ clubId: "c1" }, "u1"));

    expect(mockAccountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "express",
        country,
        business_type: "non_profit",
      }),
    );
    expect(mockBankAccountSet).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: "c1",
        stripeAccountId: "acct_new",
        stripeStatus: "pending",
      }),
      { merge: true },
    );
    expect(result).toEqual({
      url: "https://stripe.test/onboard",
      accountId: "acct_new",
      status: "verified",
    });
  });
});
