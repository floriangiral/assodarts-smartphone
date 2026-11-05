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
  { revalidate: 60, tags: ["club-slug"] },
);

export interface PublicClub {
  id: string;
  slug: string;
  name: string;
  logoUrl: string;
  coverUrl: string;
  description: string;
  city: string;
  address: string;
  contactEmail: string;
  schedule: string;
  socialLinks: Array<{ label: string; url: string }>;
}

async function readPublishedClub(clubId: string): Promise<PublicClub | null> {
  const snapshot = await db().collection("clubs_public").doc(clubId).get();
  const data = snapshot.data();
  if (
    !snapshot.exists ||
    data?.isPublished !== true ||
    typeof data.slug !== "string" ||
    typeof data.name !== "string"
  )
    return null;
  return {
    id: snapshot.id,
    slug: data.slug,
    name: data.name,
    logoUrl: publicHttpsUrl(data.logoUrl),
    coverUrl: publicHttpsUrl(data.coverUrl),
    description: text(data.description),
    city: text(data.city),
    address: text(data.address),
    contactEmail: text(data.contactEmail),
    schedule: text(data.schedule),
    socialLinks: publicLinks(data.socialLinks),
  };
}

export async function getPublishedClubById(clubId: string): Promise<PublicClub> {
  const club = await readPublishedClub(clubId);
  if (!club) notFound();
  return club;
}

export async function getClub(slug: string, path = ""): Promise<PublicClub> {
  const entry = await lookup(slug);
  if (!entry) notFound();
  // Publication is deliberately read fresh, so cached slug mappings cannot leak an unpublished club.
  const club = await readPublishedClub(entry.clubId);
  if (!club) notFound();
  if (entry.status !== "active" || club.slug !== slug) {
    const root = process.env.ROOT_DOMAIN || "localhost";
    const protocol = root === "localhost" ? "http" : "https";
    const port = root === "localhost" ? ":3000" : "";
    permanentRedirect(`${protocol}://${club.slug}.${root}${port}${path}`);
  }
  return club;
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function publicHttpsUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function publicLinks(value: unknown): Array<{ label: string; url: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value)
    .map(([label, url]) => ({ label, url: publicHttpsUrl(url) }))
    .filter((link) => link.url.length > 0);
}

export type PublicEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  date: Date | null;
  endsAt: Date | null;
  category: string;
  categories: string[];
  status: string;
};
type CachedPublicEvent = Omit<PublicEvent, "date" | "endsAt"> & {
  date: string | null;
  endsAt: string | null;
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
    endsAt: data.endsAt instanceof Timestamp ? data.endsAt.toDate() : null,
    category: text(data.category),
    categories: Array.isArray(data.categories)
      ? data.categories.filter((value): value is string => typeof value === "string")
      : [],
    status: text(data.status),
  };
}
export async function getEvents(clubId: string): Promise<PublicEvent[]> {
  const cachedEvents = await unstable_cache(
    async () => {
      const docs = await db()
        .collection("events_public")
        .where("clubId", "==", clubId)
        .where("isPublished", "==", true)
        .get();
      return docs.docs.map((snapshot) => {
        const event = eventFrom(snapshot.id, snapshot.data());
        return {
          ...event,
          date: event.date?.toISOString() ?? null,
          endsAt: event.endsAt?.toISOString() ?? null,
        };
      }).sort((a, b) => (a.date ? Date.parse(a.date) : 0) - (b.date ? Date.parse(b.date) : 0));
    },
    ["public-events", clubId],
    { revalidate: 60, tags: [`public-events-${clubId}`] },
  )();
  return (cachedEvents as CachedPublicEvent[]).map((event) => ({
    ...event,
    date: event.date ? new Date(event.date) : null,
    endsAt: event.endsAt ? new Date(event.endsAt) : null,
  }));
}
export async function getEvent(
  clubId: string,
  id: string,
): Promise<PublicEvent> {
  if (!id || id.includes("/")) notFound();
  const cachedEvent = await unstable_cache(
    async () => {
      const snapshot = await db().collection("events_public").doc(id).get();
      const data = snapshot.data();
      if (!snapshot.exists || data?.clubId !== clubId || data.isPublished !== true) {
        return null;
      }
      const event = eventFrom(snapshot.id, data);
      return {
        ...event,
        date: event.date?.toISOString() ?? null,
        endsAt: event.endsAt?.toISOString() ?? null,
      };
    },
    ["public-event", clubId, id],
    { revalidate: 60, tags: [`public-event-${id}`, `public-events-${clubId}`] },
  )();
  if (!cachedEvent) notFound();
  const event = cachedEvent as CachedPublicEvent;
  return {
    ...event,
    date: event.date ? new Date(event.date) : null,
    endsAt: event.endsAt ? new Date(event.endsAt) : null,
  };
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
