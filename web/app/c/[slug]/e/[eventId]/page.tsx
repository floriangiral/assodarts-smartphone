import { Shell } from "@/components/shell";
import {
  canonical,
  formatDate,
  getClub,
  getEvent,
  robots,
} from "@/lib/public/data";
type Props = { params: Promise<{ slug: string; eventId: string }> };
async function load(params: Props["params"]) {
  const { slug, eventId } = await params;
  const path = `/e/${encodeURIComponent(eventId)}`;
  const club = await getClub(slug, path);
  const event = await getEvent(club.id, eventId);
  return { club, event, path };
}
export async function generateMetadata({ params }: Props) {
  const { club, event, path } = await load(params);
  return {
    title: `${event.title} — ${club.name}`,
    description: event.description || `Événement organisé par ${club.name}`,
    alternates: { canonical: canonical(club.slug, path) },
    openGraph: {
      title: `${event.title} — ${club.name}`,
      images: [`${canonical(club.slug, path)}/opengraph-image`],
    },
    robots: robots(),
  };
}
export default async function Event({ params }: Props) {
  const { club, event, path } = await load(params);
  const structured = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    ...(event.date && { startDate: event.date.toISOString() }),
    ...(event.location && {
      location: { "@type": "Place", name: event.location },
    }),
    description: event.description,
    organizer: { "@type": "Organization", name: club.name },
    url: canonical(club.slug, path),
  };
  return (
    <Shell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      <article>
        <p className="text-sm font-semibold uppercase tracking-widest text-orange">
          {club.name}
        </p>
        <h1 className="mt-3 text-4xl font-bold">{event.title}</h1>
        <p className="mt-6">{formatDate(event.date)}</p>
        {event.location && <p className="mt-3">{event.location}</p>}
        {event.description && (
          <p className="mt-6 max-w-2xl whitespace-pre-line">
            {event.description}
          </p>
        )}
      </article>
    </Shell>
  );
}
