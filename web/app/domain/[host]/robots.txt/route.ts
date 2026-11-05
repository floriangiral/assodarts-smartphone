import { canonical, robots } from "@/lib/public/data";
import { getCustomDomainClub } from "@/lib/public/customDomain";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ host: string }> },
) {
  const { host } = await params;
  const club = await getCustomDomainClub(host);
  const policy = robots();
  const body = policy?.index === false
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nSitemap: ${canonical(club.slug, "/sitemap.xml")}\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}