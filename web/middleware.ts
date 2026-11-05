import { NextRequest, NextResponse } from "next/server";
import { clubSlugSchema } from "@assodarts/shared";
import { resolveHost, resolveRequest } from "./lib/routing/resolveHost";

export function middleware(request: NextRequest) {
  const root = process.env.ROOT_DOMAIN || "localhost";
  const host = resolveHost(request.headers.get("x-forwarded-host"), request.headers.get("host"), root);
  const url = request.nextUrl.clone();
  // Local-only fallback where *.localhost is unavailable. It never affects staging or production.
  const localClub = root === "localhost" && host.kind === "marketing" ? url.searchParams.get("club") : null;
  if (localClub && clubSlugSchema.safeParse(localClub).success) {
    if (url.pathname === "/") {
      url.pathname = `/c/${localClub}`;
      return NextResponse.rewrite(url);
    }
    if (url.pathname === `/c/${localClub}`) return NextResponse.next();
  }
  const decision = resolveRequest(host, request.nextUrl.pathname, root);
  if (decision.action === "custom") return new NextResponse(null, { status: 404 });
  if (decision.action === "next") return NextResponse.next();
  url.pathname = decision.path;
  if (decision.action === "redirect") {
    url.hostname = decision.host;
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.rewrite(url);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
