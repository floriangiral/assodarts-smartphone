import { canonical, getClub, getEvents } from "@/lib/public/data";
export async function GET(
  _request: Request,
  { params }: Readonly<{ params: Promise<{ slug: string }> }>,
) {
  const { slug } = await params;
  const club = await getClub(slug, "/sitemap.xml");
  const events = await getEvents(club.id);
  const paths = [
    "/",
    "/agenda",
    ...events.map((e) => `/e/${encodeURIComponent(e.id)}`),
  ];
  const urls = paths
    .map(
      (path) =>
        `<url><loc>${canonical(club.slug, path).replaceAll("&", "&amp;")}</loc></url>`,
    )
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
