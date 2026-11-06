import { revalidatePublicPages } from "./publicProjections";

describe("public web revalidation", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("does nothing until the public endpoint and shared secret are configured", async () => {
    await revalidatePublicPages(
      "11111111-1111-4111-8111-111111111111",
      [],
      "",
      "",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts only club and event identifiers with the bearer secret", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await revalidatePublicPages(
      "11111111-1111-4111-8111-111111111111",
      ["event-1"],
      "https://staging.example/api/revalidate",
      "test-secret",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://staging.example/api/revalidate",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          clubId: "11111111-1111-4111-8111-111111111111",
          eventIds: ["event-1"],
        }),
      }),
    );
  });

  it("fails the trigger when the revalidation endpoint rejects the request", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    await expect(
      revalidatePublicPages(
        "11111111-1111-4111-8111-111111111111",
        [],
        "https://staging.example/api/revalidate",
        "test-secret",
      ),
    ).rejects.toThrow("Web revalidation failed with status 503");
  });
});
