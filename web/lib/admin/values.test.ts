import { describe, expect, it } from "vitest";
import { persistedAttendance, persistedScore } from "./values";

describe("persisted values", () => {
  it("distinguishes a recorded zero from a missing or invalid score", () => {
    expect(persistedScore(0)).toBe(0);
    expect(persistedScore(undefined)).toBeNull();
    expect(persistedScore("0")).toBeNull();
    expect(persistedScore(NaN)).toBeNull();
  });
  it("never interprets an unknown attendance value as participation", () => {
    expect(persistedAttendance("going")).toBe("going");
    expect(persistedAttendance("declined")).toBe("declined");
    expect(persistedAttendance(undefined)).toBeNull();
    expect(persistedAttendance("pending")).toBeNull();
  });
});
