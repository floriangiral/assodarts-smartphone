import { describe, expect, it } from "vitest";
import { clubSlugSchema, RESERVED_SLUGS, slugify } from "./index";

describe("clubSlugSchema", () => {
  it.each(["abc", "test-club", "123", "a1-b2", "a".repeat(40)])("accepts %s", (s) => {
    expect(clubSlugSchema.safeParse(s).success).toBe(true);
  });
  it.each(["", "ab", "a".repeat(41), "-abc", "abc-", "ab--cd", "ABC", "école", "a_b", "a.b", "ab cd"])("rejects %s", (s) => {
    expect(clubSlugSchema.safeParse(s).success).toBe(false);
  });
  it.each(RESERVED_SLUGS)("reserves %s", (s) => {
    expect(clubSlugSchema.safeParse(s).success).toBe(false);
  });
});

describe("slugify", () => {
  it.each([["Club Éléphant", "club-elephant"], ["  Fléchettes & Darts ! ", "flechettes-darts"], ["東京", ""], ["a".repeat(41), "a".repeat(40)], ["e\u0301cole", "ecole"]])("suggests %s", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
});
