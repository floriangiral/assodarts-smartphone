import functionsTest from "firebase-functions-test";
import type { CallableRequest } from "firebase-functions/v2/https";

const testEnv = functionsTest();

const mockCallerMembershipGet = jest.fn();
const mockActiveMembershipsGet = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "memberships") {
        const query: { where: jest.Mock; get: jest.Mock } = {
          where: jest.fn(),
          get: mockActiveMembershipsGet,
        };
        query.where.mockImplementation(() => query);
        return {
          doc: () => ({ get: mockCallerMembershipGet }),
          where: query.where,
        };
      }
      if (name === "payment_calls" || name === "payment_call_items") {
        return { doc: (id: string) => ({ id, path: `${name}/${id}` }) };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
    batch: () => ({
      set: mockBatchSet,
      commit: mockBatchCommit,
    }),
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
  Timestamp: { fromMillis: (millis: number) => ({ millis }) },
}));

import { createPaymentCall } from "./paymentCalls";

afterAll(() => testEnv.cleanup());

function makeRequest(
  data: Record<string, unknown>,
  uid = "board-auth",
): CallableRequest<Record<string, unknown>> {
  return {
    data,
    auth: { uid, token: {} },
  } as unknown as CallableRequest<Record<string, unknown>>;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    callId: "call-1",
    clubId: "club-1",
    title: "Cotisation",
    detail: "COT-2026-0001",
    category: "cotisation",
    amountCents: 5000,
    dueDateMillis: 1_800_000_000_000,
    createdAtMillis: 1_790_000_000_000,
    notify: true,
    items: [
      { id: "item-1", memberId: "member-1" },
      { id: "item-2", memberId: "member-2" },
    ],
    ...overrides,
  };
}

describe("createPaymentCall", () => {
  const wrapped = testEnv.wrap(createPaymentCall);

  beforeEach(() => {
    jest.clearAllMocks();
    mockCallerMembershipGet.mockResolvedValue({
      data: () => ({
        status: "active",
        role: "board",
        memberId: "board-member",
      }),
    });
    mockActiveMembershipsGet.mockResolvedValue({
      docs: [
        { data: () => ({ memberId: "board-member" }) },
        { data: () => ({ memberId: "member-1" }) },
        { data: () => ({ memberId: "member-2" }) },
      ],
    });
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it("creates the payment call and one line per active recipient", async () => {
    await wrapped(makeRequest(validPayload()));

    expect(mockBatchSet).toHaveBeenCalledTimes(3);
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: "payment_calls/call-1" }),
      expect.objectContaining({
        clubId: "club-1",
        title: "Cotisation",
        amountCents: 5000,
        createdByMemberId: "board-member",
        notify: true,
      }),
    );
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: "payment_call_items/item-1" }),
      expect.objectContaining({
        paymentCallId: "call-1",
        clubId: "club-1",
        memberId: "member-1",
        isPaid: false,
      }),
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-board caller", async () => {
    mockCallerMembershipGet.mockResolvedValue({
      data: () => ({ status: "active", role: "member", memberId: "member-1" }),
    });

    await expect(wrapped(makeRequest(validPayload(), "member-auth"))).rejects.toThrow();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("rejects recipients who are not active members of the club", async () => {
    mockActiveMembershipsGet.mockResolvedValue({
      docs: [{ data: () => ({ memberId: "member-1" }) }],
    });

    await expect(wrapped(makeRequest(validPayload()))).rejects.toThrow();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("deduplicates recipients before writing payment lines", async () => {
    await wrapped(
      makeRequest(
        validPayload({
          items: [
            { id: "item-1", memberId: "member-1" },
            { id: "item-duplicate", memberId: "member-1" },
          ],
        }),
      ),
    );

    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: "payment_call_items/item-duplicate" }),
      expect.objectContaining({ memberId: "member-1" }),
    );
  });
});
