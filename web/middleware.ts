import { NextRequest, NextResponse } from "next/server";
import { resolveHost } from "./lib/routing/resolveHost";

export function middleware(request: NextRequest) {
  const root = process.env.ROOT_DOMAIN || "localhost";
  const host = resolveHost(request.headers.get("x-forwarded-host"), request.headers.get("host"), root);
  const url = request.nextUrl.clone();
  const path = url.pathname;
  if (host.kind === "custom") return new NextResponse(null, { status: 404 });
  if (host.kind === "marketing") {
    const match = /^\/c\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/.*)?$/.exec(path);
    if (match && match[1].length >= 3 && match[1].length <= 40) {
      url.hostname = `${match[1]}.${root}`;
      url.pathname = match[2] || "/";
      return NextResponse.redirect(url, 301);
    }
    return NextResponse.next();
  }
  if (host.kind === "club") {
    if (path === `/c/${host.slug}` || path.startsWith(`/c/${host.slug}/`)) return NextResponse.next();
    if (path === "/admin" || path.startsWith("/admin/")) {
      url.hostname = `admin.${root}`;
      url.pathname = path.slice("/admin".length) || "/";
      return NextResponse.redirect(url, 301);
    }
    url.pathname = `/c/${host.slug}${path === "/" ? "" : path}`;
  } else if (path !== "/admin" && !path.startsWith("/admin/")) {
    url.pathname = `/admin${path === "/" ? "" : path}`;
  }
  return NextResponse.rewrite(url);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
