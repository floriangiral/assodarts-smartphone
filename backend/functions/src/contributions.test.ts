import functionsTest from "firebase-functions-test";
import type { CallableRequest } from "firebase-functions/v2/https";

const testEnv = functionsTest();

const mockRequireClubBoard = jest.fn();

jest.mock("./shared/auth", () => ({
  requireClubBoard: mockRequireClubBoard,
}));

type DocData = Record<string, unknown> | undefined;

let store: Record<string, DocData>;
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockTransactionSet = jest.fn();
const mockTransactionCreate = jest.fn();

function docRef(path: string) {
  return {
    path,
    get: async () => ({
      exists: store[path] !== undefined,
      data: () => store[path],
    }),
    set: async (
      data: Record<string, unknown>,
      options?: { merge?: boolean },
    ) => {
      mockSet(path, data, options);
      store[path] = options?.merge ? { ...(store[path] ?? {}), ...data } : data;
    },
    update: async (data: Record<string, unknown>) => {
      mockUpdate(path, data);
      store[path] = { ...(store[path] ?? {}), ...data };
    },
    collection: (name: string) => ({
      doc: (id: string) => docRef(`${path}/${name}/${id}`),
    }),
  };
}

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => docRef(`${name}/${id}`),
    }),
    runTransaction: async (
      updateFn: (transaction: {
        set: (
          ref: ReturnType<typeof docRef>,
          data: Record<string, unknown>,
          options?: { merge?: boolean },
        ) => void;
        create: (
          ref: ReturnType<typeof docRef>,
          data: Record<string, unknown>,
        ) => void;
      }) => Promise<void>,
    ) =>
      updateFn({
        set: (ref, data, options) => {
          mockTransactionSet(ref.path, data, options);
          store[ref.path] = options?.merge
            ? { ...(store[ref.path] ?? {}), ...data }
            : data;
        },
        create: (ref, data) => {
          mockTransactionCreate(ref.path, data);
          store[ref.path] = data;
        },
      }),
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
  Timestamp: { now: () => "NOW" },
}));

import {
  chooseContribution,
  publishContributionSeason,
  saveContributionSeason,
  updateContributionLicenseNumber,
} from "./contributions";

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

beforeEach(() => {
  jest.clearAllMocks();
  store = {};
  mockRequireClubBoard.mockResolvedValue(undefined);
});

