import {
  corsHeaders,
  createAdminClient,
  errorResponse,
  json,
  requireAuth,
  requireClubBoard,
} from "../_shared/auth.ts";
import { accountStatus, stripe } from "../_shared/stripe.ts";

/**
 * Re-reads the club's Stripe account and mirrors its state into the database.
 * Called when the bureau comes back from the hosted onboarding flow.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId } = await requireAuth(req);
    const { clubId } = await req.json();
    if (!clubId) return json({ error: "clubId is required" }, 400);

    const admin = createAdminClient();
    await requireClubBoard(admin, clubId, userId);

    const { data: row } = await admin
      .from("club_bank_accounts")
      .select("stripe_account_id")
      .eq("club_id", clubId)
      .maybeSingle();

    if (!row?.stripe_account_id) {
      return json({ status: "not_connected", chargesEnabled: false, detailsSubmitted: false });
    }

    const account = await stripe.accounts.retrieve(row.stripe_account_id);
    const status = accountStatus(account);

    await admin
      .from("club_bank_accounts")
      .update({
        stripe_status: status,
        stripe_charges_enabled: account.charges_enabled ?? false,
        stripe_details_submitted: account.details_submitted ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq("club_id", clubId);

    return json({
      status,
      chargesEnabled: account.charges_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
    });
  } catch (err) {
    return errorResponse(err);
  }
});
