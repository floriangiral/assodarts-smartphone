import { canonical, getClub } from "@/lib/public/data";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const club = await getClub(slug, "/robots.txt");
  const body = process.env.ROOT_DOMAIN?.startsWith("staging.")
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nSitemap: ${canonical(club.slug, "/sitemap.xml")}\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
