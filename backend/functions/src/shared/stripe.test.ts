import { accountStatus, functionsBaseUrl } from "./stripe";
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
