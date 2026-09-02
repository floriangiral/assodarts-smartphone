import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { functionsBaseUrl, stripeClient, stripeSecretKey } from "./shared/stripe";

/**
 * Creates a Stripe Checkout session for one payment line.
 *
 * The amount is always re-read from Firestore — never trusted from the app —
 * and the charge is routed to the club's own connected account.
 */
export const stripeCreateCheckout = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required");

  const itemId = request.data?.itemId as string | undefined;
  if (!itemId) throw new HttpsError("invalid-argument", "itemId is required");

  const db = getFirestore();
  const itemRef = db.collection("payment_call_items").doc(itemId);
  const item = (await itemRef.get()).data();

  if (!item) throw new HttpsError("not-found", "Payment line not found");
  if (item.memberId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "This payment is not yours");
  }
  if (item.isPaid) throw new HttpsError("failed-precondition", "This payment is already settled");

  const call = (await db.collection("payment_calls").doc(item.paymentCallId).get()).data();
  const bank = (await db.collection("club_bank_accounts").doc(item.clubId).get()).data();

  if (!bank?.stripeAccountId || bank.stripeStatus !== "verified") {
    throw new HttpsError("failed-precondition", "This club cannot collect online payments yet");
  }

  const stripe = stripeClient(stripeSecretKey.value());
  const base = functionsBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: request.auth.token.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: (call?.currency ?? "eur").toLowerCase(),
          unit_amount: call?.amountCents ?? 0,
          product_data: {
            name: call?.title ?? "Paiement du club",
            description: call?.detail || undefined,
          },
        },
      },
    ],
    payment_intent_data: {
      transfer_data: { destination: bank.stripeAccountId },
      metadata: { item_id: itemId, club_id: item.clubId, member_id: item.memberId },
    },
    metadata: { item_id: itemId, club_id: item.clubId, member_id: item.memberId },
    success_url: `${base}/stripeReturn?state=paid`,
    cancel_url: `${base}/stripeReturn?state=cancelled`,
  });

  await itemRef.set(
    { stripeCheckoutSessionId: session.id, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  return { url: session.url, sessionId: session.id };
});
