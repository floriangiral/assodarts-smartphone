import { accountStatus, functionsBaseUrl, v2AccountReadiness } from "./stripe";
import type Stripe from "stripe";

describe("accountStatus", () => {
  it("is not_connected when neither charges nor details are complete", () => {
    expect(
      accountStatus({
        charges_enabled: false,
        details_submitted: false,
      } as Stripe.Account),
    ).toBe("pending");
  });

  it("is pending when only one of charges/details is complete", () => {
    expect(
      accountStatus({
        charges_enabled: true,
        details_submitted: false,
      } as Stripe.Account),
    ).toBe("pending");
  });

  it("is verified once charges are enabled and details are submitted", () => {
    expect(
      accountStatus({
        charges_enabled: true,
        details_submitted: true,
      } as Stripe.Account),
    ).toBe("verified");
  });
});

describe("v2AccountReadiness", () => {
  const makeAccount = (
    status: "active" | "pending" | "restricted" | "unsupported",
    hasBlockingRequirement = false,
  ) =>
    ({
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: { status },
            },
          },
        },
      },
      requirements: {
        entries: hasBlockingRequirement
          ? [
              {
                impact: {
                  restricts_capabilities: [
                    {
                      configuration: "recipient",
                      capability: "stripe_balance.stripe_transfers",
                      deadline: { status: "currently_due" },
                    },
                  ],
                },
              },
            ]
          : [],
      },
    }) as Stripe.V2.Core.Account;

  it("is verified when recipient transfers are active and requirements are clear", () => {
    expect(v2AccountReadiness(makeAccount("active"))).toEqual({
      status: "verified",
      chargesEnabled: true,
      detailsSubmitted: true,
    });
  });

  it("is pending while the recipient transfer capability is not active", () => {
    expect(v2AccountReadiness(makeAccount("pending"))).toEqual({
      status: "pending",
      chargesEnabled: false,
      detailsSubmitted: true,
    });
  });

  it("keeps details pending when Stripe still blocks recipient transfers", () => {
    expect(v2AccountReadiness(makeAccount("active", true))).toEqual({
      status: "pending",
      chargesEnabled: true,
      detailsSubmitted: false,
    });
  });
});

describe("functionsBaseUrl", () => {
  const originalGcloudProject = process.env.GCLOUD_PROJECT;
  const originalGcpProject = process.env.GCP_PROJECT;

  afterEach(() => {
    process.env.GCLOUD_PROJECT = originalGcloudProject;
    process.env.GCP_PROJECT = originalGcpProject;
  });

  it("builds a us-central1 URL from GCLOUD_PROJECT", () => {
    process.env.GCLOUD_PROJECT = "assodarts-staging";
    delete process.env.GCP_PROJECT;
    expect(functionsBaseUrl()).toBe(
      "https://us-central1-assodarts-staging.cloudfunctions.net",
    );
  });

  it("falls back to GCP_PROJECT when GCLOUD_PROJECT is unset", () => {
    delete process.env.GCLOUD_PROJECT;
    process.env.GCP_PROJECT = "assodarts";
    expect(functionsBaseUrl()).toBe(
      "https://us-central1-assodarts.cloudfunctions.net",
    );
  });
});
