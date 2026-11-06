import { describe, expect, it } from "vitest";
import { resolveHost, resolveRequest } from "./resolveHost";

describe("host routing", () => {
  it.each([["LOCALHOST:3000", "marketing"], ["www.localhost", "marketing"], ["admin.localhost", "admin"], ["test-club.localhost:3000", "club"], ["invalid.host", "custom"], ["two.labels.localhost", "custom"], ["api.localhost", "custom"], ["ab.localhost", "custom"], ["ab--cd.localhost", "custom"]])("classifies %s", (host, kind) => {
    expect(resolveHost(null, host, "localhost").kind).toBe(kind);
  });
  it("uses the first forwarded host before host", () => {
    expect(resolveHost("TEST-CLUB.Localhost:3000, proxy", "localhost", "localhost")).toEqual({ kind: "club", slug: "test-club" });
  });
  it("uses a configured staging root", () => {
    expect(resolveHost(null, "club-a.staging.assodarts.app", "staging.assodarts.app")).toEqual({ kind: "club", slug: "club-a" });
  });
  it("recognizes only the configured App Hosting preview host", () => {
    const preview = "site.example.hosted.app";
    expect(resolveHost(null, preview, "staging.assodarts.app", preview)).toEqual({ kind: "marketing" });
    expect(resolveHost(null, "other.example.hosted.app", "staging.assodarts.app", preview).kind).toBe("custom");
  });
  it("rewrites admin and club paths", () => {
    expect(resolveRequest({ kind: "admin" }, "/events", "localhost")).toEqual({ action: "rewrite", path: "/admin/events" });
    expect(resolveRequest({ kind: "club", slug: "club-a" }, "/agenda", "localhost")).toEqual({ action: "rewrite", path: "/c/club-a/agenda" });
  });
  it("redirects canonical club paths and admin paths", () => {
    expect(resolveRequest({ kind: "marketing" }, "/c/club-a/agenda", "localhost")).toEqual({ action: "redirect", host: "club-a.localhost", path: "/agenda" });
    expect(resolveRequest({ kind: "club", slug: "club-a" }, "/admin/events", "localhost")).toEqual({ action: "redirect", host: "admin.localhost", path: "/events" });
    expect(resolveRequest({ kind: "marketing" }, "/c/admin", "localhost")).toEqual({ action: "next" });
    expect(resolveRequest({ kind: "marketing" }, "/admin", "localhost")).toEqual({ action: "redirect", host: "admin.localhost", path: "/" });
    expect(resolveRequest({ kind: "admin" }, "/retour-accueil", "staging.assodarts.app")).toEqual({ action: "redirect", host: "staging.assodarts.app", path: "/" });
  });
  it("leaves unknown hosts for server-side resolution", () => {
    expect(resolveRequest({ kind: "custom", host: "other.example" }, "/", "localhost")).toEqual({ action: "custom", host: "other.example" });
  });
});
