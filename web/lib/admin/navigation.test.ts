import { describe, expect, it } from "vitest";
import { parseWorkspacePath, workspacePath } from "./navigation";

describe("workspace navigation", () => {
  it.each(["home", "news", "events", "members", "tournaments"] as const)("round trips the %s section", (tab) => {
    expect(parseWorkspacePath(workspacePath(tab))).toEqual({ tab, eventId: null });
  });
  it("round trips event links including encoded identifiers", () => {
    expect(parseWorkspacePath(workspacePath("events", "event:42"))).toEqual({ tab: "events", eventId: "event:42" });
  });
  it("accepts the internal admin prefix and rejects unknown or malformed paths", () => {
    expect(parseWorkspacePath("/admin/evenements/42")).toEqual({ tab: "events", eventId: "42" });
    expect(parseWorkspacePath("/parametres")).toBeNull();
    expect(parseWorkspacePath("/evenements/%ZZ")).toBeNull();
  });
});
