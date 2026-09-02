import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { accountStatus, functionsBaseUrl, stripeClient, stripeSecretKey } from "./shared/stripe";
import { requireClubBoard } from "./shared/auth";

/**
 * Starts (or resumes) Stripe Connect onboarding for a club.
 *
 * Returns a one-time hosted onboarding URL the app opens in a browser. The
 * club keeps its own Stripe account, so members' money lands directly on it.
 */
export const stripeConnectOnboard = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required");

  const clubId = request.data?.clubId as string | undefined;
  if (!clubId) throw new HttpsError("invalid-argument", "clubId is required");

  await requireClubBoard(clubId, request.auth.uid);

  const db = getFirestore();
  const club = (await db.collection("clubs").doc(clubId).get()).data();
  const bankRef = db.collection("club_bank_accounts").doc(clubId);
  let accountId = (await bankRef.get()).data()?.stripeAccountId as string | undefined;

  const stripe = stripeClient(stripeSecretKey.value());

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: (club?.country ?? "FR").toUpperCase().slice(0, 2),
      business_type: "non_profit",
      business_profile: {
        name: club?.name ?? "Club",
        product_description: "Cotisations et paiements des membres du club",
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { club_id: clubId },
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
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/stripeReturn?state=refresh`,
    return_url: `${base}/stripeReturn?state=done`,
    type: "account_onboarding",
  });

  const account = await stripe.accounts.retrieve(accountId);

  return {
    url: link.url,
    accountId,
    status: accountStatus(account),
  };
});
