import { createAdminClient } from "../_shared/auth.ts";
import { Stripe, stripe } from "../_shared/stripe.ts";

/**
 * Stripe webhook — the only place a payment is actually marked as settled.
 *
 * Deliberately public (no Supabase session): authenticity comes from the Stripe
 * signature check below, which is why the secret must be configured.
 */
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !secret) {
    return new Response(JSON.stringify({ error: "Missing signature" }), { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      secret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error("Invalid Stripe signature", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const itemId = session.metadata?.item_id;
        if (!itemId || session.payment_status !== "paid") break;

        await admin
          .from("payment_call_items")
          .update({
            is_paid: true,
            paid_at: new Date().toISOString(),
            declared_at: null,
            method: "card",
            stripe_payment_intent_id: typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);

        console.log(`Payment line ${itemId} settled by Stripe Checkout`);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const itemId = charge.metadata?.item_id;
        if (!itemId) break;

        await admin
          .from("payment_call_items")
          .update({ is_paid: false, paid_at: null, updated_at: new Date().toISOString() })
          .eq("id", itemId);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const status = account.charges_enabled && account.details_submitted
          ? "verified"
          : "pending";

        await admin
          .from("club_bank_accounts")
          .update({
            stripe_status: status,
            stripe_charges_enabled: account.charges_enabled ?? false,
            stripe_details_submitted: account.details_submitted ?? false,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_account_id", account.id);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Webhook handling failed", err);
    return new Response(JSON.stringify({ error: "Handler failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
