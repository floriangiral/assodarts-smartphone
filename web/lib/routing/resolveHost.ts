import { clubSlugSchema } from "@assodarts/shared";

export type HostResolution =
  | { kind: "marketing" }
  | { kind: "admin" }
  | { kind: "club"; slug: string }
  | { kind: "custom"; host: string };

export function normalizeHost(value: string): string {
  return value.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

/** Forwarded headers must be supplied by a trusted proxy. */
export function resolveHost(forwardedHost: string | null, host: string | null, rootDomain: string, previewHost?: string): HostResolution {
  const hostname = normalizeHost(forwardedHost || host || "");
  const root = normalizeHost(rootDomain);
  if (hostname === root || hostname === `www.${root}` || (previewHost && hostname === normalizeHost(previewHost))) return { kind: "marketing" };
  if (hostname === `admin.${root}`) return { kind: "admin" };
  const suffix = `.${root}`;
  if (hostname.endsWith(suffix)) {
    const slug = hostname.slice(0, -suffix.length);
    if (clubSlugSchema.safeParse(slug).success) return { kind: "club", slug };
  }
  return { kind: "custom", host: hostname };
}

export type RouteDecision =
  | { action: "next" }
  | { action: "rewrite"; path: string }
  | { action: "redirect"; host: string; path: string }
  | { action: "custom"; host: string };

function resolveMarketingPath(path: string, root: string): RouteDecision {
  const match = /^\/c\/([^/]+)(\/.*)?$/.exec(path);
  if (match && clubSlugSchema.safeParse(match[1]).success) {
    return { action: "redirect", host: `${match[1]}.${root}`, path: match[2] || "/" };
  }
  if (isAdminPath(path)) {
    return { action: "redirect", host: `admin.${root}`, path: path.slice(6) || "/" };
  }
  return { action: "next" };
}

function isAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

function resolveAdminPath(path: string): RouteDecision {
  return isAdminPath(path)
    ? { action: "next" }
    : { action: "rewrite", path: `/admin${path === "/" ? "" : path}` };
}

function resolveClubPath(
  host: Extract<HostResolution, { kind: "club" }>,
  path: string,
  root: string,
): RouteDecision {
  if (isAdminPath(path)) {
    return { action: "redirect", host: `admin.${root}`, path: path.slice(6) || "/" };
  }
  if (path === `/c/${host.slug}` || path.startsWith(`/c/${host.slug}/`)) {
    return { action: "next" };
  }
  return { action: "rewrite", path: `/c/${host.slug}${path === "/" ? "" : path}` };
}

export function resolveRequest(
  host: HostResolution,
  path: string,
  rootDomain: string,
): RouteDecision {
  const root = normalizeHost(rootDomain);
  if (host.kind === "custom") return { action: "custom", host: host.host };
  if (host.kind === "marketing") return resolveMarketingPath(path, root);
  if (host.kind === "admin") return resolveAdminPath(path);
  return resolveClubPath(host, path, root);
}
