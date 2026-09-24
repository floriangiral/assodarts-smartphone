import { makeCommitteeCallableRequest } from "./testSupport";

describe("makeCommitteeCallableRequest", () => {
  it("builds an authenticated committee-style callable request", () => {
    const request = makeCommitteeCallableRequest({ clubId: "c1" }, "u1");

    expect(request.data).toEqual({ clubId: "c1" });
    expect(request.auth).toEqual({
      uid: "u1",
      token: { email: "board@example.com" },
    });
  });

  it("keeps the request unauthenticated when no uid is provided", () => {
    const request = makeCommitteeCallableRequest({ clubId: "c1" });

    expect(request.auth).toBeUndefined();
  });
});
