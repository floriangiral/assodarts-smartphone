import { randomUUID } from "node:crypto";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireClubBoard } from "./shared/auth";

type ContributionOption = "member_fee" | "player_license";

function requireAuth(request: { auth?: { uid: string } }): string {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign-in required");
  return request.auth.uid;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function amount(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new HttpsError("invalid-argument", `${field} must be positive`);
  }
  return value as number;
}

function option(value: unknown): ContributionOption {
  if (value === "member_fee" || value === "player_license") return value;
  throw new HttpsError("invalid-argument", "Invalid contribution option");
}

async function activeMembership(clubId: string, uid: string) {
  const snapshot = await getFirestore()
    .collection("memberships")
    .doc(`${clubId}_${uid}`)
    .get();
  const membership = snapshot.data();
  if (membership?.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "Active club membership required",
    );
  }
  return membership;
}

function seasonRef(clubId: string, seasonId: string) {
  return getFirestore()
    .collection("clubs")
    .doc(clubId)
    .collection("contribution_seasons")
    .doc(seasonId);
}

/** Creates or updates the draft for a club's contribution season. */
export const saveContributionSeason = onCall(async (request) => {
  const uid = requireAuth(request);
  const clubId = cleanString(request.data?.clubId);
  const seasonId = cleanString(request.data?.seasonId);
  const label = cleanString(request.data?.label);
  if (!clubId || !seasonId || !label) {
    throw new HttpsError(
      "invalid-argument",
      "clubId, seasonId and label are required",
    );
  }
  await requireClubBoard(clubId, uid);
  const ref = seasonRef(clubId, seasonId);
  const current = await ref.get();
  if (current.exists && current.data()?.status === "published") {
    throw new HttpsError(
      "failed-precondition",
      "A published season cannot be edited",
    );
  }
  await ref.set(
    {
      seasonId,
      label,
      memberAmountCents: amount(
        request.data?.memberAmountCents,
        "memberAmountCents",
      ),
      playerAmountCents: amount(
        request.data?.playerAmountCents,
        "playerAmountCents",
      ),
      status: "draft",
      updatedByMemberId: uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { seasonId, status: "draft" };
});

/** Publishes a configured season and makes it visible to club members. */
export const publishContributionSeason = onCall(async (request) => {
  const uid = requireAuth(request);
  const clubId = cleanString(request.data?.clubId);
  const seasonId = cleanString(request.data?.seasonId);
  if (!clubId || !seasonId) {
    throw new HttpsError(
      "invalid-argument",
      "clubId and seasonId are required",
    );
  }
  await requireClubBoard(clubId, uid);
  const db = getFirestore();
  const ref = seasonRef(clubId, seasonId);
  const season = await ref.get();
  const data = season.data();
  if (data?.status !== "draft") {
    throw new HttpsError(
      "failed-precondition",
      "Only a draft season can be published",
    );
  }
  await db.runTransaction(async (transaction) => {
    const currentRef = db
      .collection("clubs")
      .doc(clubId)
      .collection("contribution_seasons")
      .doc("current");
    transaction.set(
      ref,
      {
        status: "published",
        publishedAt: FieldValue.serverTimestamp(),
        publishedByMemberId: uid,
      },
      { merge: true },
    );
    transaction.set(currentRef, {
      seasonId,
      label: data.label,
      memberAmountCents: data.memberAmountCents,
      playerAmountCents: data.playerAmountCents,
      status: "published",
      publishedAt: FieldValue.serverTimestamp(),
    });
  });
  return { seasonId, status: "published" };
});

/** Lets an active member choose exactly one contribution option for the current season. */
export const chooseContribution = onCall(async (request) => {
  const uid = requireAuth(request);
  const clubId = cleanString(request.data?.clubId);
  const seasonId = cleanString(request.data?.seasonId);
  const selectedOption = option(request.data?.option);
  if (!clubId || !seasonId) {
    throw new HttpsError(
      "invalid-argument",
      "clubId and seasonId are required",
    );
  }
  const membership = await activeMembership(clubId, uid);
  const db = getFirestore();
  const season = await seasonRef(clubId, seasonId).get();
  const seasonData = season.data();
  if (seasonData?.status !== "published") {
    throw new HttpsError(
      "failed-precondition",
      "This contribution season is not published",
    );
  }
  const memberId = cleanString(membership.memberId);
  const choiceRef = seasonRef(clubId, seasonId)
    .collection("choices")
    .doc(memberId);
  const choice = await choiceRef.get();
  if (choice.exists) {
    throw new HttpsError(
      "already-exists",
      "A contribution option was already selected",
    );
  }
  const amountCents =
    selectedOption === "player_license"
      ? seasonData.playerAmountCents
      : seasonData.memberAmountCents;
  const callId = randomUUID();
  const itemId = randomUUID();
  const now = Timestamp.now();
  const callRef = db.collection("payment_calls").doc(callId);
  const itemRef = db.collection("payment_call_items").doc(itemId);
  await db.runTransaction(async (transaction) => {
    transaction.create(choiceRef, {
      memberId,
      option: selectedOption,
      amountCents,
      status: "pending",
      paymentCallId: callId,
      selectedAt: now,
      licenseNumber: null,
    });
    transaction.create(callRef, {
      clubId,
      title: seasonData.label,
      detail:
        selectedOption === "player_license" ? "player_license" : "member_fee",
      category: "cotisation",
      amountCents,
      currency: "eur",
      dueDate: now,
      createdByMemberId: memberId,
      createdAt: now,
      notify: true,
      contributionSeasonId: seasonId,
      contributionOption: selectedOption,
    });
    transaction.create(itemRef, {
      paymentCallId: callId,
      clubId,
      memberId,
      isPaid: false,
      createdAt: now,
      updatedAt: now,
      contributionSeasonId: seasonId,
      contributionOption: selectedOption,
    });
  });
  return { callId, itemId, option: selectedOption, amountCents };
});

/** Adds or changes the optional licence number for a paid player contribution. */
export const updateContributionLicenseNumber = onCall(async (request) => {
  const uid = requireAuth(request);
  const clubId = cleanString(request.data?.clubId);
  const seasonId = cleanString(request.data?.seasonId);
  const memberId = cleanString(request.data?.memberId);
  const licenseNumber = cleanString(request.data?.licenseNumber) || null;
  if (!clubId || !seasonId || !memberId) {
    throw new HttpsError(
      "invalid-argument",
      "Contribution identifiers are required",
    );
  }
  await requireClubBoard(clubId, uid);
  const ref = seasonRef(clubId, seasonId).collection("choices").doc(memberId);
  const choice = await ref.get();
  if (
    choice.data()?.option !== "player_license" ||
    choice.data()?.status !== "paid"
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Only paid player contributions have a licence number",
    );
  }
  await ref.update({ licenseNumber, updatedAt: FieldValue.serverTimestamp() });
  return { memberId, licenseNumber };
});
