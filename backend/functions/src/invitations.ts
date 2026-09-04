import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireClubBoard } from "./shared/auth";

const VALID_ROLES = ["admin", "board", "member"];

/** The board invites someone by email, with the role they'll join with. */
export const createInvitation = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign-in required");

  const clubId = request.data?.clubId as string | undefined;
  const rawEmail = request.data?.email as string | undefined;
  const role = (request.data?.role as string | undefined) ?? "member";
  const licenseNumber =
    (request.data?.licenseNumber as string | undefined) ?? null;

  if (!clubId || !rawEmail)
    throw new HttpsError("invalid-argument", "clubId and email are required");
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes("@"))
    throw new HttpsError("invalid-argument", "A valid email is required");
  if (!VALID_ROLES.includes(role))
    throw new HttpsError("invalid-argument", "Invalid role");

  await requireClubBoard(clubId, request.auth.uid);

  await getFirestore().collection("invitations").doc(`${clubId}_${email}`).set(
    {
      clubId,
      email,
      role,
      licenseNumber,
      status: "pending",
      invitedByMemberId: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      acceptedAt: null,
      acceptedByMemberId: null,
    },
    { merge: true },
  );
});

/** The board withdraws a pending invitation before it is accepted. */
export const revokeInvitation = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign-in required");

  const clubId = request.data?.clubId as string | undefined;
  const rawEmail = request.data?.email as string | undefined;
  if (!clubId || !rawEmail)
    throw new HttpsError("invalid-argument", "clubId and email are required");

  await requireClubBoard(clubId, request.auth.uid);

  const email = rawEmail.trim().toLowerCase();
  await getFirestore()
    .collection("invitations")
    .doc(`${clubId}_${email}`)
    .delete();
});

/**
 * Called by the client right after sign-in/sign-up: joins every club that
 * invited this email address, and links `members.clubId` to the first one if
 * the member isn't already linked to a club.
 */
export const acceptInvitation = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign-in required");

  const email = request.auth.token.email as string | undefined;
  if (!email) return { joinedClubId: null };

  const db = getFirestore();
  const pending = await db
    .collection("invitations")
    .where("email", "==", email.toLowerCase())
    .where("status", "==", "pending")
    .get();

  if (pending.empty) return { joinedClubId: null };

  const memberSnapshot = await db
    .collection("members")
    .where("authUid", "==", request.auth.uid)
    .limit(1)
    .get();
  const member = memberSnapshot.docs[0];
  if (!member)
    throw new HttpsError("failed-precondition", "Member profile not found");
  const memberId = member.id;

  let firstClubId: string | null = null;

  for (const doc of pending.docs) {
    const invitation = doc.data();
    const clubId = invitation.clubId as string;
    firstClubId ??= clubId;

    await db
      .collection("memberships")
      .doc(`${clubId}_${request.auth.uid}`)
      .set(
        {
          clubId,
          memberId,
          authUid: request.auth.uid,
          role: invitation.role,
          status: "active",
          joinDate: FieldValue.serverTimestamp(),
          licenseNumber: invitation.licenseNumber ?? null,
        },
        { merge: true },
      );

    await doc.ref.set(
      {
        status: "accepted",
        acceptedAt: FieldValue.serverTimestamp(),
        acceptedByMemberId: request.auth.uid,
      },
      { merge: true },
    );
  }

  const existingClubId = member.data()?.clubId as
    string | null | undefined;
  if (!existingClubId) {
    await member.ref.set({ clubId: firstClubId }, { merge: true });
  }

  return { joinedClubId: firstClubId };
});
