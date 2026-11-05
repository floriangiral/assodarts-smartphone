import { z } from "zod";

export const RESERVED_SLUGS = [
  "www", "app", "admin", "api", "mail", "email", "smtp", "staging", "dev",
  "test", "preview", "support", "help", "status", "blog", "docs", "static",
  "cdn", "assets", "auth", "login", "account", "billing", "assodarts", "ffd",
] as const;

export const clubSlugSchema = z.string().min(3).max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => !(RESERVED_SLUGS as readonly string[]).includes(slug));

/** Suggestion only: callers must validate it and resolve collisions separately. */
export function slugify(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40).replace(/-+$/g, "");
}
