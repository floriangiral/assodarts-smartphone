import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { isDeepStrictEqual } from "node:util";

// Only explicitly entered public profile fields are copied; never spread source documents.
const profileFields = [
  "city",
  "description",
  "logoUrl",
  "coverUrl",
  "address",
  "contactEmail",
  "socialLinks",
  "schedule",
] as const;
const eventFields = [
  "title",
  "startsAt",
  "endsAt",
  "location",
  "description",
  "category",
  "categories",
  "status",
] as const;

export async function projectClub(clubId: string): Promise<void> {
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const target = db.collection("clubs_public").doc(clubId);
    const [source, existing] = await Promise.all([
      tx.get(db.collection("clubs").doc(clubId)),
      tx.get(target),
    ]);
    if (!source.exists) {
      tx.delete(target);
      return;
    }
    const data = source.data() ?? {};
    const profile =
      data.publicProfile && typeof data.publicProfile === "object"
        ? data.publicProfile
        : {};
    // DECISION: clubs are private until their responsible person explicitly publishes them.
    const result: Record<string, unknown> = {
      name: data.name ?? "",
      slug: data.slug ?? null,
      isPublished: profile.isPublished === true,
    };
    for (const key of profileFields)
      if (profile[key] !== undefined) result[key] = profile[key];
    const previous = { ...existing.data() };
    delete previous.updatedAt;
    if (!existing.exists || !isDeepStrictEqual(previous, result))
      tx.set(target, { ...result, updatedAt: FieldValue.serverTimestamp() });
  });
}

export async function projectEvent(eventId: string): Promise<void> {
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const target = db.collection("events_public").doc(eventId);
    const [source, existing] = await Promise.all([
      tx.get(db.collection("events").doc(eventId)),
      tx.get(target),
    ]);
    if (!source.exists) {
      tx.delete(target);
      return;
    }
    const data = source.data() ?? {};
    // DECISION: missing visibility on existing events means members only.
    const result: Record<string, unknown> = {
      clubId: data.clubId,
      isPublished: data.visibility === "public",
    };
    for (const key of eventFields)
      if (data[key] !== undefined) result[key] = data[key];
    const previous = { ...existing.data() };
    delete previous.updatedAt;
    if (!existing.exists || !isDeepStrictEqual(previous, result))
      tx.set(target, { ...result, updatedAt: FieldValue.serverTimestamp() });
  });
}

export const onPublicClubWritten = onDocumentWritten(
  "clubs/{clubId}",
  async (event) => projectClub(event.params.clubId),
);
export const onPublicEventWritten = onDocumentWritten(
  "events/{eventId}",
  async (event) => projectEvent(event.params.eventId),
);
