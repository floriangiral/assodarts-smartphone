const mockPaymentCallGet = jest.fn();
const mockMemberGet = jest.fn();
const mockConversationGet = jest.fn();
const mockTournamentGet = jest.fn();
const mockMembershipsQueryGet = jest.fn();
const mockTokensQueryGet = jest.fn();
const mockNotificationAdd = jest.fn();
const mockNotificationSet = jest.fn();
const mockNotificationBatchCommit = jest.fn();
const mockGetAll = jest.fn();
const mockSendEachForMulticast = jest.fn();
const mockTokenDelete = jest.fn();
let lastMembershipsQuery: { where: jest.Mock; get: jest.Mock };

function makeMembershipsQuery(): {
  where: jest.Mock;
  get: jest.Mock;
} {
  const query: { where: jest.Mock; get: jest.Mock } = {
    where: jest.fn(),
    get: mockMembershipsQueryGet,
  };
  query.where.mockImplementation(() => query);
  lastMembershipsQuery = query;
  return query;
}

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    getAll: mockGetAll,
    batch: () => ({
      set: mockNotificationSet,
      commit: mockNotificationBatchCommit,
    }),
    collection: (name: string) => {
      if (name === "payment_calls") {
        return { doc: () => ({ get: mockPaymentCallGet }) };
      }
      if (name === "members") {
        return {
          doc: (memberId: string) => ({
            id: memberId,
            get: () => mockMemberGet(memberId),
          }),
        };
      }
      if (name === "conversations") {
        return { doc: () => ({ get: mockConversationGet }) };
      }
      if (name === "tournaments") {
        return { doc: () => ({ get: mockTournamentGet }) };
      }
      if (name === "memberships") {
        return makeMembershipsQuery();
      }
      if (name === "notifications") {
        return {
          add: mockNotificationAdd,
          doc: () => ({ path: "notifications/generated" }),
        };
      }
      if (name === "device_push_tokens") {
        return {
          doc: () => ({ delete: mockTokenDelete }),
          where: jest.fn(() => ({ get: mockTokensQueryGet })),
        };
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
  onEventCreated,
  onMessageCreated,
  onTournamentEntryCreated,
  onPlatformAnnouncementCreated,
  onNotificationCreated,
} from "./notifications";

beforeEach(() => {
  jest.clearAllMocks();
  mockNotificationAdd.mockResolvedValue(undefined);
  mockNotificationSet.mockImplementation((_ref, data) =>
    mockNotificationAdd(data),
  );
  mockNotificationBatchCommit.mockResolvedValue(undefined);
  mockGetAll.mockImplementation((...refs: { id: string }[]) =>
    Promise.all(refs.map((ref) => mockMemberGet(ref.id))),
  );
  mockTokenDelete.mockResolvedValue(undefined);
  mockPaymentCallGet.mockResolvedValue({
    data: () => ({ title: "Cotisation", amountCents: 5000, notify: true }),
  });
  mockMemberGet.mockResolvedValue({
    data: () => ({ displayName: "Jane Doe" }),
  });
  mockConversationGet.mockResolvedValue({
    data: () => ({
      clubId: "c1",
      kind: "direct",
      participantIds: ["member1", "member2"],
    }),
  });
  mockMembershipsQueryGet.mockResolvedValue({
    docs: [
      { data: () => ({ memberId: "member1", clubId: "c1" }) },
      { data: () => ({ memberId: "member2", clubId: "c1" }) },
    ],
  });
  mockTournamentGet.mockResolvedValue({
    data: () => ({ name: "Open de rentrée" }),
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

function eventEvent(data: Record<string, unknown> | undefined) {
  return {
    params: { eventId: "event-1" },
    data: { data: () => data },
  } as never;
}

function messageEvent(data: Record<string, unknown> | undefined) {
  return {
    params: { conversationId: "conversation-1", messageId: "message-1" },
    data: { data: () => data },
  } as never;
}

function tournamentEntryEvent(data: Record<string, unknown> | undefined) {
  return {
    params: { entryId: "entry-1" },
    data: { data: () => data },
  } as never;
}

function platformAnnouncementEvent(data: Record<string, unknown> | undefined) {
  return {
    params: { announcementId: "platform-ann-1" },
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

  it("does not notify the declaring member when they are also on the board", async () => {
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [
        { data: () => ({ memberId: "board1" }) },
        { data: () => ({ memberId: "member1" }) },
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

    expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: "board1", kind: "payment_to_confirm" }),
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

  it("notifies the member when a payable item is created and notify is enabled", async () => {
    await onPaymentItemWritten.run(
      paymentItemEvent(undefined, {
        memberId: "member1",
        clubId: "c1",
        paymentCallId: "call1",
        isPaid: false,
      }),
    );

    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "member1",
        kind: "payment_due",
        payload: expect.objectContaining({
          callId: "call1",
          itemId: "item-1",
          label: "Cotisation",
        }),
      }),
    );
  });

  it("does not notify a member who disabled payment notifications", async () => {
    mockMemberGet.mockResolvedValue({
      data: () => ({ displayName: "Jane Doe", notifyPayments: false }),
    });

    await onPaymentItemWritten.run(
      paymentItemEvent(undefined, {
        memberId: "member1",
        clubId: "c1",
        paymentCallId: "call1",
        isPaid: false,
      }),
    );

    expect(mockNotificationAdd).not.toHaveBeenCalled();
  });

  it("does not notify payment recipients outside active club memberships", async () => {
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [{ data: () => ({ memberId: "other-member", clubId: "c1" }) }],
    });

    await onPaymentItemWritten.run(
      paymentItemEvent(undefined, {
        memberId: "member1",
        clubId: "c1",
        paymentCallId: "call1",
        isPaid: false,
      }),
    );

    expect(mockNotificationAdd).not.toHaveBeenCalled();
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

  it("does not notify members when the announcement notification toggle is off", async () => {
    await onAnnouncementCreated.run(
      announcementEvent({
        clubId: "c1",
        title: "Info",
        body: "Contenu",
        publishedAt: "2026-09-03T00:00:00Z",
        notify: false,
      }),
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

  it("does not notify the announcement's author", async () => {
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
        createdByMemberId: "m1",
      }),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: "m2", kind: "announcement" }),
    );
  });
});

describe("onEventCreated", () => {
  it("notifies active members when an event is created", async () => {
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [
        { data: () => ({ memberId: "m1" }) },
        { data: () => ({ memberId: "m2" }) },
      ],
    });

    await onEventCreated.run(
      eventEvent({
        clubId: "c1",
        title: "Open",
        location: "Club house",
      }),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(2);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "m1",
        kind: "event",
        payload: expect.objectContaining({ eventId: "event-1" }),
      }),
    );
  });

  it("does not notify the event's creator", async () => {
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [
        { data: () => ({ memberId: "m1" }) },
        { data: () => ({ memberId: "m2" }) },
      ],
    });

    await onEventCreated.run(
      eventEvent({
        clubId: "c1",
        title: "Open",
        location: "Club house",
        createdByMemberId: "m1",
      }),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: "m2", kind: "event" }),
    );
  });
});

