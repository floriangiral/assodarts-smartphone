import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireClubBoard } from "./shared/auth";
import {
  functionsBaseUrl,
  stripeClient,
  stripeSecretKey,
} from "./shared/stripe";
import {
  LIVE_STRIPE_STATUSES,
  activeCouponForClub,
  ensureStripeCoupon,
  tierForClub,
  tierPriceCents,
} from "./shared/subscription";

/**
 * Stripe Checkout for the club's own yearly Assodarts subscription.
 *
 * Deliberately *not* a Connect charge: this money goes to Assodarts, so there
 * is no `transfer_data` here — unlike `stripeCreateCheckout.ts`, which routes a
 * member's membership fee to the club's connected account.
 *
 * The price is always derived server-side from the club's active member count;
 * nothing about the amount is accepted from the app.
 */
export const stripeCreateClubSubscriptionCheckout = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign-in required");

    const clubId = String(request.data?.clubId ?? "").trim();
    if (!clubId) throw new HttpsError("invalid-argument", "clubId is required");

    await requireClubBoard(clubId, request.auth.uid);

    const db = getFirestore();
    const clubRef = db.collection("clubs").doc(clubId);
    const club = (await clubRef.get()).data();
    if (!club) throw new HttpsError("not-found", "Club not found");

    const stripe = stripeClient(stripeSecretKey.value());

    // Never let a club end up paying twice: an existing live subscription is
    // managed through the billing portal, not by starting a second checkout.
    if (club.stripeSubscriptionId) {
      try {
        const existing = await stripe.subscriptions.retrieve(
          club.stripeSubscriptionId,
        );
        if (LIVE_STRIPE_STATUSES.includes(existing.status)) {
          throw new HttpsError(
            "failed-precondition",
            "This club already has an active subscription",
          );
        }
      } catch (err) {
        if (err instanceof HttpsError) throw err;
        // Unknown/deleted subscription: fall through and let the club re-subscribe.
      }
    }

    const tier = await tierForClub(clubId);
    if (tier.priceEuros <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "This club size is billed on quote; contact Assodarts",
      );
    }

    let customerId = club.stripeCustomerId as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: request.auth.token.email,
        name: club.name,
        metadata: { club_id: clubId },
      });
      customerId = customer.id;
      await clubRef.set(
        {
          stripeCustomerId: customerId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const coupon = await activeCouponForClub(clubId, club.couponCode);
    const discounts = coupon
      ? [{ coupon: await ensureStripeCoupon(stripe, coupon) }]
      : undefined;

    const base = functionsBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: tierPriceCents(tier),
            recurring: { interval: "year" },
            product_data: {
              name: `Assodarts — abonnement ${tier.id}`,
            },
          },
        },
      ],
      discounts,
      subscription_data: { metadata: { club_id: clubId, tier_id: tier.id } },
      metadata: { club_id: clubId, tier_id: tier.id },
      success_url: `${base}/stripeReturn?state=subscribed`,
      cancel_url: `${base}/stripeReturn?state=subscription_cancelled`,
    });

    await clubRef.set(
      {
        stripeCheckoutSessionId: session.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { url: session.url, sessionId: session.id };
  },
);
