import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import Stripe from "stripe";
import {
  stripeClient,
  stripeSecretKey,
  stripeWebhookSecret,
} from "./shared/stripe";

/**
 * Finds the club a subscription event belongs to. The id is carried in
 * `subscription_data.metadata` at checkout, but Stripe does not repeat it on
 * every invoice, so fall back to a lookup by subscription id.
 */
async function clubRefForSubscription(
  db: FirebaseFirestore.Firestore,
  subscriptionId: string | null,
  clubIdFromMetadata: string | undefined,
) {
  if (clubIdFromMetadata) return db.collection("clubs").doc(clubIdFromMetadata);
  if (!subscriptionId) return null;

  const clubs = await db
    .collection("clubs")
    .where("stripeSubscriptionId", "==", subscriptionId)
    .limit(1)
    .get();
  return clubs.empty ? null : clubs.docs[0].ref;
}

function subscriptionIdOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id: unknown }).id);
  }
  return null;
}

/**
 * Stripe webhook — the only place a payment is actually marked as settled.
 *
 * Deliberately public (no Firebase Auth session): authenticity comes from the
 * Stripe signature check below, which is why the secret must be configured.
 *
 * Serves both money flows, told apart by metadata rather than by event type:
 * a member's fee carries `item_id`, a club's own subscription carries
 * `club_id` with `mode: "subscription"`.
 */
export const stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret], cors: false },
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing signature" });
      return;
    }

    const stripe = stripeClient(stripeSecretKey.value());

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        stripeWebhookSecret.value(),
      );
    } catch (err) {
      console.error("Invalid Stripe signature", err);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const db = getFirestore();

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;

          // Club subscription: no `item_id`, the club is named directly.
          if (session.mode === "subscription") {
            const clubId = session.metadata?.club_id;
            if (!clubId) break;

            await db
              .collection("clubs")
              .doc(clubId)
              .set(
                {
                  stripeCustomerId:
                    typeof session.customer === "string"
                      ? session.customer
                      : (session.customer?.id ?? null),
                  stripeSubscriptionId: subscriptionIdOf(session.subscription),
                  subscriptionStatus: "active",
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
              );

            console.log(`Club ${clubId} subscription activated`);
            break;
          }

          const itemId = session.metadata?.item_id;
          if (!itemId || session.payment_status !== "paid") break;

          await db
            .collection("payment_call_items")
            .doc(itemId)
            .set(
              {
                isPaid: true,
                paidAt: FieldValue.serverTimestamp(),
                declaredAt: null,
                method: "card",
                stripePaymentIntentId:
                  typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : (session.payment_intent?.id ?? null),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            );

          console.log(`Payment line ${itemId} settled by Stripe Checkout`);
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          const itemId = charge.metadata?.item_id;
          if (!itemId) break;

          await db.collection("payment_call_items").doc(itemId).set(
            {
              isPaid: false,
              paidAt: null,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice & {
            subscription?: string | { id: string } | null;
            lines?: { data?: Array<{ period?: { end?: number } }> };
          };
          const subscriptionId = subscriptionIdOf(invoice.subscription);
          const clubRef = await clubRefForSubscription(
            db,
            subscriptionId,
            invoice.metadata?.club_id,
          );
          if (!clubRef) break;

          const periodEnd = invoice.lines?.data?.[0]?.period?.end;
          await clubRef.set(
            {
              subscriptionStatus: "active",
              stripeSubscriptionId: subscriptionId,
              currentPeriodEnd: periodEnd
                ? Timestamp.fromMillis(periodEnd * 1000)
                : null,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice & {
            subscription?: string | { id: string } | null;
          };
          const clubRef = await clubRefForSubscription(
            db,
            subscriptionIdOf(invoice.subscription),
            invoice.metadata?.club_id,
          );
          if (!clubRef) break;

          // Grace, not expiry: Stripe keeps retrying the card for about a week
          // and `checkTrialExpirations` closes the window afterwards.
          await clubRef.set(
            {
              subscriptionStatus: "grace",
              graceStartedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const clubRef = await clubRefForSubscription(
            db,
            subscription.id,
            subscription.metadata?.club_id,
          );
          if (!clubRef) break;

          await clubRef.set(
            {
              subscriptionStatus: "expired",
              stripeSubscriptionId: null,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          break;
        }

        case "account.updated": {
          const account = event.data.object as Stripe.Account;
          const status =
            account.charges_enabled && account.details_submitted
              ? "verified"
              : "pending";

          const bankAccounts = await db
            .collection("club_bank_accounts")
            .where("stripeAccountId", "==", account.id)
            .get();

          await Promise.all(
            bankAccounts.docs.map((doc) =>
              doc.ref.set(
                {
                  stripeStatus: status,
                  stripeChargesEnabled: account.charges_enabled ?? false,
                  stripeDetailsSubmitted: account.details_submitted ?? false,
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
              ),
            ),
          );
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error("Webhook handling failed", err);
      res.status(500).json({ error: "Handler failed" });
      return;
    }

    res.json({ received: true });
  },
);
