import { describe, expect, it } from "vitest";
import { defaultHomeContent, parseHomeContent } from "./content";

describe("published site content", () => {
  it("provides complete local content when there is no publication", () => {
    expect(defaultHomeContent.headline).toContain("Le club en jeu.");
    expect(defaultHomeContent.description).not.toBe("");
    expect(defaultHomeContent.feature1Title).not.toBe("");
  });
  it("keeps existing publications readable without inventing optional content", () => {
    const content = parseHomeContent({ headline: "Titre", description: "Description" });
    expect(content?.headline).toBe("Titre");
    expect(content?.featuresTitle).toBe("");
    expect(content?.feature1Title).toBe("");
  });
  it("preserves editorial fields from the database", () => {
    const content = parseHomeContent({ headline: "Titre", description: "Description", feature1Title: "Membres" });
    expect(content?.feature1Title).toBe("Membres");
  });
  it("rejects missing or malformed published content", () => {
    expect(parseHomeContent(undefined)).toBeNull();
    expect(parseHomeContent({ headline: "", description: "Description" })).toBeNull();
    expect(parseHomeContent({ headline: "Titre", description: "Description", feature1Title: 42 })).toBeNull();
  });
});
