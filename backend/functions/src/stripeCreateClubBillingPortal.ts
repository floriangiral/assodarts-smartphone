import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { requireClubBoard } from "./shared/auth";
import {
  functionsBaseUrl,
  stripeClient,
  stripeSecretKey,
} from "./shared/stripe";

/**
 * Opens Stripe's hosted billing portal so the committee can change its card,
 * download invoices or cancel — without any manual support step on our side.
 */
export const stripeCreateClubBillingPortal = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign-in required");

    const clubId = String(request.data?.clubId ?? "").trim();
    if (!clubId) throw new HttpsError("invalid-argument", "clubId is required");

    await requireClubBoard(clubId, request.auth.uid);

    const club = (
      await getFirestore().collection("clubs").doc(clubId).get()
    ).data();
    if (!club) throw new HttpsError("not-found", "Club not found");
    if (!club.stripeCustomerId) {
      throw new HttpsError(
        "failed-precondition",
        "This club has no billing account yet",
      );
    }

    const stripe = stripeClient(stripeSecretKey.value());
    const session = await stripe.billingPortal.sessions.create({
      customer: club.stripeCustomerId,
      return_url: `${functionsBaseUrl()}/stripeReturn?state=billing_portal`,
    });

    return { url: session.url };
  },
);
