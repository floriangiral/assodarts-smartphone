export function GET() {
  const staging = process.env.ROOT_DOMAIN?.startsWith("staging.");
  const root = process.env.ROOT_DOMAIN || "localhost";
  return new Response(
    staging
      ? "User-agent: *\nDisallow: /\n"
      : `User-agent: *\nAllow: /\nSitemap: ${root === "localhost" ? "http" : "https"}://${root}${root === "localhost" ? ":3000" : ""}/sitemap.xml\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
