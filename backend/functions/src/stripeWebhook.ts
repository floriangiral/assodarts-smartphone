import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import {
  stripeClient,
  stripeSecretKey,
  stripeWebhookSecret,
} from "./shared/stripe";

/**
 * Stripe webhook — the only place a payment is actually marked as settled.
 *
 * Deliberately public (no Firebase Auth session): authenticity comes from the
 * Stripe signature check below, which is why the secret must be configured.
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
