import { Shell } from "@/components/shell";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, Mail, MapPin } from "lucide-react";
import { messages } from "@/lib/messages";
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
  const localClubQuery =
    process.env.ROOT_DOMAIN === "localhost"
      ? `?club=${encodeURIComponent(club.slug)}`
      : "";
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
    <Shell club={club}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-16">
        <Link
          className="focus-ring inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-muted transition hover:text-navy"
          href={`/agenda${localClubQuery}`}
        >
          <ArrowLeft aria-hidden="true" size={16} /> {messages.eventPage.returnAgenda}
        </Link>
        <article className="mt-8 grid gap-10 lg:grid-cols-[1fr_21rem] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase text-orange">
              {club.name}
            </p>
            <h1 className="font-display mt-4 max-w-4xl text-4xl leading-tight sm:text-6xl">
              {event.title}
            </h1>
            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 border-y border-border py-5 text-sm font-semibold">
              <span className="flex items-center gap-2 text-green">
                <CalendarDays aria-hidden="true" size={17} />
                {formatDate(event.date)}
              </span>
              {event.location && (
                <span className="flex items-center gap-2 text-muted">
                  <MapPin aria-hidden="true" size={17} /> {event.location}
                </span>
              )}
            </div>
            {event.description && (
              <section className="mt-9 max-w-3xl">
                <h2 className="font-display text-2xl">{messages.eventPage.about}</h2>
                <p className="mt-4 whitespace-pre-line text-base leading-7 text-muted">
                  {event.description}
                </p>
              </section>
            )}
          </div>

          <aside className="h-fit border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div className="flex items-center gap-2 text-orange">
              <Clock3 aria-hidden="true" size={17} />
              <h2 className="text-xs font-bold uppercase text-muted">
                {messages.eventPage.date}
              </h2>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6">
              {formatDate(event.date)}
            </p>
            {event.location && (
              <div className="mt-6 border-t border-border pt-5">
                <div className="flex items-center gap-2 text-green">
                  <MapPin aria-hidden="true" size={17} />
                  <h2 className="text-xs font-bold uppercase text-muted">
                    {messages.eventPage.location}
                  </h2>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-6">
                  {event.location}
                </p>
              </div>
            )}
            <div className="mt-7 border-t border-border pt-5">
              <h2 className="font-display text-2xl">
                {messages.eventPage.registrationTitle}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                {messages.eventPage.registrationUnavailable}
              </p>
              {club.contactEmail && (
                <a
                  className="focus-ring mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-navy px-4 text-sm font-bold text-white transition hover:bg-navy-deep"
                  href={`mailto:${club.contactEmail}`}
                >
                  <Mail aria-hidden="true" size={16} />
                  {messages.eventPage.contactClub}
                </a>
              )}
            </div>
          </aside>
        </article>
      </div>
    </Shell>
  );
}