describe("saveContributionSeason", () => {
  const wrapped = testEnv.wrap(saveContributionSeason);
  const payload = {
    clubId: "club-1",
    seasonId: "season-1",
    label: "2026 dues",
    memberAmountCents: 5000,
    playerAmountCents: 8000,
  };

  it("rejects unauthenticated calls", async () => {
    await expect(wrapped(makeRequest(payload))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects missing required fields", async () => {
    await expect(
      wrapped(makeRequest({ clubId: "club-1" }, "board-uid")),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects non-positive amounts", async () => {
    await expect(
      wrapped(makeRequest({ ...payload, memberAmountCents: 0 }, "board-uid")),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects editing a published season", async () => {
    store["clubs/club-1/contribution_seasons/season-1"] = {
      status: "published",
    };
    await expect(
      wrapped(makeRequest(payload, "board-uid")),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("saves the draft season", async () => {
    const result = await wrapped(makeRequest(payload, "board-uid"));

    expect(mockRequireClubBoard).toHaveBeenCalledWith("club-1", "board-uid");
    expect(mockSet).toHaveBeenCalledWith(
      "clubs/club-1/contribution_seasons/season-1",
      expect.objectContaining({
        seasonId: "season-1",
        label: "2026 dues",
        memberAmountCents: 5000,
        playerAmountCents: 8000,
        status: "draft",
        updatedByMemberId: "board-uid",
      }),
      { merge: true },
    );
    expect(result).toEqual({ seasonId: "season-1", status: "draft" });
  });
});

describe("publishContributionSeason", () => {
  const wrapped = testEnv.wrap(publishContributionSeason);
  const payload = { clubId: "club-1", seasonId: "season-1" };

  it("rejects unauthenticated calls", async () => {
    await expect(wrapped(makeRequest(payload))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects missing identifiers", async () => {
    await expect(wrapped(makeRequest({}, "board-uid"))).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects publishing a season that is not a draft", async () => {
    store["clubs/club-1/contribution_seasons/season-1"] = {
      status: "published",
    };
    await expect(
      wrapped(makeRequest(payload, "board-uid")),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("publishes the season and mirrors it to the current pointer", async () => {
    store["clubs/club-1/contribution_seasons/season-1"] = {
      status: "draft",
      label: "2026 dues",
      memberAmountCents: 5000,
      playerAmountCents: 8000,
    };

    const result = await wrapped(makeRequest(payload, "board-uid"));

    expect(mockRequireClubBoard).toHaveBeenCalledWith("club-1", "board-uid");
    expect(mockTransactionSet).toHaveBeenCalledWith(
      "clubs/club-1/contribution_seasons/season-1",
      expect.objectContaining({
        status: "published",
        publishedByMemberId: "board-uid",
      }),
      { merge: true },
    );
    expect(mockTransactionSet).toHaveBeenCalledWith(
      "clubs/club-1/contribution_seasons/current",
      expect.objectContaining({
        seasonId: "season-1",
        label: "2026 dues",
        memberAmountCents: 5000,
        playerAmountCents: 8000,
        status: "published",
      }),
      undefined,
    );
    expect(result).toEqual({ seasonId: "season-1", status: "published" });
  });
});

describe("chooseContribution", () => {
  const wrapped = testEnv.wrap(chooseContribution);
  const payload = {
    clubId: "club-1",
    seasonId: "season-1",
    option: "member_fee",
  };

  it("rejects unauthenticated calls", async () => {
    await expect(wrapped(makeRequest(payload))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects an invalid option", async () => {
    await expect(
      wrapped(makeRequest({ ...payload, option: "bogus" }, "member-uid")),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects members without an active membership", async () => {
    store["memberships/club-1_member-uid"] = { status: "pending" };

    await expect(
      wrapped(makeRequest(payload, "member-uid")),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects when the season is not published", async () => {
    store["memberships/club-1_member-uid"] = {
      status: "active",
      memberId: "member-1",
    };
    store["clubs/club-1/contribution_seasons/season-1"] = { status: "draft" };

    await expect(
      wrapped(makeRequest(payload, "member-uid")),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("rejects a member who already chose", async () => {
    store["memberships/club-1_member-uid"] = {
      status: "active",
      memberId: "member-1",
    };
    store["clubs/club-1/contribution_seasons/season-1"] = {
      status: "published",
      memberAmountCents: 5000,
      playerAmountCents: 8000,
      label: "2026 dues",
    };
    store["clubs/club-1/contribution_seasons/season-1/choices/member-1"] = {
      option: "member_fee",
    };

    await expect(
      wrapped(makeRequest(payload, "member-uid")),
    ).rejects.toMatchObject({ code: "already-exists" });
  });

  it("creates the choice, payment call and item for the member fee", async () => {
    store["memberships/club-1_member-uid"] = {
      status: "active",
      memberId: "member-1",
    };
    store["clubs/club-1/contribution_seasons/season-1"] = {
      status: "published",
      memberAmountCents: 5000,
      playerAmountCents: 8000,
      label: "2026 dues",
    };

    const result = (await wrapped(makeRequest(payload, "member-uid"))) as {
      callId: string;
      itemId: string;
      option: string;
      amountCents: number;
    };

    expect(result.option).toBe("member_fee");
    expect(result.amountCents).toBe(5000);
    expect(mockTransactionCreate).toHaveBeenCalledWith(
      "clubs/club-1/contribution_seasons/season-1/choices/member-1",
      expect.objectContaining({
        memberId: "member-1",
        option: "member_fee",
        amountCents: 5000,
        status: "pending",
        paymentCallId: result.callId,
      }),
    );
    expect(mockTransactionCreate).toHaveBeenCalledWith(
      `payment_calls/${result.callId}`,
      expect.objectContaining({
        clubId: "club-1",
        detail: "member_fee",
        category: "cotisation",
        amountCents: 5000,
        contributionSeasonId: "season-1",
      }),
    );
    expect(mockTransactionCreate).toHaveBeenCalledWith(
      `payment_call_items/${result.itemId}`,
      expect.objectContaining({
        paymentCallId: result.callId,
        clubId: "club-1",
        memberId: "member-1",
        isPaid: false,
      }),
    );
  });

  it("uses the player license amount when selected", async () => {
    store["memberships/club-1_member-uid"] = {
      status: "active",
      memberId: "member-1",
    };
    store["clubs/club-1/contribution_seasons/season-1"] = {
      status: "published",
      memberAmountCents: 5000,
      playerAmountCents: 8000,
      label: "2026 dues",
    };

    const result = (await wrapped(
      makeRequest({ ...payload, option: "player_license" }, "member-uid"),
    )) as { amountCents: number; option: string };

    expect(result.amountCents).toBe(8000);
    expect(result.option).toBe("player_license");
  });
});

describe("updateContributionLicenseNumber", () => {
  const wrapped = testEnv.wrap(updateContributionLicenseNumber);
  const payload = {
    clubId: "club-1",
    seasonId: "season-1",
    memberId: "member-1",
    licenseNumber: "LIC-42",
  };

  it("rejects unauthenticated calls", async () => {
    await expect(wrapped(makeRequest(payload))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects missing identifiers", async () => {
    await expect(
      wrapped(makeRequest({ clubId: "club-1" }, "board-uid")),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects a choice that is not a paid player contribution", async () => {
    store["clubs/club-1/contribution_seasons/season-1/choices/member-1"] = {
      option: "member_fee",
      status: "paid",
    };

    await expect(
      wrapped(makeRequest(payload, "board-uid")),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("updates the licence number", async () => {
    store["clubs/club-1/contribution_seasons/season-1/choices/member-1"] = {
      option: "player_license",
      status: "paid",
    };

    const result = await wrapped(makeRequest(payload, "board-uid"));

    expect(mockRequireClubBoard).toHaveBeenCalledWith("club-1", "board-uid");
    expect(mockUpdate).toHaveBeenCalledWith(
      "clubs/club-1/contribution_seasons/season-1/choices/member-1",
      { licenseNumber: "LIC-42", updatedAt: "SERVER_TIMESTAMP" },
    );
    expect(result).toEqual({ memberId: "member-1", licenseNumber: "LIC-42" });
  });

  it("clears the licence number when an empty string is provided", async () => {
    store["clubs/club-1/contribution_seasons/season-1/choices/member-1"] = {
      option: "player_license",
      status: "paid",
    };

    const result = await wrapped(
      makeRequest({ ...payload, licenseNumber: "  " }, "board-uid"),
    );

    expect(result).toEqual({ memberId: "member-1", licenseNumber: null });
  });
});
