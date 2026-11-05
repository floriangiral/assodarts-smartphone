import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { isDeepStrictEqual } from "node:util";

const webRevalidationSecret = defineSecret("WEB_REVALIDATION_SECRET");
const webRevalidationUrl = defineString("WEB_REVALIDATION_URL", {
  default: "",
});

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

async function projectDocument(
  sourceCollection: "clubs" | "events",
  targetCollection: "clubs_public" | "events_public",
  id: string,
  createProjection: (
    data: FirebaseFirestore.DocumentData,
  ) => Record<string, unknown>,
): Promise<void> {
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const target = db.collection(targetCollection).doc(id);
    const [source, existing] = await Promise.all([
      tx.get(db.collection(sourceCollection).doc(id)),
      tx.get(target),
    ]);
    if (!source.exists) {
      tx.delete(target);
      return;
    }
    const result = createProjection(source.data() ?? {});
    const previous = { ...existing.data() };
    delete previous.updatedAt;
    if (!existing.exists || !isDeepStrictEqual(previous, result))
      tx.set(target, { ...result, updatedAt: FieldValue.serverTimestamp() });
  });
}

export async function projectClub(clubId: string): Promise<void> {
  return projectDocument("clubs", "clubs_public", clubId, (data) => {
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
    return result;
  });
}

export async function projectEvent(eventId: string): Promise<void> {
  return projectDocument("events", "events_public", eventId, (data) => {
    // DECISION: missing visibility on existing events means members only.
    const result: Record<string, unknown> = {
      clubId: data.clubId,
      isPublished: data.visibility === "public",
    };
    for (const key of eventFields)
      if (data[key] !== undefined) result[key] = data[key];
    return result;
  });
}

export async function revalidatePublicPages(
  clubId: string,
  eventIds: string[] = [],
  url = webRevalidationUrl.value(),
  secretOverride?: string,
): Promise<void> {
  if (!url) return;
  const secret = secretOverride ?? webRevalidationSecret.value();
  if (!secret) return;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ clubId, eventIds }),
  });
  if (!response.ok) {
    throw new Error(`Web revalidation failed with status ${response.status}`);
  }
}

export const onPublicClubWritten = onDocumentWritten(
  { document: "clubs/{clubId}", secrets: [webRevalidationSecret] },
  async (event) => {
    const clubId = event.params.clubId;
    await projectClub(clubId);
    await revalidatePublicPages(clubId);
  },
);
export const onPublicEventWritten = onDocumentWritten(
  { document: "events/{eventId}", secrets: [webRevalidationSecret] },
  async (event) => {
    const eventId = event.params.eventId;
    const clubId =
      event.data?.after.data()?.clubId ?? event.data?.before.data()?.clubId;
    await projectEvent(eventId);
    if (typeof clubId === "string") {
      await revalidatePublicPages(clubId, [eventId]);
    }
  },
);
