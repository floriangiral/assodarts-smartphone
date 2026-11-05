import Link from "next/link";
import { Shell } from "@/components/shell";
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
    <Shell>
      <article className="space-y-10">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-orange">
            Club de fléchettes
          </p>
          <h1 className="mt-3 text-4xl font-bold">{club.name}</h1>
          {club.city && <p className="mt-2">{club.city}</p>}
          {club.description && (
            <p className="mt-6 max-w-2xl whitespace-pre-line">
              {club.description}
            </p>
          )}
        </header>
        {club.schedule && (
          <section>
            <h2 className="text-2xl font-bold">Entraînements</h2>
            <p className="mt-3 whitespace-pre-line">{club.schedule}</p>
          </section>
        )}
        <section>
          <h2 className="text-2xl font-bold">Prochains événements</h2>
          {events.length ? (
            <ul className="mt-4 space-y-3">
              {events.map((e) => (
                <li key={e.id}>
                  <Link
                    className="underline"
                    href={`/e/${encodeURIComponent(e.id)}${localClubQuery}`}
                  >
                    {e.title}
                  </Link>{" "}
                  — {formatDate(e.date)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3">Aucun événement à venir.</p>
          )}
          <Link
            className="mt-5 inline-block underline"
            href={`/agenda${localClubQuery}`}
          >
            Voir l’agenda
          </Link>
        </section>
        {(club.address || club.contactEmail) && (
          <section>
            <h2 className="text-2xl font-bold">Contact</h2>
            {club.address && (
              <p className="mt-3 whitespace-pre-line">{club.address}</p>
            )}
            {club.contactEmail && <p className="mt-3">{club.contactEmail}</p>}
          </section>
        )}
      </article>
    </Shell>
  );
}
