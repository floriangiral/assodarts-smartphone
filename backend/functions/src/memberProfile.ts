import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import {
  requireClubAdmin,
  requireClubBoard,
} from "./shared/auth";

const VALID_ROLES = new Set(["admin", "board", "member"]);
const PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "birthDate",
  "photoPath",
  "notifyAnnouncements",
  "notifyEvents",
  "notifyPayments",
  "notifyTournaments",
];

function cleanString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = cleanString(value);
  return cleaned === "" ? null : cleaned;
}

function optionalBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function optionalDate(value: unknown): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizedRole(value: unknown): string {
  const role = cleanString(value);
  return role === "bureau" || role === "treasurer" ? "board" : role;
}

function requireSignedIn(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError("unauthenticated", "Sign-in required");
  return auth.uid;
}

function requiredIds(data: Record<string, unknown>): {
  memberId: string;
  clubId: string;
} {
  const memberId = cleanString(data.memberId);
  const clubId = cleanString(data.clubId);
  if (!memberId || !clubId) {
    throw new HttpsError(
      "invalid-argument",
      "memberId and clubId are required",
    );
  }
  return { memberId, clubId };
}

async function loadProfileContext(
  db: FirebaseFirestore.Firestore,
  memberId: string,
  clubId: string,
) {
  const memberRef = db.collection("members").doc(memberId);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    throw new HttpsError("not-found", "Member profile not found");
  }

  const member = memberSnap.data() ?? {};
  const targetAuthUid = cleanString(member.authUid);
  if (!targetAuthUid) {
    throw new HttpsError("failed-precondition", "Member is not linked to auth");
  }

  const membershipRef = db
    .collection("memberships")
    .doc(`${clubId}_${targetAuthUid}`);
  const membershipSnap = await membershipRef.get();
  const membership = membershipSnap.data();
  if (!membershipSnap.exists || membership?.memberId !== memberId) {
    throw new HttpsError("not-found", "Club membership not found");
  }

  return { memberRef, member, targetAuthUid, membershipRef, membership };
}

function profileFieldValue(
  field: string,
  data: Record<string, unknown>,
  member: FirebaseFirestore.DocumentData,
): unknown {
  switch (field) {
    case "firstName":
    case "lastName":
    case "email":
      return cleanString(data[field], member[field]);
    case "phone":
    case "photoPath":
      return optionalString(data[field]);
    case "birthDate":
      return optionalDate(data[field]);
    default:
      return optionalBool(data[field]);
  }
}

function buildMemberUpdate(
  data: Record<string, unknown>,
  member: FirebaseFirestore.DocumentData,
  isSelf: boolean,
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  for (const field of PROFILE_FIELDS) {
    if (data[field] === undefined || (!isSelf && field === "photoPath")) {
      continue;
    }
    const value = profileFieldValue(field, data, member);
    if (typeof value === "boolean" || value !== null) update[field] = value;
  }

  if (update.firstName || update.lastName) {
    const firstName = String(update.firstName ?? member.firstName ?? "");
    const lastName = String(update.lastName ?? member.lastName ?? "");
    update.displayName = `${firstName} ${lastName}`.trim();
  }

  return update;
}

async function buildMembershipUpdate(
  data: Record<string, unknown>,
  membership: FirebaseFirestore.DocumentData,
  clubId: string,
  callerUid: string,
): Promise<Record<string, unknown>> {
  const update: Record<string, unknown> = {};

  if (data.licenseNumber !== undefined) {
    const licenseNumber = optionalString(data.licenseNumber);
    if (licenseNumber !== (membership.licenseNumber ?? null)) {
      await requireClubBoard(clubId, callerUid);
      update.licenseNumber = licenseNumber;
    }
  }

  if (data.isActive !== undefined) {
    if (typeof data.isActive !== "boolean") {
      throw new HttpsError("invalid-argument", "isActive must be a boolean");
    }
    const status = data.isActive ? "active" : "inactive";
    if (status !== membership.status) {
      await requireClubBoard(clubId, callerUid);
      update.status = status;
    }
  }

  if (data.role !== undefined) {
    const role = cleanString(data.role);
    if (!VALID_ROLES.has(role)) {
      throw new HttpsError("invalid-argument", "Invalid role");
    }
    if (role !== normalizedRole(membership.role)) {
      await requireClubAdmin(clubId, callerUid);
      update.role = role;
    }
  }

  return update;
}

/** Creates the authenticated user's member profile exactly once. */
export const createSelfMember = onCall(async (request) => {
  const auth = request.auth;
  const uid = requireSignedIn(auth);
  const email = cleanString(auth?.token.email).toLowerCase();
  const firstName = cleanString(request.data?.firstName);
  const lastName = cleanString(request.data?.lastName);
  const phone = optionalString(request.data?.phone);
  const displayName = `${firstName} ${lastName}`.trim();

  if (!email.includes("@")) {
    throw new HttpsError("invalid-argument", "A valid email is required");
  }
  if (!firstName || !lastName) {
    throw new HttpsError(
      "invalid-argument",
      "First name and last name are required",
    );
  }
  if (
    firstName.length > 80 ||
    lastName.length > 80 ||
    displayName.length > 160 ||
    (phone !== null && phone.length > 30)
  ) {
    throw new HttpsError("invalid-argument", "Profile fields are too long");
  }

  const db = getFirestore();
  const existing = await db
    .collection("members")
    .where("authUid", "==", uid)
    .limit(1)
    .get();
  if (!existing.empty) {
    return { memberId: existing.docs[0].id, created: false };
  }

  const memberId = randomUUID();
  await db.collection("members").doc(memberId).set({
    authUid: uid,
    clubId: null,
    defaultClubId: null,
    firstName,
    lastName,
    displayName,
    email,
    phone,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
  });

  return { memberId, created: true };
});

/**
 * Persists profile edits and club-management changes in one server-checked path.
 * Members can edit their own identity/preferences/photo. Board members can manage
 * licence/status. Only club admins can change roles.
 */
export const updateMemberProfile = onCall(async (request) => {
  const callerUid = requireSignedIn(request.auth);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const { memberId, clubId } = requiredIds(data);
  const db = getFirestore();
  const { memberRef, member, targetAuthUid, membershipRef, membership } =
    await loadProfileContext(db, memberId, clubId);
  const isSelf = targetAuthUid === callerUid;

  if (!isSelf) {
    await requireClubBoard(clubId, callerUid);
  }

  const memberUpdate = buildMemberUpdate(data, member, isSelf);
  const membershipUpdate = await buildMembershipUpdate(
    data,
    membership,
    clubId,
    callerUid,
  );

  const batch = db.batch();
  if (Object.keys(memberUpdate).length > 1)
    batch.set(memberRef, memberUpdate, { merge: true });
  if (Object.keys(membershipUpdate).length > 0) {
    batch.set(
      membershipRef,
      { ...membershipUpdate, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  await batch.commit();
});