describe("onMessageCreated", () => {
  it("notifies direct conversation recipients except the sender", async () => {
    await onMessageCreated.run(
      messageEvent({ senderId: "member1", text: "Salut" }),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "member2",
        clubId: "c1",
        kind: "message",
        payload: expect.objectContaining({ conversationId: "conversation-1" }),
      }),
    );
  });

  it("does not notify direct participants without an active membership in the conversation club", async () => {
    mockConversationGet.mockResolvedValue({
      data: () => ({
        clubId: "c1",
        kind: "direct",
        participantIds: ["member1", "external-member"],
      }),
    });
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [{ data: () => ({ memberId: "member1", clubId: "c1" }) }],
    });

    await onMessageCreated.run(
      messageEvent({ senderId: "member1", text: "Salut" }),
    );

    expect(mockNotificationAdd).not.toHaveBeenCalled();
  });

  it("does not notify malformed direct conversations with too many recipients", async () => {
    mockConversationGet.mockResolvedValue({
      data: () => ({
        clubId: "c1",
        kind: "direct",
        participantIds: ["member1", "member2", "member3"],
      }),
    });
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [
        { data: () => ({ memberId: "member1", clubId: "c1" }) },
        { data: () => ({ memberId: "member2", clubId: "c1" }) },
        { data: () => ({ memberId: "member3", clubId: "c1" }) },
      ],
    });

    await onMessageCreated.run(
      messageEvent({ senderId: "member1", text: "Salut" }),
    );

    expect(mockNotificationAdd).not.toHaveBeenCalled();
  });

  it("notifies the board when a member writes to a committee conversation", async () => {
    mockConversationGet.mockResolvedValue({
      data: () => ({
        clubId: "c1",
        kind: "bureau",
        participantIds: ["member1"],
      }),
    });
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [
        { data: () => ({ memberId: "board1" }) },
        { data: () => ({ memberId: "member1" }) },
      ],
    });

    await onMessageCreated.run(
      messageEvent({ senderId: "member1", text: "Besoin d'aide" }),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "board1",
        kind: "message",
      }),
    );
  });

  it("notifies only the thread member when the board replies to a committee conversation", async () => {
    mockConversationGet.mockResolvedValue({
      data: () => ({
        clubId: "c1",
        kind: "bureau",
        participantIds: ["member1"],
      }),
    });
    mockMembershipsQueryGet
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ memberId: "member1", clubId: "c1" }) },
          { data: () => ({ memberId: "board1", clubId: "c1" }) },
          { data: () => ({ memberId: "board2", clubId: "c1" }) },
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ memberId: "board1", clubId: "c1" }) },
          { data: () => ({ memberId: "board2", clubId: "c1" }) },
        ],
      });

    await onMessageCreated.run(
      messageEvent({ senderId: "board1", text: "Bien reçu" }),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "member1",
        kind: "message",
      }),
    );
  });

  it("does not notify malformed committee conversations with several member-side participants", async () => {
    mockConversationGet.mockResolvedValue({
      data: () => ({
        clubId: "c1",
        kind: "bureau",
        participantIds: ["member1", "member2"],
      }),
    });

    await onMessageCreated.run(
      messageEvent({ senderId: "member1", text: "Besoin d'aide" }),
    );

    expect(mockNotificationAdd).not.toHaveBeenCalled();
  });
});

