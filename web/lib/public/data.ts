import "server-only";
import { unstable_cache } from "next/cache";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { clubSlugSchema } from "@assodarts/shared";
import { notFound, permanentRedirect } from "next/navigation";
import { serverApp } from "@/lib/firebase/server";

const db = () => getFirestore(serverApp());
const lookup = unstable_cache(
  async (slug: string) => {
    if (!clubSlugSchema.safeParse(slug).success) return null;
    const doc = await db().collection("club_slugs").doc(slug).get();
    const data = doc.data();
    return doc.exists && typeof data?.clubId === "string"
      ? { clubId: data.clubId, status: data.status }
      : null;
  },
  ["club-slug"],
  { revalidate: 60 },
);

export async function getClub(slug: string, path = "") {
  const entry = await lookup(slug);
  if (!entry) notFound();
  // Publication is deliberately read fresh, so cached slug mappings cannot leak an unpublished club.
  const snapshot = await db()
    .collection("clubs_public")
    .doc(entry.clubId)
    .get();
  const data = snapshot.data();
  if (
    !snapshot.exists ||
    data?.isPublished !== true ||
    typeof data.slug !== "string" ||
    typeof data.name !== "string"
  )
    notFound();
  if (entry.status !== "active" || data.slug !== slug) {
    const root = process.env.ROOT_DOMAIN || "localhost";
    const protocol = root === "localhost" ? "http" : "https";
    const port = root === "localhost" ? ":3000" : "";
    permanentRedirect(`${protocol}://${data.slug}.${root}${port}${path}`);
  }
  return {
    id: entry.clubId,
    slug: data.slug as string,
    name: data.name as string,
    description: text(data.description),
    city: text(data.city),
    address: text(data.address),
    contactEmail: text(data.contactEmail),
    schedule: text(data.schedule),
  };
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
export type PublicEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  date: Date | null;
};
function eventFrom(
  id: string,
  data: FirebaseFirestore.DocumentData,
): PublicEvent {
  return {
    id,
    title: text(data.title),
    description: text(data.description),
    location: text(data.location),
    date: data.startsAt instanceof Timestamp ? data.startsAt.toDate() : null,
  };
}
export async function getEvents(clubId: string): Promise<PublicEvent[]> {
  const docs = await db()
    .collection("events_public")
    .where("clubId", "==", clubId)
    .where("isPublished", "==", true)
    .get();
  return docs.docs
    .map((doc) => eventFrom(doc.id, doc.data()))
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
}
export async function getEvent(
  clubId: string,
  id: string,
): Promise<PublicEvent> {
  if (!id || id.includes("/")) notFound();
  const doc = await db().collection("events_public").doc(id).get();
  const data = doc.data();
  if (!doc.exists || data?.clubId !== clubId || data.isPublished !== true)
    notFound();
  return eventFrom(doc.id, data);
}
export function formatDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(date)
    : "Date à préciser";
}
export function canonical(slug: string, path = "") {
  const root = process.env.ROOT_DOMAIN || "localhost";
  return `${root === "localhost" ? "http" : "https"}://${slug}.${root}${root === "localhost" ? ":3000" : ""}${path || "/"}`;
}
export const robots = () =>
  process.env.ROOT_DOMAIN?.startsWith("staging.")
    ? { index: false, follow: false }
    : undefined;

export function splitEvents(events: PublicEvent[]) {
  const now = Date.now();
  return {
    upcoming: events.filter((e) => e.date && e.date.getTime() >= now),
    past: events.filter((e) => !e.date || e.date.getTime() < now).reverse(),
  };
}
