import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
  const clubId = slugify(rawName);
  const now = FieldValue.serverTimestamp();
  const trialEndsAt = Timestamp.fromDate(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  );

  return await db.runTransaction(async (transaction) => {
    const clubRef = db.collection("clubs").doc(clubId);
    const clubSnapshot = await transaction.get(clubRef);
    if (clubSnapshot.exists) {
      throw new HttpsError("already-exists", `Club already exists: ${clubId}`);
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

    transaction.set(
      clubRef,
      {
        name: rawName,
        createdAt: now,
        subscriptionStatus: "trial",
        trialEndsAt,
      },
      { merge: true },
    );

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
});
