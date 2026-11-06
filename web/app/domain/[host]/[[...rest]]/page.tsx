import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, MapPin } from "lucide-react";
import { Shell } from "@/components/shell";
import { messages } from "@/lib/messages";
import {
  canonical,
  formatDate,
  getEvent,
  getEvents,
  robots,
  splitEvents,
  type PublicEvent,
} from "@/lib/public/data";
import { getCustomDomainClub } from "@/lib/public/customDomain";

type Props = Readonly<{ params: Promise<{ host: string; rest?: string[] }> }>;
type CustomView = "home" | "agenda" | "event";

async function loadCustomPage(params: Props["params"]) {
  const { host, rest = [] } = await params;
  const club = await getCustomDomainClub(host);
  let view: CustomView;
  let path: string;
  let event: PublicEvent | null = null;
  let events: PublicEvent[] = [];

  if (rest.length === 0) {
    view = "home";
    path = "/";
    events = splitEvents(await getEvents(club.id)).upcoming.slice(0, 5);
  } else if (rest.length === 1 && rest[0] === "agenda") {
    view = "agenda";
    path = "/agenda";
    events = await getEvents(club.id);
  } else if (rest.length === 2 && rest[0] === "e") {
    view = "event";
    path = `/e/${encodeURIComponent(rest[1])}`;
    event = await getEvent(club.id, rest[1]);
  } else {
    notFound();
  }

  return { club, event, events, path, view };
}

export async function generateMetadata({ params }: Props) {
  const { club, event, path, view } = await loadCustomPage(params);
  const title = view === "event" && event
    ? `${event.title} — ${club.name}`
    : view === "agenda"
      ? `Agenda — ${club.name}`
      : club.name;
  return {
    title,
    ...(event?.description ? { description: event.description } : {}),
    alternates: { canonical: canonical(club.slug, path) },
    robots: robots(),
  };
}

