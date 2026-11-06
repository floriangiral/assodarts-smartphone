import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => mocks);

import { POST } from "./route";

const secret = "local-test-secret-with-at-least-32-characters";

function makeRequest(body: unknown, authorization?: string) {
  return new Request("http://localhost/api/revalidate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("public cache revalidation endpoint", () => {
  beforeEach(() => {
    process.env.WEB_REVALIDATION_SECRET = secret;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.WEB_REVALIDATION_SECRET;
  });

  it("fails closed when the shared secret is not configured", async () => {
    delete process.env.WEB_REVALIDATION_SECRET;
    const response = await POST(makeRequest({ clubId: "11111111-1111-4111-8111-111111111111" }));
    expect(response.status).toBe(503);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects an invalid bearer token", async () => {
    const response = await POST(
      makeRequest({ clubId: "11111111-1111-4111-8111-111111111111" }, "Bearer invalid"),
    );
    expect(response.status).toBe(401);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("validates UUIDs and slugs before invalidating tags", async () => {
    const response = await POST(
      makeRequest({ clubId: "not-a-uuid", slug: "admin" }, `Bearer ${secret}`),
    );
    expect(response.status).toBe(400);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("invalidates slug, club event-list and requested event tags", async () => {
    const response = await POST(
      makeRequest(
        {
          clubId: "11111111-1111-4111-8111-111111111111",
          slug: "club-a",
          eventIds: ["event-1", "event-2"],
        },
        `Bearer ${secret}`,
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("club-slug", "max");
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      "public-events-11111111-1111-4111-8111-111111111111",
      "max",
    );
    expect(mocks.revalidateTag).toHaveBeenCalledWith("public-event-event-1", "max");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("public-event-event-2", "max");
  });
});