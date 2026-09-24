import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  stripeConnectedAccountInclude,
  stripeClient,
  stripeSecretKey,
  v2AccountReadiness,
} from "./shared/stripe";
import { requireClubBoard } from "./shared/auth";

/**
 * Re-reads the club's Stripe account and mirrors its state into Firestore.
 * Called when the bureau comes back from the hosted onboarding flow.
 */
export const stripeConnectStatus = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign-in required");

    const clubId = request.data?.clubId as string | undefined;
    if (!clubId) throw new HttpsError("invalid-argument", "clubId is required");

    await requireClubBoard(clubId, request.auth.uid);

    const bankRef = getFirestore().collection("club_bank_accounts").doc(clubId);
    const stripeAccountId = (await bankRef.get()).data()?.stripeAccountId as
      string | undefined;

    if (!stripeAccountId) {
      return {
        status: "not_connected",
        chargesEnabled: false,
        detailsSubmitted: false,
      };
    }

    const stripe = stripeClient(stripeSecretKey.value());
    const account = await stripe.v2.core.accounts.retrieve(stripeAccountId, {
      include: stripeConnectedAccountInclude,
    });
    const readiness = v2AccountReadiness(account);

    await bankRef.set(
      {
        stripeStatus: readiness.status,
        stripeChargesEnabled: readiness.chargesEnabled,
        stripeDetailsSubmitted: readiness.detailsSubmitted,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return {
      status: readiness.status,
      chargesEnabled: readiness.chargesEnabled,
      detailsSubmitted: readiness.detailsSubmitted,
    };
  },
);
