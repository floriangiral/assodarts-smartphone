import { stripeReturn } from "./stripeReturn";

type MockResponse = {
  set: jest.Mock;
  send: jest.Mock;
};

function makeResponse(): MockResponse {
  return {
    set: jest.fn(),
    send: jest.fn(),
  };
}

const handler = stripeReturn as unknown as (
  req: unknown,
  res: unknown,
) => Promise<void>;

describe("stripeReturn", () => {
  it.each([
    ["paid", "Paiement confirmé"],
    ["cancelled", "Paiement annulé"],
    ["done", "Compte transmis à Stripe"],
    ["refresh", "Lien expiré"],
  ])("renders the %s message", async (state, title) => {
    const response = makeResponse();

    await handler({ query: { state } }, response);

    expect(response.set).toHaveBeenCalledWith(
      "Content-Type",
      "text/html; charset=utf-8",
    );
    expect(response.send).toHaveBeenCalledWith(
      expect.stringContaining(`<h1>${title}</h1>`),
    );
  });

  it.each([undefined, "unknown"])(
    'defaults state "%s" to done',
    async (state) => {
      const response = makeResponse();

      await handler({ query: { state } }, response);

      expect(response.send).toHaveBeenCalledWith(
        expect.stringContaining("<h1>Compte transmis à Stripe</h1>"),
      );
    },
  );

  it("does not reflect an unrecognized state into the HTML", async () => {
    const response = makeResponse();
    const maliciousState = "<script>alert(1)</script>";

    await handler({ query: { state: maliciousState } }, response);

    const html = response.send.mock.calls[0][0] as string;
    expect(html).not.toContain(maliciousState);
    expect(html).toContain("<h1>Compte transmis à Stripe</h1>");
  });
});
