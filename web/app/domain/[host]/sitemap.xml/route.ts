import { canonical, getEvents } from "@/lib/public/data";
import { getCustomDomainClub } from "@/lib/public/customDomain";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ host: string }> },
) {
  const { host } = await params;
  const club = await getCustomDomainClub(host);
  const events = await getEvents(club.id);
  const paths = [
    "/",
    "/agenda",
    ...events.map((event) => `/e/${encodeURIComponent(event.id)}`),
  ];
  const urls = paths
    .map((path) => `<url><loc>${escapeXml(canonical(club.slug, path))}</loc></url>`)
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}