import Stripe from "stripe";
import { defineSecret } from "firebase-functions/params";

export const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

export function stripeClient(secretValue: string): Stripe {
  return new Stripe(secretValue, { apiVersion: "2026-08-26.dahlia" });
}

/**
 * Base URL of this project's deployed functions, used for Stripe redirects.
 * Adjust the region here if the functions are deployed outside us-central1.
 */
export function functionsBaseUrl(): string {
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
  return `https://us-central1-${projectId}.cloudfunctions.net`;
}

/**
 * A connected account can collect money once Stripe has enabled charges and
 * the onboarding form is complete.
 */
export function accountStatus(
  account: Stripe.Account,
): "not_connected" | "pending" | "verified" {
  if (account.charges_enabled && account.details_submitted) return "verified";
  return "pending";
}
