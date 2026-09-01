import Stripe from "https://esm.sh/stripe@16.12.0?target=denonext";

/**
 * Shared Stripe client. Deno needs the fetch-based HTTP client rather than the
 * default Node one.
 */
export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

export { Stripe };

/** Base URL of this Supabase project's functions, used for Stripe redirects. */
export function functionsBaseUrl(): string {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
}

/**
 * A connected account can collect money once Stripe has enabled charges and the
 * onboarding form is complete.
 */
export function accountStatus(account: Stripe.Account): "not_connected" | "pending" | "verified" {
  if (account.charges_enabled && account.details_submitted) return "verified";
  return "pending";
}
