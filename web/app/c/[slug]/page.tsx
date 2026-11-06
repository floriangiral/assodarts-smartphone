import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, MapPin, Mail } from "lucide-react";
import { Shell } from "@/components/shell";
import { messages } from "@/lib/messages";
import {
  canonical,
  formatDate,
  getClub,
  getEvents,
  robots,
  splitEvents,
} from "@/lib/public/data";

type Props = Readonly<{ params: Promise<{ slug: string }> }>;
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const club = await getClub(slug);
  return {
    title: club.name,
    description:
      club.description || `Découvrez ${club.name} et ses événements.`,
    alternates: { canonical: canonical(club.slug) },
    robots: robots(),
  };
}
export default async function Club({ params }: Props) {
  const { slug } = await params;
  const club = await getClub(slug);
  const localClubQuery =
    process.env.ROOT_DOMAIN === "localhost"
      ? `?club=${encodeURIComponent(club.slug)}`
      : "";
  const events = splitEvents(await getEvents(club.id)).upcoming.slice(0, 5);
  return (
    <Shell club={club}>
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-16">
        <section className="relative overflow-hidden rounded-lg border border-border bg-surface px-6 py-10 text-ink shadow-sm sm:px-10 sm:py-14">
          {club.coverUrl ? (
            <div
              aria-label={`${messages.clubPage.coverLabel} ${club.name}`}
              className="absolute inset-0 bg-cover bg-center opacity-20"
              role="img"
              style={{ backgroundImage: `url("${club.coverUrl}")` }}
            />
          ) : (
            <>
              <div aria-hidden="true" className="absolute -right-10 -top-20 size-72 rounded-full border border-border sm:size-96" />
              <div aria-hidden="true" className="absolute -right-2 top-0 size-56 rounded-full border border-orange/30 sm:size-72" />
            </>
          )}
          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase text-orange">
              {messages.clubPage.eyebrow}{club.city ? ` · ${club.city}` : ""}
            </p>
            <h1 className="font-display mt-5 text-4xl leading-tight sm:text-6xl">
              {club.name}
            </h1>
            <p className="mt-5 max-w-2xl whitespace-pre-line text-base leading-7 text-muted sm:text-lg">
              {club.description || messages.clubPage.noDescription}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full bg-orange px-5 text-sm font-bold text-ink transition hover:bg-[#fdf0df]"
                href={`/agenda${localClubQuery}`}
              >
                <CalendarDays aria-hidden="true" size={17} />
                {messages.clubPage.seeAgenda}
              </Link>
              {club.contactEmail && (
                <a
                  className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-surface px-5 text-sm font-bold text-ink transition hover:bg-soft"
                  href={`mailto:${club.contactEmail}`}
                >
                  <Mail aria-hidden="true" size={16} />
                  {messages.navigation.contact}
                </a>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-12 py-12 lg:grid-cols-[1.4fr_0.6fr] lg:gap-16 lg:py-16">
          <section>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="text-xs font-bold uppercase text-green">
                  {club.city || messages.clubPage.eyebrow}
                </p>
                <h2 className="font-display mt-2 text-3xl sm:text-4xl">
                  {messages.clubPage.upcomingEvents}
                </h2>
              </div>
              <Link
                className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-sm text-sm font-bold text-navy hover:underline"
                href={`/agenda${localClubQuery}`}
              >
                {messages.clubPage.seeAgenda} <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
            {events.length ? (
              <ul className="divide-y divide-border">
                {events.map((event) => (
                  <li key={event.id}>
                    <Link
                      className="focus-ring group grid gap-4 rounded-sm py-5 transition sm:grid-cols-[7rem_1fr_auto] sm:items-center"
                      href={`/e/${encodeURIComponent(event.id)}${localClubQuery}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-green sm:block">
                        <CalendarDays aria-hidden="true" className="sm:hidden" size={16} />
                        {event.date
                          ? new Intl.DateTimeFormat("fr-FR", {
                              day: "numeric",
                              month: "short",
                              timeZone: "Europe/Paris",
                            }).format(event.date)
                          : "Date à préciser"}
                      </span>
                      <span>
                        <span className="block text-lg font-bold group-hover:text-navy">
                          {event.title}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                          <Clock3 aria-hidden="true" size={14} />
                          {formatDate(event.date)}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="hidden text-muted transition group-hover:translate-x-1 group-hover:text-navy sm:block" size={18} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-sm leading-6 text-muted">
                {messages.clubPage.noUpcoming}
              </p>
            )}
          </section>

          <aside className="space-y-8 border-t border-border pt-7 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            {club.schedule && (
              <section>
                <div className="flex items-center gap-2 text-green">
                  <Clock3 aria-hidden="true" size={17} />
                  <h2 className="text-sm font-bold uppercase text-ink">
                    {messages.clubPage.training}
                  </h2>
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted">
                  {club.schedule}
                </p>
              </section>
            )}
            {club.address && (
              <section>
                <div className="flex items-center gap-2 text-orange">
                  <MapPin aria-hidden="true" size={17} />
                  <h2 className="text-sm font-bold uppercase text-ink">
                    {messages.clubPage.address}
                  </h2>
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted">
                  {club.address}
                </p>
              </section>
            )}
            {club.contactEmail && (
              <section className="border-t border-border pt-6">
                <h2 className="font-display text-2xl">
                  {messages.clubPage.contact}
                </h2>
                <a
                  className="focus-ring mt-3 inline-flex items-center gap-2 rounded-sm break-all text-sm font-semibold text-navy hover:underline"
                  href={`mailto:${club.contactEmail}`}
                >
                  <Mail aria-hidden="true" size={16} />
                  {club.contactEmail}
                </a>
              </section>
            )}
            {club.socialLinks.length > 0 && (
              <section className="border-t border-border pt-6">
                <h2 className="font-display text-2xl">{messages.clubPage.socialNetworks}</h2>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {club.socialLinks.map((link) => (
                    <li key={link.label}>
                      <a
                        className="focus-ring rounded-sm text-sm font-semibold text-navy hover:underline"
                        href={link.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>
    </Shell>
  );
}
