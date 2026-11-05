import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { clubSlugSchema } from "./shared/club-slug";

export const setClubSlug = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign-in required");
  const clubId = request.data?.clubId;
  const slug = request.data?.slug;
  if (
    typeof clubId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(clubId) ||
    !clubSlugSchema.safeParse(slug).success
  ) {
    throw new HttpsError("invalid-argument", "Invalid club or slug");
  }
  const uid = request.auth.uid;
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const clubRef = db.collection("clubs").doc(clubId);
    const slugRef = db.collection("club_slugs").doc(slug);
    const [club, entry, membership, platform] = await Promise.all([
      tx.get(clubRef),
      tx.get(slugRef),
      tx.get(db.collection("memberships").doc(`${clubId}_${uid}`)),
      tx.get(db.collection("platform_admins").doc(uid)),
    ]);
    const role = membership.data();
    if (
      !platform.exists &&
      !(role?.status === "active" && ["admin", "board"].includes(role.role))
    )
      throw new HttpsError(
        "permission-denied",
        "Club committee access required",
      );
    if (!club.exists) throw new HttpsError("not-found", "Club not found");
    if (entry.exists && entry.data()?.clubId !== clubId)
      throw new HttpsError("already-exists", "Slug unavailable");
    const previous = club.data()?.slug;
    if (previous === slug) return;
    const old =
      typeof previous === "string" && clubSlugSchema.safeParse(previous).success
        ? await tx.get(db.collection("club_slugs").doc(previous))
        : null;
    // DECISION: aliases are retained indefinitely to preserve printed QR codes.
    if (old?.exists && old.data()?.clubId === clubId)
      tx.update(old.ref, { status: "alias" });
    tx.set(slugRef, {
      clubId,
      status: "active",
      createdAt: entry.data()?.createdAt ?? FieldValue.serverTimestamp(),
    });
    tx.update(clubRef, { slug });
  });
  return { slug };
});
