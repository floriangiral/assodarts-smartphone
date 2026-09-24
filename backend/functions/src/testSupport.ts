import type { CallableRequest } from "firebase-functions/v2/https";

type CallableData = Record<string, unknown>;
type CallableHandler = (
  request: CallableRequest<CallableData>,
) => Promise<unknown>;
type AuthOptions =
  | string
  | {
      uid?: string;
      token?: Record<string, unknown>;
    };

export function makeCallableRequest(
  data: CallableData,
  auth?: AuthOptions,
): CallableRequest<CallableData> {
  const uid = typeof auth === "string" ? auth : auth?.uid;
  const token = typeof auth === "string" ? {} : (auth?.token ?? {});
  return {
    data,
    auth: uid ? { uid, token } : undefined,
  } as unknown as CallableRequest<CallableData>;
}

export const makeCommitteeCallableRequest = (
  data: CallableData,
  uid?: string,
): CallableRequest<CallableData> =>
  makeCallableRequest(data, { uid, token: { email: "board@example.com" } });

export function describeClubAdminCallableGuards({
  handler,
  makeRequest = makeCommitteeCallableRequest,
  requireClubAdminMock,
  downstreamMock,
}: {
  handler: CallableHandler;
  makeRequest?: typeof makeCommitteeCallableRequest;
  requireClubAdminMock: jest.Mock;
  downstreamMock: jest.Mock;
}) {
  it("rejects unauthenticated calls", async () => {
    await expect(handler(makeRequest({ clubId: "c1" }))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects calls without clubId", async () => {
    await expect(handler(makeRequest({}, "u1"))).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects a caller who is not on the committee", async () => {
    requireClubAdminMock.mockRejectedValue(new Error("permission denied"));

    await expect(handler(makeRequest({ clubId: "c1" }, "u1"))).rejects.toThrow(
      "permission denied",
    );
    expect(requireClubAdminMock).toHaveBeenCalledWith("c1", "u1");
    expect(downstreamMock).not.toHaveBeenCalled();
  });
}

export function firestoreDoc<T extends Record<string, unknown>>(
  data: T,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return { data: () => data, ...extras };
}

export function firestoreSnapshot(docs: Record<string, unknown>[]): {
  docs: Record<string, unknown>[];
} {
  return { docs };
}

export class MockTimestamp {
  millis: number;

  constructor(millis: number) {
    this.millis = millis;
  }

  static fromMillis(millis: number) {
    return new this(millis);
  }

  toMillis() {
    return this.millis;
  }
}
