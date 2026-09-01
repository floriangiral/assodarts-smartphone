import {
  corsHeaders,
  createAdminClient,
  errorResponse,
  json,
  requireAuth,
} from "../_shared/auth.ts";
import { functionsBaseUrl, stripe } from "../_shared/stripe.ts";

/**
 * Creates a Stripe Checkout session for one payment line.
 *
 * The amount is always re-read from the database — never trusted from the app —
 * and the charge is routed to the club's own connected account.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId, email } = await requireAuth(req);
    const { itemId } = await req.json();
    if (!itemId) return json({ error: "itemId is required" }, 400);

    const admin = createAdminClient();

    const { data: item } = await admin
      .from("payment_call_items")
      .select("id, club_id, member_id, is_paid, payment_call_id")
      .eq("id", itemId)
      .maybeSingle();

    if (!item) return json({ error: "Payment line not found" }, 404);
    if (item.member_id !== userId) return json({ error: "This payment is not yours" }, 403);
    if (item.is_paid) return json({ error: "This payment is already settled" }, 409);

    const { data: call } = await admin
      .from("payment_calls")
      .select("title, detail, amount_cents, currency")
      .eq("id", item.payment_call_id)
      .single();

    const { data: bank } = await admin
      .from("club_bank_accounts")
      .select("stripe_account_id, stripe_status")
      .eq("club_id", item.club_id)
      .maybeSingle();

    if (!bank?.stripe_account_id || bank.stripe_status !== "verified") {
      return json({ error: "This club cannot collect online payments yet" }, 409);
    }

    const base = functionsBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (call?.currency ?? "eur").toLowerCase(),
            unit_amount: call?.amount_cents ?? 0,
            product_data: {
              name: call?.title ?? "Paiement du club",
              description: call?.detail || undefined,
            },
          },
        },
      ],
      payment_intent_data: {
        transfer_data: { destination: bank.stripe_account_id },
        metadata: { item_id: item.id, club_id: item.club_id, member_id: item.member_id },
      },
      metadata: { item_id: item.id, club_id: item.club_id, member_id: item.member_id },
      success_url: `${base}/stripe-return?state=paid`,
      cancel_url: `${base}/stripe-return?state=cancelled`,
    });

    await admin
      .from("payment_call_items")
      .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", item.id);

    return json({ url: session.url, sessionId: session.id });
  } catch (err) {
    return errorResponse(err);
  }
});
