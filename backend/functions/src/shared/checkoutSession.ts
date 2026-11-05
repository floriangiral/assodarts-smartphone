import { randomUUID } from "node:crypto";
import {
  FieldValue,
  getFirestore,
  type DocumentReference,
} from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type Stripe from "stripe";

const CHECKOUT_ATTEMPT_LEASE_MS = 5 * 60 * 1000;

type Reservation = { sessionId: string } | { idempotencyKey: string };

function attemptTimeMillis(value: unknown): number {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  return 0;
}

function assertReusableSession(session: Stripe.Checkout.Session) {
  if (session.status === "open" && session.url) return session;
  if (session.status === "complete") {
    throw new HttpsError(
      "failed-precondition",
      "This checkout session is already complete",
    );
  }
  if (session.status !== "expired") {
    throw new HttpsError("unavailable", "Checkout session status is unknown");
  }
  return null;
}

export async function createOrReuseCheckoutSession(
  ref: DocumentReference,
  stripe: Stripe,
  params: Stripe.Checkout.SessionCreateParams,
  keyPrefix: string,
): Promise<Stripe.Checkout.Session> {
  const db = getFirestore();
  let expiredSessionId: string | undefined;

  for (let retry = 0; retry < 3; retry += 1) {
    const snapshot = await ref.get();
    const currentSessionId = snapshot.data()?.stripeCheckoutSessionId;
    if (typeof currentSessionId === "string") {
      const currentSession =
        await stripe.checkout.sessions.retrieve(currentSessionId);
      const reusable = assertReusableSession(currentSession);
      if (reusable) return reusable;
      expiredSessionId = currentSessionId;
    }

    const reservation = await db.runTransaction<Reservation>(async (tx) => {
      const current = await tx.get(ref);
      const data = current.data() ?? {};
      if (data.isPaid === true) {
        throw new HttpsError(
          "failed-precondition",
          "This payment is already settled",
        );
      }
      const sessionId = data.stripeCheckoutSessionId;
      if (typeof sessionId === "string" && sessionId !== expiredSessionId) {
        return { sessionId };
      }

      const idempotencyKey = data.stripeCheckoutIdempotencyKey;
      const attemptAt = attemptTimeMillis(data.stripeCheckoutAttemptAt);
      if (
        typeof idempotencyKey === "string" &&
        attemptAt > Date.now() - CHECKOUT_ATTEMPT_LEASE_MS
      ) {
        return { idempotencyKey };
      }

      const nextKey = `${keyPrefix}-${randomUUID()}`;
      tx.set(
        ref,
        {
          stripeCheckoutSessionId: null,
          stripeCheckoutIdempotencyKey: nextKey,
          stripeCheckoutAttemptAt: Date.now(),
        },
        { merge: true },
      );
      return { idempotencyKey: nextKey };
    });

    if ("sessionId" in reservation) {
      expiredSessionId = undefined;
      continue;
    }

    const session = await stripe.checkout.sessions.create(params, {
      idempotencyKey: reservation.idempotencyKey,
    });
    const persistedSessionId = await db.runTransaction<string | null>(
      async (tx) => {
        const current = await tx.get(ref);
        const data = current.data() ?? {};
        if (data.isPaid === true) {
          throw new HttpsError(
            "failed-precondition",
            "This payment is already settled",
          );
        }
        if (data.stripeCheckoutSessionId === session.id) return session.id;
        if (data.stripeCheckoutIdempotencyKey !== reservation.idempotencyKey) {
          return typeof data.stripeCheckoutSessionId === "string"
            ? data.stripeCheckoutSessionId
            : null;
        }
        tx.set(
          ref,
          {
            stripeCheckoutSessionId: session.id,
            stripeCheckoutIdempotencyKey: null,
            stripeCheckoutAttemptAt: null,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return session.id;
      },
    );

    if (persistedSessionId === session.id) return session;
    if (!persistedSessionId) {
      throw new HttpsError("aborted", "Checkout reservation changed");
    }
    expiredSessionId = undefined;
  }

  throw new HttpsError("aborted", "Could not reserve a checkout session");
}
