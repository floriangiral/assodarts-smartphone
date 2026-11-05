import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, MapPin } from "lucide-react";
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
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const club = await getClub(slug, "/agenda");
  return {
    title: `Agenda — ${club.name}`,
    alternates: { canonical: canonical(club.slug, "/agenda") },
    robots: robots(),
  };
}
export default async function Agenda({ params }: Props) {
  const { slug } = await params;
  const club = await getClub(slug, "/agenda");
  const localClubQuery =
    process.env.ROOT_DOMAIN === "localhost"
      ? `?club=${encodeURIComponent(club.slug)}`
      : "";
  const events = await getEvents(club.id);
  const { upcoming, past } = splitEvents(events);
  return (
    <Shell club={club}>
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-16">
        <header className="max-w-3xl border-b border-border pb-8 sm:pb-10">
          <p className="text-xs font-bold uppercase text-green">
            {messages.agendaPage.eyebrow}
          </p>
          <h1 className="font-display mt-3 text-4xl leading-tight sm:text-6xl">
            L’agenda <span className="text-navy">{club.name}</span>
          </h1>
          {club.city && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted">
              <MapPin aria-hidden="true" size={16} /> {club.city}
            </p>
          )}
        </header>

        {[
          {
            label: messages.agendaPage.upcoming,
            list: upcoming,
            empty: messages.agendaPage.noUpcoming,
            pastEvents: false,
          },
          {
            label: messages.agendaPage.past,
            list: past,
            empty: messages.agendaPage.noPast,
            pastEvents: true,
          },
        ].map(({ label, list, empty, pastEvents }) => (
          <section className="mt-10 sm:mt-14" key={label}>
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <span className={`grid size-9 place-items-center rounded-lg ${pastEvents ? "bg-soft text-muted" : "bg-green-soft text-green"}`}>
                <CalendarDays aria-hidden="true" size={18} />
              </span>
              <h2 className="font-display text-2xl sm:text-3xl">{label}</h2>
              <span className="ml-auto text-sm text-muted">{list.length}</span>
            </div>
            {list.length ? (
              <ul className="divide-y divide-border">
                {list.map((event) => (
                  <li key={event.id}>
                    <Link
                      className="focus-ring group grid gap-4 rounded-sm py-5 sm:grid-cols-[7rem_1fr_auto] sm:items-center"
                      href={`/e/${encodeURIComponent(event.id)}${localClubQuery}`}
                    >
                      <span className={`flex items-center gap-2 text-sm font-bold sm:block ${pastEvents ? "text-muted" : "text-green"}`}>
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
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-navy sm:justify-self-end">
                        <span className="sm:hidden">{messages.agendaPage.eventLink}</span>
                        <ArrowRight aria-hidden="true" className="transition group-hover:translate-x-1" size={17} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-7 text-sm leading-6 text-muted">{empty}</p>
            )}
          </section>
        ))}
      </div>
    </Shell>
  );
}
