import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  functionsBaseUrl,
  stripeConnectedAccountInclude,
  stripeClient,
  stripeSecretKey,
  v2AccountReadiness,
} from "./shared/stripe";
import { requireClubBoard } from "./shared/auth";

/**
 * Starts (or resumes) Stripe Connect onboarding for a club.
 *
 * Returns a one-time hosted onboarding URL the app opens in a browser. The
 * club keeps its own Stripe account, so members' money lands directly on it.
 */
export const stripeConnectOnboard = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Sign-in required");

    const clubId = request.data?.clubId as string | undefined;
    if (!clubId) throw new HttpsError("invalid-argument", "clubId is required");

    await requireClubBoard(clubId, request.auth.uid);

    const db = getFirestore();
    const club = (await db.collection("clubs").doc(clubId).get()).data();
    const bankRef = db.collection("club_bank_accounts").doc(clubId);
    let accountId = (await bankRef.get()).data()?.stripeAccountId as
      string | undefined;

    const stripe = stripeClient(stripeSecretKey.value());

    if (!accountId) {
      const userEmail =
        typeof request.auth.token.email === "string"
          ? request.auth.token.email
          : "support@assodarts.fr";
      const account = await stripe.v2.core.accounts.create({
        contact_email: userEmail,
        dashboard: "express",
        display_name: club?.name ?? "Club",
        defaults: {
          responsibilities: {
            fees_collector: "application",
            losses_collector: "application",
          },
        },
        identity: {
          country: (club?.country ?? "FR").toUpperCase().slice(0, 2),
          entity_type: "non_profit",
          business_details: {
            registered_name: club?.name ?? "Club",
          },
        },
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: { requested: true },
              },
            },
          },
        },
        metadata: { club_id: clubId },
        include: stripeConnectedAccountInclude,
      });
      accountId = account.id;

      await bankRef.set(
        {
          clubId,
          stripeAccountId: accountId,
          stripeStatus: "pending",
          updatedByMemberId: request.auth.uid,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const base = functionsBaseUrl();
    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: `${base}/stripeReturn?state=refresh`,
          return_url: `${base}/stripeReturn?state=done`,
        },
      },
    });

    const account = await stripe.v2.core.accounts.retrieve(accountId, {
      include: stripeConnectedAccountInclude,
    });
    const readiness = v2AccountReadiness(account);

    return {
      url: link.url,
      accountId,
      status: readiness.status,
    };
  },
);
