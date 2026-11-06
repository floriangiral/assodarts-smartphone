export function GET() {
  const staging = process.env.ROOT_DOMAIN?.startsWith("staging.");
  const root = process.env.ROOT_DOMAIN || "localhost";
  if (staging) {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const protocol = root === "localhost" ? "http" : "https";
  const portSuffix = root === "localhost" ? ":3000" : "";
  return new Response(
    `User-agent: *\nAllow: /\nSitemap: ${protocol}://${root}${portSuffix}/sitemap.xml\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
