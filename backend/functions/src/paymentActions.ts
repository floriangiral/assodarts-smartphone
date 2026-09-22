import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  getFirestore,
  FieldValue,
  DocumentReference,
  DocumentData,
} from "firebase-admin/firestore";
import { requireClubBoard } from "./shared/auth";

async function loadItem(
  itemId: string,
): Promise<{ ref: DocumentReference; data: DocumentData }> {
  const ref = getFirestore().collection("payment_call_items").doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Payment line not found");
  return { ref, data: snap.data()! };
}

async function requirePaymentOwner(
  data: DocumentData,
  uid: string,
): Promise<void> {
  const clubId = String(data.clubId ?? "").trim();
  const memberId = String(data.memberId ?? "").trim();
  if (!clubId || !memberId) {
    throw new HttpsError(
      "failed-precondition",
      "Payment line is missing its ownership data",
    );
  }

  const membership = (
    await getFirestore().collection("memberships").doc(`${clubId}_${uid}`).get()
  ).data();

  if (membership?.status !== "active" || membership.memberId !== memberId) {
    throw new HttpsError("permission-denied", "This payment is not yours");
  }
}

async function markContributionPaid(data: DocumentData): Promise<void> {
  const seasonId = String(data.contributionSeasonId ?? "").trim();
  const memberId = String(data.memberId ?? "").trim();
  const option = String(data.contributionOption ?? "").trim();
  const clubId = String(data.clubId ?? "").trim();
  if (!seasonId || !memberId || !clubId || !option) return;
  await getFirestore()
    .collection("clubs")
    .doc(clubId)
    .collection("contribution_seasons")
    .doc(seasonId)
    .collection("choices")
    .doc(memberId)
    .set(
      { status: "paid", paidAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  const memberships = await getFirestore()
    .collection("memberships")
    .where("memberId", "==", memberId)
    .get();
  const membership = memberships.docs.find(
    (doc) => doc.data().clubId === clubId,
  );
  if (membership) {
    await membership.ref.set(
      {
        contributionSeasonId: seasonId,
        contributionStatus: option === "player_license" ? "player" : "member",
      },
      { merge: true },
    );
  }
}

/** A member self-declares a cash/transfer payment, pending board validation. */
export const declarePayment = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign-in required");

  const itemId = request.data?.itemId as string | undefined;
  const method = request.data?.method as string | undefined;
  const reference = (request.data?.reference as string | undefined) ?? null;
  if (!itemId || !method)
    throw new HttpsError("invalid-argument", "itemId and method are required");

  const { ref, data } = await loadItem(itemId);
  await requirePaymentOwner(data, request.auth.uid);
  if (data.isPaid)
    throw new HttpsError(
      "failed-precondition",
      "This payment is already settled",
    );

  await ref.set(
    {
      method,
      reference,
      declaredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
});

/** The board confirms a declared payment was actually received. */
export const validatePayment = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign-in required");

  const itemId = request.data?.itemId as string | undefined;
  if (!itemId) throw new HttpsError("invalid-argument", "itemId is required");

  const { ref, data } = await loadItem(itemId);
  await requireClubBoard(data.clubId, request.auth.uid);

  await ref.set(
    {
      isPaid: true,
      paidAt: FieldValue.serverTimestamp(),
      declaredAt: null,
      validatedByMemberId: request.auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await markContributionPaid(data);
});

/** The member withdraws their declaration, or the board rejects it. */
export const cancelPaymentDeclaration = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign-in required");

  const itemId = request.data?.itemId as string | undefined;
  if (!itemId) throw new HttpsError("invalid-argument", "itemId is required");

  const { ref, data } = await loadItem(itemId);
  try {
    await requirePaymentOwner(data, request.auth.uid);
  } catch (err) {
    if (!(err instanceof HttpsError) || err.code !== "permission-denied") {
      throw err;
    }
    await requireClubBoard(data.clubId, request.auth.uid);
  }

  await ref.set(
    {
      declaredAt: null,
      method: null,
      reference: null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
});
