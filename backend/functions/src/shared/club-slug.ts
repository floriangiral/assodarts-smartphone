import { z } from "zod";

export const RESERVED_SLUGS = [
  "www",
  "app",
  "admin",
  "api",
  "mail",
  "email",
  "smtp",
  "staging",
  "dev",
  "test",
  "preview",
  "support",
  "help",
  "status",
  "blog",
  "docs",
  "static",
  "cdn",
  "assets",
  "auth",
  "login",
  "account",
  "billing",
  "assodarts",
  "ffd",
] as const;

export const clubSlugSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9-]+$/)
  .refine(
    (slug) =>
      !slug.startsWith("-") && !slug.endsWith("-") && !slug.includes("--"),
  )
  .refine((slug) => !(RESERVED_SLUGS as readonly string[]).includes(slug));

/** Suggestion only: callers must validate it and resolve collisions separately. */
export function slugify(name: string): string {
  let slug = "";
  let separatorPending = false;
  for (const character of name.normalize("NFKD").toLowerCase()) {
    const code = character.codePointAt(0)!;
    if (code >= 0x300 && code <= 0x36f) continue;
    if ((code >= 0x61 && code <= 0x7a) || (code >= 0x30 && code <= 0x39)) {
      if (separatorPending && slug) slug += "-";
      slug += character;
      separatorPending = false;
    } else {
      separatorPending = true;
    }
  }
  const truncated = slug.slice(0, 40);
  return truncated.endsWith("-") ? truncated.slice(0, -1) : truncated;
}
