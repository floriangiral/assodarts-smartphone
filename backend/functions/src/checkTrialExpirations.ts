import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { GRACE_PERIOD_DAYS } from "./shared/subscription";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Closes the two windows Stripe cannot close on its own.
 *
 * - A free trial that ran out without anyone subscribing.
 * - A club left in `grace` after a failed renewal, once Stripe has had
 *   `GRACE_PERIOD_DAYS` to retry the card.
 *
 * Runs daily at 03:15 Paris time, off-peak and after Stripe's own nightly
 * retries. Idempotent: a club already `expired` no longer matches either query.
 */
export const checkTrialExpirations = onSchedule(
  { schedule: "15 3 * * *", timeZone: "Europe/Paris" },
  async () => {
    const db = getFirestore();
    const now = Date.now();

    const expiredTrials = await db
      .collection("clubs")
      .where("subscriptionStatus", "==", "trial")
      .where("trialEndsAt", "<=", Timestamp.fromMillis(now))
      .get();

    const staleGrace = await db
      .collection("clubs")
      .where("subscriptionStatus", "==", "grace")
      .where(
        "graceStartedAt",
        "<=",
        Timestamp.fromMillis(now - GRACE_PERIOD_DAYS * DAY_MS),
      )
      .get();

    // A trial club that already holds a live subscription is mid-activation:
    // the webhook flips it to `active`, expiring it here would be a race.
    const toExpire = [
      ...expiredTrials.docs.filter((doc) => !doc.data().stripeSubscriptionId),
      ...staleGrace.docs,
    ];

    await Promise.all(
      toExpire.map((doc) =>
        doc.ref.set(
          {
            subscriptionStatus: "expired",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
      ),
    );

    console.log(
      `Subscription sweep: ${toExpire.length} club(s) expired ` +
        `(${expiredTrials.size} trial(s) checked, ${staleGrace.size} in grace)`,
    );
  },
);
