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

export const stripeConnectedAccountInclude: Array<
  "configuration.recipient" | "requirements"
> = [
  "configuration.recipient",
  "requirements",
];

export type StripeConnectStatus = "not_connected" | "pending" | "verified";

/**
 * A connected account can collect money once Stripe has enabled charges and
 * the onboarding form is complete.
 */
export function accountStatus(
  account: Stripe.Account,
): StripeConnectStatus {
  if (account.charges_enabled && account.details_submitted) return "verified";
  return "pending";
}

export function v2AccountReadiness(
  account: Stripe.V2.Core.Account,
): {
  status: StripeConnectStatus;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
} {
  const transfersStatus =
    account.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status;
  const chargesEnabled = transfersStatus === "active";
  const hasBlockingRequirement =
    account.requirements?.entries?.some((entry) =>
      entry.impact.restricts_capabilities?.some(
        (restricted) =>
          restricted.configuration === "recipient" &&
          restricted.capability === "stripe_balance.stripe_transfers" &&
          (restricted.deadline.status === "currently_due" ||
            restricted.deadline.status === "past_due"),
      ),
    ) ?? false;
  const detailsSubmitted = !hasBlockingRequirement;

  return {
    status: chargesEnabled && detailsSubmitted ? "verified" : "pending",
    chargesEnabled,
    detailsSubmitted,
  };
}
