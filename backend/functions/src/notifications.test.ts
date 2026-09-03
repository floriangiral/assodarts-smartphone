const mockPaymentCallGet = jest.fn();
const mockMemberGet = jest.fn();
const mockMembershipsQueryGet = jest.fn();
const mockTokensQueryGet = jest.fn();
const mockNotificationAdd = jest.fn();
const mockSendEachForMulticast = jest.fn();

function makeMembershipsQuery(): {
  where: jest.Mock;
  get: jest.Mock;
} {
  const query: { where: jest.Mock; get: jest.Mock } = {
    where: jest.fn(),
    get: mockMembershipsQueryGet,
  };
  query.where.mockImplementation(() => query);
  return query;
}

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "payment_calls") {
        return { doc: () => ({ get: mockPaymentCallGet }) };
      }
      if (name === "members") {
        return { doc: () => ({ get: mockMemberGet }) };
      }
      if (name === "memberships") {
        return makeMembershipsQuery();
      }
      if (name === "notifications") {
        return { add: mockNotificationAdd };
      }
      if (name === "device_push_tokens") {
        return { where: jest.fn(() => ({ get: mockTokensQueryGet })) };
      }
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

jest.mock("firebase-admin/messaging", () => ({
  getMessaging: () => ({ sendEachForMulticast: mockSendEachForMulticast }),
}));

import {
  onPaymentItemWritten,
  onAnnouncementCreated,
  onNotificationCreated,
} from "./notifications";

beforeEach(() => {
  mockNotificationAdd.mockResolvedValue(undefined);
  mockPaymentCallGet.mockResolvedValue({
    data: () => ({ title: "Cotisation", amountCents: 5000 }),
  });
  mockMemberGet.mockResolvedValue({
    data: () => ({ displayName: "Jane Doe" }),
  });
});

function paymentItemEvent(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
) {
  return {
    params: { itemId: "item-1" },
    data: {
      before: { data: () => before },
      after: { data: () => after },
    },
  } as never;
}

function announcementEvent(data: Record<string, unknown> | undefined) {
  return {
    params: { announcementId: "ann-1" },
    data: { data: () => data },
  } as never;
}

function notificationEvent(data: Record<string, unknown> | undefined) {
  return {
    params: { notificationId: "notif-1" },
    data: { data: () => data },
  } as never;
}

describe("onPaymentItemWritten", () => {
  it("does nothing when the document was deleted", async () => {
    await onPaymentItemWritten.run(
      paymentItemEvent({ isPaid: false }, undefined),
    );
    expect(mockNotificationAdd).not.toHaveBeenCalled();
  });

  it("notifies the board when a payment is newly declared", async () => {
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [
        { data: () => ({ memberId: "board1" }) },
        { data: () => ({ memberId: "board2" }) },
      ],
    });

    await onPaymentItemWritten.run(
      paymentItemEvent(
        { memberId: "member1", clubId: "c1", declaredAt: null, isPaid: false },
        {
          memberId: "member1",
          clubId: "c1",
          paymentCallId: "call1",
          declaredAt: "2026-09-03T00:00:00Z",
          isPaid: false,
        },
      ),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(2);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "board1",
        clubId: "c1",
        kind: "payment_to_confirm",
        payload: expect.objectContaining({
          itemId: "item-1",
          label: "Cotisation",
          amountCents: 5000,
          memberName: "Jane Doe",
        }),
      }),
    );
  });

  it("notifies the member when their payment is confirmed", async () => {
    await onPaymentItemWritten.run(
      paymentItemEvent(
        { memberId: "member1", clubId: "c1", isPaid: false },
        {
          memberId: "member1",
          clubId: "c1",
          paymentCallId: "call1",
          isPaid: true,
        },
      ),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "member1",
        kind: "payment_confirmed",
      }),
    );
  });

  it("does not renotify when declaredAt/isPaid were already set", async () => {
    await onPaymentItemWritten.run(
      paymentItemEvent(
        {
          memberId: "member1",
          clubId: "c1",
          declaredAt: "already",
          isPaid: true,
        },
        {
          memberId: "member1",
          clubId: "c1",
          paymentCallId: "call1",
          declaredAt: "already",
          isPaid: true,
        },
      ),
    );

    expect(mockNotificationAdd).not.toHaveBeenCalled();
  });
});

describe("onAnnouncementCreated", () => {
  it("does nothing when the announcement has no publishedAt", async () => {
    await onAnnouncementCreated.run(
      announcementEvent({ clubId: "c1", title: "t", body: "b" }),
    );
    expect(mockNotificationAdd).not.toHaveBeenCalled();
  });

  it("notifies every active member once published", async () => {
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [
        { data: () => ({ memberId: "m1" }) },
        { data: () => ({ memberId: "m2" }) },
      ],
    });

    await onAnnouncementCreated.run(
      announcementEvent({
        clubId: "c1",
        title: "Bienvenue",
        body: "Contenu",
        publishedAt: "2026-09-03T00:00:00Z",
      }),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(2);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "m1",
        kind: "announcement",
        title: "Bienvenue",
        payload: expect.objectContaining({ announcementId: "ann-1" }),
      }),
    );
  });
});

describe("onNotificationCreated", () => {
  it("skips FCM when no device tokens are registered", async () => {
    mockTokensQueryGet.mockResolvedValue({ empty: true, docs: [] });

    await onNotificationCreated.run(
      notificationEvent({ memberId: "m1", title: "t", body: "b" }),
    );

    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it("sends a multicast push to every registered device", async () => {
    mockTokensQueryGet.mockResolvedValue({
      empty: false,
      docs: [{ id: "token1" }, { id: "token2" }],
    });
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
    });

    await onNotificationCreated.run(
      notificationEvent({ memberId: "m1", title: "Titre", body: "Corps" }),
    );

    expect(mockSendEachForMulticast).toHaveBeenCalledWith({
      tokens: ["token1", "token2"],
      notification: { title: "Titre", body: "Corps" },
    });
  });

  it("does nothing when the notification document has no data", async () => {
    await onNotificationCreated.run(notificationEvent(undefined));
    expect(mockTokensQueryGet).not.toHaveBeenCalled();
  });
});
