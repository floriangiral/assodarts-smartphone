import { describe, expect, it } from "vitest";
import { clubSlugSchema, RESERVED_SLUGS, slugify } from "./index";

describe("clubSlugSchema", () => {
  it.each(["abc", "test-club", "123", "a1-b2", "a".repeat(40)])(
    "accepts %s",
    (s) => {
      expect(clubSlugSchema.safeParse(s).success).toBe(true);
    },
  );
  it.each([
    "",
    "ab",
    "a".repeat(41),
    "-abc",
    "abc-",
    "abc\n",
    "ab--cd",
    "ABC",
    "école",
    "a_b",
    "a.b",
    "ab cd",
  ])("rejects %s", (s) => {
    expect(clubSlugSchema.safeParse(s).success).toBe(false);
  });
  it("rejects overlong values before inspecting their characters", () => {
    expect(clubSlugSchema.safeParse("a".repeat(100_000)).success).toBe(false);
  });
  it.each(RESERVED_SLUGS)("reserves %s", (s) => {
    expect(clubSlugSchema.safeParse(s).success).toBe(false);
  });
});

describe("slugify", () => {
  it.each([
    ["Club Éléphant", "club-elephant"],
    ["  Fléchettes & Darts ! ", "flechettes-darts"],
    ["東京", ""],
    ["a".repeat(41), "a".repeat(40)],
    ["e\u0301cole", "ecole"],
  ])("suggests %s", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
  it("handles long punctuation-heavy names without changing the slug format", () => {
    expect(slugify(`${"Club ! ".repeat(100)}Darts`)).toBe(
      "club-club-club-club-club-club-club-club",
    );
  });
});