describe("onTournamentEntryCreated", () => {
  it("notifies opted-in active members with the recorded result", async () => {
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [
        { data: () => ({ memberId: "m1" }) },
        { data: () => ({ memberId: "m2" }) },
      ],
    });
    mockMemberGet.mockImplementation((memberId?: string) => ({
      data: () => ({ notifyTournaments: memberId === "m1" }),
    }));

    await onTournamentEntryCreated.run(
      tournamentEntryEvent({
        clubId: "c1",
        tournamentId: "tournament-1",
        playerA: "Alice",
        playerB: "Bob",
        scoreA: 3,
        scoreB: 2,
      }),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "m1",
        clubId: "c1",
        kind: "tournament",
        body: "Alice 3 - 2 Bob",
        payload: {
          tournamentId: "tournament-1",
          label: "Open de rentrée",
        },
      }),
    );
  });

  it("does not notify when the entry has no data", async () => {
    await onTournamentEntryCreated.run(tournamentEntryEvent(undefined));

    expect(mockMembershipsQueryGet).not.toHaveBeenCalled();
    expect(mockNotificationAdd).not.toHaveBeenCalled();
  });

  it("does not notify the member who recorded the result", async () => {
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [
        { data: () => ({ memberId: "m1" }) },
        { data: () => ({ memberId: "m2" }) },
      ],
    });
    mockMemberGet.mockResolvedValue({ data: () => ({ notifyTournaments: true }) });

    await onTournamentEntryCreated.run(
      tournamentEntryEvent({
        clubId: "c1",
        tournamentId: "tournament-1",
        playerA: "Alice",
        playerB: "Bob",
        scoreA: 3,
        scoreB: 2,
        recordedByMemberId: "m1",
      }),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: "m2", kind: "tournament" }),
    );
  });
});