export default async function CustomDomain({ params }: Props) {
  const { club, event, events, path, view } = await loadCustomPage(params);
  const localClubQuery =
    process.env.ROOT_DOMAIN === "localhost"
      ? `?club=${encodeURIComponent(club.slug)}`
      : "";

  if (view === "event" && event) {
    const structured = {
      "@context": "https://schema.org",
      "@type": "Event",
      name: event.title,
      ...(event.date && { startDate: event.date.toISOString() }),
      ...(event.endsAt && { endDate: event.endsAt.toISOString() }),
      ...(event.location && { location: { "@type": "Place", name: event.location } }),
      description: event.description,
      organizer: { "@type": "Organization", name: club.name },
      url: canonical(club.slug, path),
    };
    return (
      <Shell club={club} customDomain>
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-16">
          <Link className="focus-ring inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-muted hover:text-navy" href={`/agenda${localClubQuery}`}>
            <ArrowRight aria-hidden="true" className="rotate-180" size={16} /> {messages.eventPage.returnAgenda}
          </Link>
          <article className="mt-7 grid gap-10 lg:grid-cols-[1fr_21rem]">
            <div>
              <p className="text-xs font-bold uppercase text-orange">{club.name}</p>
              <h1 className="font-display mt-4 text-4xl leading-tight sm:text-6xl">{event.title}</h1>
              {(event.category || event.categories.length > 0) && <ul aria-label={messages.eventPage.categories} className="mt-5 flex flex-wrap gap-2">{[event.category, ...event.categories].filter((category, index, values) => category && values.indexOf(category) === index).map((category) => <li className="rounded-sm bg-green-soft px-3 py-1 text-xs font-bold text-green" key={category}>{category}</li>)}</ul>}
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 border-y border-border py-5 text-sm text-muted">
                <span className="flex items-center gap-2"><Clock3 aria-hidden="true" size={16} />{formatDate(event.date)}{event.endsAt && ` – ${formatDate(event.endsAt)}`}</span>
                {event.location && <span className="flex items-center gap-2"><MapPin aria-hidden="true" size={16} />{event.location}</span>}
              </div>
              {event.description && <p className="mt-7 max-w-3xl whitespace-pre-line text-sm leading-7 text-muted">{event.description}</p>}
            </div>
            <aside className="h-fit border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <h2 className="font-display text-2xl">{messages.eventPage.registrationTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{messages.eventPage.registrationUnavailable}</p>
              {club.contactEmail && <a className="focus-ring mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-navy px-4 text-sm font-bold text-white" href={`mailto:${club.contactEmail}`}>{messages.eventPage.contactClub}</a>}
            </aside>
          </article>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replaceAll("<", String.raw`\u003c`) }} />
      </Shell>
    );
  }

  if (view === "agenda") {
    const { upcoming, past } = splitEvents(events);
    return (
      <Shell club={club} customDomain>
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-16">
          <header className="border-b border-border pb-8">
            <p className="text-xs font-bold uppercase text-green">{messages.agendaPage.eyebrow}</p>
            <h1 className="font-display mt-3 text-4xl sm:text-6xl">L’agenda <span className="text-navy">{club.name}</span></h1>
          </header>
          <EventGroup label={messages.agendaPage.upcoming} events={upcoming} />
          <EventGroup label={messages.agendaPage.past} events={past} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell club={club} customDomain>
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
            <p className="text-xs font-bold uppercase text-orange">{messages.clubPage.eyebrow}{club.city ? ` · ${club.city}` : ""}</p>
            <h1 className="font-display mt-5 text-4xl leading-tight sm:text-6xl">{club.name}</h1>
            <p className="mt-5 max-w-2xl whitespace-pre-line text-base leading-7 text-muted sm:text-lg">{club.description || messages.clubPage.noDescription}</p>
            <Link className="focus-ring mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-orange px-5 text-sm font-bold text-ink hover:bg-[#fdf0df]" href={`/agenda${localClubQuery}`}><CalendarDays aria-hidden="true" size={17} />{messages.clubPage.seeAgenda}</Link>
          </div>
        </section>
        <section className="mt-12">
          <h2 className="font-display border-b border-border pb-4 text-3xl">{messages.clubPage.upcomingEvents}</h2>
          <ul className="divide-y divide-border">
            {events.map((item) => <li key={item.id}><EventLink event={item} /></li>)}
          </ul>
          {!events.length && <p className="py-7 text-sm text-muted">{messages.clubPage.noUpcoming}</p>}
        </section>
        {(club.schedule || club.address || club.contactEmail || club.socialLinks.length > 0) && (
          <aside className="mt-12 grid gap-8 border-t border-border pt-7 sm:grid-cols-3">
            {club.schedule && <section><h2 className="text-sm font-bold">{messages.clubPage.training}</h2><p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">{club.schedule}</p></section>}
            {club.address && <section><h2 className="text-sm font-bold">{messages.clubPage.address}</h2><p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">{club.address}</p></section>}
            {club.contactEmail && <section><h2 className="text-sm font-bold">{messages.clubPage.contact}</h2><a className="mt-3 inline-block break-all text-sm font-semibold text-navy hover:underline" href={`mailto:${club.contactEmail}`}>{club.contactEmail}</a></section>}
            {club.socialLinks.length > 0 && <section><h2 className="text-sm font-bold">{messages.clubPage.socialNetworks}</h2><ul className="mt-3 space-y-2">{club.socialLinks.map((link) => <li key={link.label}><a className="focus-ring rounded-sm text-sm font-semibold text-navy hover:underline" href={link.url} rel="noreferrer" target="_blank">{link.label}</a></li>)}</ul></section>}
          </aside>
        )}
      </div>
    </Shell>
  );
}

function EventGroup({ label, events }: { label: string; events: PublicEvent[] }) {
  return (
    <section className="mt-10 sm:mt-14">
      <h2 className="font-display border-b border-border pb-4 text-2xl sm:text-3xl">{label}</h2>
      <ul className="divide-y divide-border">{events.map((event) => <li key={event.id}><EventLink event={event} /></li>)}</ul>
      {!events.length && <p className="py-7 text-sm text-muted">{label === messages.agendaPage.upcoming ? messages.agendaPage.noUpcoming : messages.agendaPage.noPast}</p>}
    </section>
  );
}

function EventLink({ event }: { event: PublicEvent }) {
  return (
    <Link className="focus-ring group flex items-center gap-4 py-5" href={`/e/${encodeURIComponent(event.id)}`}>
      <span className="text-sm font-bold text-green">{event.date ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(event.date) : messages.agendaPage.noUpcoming}</span>
      <span className="min-w-0 flex-1"><span className="block font-bold group-hover:text-navy">{event.title}</span><span className="mt-1 block text-sm text-muted">{formatDate(event.date)}{event.location ? ` · ${event.location}` : ""}</span></span>
      <ArrowRight aria-hidden="true" className="text-muted group-hover:text-navy" size={16} />
    </Link>
  );
}
