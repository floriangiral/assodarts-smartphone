import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { requireNotPlatformAdmin } from "./shared/auth";
import { clubSlugSchema, slugify } from "./shared/club-slug";

export const createClub = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required");
  }

  const rawName = String(request.data?.name ?? "").trim();
  if (!rawName) {
    throw new HttpsError("invalid-argument", "Club name is required");
  }
  if (rawName.length < 2 || rawName.length > 80) {
    throw new HttpsError("invalid-argument", "Club name length is invalid");
  }

  const db = getFirestore();
  const uid = request.auth.uid;
  await requireNotPlatformAdmin(uid);

  const memberQuery = await db
    .collection("members")
    .where("authUid", "==", uid)
    .limit(1)
    .get();

  if (memberQuery.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Member profile not found. Call createSelfMember before createClub.",
    );
  }

  const memberDoc = memberQuery.docs[0];
  const clubId = randomUUID();
  const now = FieldValue.serverTimestamp();
  const trialEndsAt = Timestamp.fromDate(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  );

  const proposed = slugify(rawName);
  const base = clubSlugSchema.safeParse(proposed).success
    ? proposed
    : `club-${clubId.slice(0, 8)}`;
  for (let suffix = 0; suffix < 100; suffix++) {
    const tail = suffix === 0 ? "" : `-${suffix + 1}`;
    const slug = `${base.slice(0, 40 - tail.length).replace(/-+$/, "")}${tail}`;
    try {
      return await db.runTransaction(async (transaction) => {
        const clubRef = db.collection("clubs").doc(clubId);
        const clubSnapshot = await transaction.get(clubRef);
        if (clubSnapshot.exists) {
          throw new HttpsError(
            "already-exists",
            `Club already exists: ${clubId}`,
          );
        }

        const memberRef = db.collection("members").doc(memberDoc.id);
        const memberSnapshot = await transaction.get(memberRef);
        if (!memberSnapshot.exists) {
          throw new HttpsError(
            "failed-precondition",
            "Member profile document does not exist. Create it before calling createClub.",
          );
        }

        const memberData = memberSnapshot.data() ?? {};
        const existingClubId = String(memberData.clubId ?? "").trim();

        const slugRef = db.collection("club_slugs").doc(slug);
        const slugSnapshot = await transaction.get(slugRef);
        if (slugSnapshot.exists)
          throw new HttpsError("already-exists", "Slug unavailable");

        transaction.set(
          clubRef,
          {
            name: rawName,
            slug,
            displayName: rawName,
            createdAt: now,
            subscriptionStatus: "trial",
            trialEndsAt,
          },
          { merge: true },
        );

        transaction.set(slugRef, { clubId, status: "active", createdAt: now });

        transaction.set(
          db.collection("memberships").doc(`${clubId}_${uid}`),
          {
            clubId,
            memberId: memberDoc.id,
            authUid: uid,
            role: "admin",
            status: "active",
            joinDate: now,
            licenseNumber: null,
          },
          { merge: true },
        );

        transaction.set(
          memberRef,
          {
            clubId: existingClubId === "" ? clubId : existingClubId,
            defaultClubId: clubId,
          },
          { merge: true },
        );

        return { clubId };
      });
    } catch (error) {
      if (
        !(error instanceof HttpsError) ||
        error.message !== "Slug unavailable"
      )
        throw error;
    }
  }
  throw new HttpsError("resource-exhausted", "Could not allocate a club slug");
});
