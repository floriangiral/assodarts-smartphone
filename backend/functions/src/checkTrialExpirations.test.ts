const mockClubsWhere = jest.fn();
const mockSet = jest.fn();

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === "clubs") return { where: mockClubsWhere };
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
  Timestamp: { fromMillis: (ms: number) => ({ __ms: ms }) },
}));

import { checkTrialExpirations } from "./checkTrialExpirations";
import { GRACE_PERIOD_DAYS } from "./shared/subscription";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A club document with a spy on its own `set`. */
function clubDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data, ref: { set: mockSet } };
}

/**
 * The function issues two chained `where()` queries; this returns the trial
 * snapshot for the first call and the grace snapshot for the second, and
 * records the arguments of the second `where()` so the cutoff can be asserted.
 */
const secondWhereArgs: unknown[][] = [];

function stubQueries(trialDocs: unknown[], graceDocs: unknown[]) {
  secondWhereArgs.length = 0;
  let call = 0;
  mockClubsWhere.mockImplementation(() => {
    const isTrial = call++ === 0;
    return {
      where: (...args: unknown[]) => {
        secondWhereArgs.push(args);
        return {
          get: async () =>
            isTrial
              ? { docs: trialDocs, size: trialDocs.length }
              : { docs: graceDocs, size: graceDocs.length },
        };
      },
    };
  });
}

const handler = checkTrialExpirations.run.bind(checkTrialExpirations);

beforeEach(() => {
  jest.clearAllMocks();
  mockSet.mockResolvedValue(undefined);
});

describe("checkTrialExpirations", () => {
  it("expires a trial that ran out without a subscription", async () => {
    stubQueries([clubDoc("c1", { subscriptionStatus: "trial" })], []);

    await handler({} as never);

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionStatus: "expired" }),
      { merge: true },
    );
  });

  it("leaves a trial club alone while it is activating a subscription", async () => {
    stubQueries(
      [
        clubDoc("c1", {
          subscriptionStatus: "trial",
          stripeSubscriptionId: "sub_live",
        }),
      ],
      [],
    );

    await handler({} as never);

    expect(mockSet).not.toHaveBeenCalled();
  });

  it("expires a club left in grace beyond the window", async () => {
    stubQueries([], [clubDoc("c2", { subscriptionStatus: "grace" })]);

    await handler({} as never);

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionStatus: "expired" }),
      { merge: true },
    );
  });

  it("does nothing when no club is out of time", async () => {
    stubQueries([], []);

    await handler({} as never);

    expect(mockSet).not.toHaveBeenCalled();
  });

  it("queries the grace window exactly GRACE_PERIOD_DAYS back", async () => {
    stubQueries([], []);
    const before = Date.now();

    await handler({} as never);

    const after = Date.now();
    const [field, op, cutoff] = secondWhereArgs[1] as [
      string,
      string,
      { __ms: number },
    ];

    expect(field).toBe("graceStartedAt");
    expect(op).toBe("<=");
    // The cutoff is "now minus the grace window", computed during the call.
    expect(cutoff.__ms).toBeGreaterThanOrEqual(
      before - GRACE_PERIOD_DAYS * DAY_MS,
    );
    expect(cutoff.__ms).toBeLessThanOrEqual(after - GRACE_PERIOD_DAYS * DAY_MS);
  });

  it("only ever expires trials whose end date has passed", async () => {
    stubQueries([], []);
    const before = Date.now();

    await handler({} as never);

    const [field, op, cutoff] = secondWhereArgs[0] as [
      string,
      string,
      { __ms: number },
    ];
    expect(field).toBe("trialEndsAt");
    expect(op).toBe("<=");
    expect(cutoff.__ms).toBeGreaterThanOrEqual(before);
  });
});
