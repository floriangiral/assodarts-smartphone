import { randomUUID } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requirePlatformAdmin } from "./shared/auth";

function requireAuth(request: { auth?: { uid: string } }): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required");
  }
  return request.auth.uid;
}

function parseClubIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map(String)
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

function parseExpiry(value: unknown): Date {
  const date =
    value instanceof Date
      ? value
      : value && typeof (value as { toDate?: unknown }).toDate === "function"
        ? (value as { toDate: () => Date }).toDate()
        : new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    throw new HttpsError("invalid-argument", "expiresAt must be a valid date");
  }
  return date;
}

export const broadcastAnnouncement = onCall(async (request) => {
  const uid = requireAuth(request);
  await requirePlatformAdmin(uid);

  const title = String(request.data?.title ?? "").trim();
  const body = String(request.data?.body ?? "").trim();
  const audience = String(request.data?.audience ?? "").trim();
  if (!title || !body || !["all", "admins"].includes(audience)) {
    throw new HttpsError(
      "invalid-argument",
      "title, body and audience are required",
    );
  }

  const id = randomUUID();
  await getFirestore().collection("platform_announcements").doc(id).set({
    title,
    body,
    audience,
    publishedAt: FieldValue.serverTimestamp(),
    publishedBy: uid,
  });
  return { id };
});

export const createCoupon = onCall(async (request) => {
  const uid = requireAuth(request);
  await requirePlatformAdmin(uid);

  const code = String(request.data?.code ?? "")
    .trim()
    .toUpperCase();
  const percent = Number(request.data?.percent);
  const clubIds = parseClubIds(request.data?.clubIds);
  const expiresAt = parseExpiry(request.data?.expiresAt);
  const autoRenew = Boolean(request.data?.autoRenew);

  if (!code || !Number.isInteger(percent) || percent < 1 || percent > 100) {
    throw new HttpsError(
      "invalid-argument",
      "code and percent between 1 and 100 are required",
    );
  }

  const db = getFirestore();
  const couponId = randomUUID();
  await db.runTransaction(async (transaction) => {
    const duplicate = await transaction.get(
      db.collection("coupons").where("code", "==", code).limit(1),
    );
    if (!duplicate.empty) {
      throw new HttpsError("already-exists", "Coupon code already exists");
    }

    const clubRefs = clubIds.map((clubId) =>
      db.collection("clubs").doc(clubId),
    );
    const clubSnapshots = [];
    for (const clubRef of clubRefs) {
      clubSnapshots.push(await transaction.get(clubRef));
    }

    transaction.set(db.collection("coupons").doc(couponId), {
      code,
      percent,
      expiresAt,
      clubIds,
      autoRenew,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
    });

    clubSnapshots.forEach((snapshot, index) => {
      if (snapshot.exists) {
        transaction.set(clubRefs[index], { couponCode: code }, { merge: true });
      }
    });
  });

  return { couponId };
});

export const deleteCoupon = onCall(async (request) => {
  const uid = requireAuth(request);
  await requirePlatformAdmin(uid);
  const couponId = String(request.data?.couponId ?? "").trim();
  if (!couponId) {
    throw new HttpsError("invalid-argument", "couponId is required");
  }

  const db = getFirestore();
  await db.runTransaction(async (transaction) => {
    const couponRef = db.collection("coupons").doc(couponId);
    const couponSnapshot = await transaction.get(couponRef);
    if (!couponSnapshot.exists) {
      throw new HttpsError("not-found", "Coupon not found");
    }

    const coupon = couponSnapshot.data() ?? {};
    const code = String(coupon.code ?? "");
    const clubIds = parseClubIds(coupon.clubIds);
    const clubRefs = clubIds.map((clubId) =>
      db.collection("clubs").doc(clubId),
    );
    const clubSnapshots = [];
    for (const clubRef of clubRefs) {
      clubSnapshots.push(await transaction.get(clubRef));
    }

    transaction.delete(couponRef);
    clubSnapshots.forEach((snapshot, index) => {
      if (snapshot.exists && snapshot.data()?.couponCode === code) {
        transaction.set(clubRefs[index], { couponCode: null }, { merge: true });
      }
    });
  });

  return { deleted: true };
});
