const mockSend = jest.fn();
const mockUpdate = jest.fn();
const mockTimestampNow = jest.fn();
const mockTimestampFromMillis = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

jest.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({
    value: () =>
      name === "RESEND_API_KEY"
        ? "re_test_key"
        : "ne_pas_repondre@bougnatdarts.fr",
  }),
}));

jest.mock("firebase-functions/logger", () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(),
  Timestamp: {
    now: mockTimestampNow,
    fromMillis: mockTimestampFromMillis,
  },
}));

import { sendMailOnCreate } from "./sendMailOnCreate";

const startTime = { toMillis: () => 1_000 };
const endTime = { toMillis: () => 2_000 };
const expireAt = { toMillis: () => 30 * 24 * 60 * 60 * 1000 + 1_000 };

beforeEach(() => {
  jest.clearAllMocks();
  mockTimestampNow.mockReturnValueOnce(startTime).mockReturnValue(endTime);
  mockTimestampFromMillis.mockReturnValue(expireAt);
  mockUpdate.mockResolvedValue(undefined);
  mockSend.mockResolvedValue({ data: { id: "re_123" }, error: null });
});

function mailEvent(data: Record<string, unknown>) {
  return {
    params: { docId: "mail-1" },
    data: {
      data: () => data,
      ref: { update: mockUpdate },
    },
  } as never;
}

describe("sendMailOnCreate", () => {
  it("sends html and text mail and records the Resend id", async () => {
    await sendMailOnCreate.run(
      mailEvent({
        to: "alice@example.com",
        cc: ["copy@example.com"],
        bcc: "blind@example.com",
        replyTo: "support@example.com",
        message: {
          subject: "Bienvenue",
          text: "Bienvenue sur Assodarts.",
          html: "<p>Bienvenue sur Assodarts.</p>",
        },
      }),
    );

    expect(mockSend).toHaveBeenCalledWith({
      to: ["alice@example.com"],
      cc: ["copy@example.com"],
      bcc: ["blind@example.com"],
      from: "ne_pas_repondre@bougnatdarts.fr",
      replyTo: "support@example.com",
      subject: "Bienvenue",
      text: "Bienvenue sur Assodarts.",
      html: "<p>Bienvenue sur Assodarts.</p>",
    });
    expect(mockUpdate).toHaveBeenNthCalledWith(1, {
      expireAt,
      delivery: { state: "PENDING", startTime },
    });
    expect(mockUpdate).toHaveBeenNthCalledWith(2, {
      delivery: {
        state: "SUCCESS",
        startTime,
        endTime,
        id: "re_123",
      },
    });
  });

  it("accepts recipient strings and arrays", async () => {
    await sendMailOnCreate.run(
      mailEvent({
        to: ["alice@example.com", "bob@example.com"],
        cc: "copy@example.com",
        bcc: ["blind@example.com", "audit@example.com"],
        from: "verified@example.com",
        message: { subject: "Sujet", html: "<p>Contenu</p>" },
      }),
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["alice@example.com", "bob@example.com"],
        cc: ["copy@example.com"],
        bcc: ["blind@example.com", "audit@example.com"],
        from: "verified@example.com",
      }),
    );
  });

  it("records an error when Resend rejects the request", async () => {
    mockSend.mockRejectedValue(new Error("Resend unavailable"));

    await sendMailOnCreate.run(
      mailEvent({
        to: "alice@example.com",
        message: { subject: "Sujet", text: "Contenu" },
      }),
    );

    expect(mockUpdate).toHaveBeenLastCalledWith({
      delivery: {
        state: "ERROR",
        startTime,
        endTime,
        error: "Resend unavailable",
      },
    });
  });

  it("records an error when Resend returns an API error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Invalid API key" },
    });

    await sendMailOnCreate.run(
      mailEvent({
        to: "alice@example.com",
        message: { subject: "Sujet", text: "Contenu" },
      }),
    );

    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        delivery: expect.objectContaining({
          state: "ERROR",
          error: "Invalid API key",
        }),
      }),
    );
  });

  it.each([
    [
      { message: { subject: "Sujet", text: "Contenu" } },
      "Mail document must contain at least one recipient in 'to'",
    ],
    [
      { to: "alice@example.com", message: { subject: "Sujet" } },
      "Mail message must contain text or html",
    ],
  ])("rejects invalid documents", async (data, expectedError) => {
    await sendMailOnCreate.run(mailEvent(data));

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        delivery: expect.objectContaining({
          state: "ERROR",
          error: expectedError,
        }),
      }),
    );
  });
});
