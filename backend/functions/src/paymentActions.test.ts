import functionsTest from "firebase-functions-test";
import type { CallableRequest } from "firebase-functions/v2/https";

const testEnv = functionsTest();

const mockMembershipGet = jest.fn();
const mockItemGet = jest.fn();
const mockItemSet = jest.fn();

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "memberships") {
        return { doc: () => ({ get: mockMembershipGet }) };
      }
      if (name === "payment_call_items") {
        return { doc: () => ({ get: mockItemGet, set: mockItemSet }) };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

import {
  declarePayment,
  validatePayment,
  cancelPaymentDeclaration,
} from "./paymentActions";

afterAll(() => testEnv.cleanup());

function makeRequest(
  data: Record<string, unknown>,
  uid?: string,
): CallableRequest<Record<string, unknown>> {
  return {
    data,
    auth: uid ? { uid, token: {} } : undefined,
  } as unknown as CallableRequest<Record<string, unknown>>;
}

describe("declarePayment", () => {
  const wrapped = testEnv.wrap(declarePayment);

  it("rejects unauthenticated calls", async () => {
    await expect(
      wrapped(makeRequest({ itemId: "i1", method: "cash" })),
    ).rejects.toThrow();
  });

  it("rejects when itemId or method is missing", async () => {
    await expect(
      wrapped(makeRequest({ itemId: "i1" }, "member1")),
    ).rejects.toThrow();
  });

  it("rejects when the item does not belong to the caller", async () => {
    mockItemGet.mockResolvedValue({
      exists: true,
      data: () => ({ memberId: "someoneElse", isPaid: false }),
    });
    await expect(
      wrapped(makeRequest({ itemId: "i1", method: "cash" }, "member1")),
    ).rejects.toThrow();
  });

  it("rejects when the item is already paid", async () => {
    mockItemGet.mockResolvedValue({
      exists: true,
      data: () => ({ memberId: "member1", isPaid: true }),
    });
    await expect(
      wrapped(makeRequest({ itemId: "i1", method: "cash" }, "member1")),
    ).rejects.toThrow();
  });

  it("declares the payment for its own owner", async () => {
    mockItemGet.mockResolvedValue({
      exists: true,
      data: () => ({ memberId: "member1", isPaid: false }),
    });
    mockItemSet.mockResolvedValue(undefined);

    await wrapped(
      makeRequest(
        { itemId: "i1", method: "cash", reference: "ref-1" },
        "member1",
      ),
    );

    expect(mockItemSet).toHaveBeenCalledWith(
      expect.objectContaining({ method: "cash", reference: "ref-1" }),
      { merge: true },
    );
  });
});

describe("validatePayment", () => {
  const wrapped = testEnv.wrap(validatePayment);

  it("rejects a non-board caller", async () => {
    mockItemGet.mockResolvedValue({
      exists: true,
      data: () => ({ memberId: "member1", clubId: "c1" }),
    });
    mockMembershipGet.mockResolvedValue({
      data: () => ({ status: "active", role: "member" }),
    });
    await expect(
      wrapped(makeRequest({ itemId: "i1" }, "someone")),
    ).rejects.toThrow();
  });

  it("marks the item paid for a board caller", async () => {
    mockItemGet.mockResolvedValue({
      exists: true,
      data: () => ({ memberId: "member1", clubId: "c1" }),
    });
    mockMembershipGet.mockResolvedValue({
      data: () => ({ status: "active", role: "board" }),
    });
    mockItemSet.mockResolvedValue(undefined);

    await wrapped(makeRequest({ itemId: "i1" }, "board1"));

    expect(mockItemSet).toHaveBeenCalledWith(
      expect.objectContaining({ isPaid: true, validatedByMemberId: "board1" }),
      { merge: true },
    );
  });

  it("rejects when the item does not exist", async () => {
    mockItemGet.mockResolvedValue({ exists: false });
    await expect(
      wrapped(makeRequest({ itemId: "missing" }, "board1")),
    ).rejects.toThrow();
  });
});

describe("cancelPaymentDeclaration", () => {
  const wrapped = testEnv.wrap(cancelPaymentDeclaration);

  it("lets the owner cancel their own declaration", async () => {
    mockItemGet.mockResolvedValue({
      exists: true,
      data: () => ({ memberId: "member1", clubId: "c1" }),
    });
    mockItemSet.mockResolvedValue(undefined);

    await wrapped(makeRequest({ itemId: "i1" }, "member1"));

    expect(mockItemSet).toHaveBeenCalledWith(
      expect.objectContaining({
        declaredAt: null,
        method: null,
        reference: null,
      }),
      { merge: true },
    );
  });

  it("requires board membership when cancelling someone else's declaration", async () => {
    mockItemGet.mockResolvedValue({
      exists: true,
      data: () => ({ memberId: "member1", clubId: "c1" }),
    });
    mockMembershipGet.mockResolvedValue({
      data: () => ({ status: "active", role: "member" }),
    });
    await expect(
      wrapped(makeRequest({ itemId: "i1" }, "someoneElse")),
    ).rejects.toThrow();
  });
});
