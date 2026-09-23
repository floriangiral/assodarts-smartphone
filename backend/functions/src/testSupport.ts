import type { CallableRequest } from "firebase-functions/v2/https";

type CallableData = Record<string, unknown>;
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
