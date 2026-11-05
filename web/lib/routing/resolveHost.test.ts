import { describe, expect, it } from "vitest";
import { resolveHost } from "./resolveHost";

describe("resolveHost", () => {
  it.each([["localhost:3000", "marketing"], ["www.localhost", "marketing"], ["admin.localhost", "admin"], ["test-club.localhost:3000", "club"], ["invalid.host", "custom"], ["two.labels.localhost", "custom"]])("classifies %s", (host, kind) => {
    expect(resolveHost(null, host, "localhost").kind).toBe(kind);
  });
  it("prioritizes and normalizes the forwarded host", () => {
    expect(resolveHost("TEST-CLUB.Localhost:3000", "localhost", "localhost")).toEqual({ kind: "club", slug: "test-club" });
  });
});
