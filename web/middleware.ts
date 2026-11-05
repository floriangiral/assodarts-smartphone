import { NextRequest, NextResponse } from "next/server";
import { clubSlugSchema } from "@assodarts/shared";
import {
  resolveHost,
  resolveRequest,
  type RouteDecision,
} from "./lib/routing/resolveHost";

function isStaticAsset(pathname: string) {
  return /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf)$/i.test(pathname);
}

function resolveLocalClubFallback(
  url: URL,
  root: string,
  kind: string,
): NextResponse | null {
  // Local-only fallback where *.localhost is unavailable. It never affects staging or production.
  if (root !== "localhost" || kind !== "marketing") return null;
  const slug = url.searchParams.get("club");
  if (!slug || !clubSlugSchema.safeParse(slug).success) return null;

  const isClubPath =
    url.pathname === `/c/${slug}` || url.pathname.startsWith(`/c/${slug}/`);
  if (isClubPath) return NextResponse.next();

  const isAdminPath =
    url.pathname === "/admin" || url.pathname.startsWith("/admin/");
  if (isAdminPath) return null;

  url.pathname = `/c/${slug}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

function resolveCustomDomain(url: URL, host: string) {
  // Only the server page reads Firestore; reject malformed hosts before routing.
  if (!/^[a-z0-9.-]+$/.test(host) || host.length > 253) {
    return new NextResponse(null, { status: 404 });
  }
  const prefix = `/domain/${host}`;
  if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
    return NextResponse.next();
  }
  url.pathname = `${prefix}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

function applyRouteDecision(
  url: URL,
  decision: Extract<RouteDecision, { action: "redirect" | "rewrite" }>,
) {
  url.pathname = decision.path;
  if (decision.action === "redirect") {
    url.hostname = decision.host;
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
  if (isStaticAsset(request.nextUrl.pathname)) return NextResponse.next();

  const root = process.env.ROOT_DOMAIN || "localhost";
  const host = resolveHost(
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
    root,
    process.env.APPHOSTING_DEFAULT_HOST,
  );
  const url = request.nextUrl.clone();
  const localResponse = resolveLocalClubFallback(url, root, host.kind);
  if (localResponse) return localResponse;

  const decision = resolveRequest(host, request.nextUrl.pathname, root);
  if (decision.action === "next") return NextResponse.next();
  if (decision.action === "custom") {
    return resolveCustomDomain(url, decision.host);
  }
  return applyRouteDecision(url, decision);
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
