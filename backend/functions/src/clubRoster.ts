import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

type MembershipData = {
  clubId?: unknown;
  memberId?: unknown;
  authUid?: unknown;
  role?: unknown;
  status?: unknown;
  joinDate?: unknown;
  licenseNumber?: unknown;
};

type MemberData = {
  authUid?: unknown;
  clubId?: unknown;
  defaultClubId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  birthDate?: unknown;
  photoPath?: unknown;
  notifyAnnouncements?: unknown;
  notifyEvents?: unknown;
  notifyPayments?: unknown;
  notifyTournaments?: unknown;
  status?: unknown;
};

function cleanString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function optionalString(value: unknown): string | null {
  const cleaned = cleanString(value);
  return cleaned === "" ? null : cleaned;
}

function optionalBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

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
  return null;
}

function rank(role: string): number {
  if (role === "admin") return 2;
  if (role === "board") return 1;
  return 0;
}

function statusRank(status: string): number {
  if (status === "active") return 2;
  if (status === "invited") return 1;
  return 0;
}

function preferMembership(
  current: MembershipData | undefined,
  candidate: MembershipData,
): MembershipData {
  if (!current) return candidate;
  const currentStatus = cleanString(current.status);
  const candidateStatus = cleanString(candidate.status);
  if (statusRank(candidateStatus) !== statusRank(currentStatus)) {
    return statusRank(candidateStatus) > statusRank(currentStatus)
      ? candidate
      : current;
  }
  return rank(cleanString(candidate.role)) > rank(cleanString(current.role))
    ? candidate
    : current;
}

function prefersRosterMember(
  current: Record<string, unknown>,
  candidate: Record<string, unknown>,
): Record<string, unknown> {
  const currentStatus = cleanString(current.membershipStatus);
  const candidateStatus = cleanString(candidate.membershipStatus);
  if (statusRank(candidateStatus) !== statusRank(currentStatus)) {
    return statusRank(candidateStatus) > statusRank(currentStatus)
      ? candidate
      : current;
  }
  return rank(cleanString(candidate.role)) > rank(cleanString(current.role))
    ? candidate
    : current;
}

/**
 * Returns the full club roster through the Admin SDK. Client-side Firestore
 * reads cannot reliably build this list because member profile visibility is
 * based on `members.clubId/defaultClubId`, while real club membership lives in
 * `memberships`.
 */
export const clubRoster = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required");
  }

  const clubId = cleanString(request.data?.clubId);
  if (!clubId) {
    throw new HttpsError("invalid-argument", "clubId is required");
  }

  const db = getFirestore();
  const callerMembership = await db
    .collection("memberships")
    .doc(`${clubId}_${request.auth.uid}`)
    .get();
  const caller = callerMembership.data();
  if (!caller || caller.status !== "active") {
    throw new HttpsError("permission-denied", "Active club membership required");
  }

  const membershipsSnap = await db
    .collection("memberships")
    .where("clubId", "==", clubId)
    .get();

  const membershipByMember = new Map<string, MembershipData>();
  for (const document of membershipsSnap.docs) {
    const membership = document.data() as MembershipData;
    const memberId = cleanString(membership.memberId);
    if (!memberId) continue;
    membershipByMember.set(
      memberId,
      preferMembership(membershipByMember.get(memberId), membership),
    );
  }

  const byId = new Map<string, Record<string, unknown>>();
  const duplicateMemberIds: string[] = [];
  for (const [memberId, membership] of membershipByMember) {
    const memberSnap = await db.collection("members").doc(memberId).get();
    if (!memberSnap.exists) continue;
    const member = memberSnap.data() as MemberData | undefined;
    if (!member) continue;

    const joinedAtMillis = timestampMillis(membership.joinDate) ?? Date.now();
    const birthDateMillis = timestampMillis(member.birthDate);
    byId.set(memberId, {
      id: memberId,
      authUid: cleanString(member.authUid, cleanString(membership.authUid)),
      clubId: optionalString(member.clubId),
      defaultClubId: optionalString(member.defaultClubId),
      firstName: cleanString(member.firstName),
      lastName: cleanString(member.lastName),
      email: cleanString(member.email).toLowerCase(),
      phone: optionalString(member.phone),
      birthDateMillis,
      photoPath: optionalString(member.photoPath),
      notifyAnnouncements: optionalBool(member.notifyAnnouncements, true),
      notifyEvents: optionalBool(member.notifyEvents, true),
      notifyPayments: optionalBool(member.notifyPayments, true),
      notifyTournaments: optionalBool(member.notifyTournaments, false),
      profileStatus: cleanString(member.status, "active"),
      role: cleanString(membership.role, "member"),
      membershipStatus: cleanString(membership.status, "inactive"),
      joinedAtMillis,
      licenseNumber: optionalString(membership.licenseNumber),
    });
  }

  const byIdentity = new Map<string, Record<string, unknown>>();
  for (const member of byId.values()) {
    const email = cleanString(member.email).toLowerCase();
    const memberId = cleanString(member.id);
    const dedupeKey = email ? `email:${email}` : `id:${memberId}`;
    const existing = byIdentity.get(dedupeKey);
    if (existing) {
      duplicateMemberIds.push(memberId);
      byIdentity.set(dedupeKey, prefersRosterMember(existing, member));
    } else {
      byIdentity.set(dedupeKey, member);
    }
  }

  const members = Array.from(byIdentity.values()).sort((lhs, rhs) =>
    `${cleanString(lhs.lastName)} ${cleanString(lhs.firstName)}`.localeCompare(
      `${cleanString(rhs.lastName)} ${cleanString(rhs.firstName)}`,
      "fr",
      { sensitivity: "base" },
    ),
  );

  return {
    members,
    memberCount: members.filter(
      (member) =>
        member.membershipStatus === "active" && member.profileStatus !== "deleted",
    ).length,
    duplicateMemberIds,
  };
});
