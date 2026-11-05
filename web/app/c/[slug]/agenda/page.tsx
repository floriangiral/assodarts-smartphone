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
    <Shell>
      <h1 className="text-4xl font-bold">Agenda de {club.name}</h1>
      {[
        ["À venir", upcoming],
        ["Événements passés", past],
      ].map(([label, list]) => (
        <section className="mt-10" key={label as string}>
          <h2 className="text-2xl font-bold">{label as string}</h2>
          {(list as typeof events).length ? (
            <ul className="mt-4 space-y-3">
              {(list as typeof events).map((e) => (
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
            <p className="mt-3">Aucun événement.</p>
          )}
        </section>
      ))}
    </Shell>
  );
}
