import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  requireClubAdmin,
  requireClubBoard,
  requireEmailNotPlatformAdmin,
  requireNotPlatformAdmin,
} from "./shared/auth";

const VALID_ROLES = ["admin", "board", "member"];
const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function timestampMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return null;
}

function pendingInvitationIsUsable(
  invitation: Record<string, unknown>,
): boolean {
  if (invitation.status !== "pending") return false;
  const expiresAtMillis = timestampMillis(invitation.expiresAt);
  return expiresAtMillis !== null && expiresAtMillis > Date.now();
}

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
  if (role !== "member") {
    await requireClubAdmin(clubId, request.auth.uid);
  }
  await requireEmailNotPlatformAdmin(email);

  const db = getFirestore();
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITATION_TTL_MS);
  const baseUrl =
    process.env.ASSODARTS_INVITE_BASE_URL ?? "https://assodarts.app/invite";
  const inviteUrl = `${baseUrl}?club=${encodeURIComponent(
    clubId,
  )}&email=${encodeURIComponent(email)}`;

  await db.collection("invitations").doc(`${clubId}_${email}`).set(
    {
      clubId,
      email,
      role,
      licenseNumber,
      inviteUrl,
      status: "pending",
      invitedByMemberId: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      acceptedAt: null,
      acceptedByMemberId: null,
    },
    { merge: true },
  );

  await db.collection("mail").add({
    to: [email],
    message: {
      subject: "Invitation Assodarts",
      text:
        "Votre club vous invite sur Assodarts. " +
        "Creez votre compte avec cette adresse email pour rejoindre le club : " +
        inviteUrl,
      html:
        "<p>Votre club vous invite sur Assodarts.</p>" +
        "<p>Creez votre compte avec cette adresse email pour rejoindre le club.</p>" +
        `<p><a href="${inviteUrl}">Rejoindre Assodarts</a></p>`,
    },
    createdAt: FieldValue.serverTimestamp(),
    invitationId: `${clubId}_${email}`,
  });

  return { inviteUrl, expiresAtMillis: expiresAt.toMillis() };
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
  await requireNotPlatformAdmin(request.auth.uid);

  const db = getFirestore();
  const invitationSnapshots = await Promise.all(
    ["pending", "accepted"].map((status) =>
      db
        .collection("invitations")
        .where("email", "==", email.toLowerCase())
        .where("status", "==", status)
        .get(),
    ),
  );
  const invitationDocs = invitationSnapshots
    .flatMap((snapshot) => snapshot.docs)
    .filter((doc) => {
      const invitation = doc.data();
      return (
        invitation.status === "accepted" ||
        pendingInvitationIsUsable(invitation)
      );
    });

  if (invitationDocs.length === 0) return { joinedClubId: null };

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

  for (const doc of invitationDocs) {
    const invitation = doc.data();
    const clubId = invitation.clubId as string;
    firstClubId ??= clubId;
    const previousAuthUid = invitation.acceptedByMemberId as string | undefined;
    const membershipRef = db
      .collection("memberships")
      .doc(`${clubId}_${request.auth.uid}`);

    await membershipRef.set(
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

    if (previousAuthUid && previousAuthUid !== request.auth.uid) {
      await db
        .collection("memberships")
        .doc(`${clubId}_${previousAuthUid}`)
        .delete();
    }

    await doc.ref.set(
      {
        status: "accepted",
        acceptedAt: FieldValue.serverTimestamp(),
        acceptedByMemberId: request.auth.uid,
      },
      { merge: true },
    );
  }

  const existingClubId = member.data()?.clubId as string | null | undefined;
  if (!existingClubId) {
    await member.ref.set(
      { clubId: firstClubId, defaultClubId: firstClubId },
      { merge: true },
    );
  }

  return { joinedClubId: firstClubId };
});