describe("onPlatformAnnouncementCreated", () => {
  it("notifies every active membership across clubs for all audience", async () => {
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [
        { data: () => ({ memberId: "m1", clubId: "c1" }) },
        { data: () => ({ memberId: "m2", clubId: "c2" }) },
      ],
    });

    await onPlatformAnnouncementCreated.run(
      platformAnnouncementEvent({
        title: "Mise à jour",
        body: "Contenu",
        audience: "all",
        publishedAt: "2026-09-03T00:00:00Z",
      }),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(2);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "m1",
        clubId: "c1",
        kind: "platform_announcement",
        payload: expect.objectContaining({ announcementId: "platform-ann-1" }),
      }),
    );
  });

  it("uses the admin and board membership filter for admins audience", async () => {
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [{ data: () => ({ memberId: "admin1", clubId: "c1" }) }],
    });

    await onPlatformAnnouncementCreated.run(
      platformAnnouncementEvent({
        title: "Admins",
        body: "Contenu",
        audience: "admins",
        publishedAt: "2026-09-03T00:00:00Z",
      }),
    );

    expect(lastMembershipsQuery.where).toHaveBeenNthCalledWith(
      1,
      "status",
      "==",
      "active",
    );
    expect(lastMembershipsQuery.where).toHaveBeenNthCalledWith(
      2,
      "role",
      "in",
      ["admin", "board"],
    );
    expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "admin1",
        kind: "platform_announcement",
      }),
    );
  });

  it("does not notify when the platform announcement is unpublished", async () => {
    await onPlatformAnnouncementCreated.run(
      platformAnnouncementEvent({
        title: "Brouillon",
        body: "Contenu",
        audience: "all",
      }),
    );

    expect(mockMembershipsQueryGet).not.toHaveBeenCalled();
    expect(mockNotificationAdd).not.toHaveBeenCalled();
  });

  it("does not notify the platform admin who published the announcement", async () => {
    mockMembershipsQueryGet.mockResolvedValue({
      docs: [
        { data: () => ({ memberId: "m1", clubId: "c1", authUid: "admin-uid" }) },
        { data: () => ({ memberId: "m2", clubId: "c2", authUid: "other-uid" }) },
      ],
    });

    await onPlatformAnnouncementCreated.run(
      platformAnnouncementEvent({
        title: "Mise à jour",
        body: "Contenu",
        audience: "all",
        publishedAt: "2026-09-03T00:00:00Z",
        publishedBy: "admin-uid",
      }),
    );

    expect(mockNotificationAdd).toHaveBeenCalledTimes(1);
    expect(mockNotificationAdd).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: "m2", kind: "platform_announcement" }),
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
      responses: [{ success: true }, { success: true }],
    });

    await onNotificationCreated.run(
      notificationEvent({ memberId: "m1", title: "Titre", body: "Corps" }),
    );

    expect(mockSendEachForMulticast).toHaveBeenCalledWith({
      tokens: ["token1", "token2"],
      notification: { title: "Titre", body: "Corps" },
      data: {
        notificationId: "notif-1",
        memberId: "m1",
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    });
  });

  it("removes invalid FCM tokens", async () => {
    mockTokensQueryGet.mockResolvedValue({
      empty: false,
      docs: [
        { id: "token1", ref: { delete: mockTokenDelete } },
        { id: "token2", ref: { delete: mockTokenDelete } },
      ],
    });
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: "messaging/registration-token-not-registered" },
        },
      ],
    });

    await onNotificationCreated.run(
      notificationEvent({
        memberId: "m1",
        clubId: "c1",
        kind: "message",
        title: "Titre",
        body: "Corps",
        payload: { conversationId: "conversation-1" },
      }),
    );

    expect(mockTokenDelete).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the notification document has no data", async () => {
    await onNotificationCreated.run(notificationEvent(undefined));
    expect(mockTokensQueryGet).not.toHaveBeenCalled();
  });
});
