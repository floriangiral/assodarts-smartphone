import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

const VALID_CATEGORIES = ["cotisation", "tenue", "deplacement", "autre"];

type PaymentCallItemInput = {
  id?: unknown;
  memberId?: unknown;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function millisToTimestamp(value: unknown, field: string): Timestamp {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HttpsError("invalid-argument", `${field} must be a timestamp`);
  }
  return Timestamp.fromMillis(value);
}

/** Creates a payment call and its member lines server-side so notifications can fan out reliably. */
export const createPaymentCall = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required");
  }

  const callId = cleanString(request.data?.callId);
  const clubId = cleanString(request.data?.clubId);
  const title = cleanString(request.data?.title);
  const detail = cleanString(request.data?.detail);
  const category = cleanString(request.data?.category);
  const amountCents = request.data?.amountCents;
  const notify = request.data?.notify !== false;
  const rawItems = request.data?.items;

  if (!callId || !clubId || !title) {
    throw new HttpsError("invalid-argument", "callId, clubId and title are required");
  }
  if (!VALID_CATEGORIES.includes(category)) {
    throw new HttpsError("invalid-argument", "Invalid payment category");
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new HttpsError("invalid-argument", "amountCents must be positive");
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new HttpsError("invalid-argument", "At least one recipient is required");
  }

  const db = getFirestore();
  const callerMembershipSnap = await db
    .collection("memberships")
    .doc(`${clubId}_${request.auth.uid}`)
    .get();
  const callerMembership = callerMembershipSnap.data();
  if (
    !callerMembership ||
    callerMembership.status !== "active" ||
    !["admin", "board"].includes(callerMembership.role)
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only the club committee can create payment calls",
    );
  }

  const activeMemberships = await db
    .collection("memberships")
    .where("clubId", "==", clubId)
    .where("status", "==", "active")
    .get();
  const activeMemberIds = new Set(
    activeMemberships.docs
      .map((doc) => doc.data().memberId as unknown)
      .filter((memberId): memberId is string => typeof memberId === "string"),
  );

  const items = (rawItems as PaymentCallItemInput[]).map((item) => ({
    id: cleanString(item.id),
    memberId: cleanString(item.memberId),
  }));
  if (items.some((item) => !item.id || !item.memberId)) {
    throw new HttpsError("invalid-argument", "Every payment line needs an id and memberId");
  }

  const dedupedItems = Array.from(
    new Map(items.map((item) => [item.memberId, item])).values(),
  );
  const invalidMemberIds = dedupedItems
    .map((item) => item.memberId)
    .filter((memberId) => !activeMemberIds.has(memberId));
  if (invalidMemberIds.length > 0) {
    throw new HttpsError(
      "failed-precondition",
      "Every recipient must be an active member of this club",
    );
  }

  const batch = db.batch();
  batch.set(db.collection("payment_calls").doc(callId), {
    clubId,
    title,
    detail,
    category,
    amountCents,
    currency: "eur",
    dueDate: millisToTimestamp(request.data?.dueDateMillis, "dueDateMillis"),
    createdByMemberId: callerMembership.memberId,
    createdAt: millisToTimestamp(request.data?.createdAtMillis, "createdAtMillis"),
    notify,
    updatedAt: FieldValue.serverTimestamp(),
  });

  for (const item of dedupedItems) {
    batch.set(db.collection("payment_call_items").doc(item.id), {
      paymentCallId: callId,
      clubId,
      memberId: item.memberId,
      isPaid: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  return { itemCount: dedupedItems.length };
});
