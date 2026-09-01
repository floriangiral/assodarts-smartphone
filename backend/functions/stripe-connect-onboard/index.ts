import {
  corsHeaders,
  createAdminClient,
  errorResponse,
  json,
  requireAuth,
  requireClubBoard,
} from "../_shared/auth.ts";
import { accountStatus, functionsBaseUrl, stripe } from "../_shared/stripe.ts";

/**
 * Starts (or resumes) Stripe Connect onboarding for a club.
 *
 * Returns a one-time hosted onboarding URL the app opens in a browser. The club
 * keeps its own Stripe account, so members' money lands directly on it.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId } = await requireAuth(req);
    const { clubId } = await req.json();
    if (!clubId) return json({ error: "clubId is required" }, 400);

    const admin = createAdminClient();
    await requireClubBoard(admin, clubId, userId);

    const { data: club } = await admin
      .from("clubs")
      .select("name, country")
      .eq("id", clubId)
      .single();

    const { data: existing } = await admin
      .from("club_bank_accounts")
      .select("stripe_account_id")
      .eq("club_id", clubId)
      .maybeSingle();

    let accountId = existing?.stripe_account_id ?? null;

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

      await admin.from("club_bank_accounts").upsert(
        {
          club_id: clubId,
          stripe_account_id: accountId,
          stripe_status: "pending",
          updated_by_member_id: userId,
        },
        { onConflict: "club_id" },
      );
    }

    const base = functionsBaseUrl();
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/stripe-return?state=refresh`,
      return_url: `${base}/stripe-return?state=done`,
      type: "account_onboarding",
    });

    const account = await stripe.accounts.retrieve(accountId);

    return json({
      url: link.url,
      accountId,
      status: accountStatus(account),
    });
  } catch (err) {
    return errorResponse(err);
  }
});
