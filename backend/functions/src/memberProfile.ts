import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireClubAdmin, requireClubBoard } from "./shared/auth";

const VALID_ROLES = ["admin", "board", "member"];
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

/**
 * Persists profile edits and club-management changes in one server-checked path.
 * Members can edit their own identity/preferences/photo. Board members can manage
 * licence/status. Only club admins can change roles.
 */
export const updateMemberProfile = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign-in required");

  const memberId = cleanString(request.data?.memberId);
  const clubId = cleanString(request.data?.clubId);
  if (!memberId || !clubId)
    throw new HttpsError("invalid-argument", "memberId and clubId are required");

  const db = getFirestore();
  const memberRef = db.collection("members").doc(memberId);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists)
    throw new HttpsError("not-found", "Member profile not found");

  const member = memberSnap.data() ?? {};
  const targetAuthUid = cleanString(member.authUid);
  if (!targetAuthUid)
    throw new HttpsError("failed-precondition", "Member is not linked to auth");

  const membershipRef = db.collection("memberships").doc(`${clubId}_${targetAuthUid}`);
  const membershipSnap = await membershipRef.get();
  const membership = membershipSnap.data();
  if (!membershipSnap.exists || membership?.memberId !== memberId) {
    throw new HttpsError("not-found", "Club membership not found");
  }

  const isSelf = targetAuthUid === request.auth.uid;

  if (!isSelf) {
    await requireClubBoard(clubId, request.auth.uid);
  }

  const memberUpdate: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  for (const field of PROFILE_FIELDS) {
    if (request.data?.[field] === undefined) continue;
    if (!isSelf && field === "photoPath") continue;

    switch (field) {
      case "firstName":
      case "lastName":
      case "email":
        memberUpdate[field] = cleanString(request.data[field], member[field]);
        break;
      case "phone":
      case "photoPath":
        memberUpdate[field] = optionalString(request.data[field]);
        break;
      case "birthDate":
        memberUpdate[field] = optionalDate(request.data[field]);
        break;
      default: {
        const bool = optionalBool(request.data[field]);
        if (bool !== null) memberUpdate[field] = bool;
      }
    }
  }

  if (memberUpdate.firstName || memberUpdate.lastName) {
    const firstName = String(memberUpdate.firstName ?? member.firstName ?? "");
    const lastName = String(memberUpdate.lastName ?? member.lastName ?? "");
    memberUpdate.displayName = `${firstName} ${lastName}`.trim();
  }

  const membershipUpdate: Record<string, unknown> = {};

  if (request.data?.licenseNumber !== undefined) {
    const licenseNumber = optionalString(request.data.licenseNumber);
    if (licenseNumber !== (membership.licenseNumber ?? null)) {
      await requireClubBoard(clubId, request.auth.uid);
      membershipUpdate.licenseNumber = licenseNumber;
    }
  }

  if (request.data?.isActive !== undefined) {
    if (typeof request.data.isActive !== "boolean") {
      throw new HttpsError("invalid-argument", "isActive must be a boolean");
    }
    const status = request.data.isActive ? "active" : "inactive";
    if (status !== membership.status) {
      await requireClubBoard(clubId, request.auth.uid);
      membershipUpdate.status = status;
    }
  }

  if (request.data?.role !== undefined) {
    const role = cleanString(request.data.role);
    if (!VALID_ROLES.includes(role)) {
      throw new HttpsError("invalid-argument", "Invalid role");
    }
    if (role !== normalizedRole(membership.role)) {
      await requireClubAdmin(clubId, request.auth.uid);
      membershipUpdate.role = role;
    }
  }

  const batch = db.batch();
  if (Object.keys(memberUpdate).length > 1) batch.set(memberRef, memberUpdate, { merge: true });
  if (Object.keys(membershipUpdate).length > 0) {
    batch.set(
      membershipRef,
      { ...membershipUpdate, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  await batch.commit();
});
