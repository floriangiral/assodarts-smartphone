export type HostResolution =
  | { kind: "marketing" }
  | { kind: "admin" }
  | { kind: "club"; slug: string }
  | { kind: "custom"; host: string };

/** The caller must accept forwarded headers only from its trusted proxy. */
export function resolveHost(forwardedHost: string | null, host: string | null, rootDomain: string): HostResolution {
  const hostname = (forwardedHost || host || "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  const root = rootDomain.trim().toLowerCase().replace(/:\d+$/, "");
  if (hostname === root || hostname === `www.${root}`) return { kind: "marketing" };
  if (hostname === `admin.${root}`) return { kind: "admin" };
  const suffix = `.${root}`;
  if (hostname.endsWith(suffix)) {
    const slug = hostname.slice(0, -suffix.length);
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 40) return { kind: "club", slug };
  }
  return { kind: "custom", host: hostname };
}
