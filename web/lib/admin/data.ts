import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { clientDb, clientFunctions } from "@/lib/firebase/client";
import { canManageClub, roleFromMembership, type ClubRole } from "./roles";
import { persistedAttendance, persistedScore } from "./values";

export interface ClubAccess {
  id: string;
  name: string;
  role: ClubRole;
  subscriptionStatus: string;
  licenseNumber: string;
  seasonStatus: string;
}

export type ClubSessionResult =
  | { kind: "platform-admin"; uid: string; email: string; siteEditor: boolean }
  | { kind: "site-editor"; uid: string; email: string }
  | { kind: "no-profile"; uid: string; email: string }
  | { kind: "no-membership"; uid: string; email: string; memberId: string }
  | {
      kind: "club-member";
      platformAdmin: boolean;
      siteEditor: boolean;
      uid: string;
      email: string;
      memberId: string;
      firstName: string;
      lastName: string;
      defaultClubId: string | null;
      clubs: ClubAccess[];
    };

export interface ClubAnnouncement {
  id: string;
  title: string;
  body: string;
  createdAt: Date | null;
  publishedAt: Date | null;
  isPinned: boolean;
  authorId: string;
}

export interface ClubEvent {
  id: string;
  title: string;
  description: string;
  startsAt: Date | null;
  location: string;
  category: string;
}

export interface EventAttendance {
  eventId: string;
  memberId: string;
  status: "going" | "declined";
}

export interface ClubRosterMember {
  id: string;
  firstName: string;
  lastName: string;
  role: ClubRole;
  membershipStatus: string;
  profileStatus: string;
  licenseNumber: string;
  seasonStatus: string;
}

export interface ClubTournament {
  id: string;
  name: string;
  date: Date | null;
  location: string;
  isFinished: boolean | null;
  markerIds: string[];
  entries: ClubTournamentEntry[];
}

export interface ClubTournamentEntry {
  id: string;
  tableau: string;
  tour: string;
  playerA: string;
  playerB: string;
  scoreA: number | null;
  scoreB: number | null;
}

export interface ClubWorkspaceData {
  announcements: ClubAnnouncement[];
  events: ClubEvent[];
  attendance: EventAttendance[];
  members: ClubRosterMember[];
  tournaments: ClubTournament[];
}

export async function resolveClubSession(user: User): Promise<ClubSessionResult> {
  const db = clientDb();
  const email = user.email ?? "";
  // Authorization decisions must not be based on an offline Firestore cache.
  const [platformAdmin, siteEditor] = await Promise.all([
    getDocFromServer(doc(db, "platform_admins", user.uid)),
    getDocFromServer(doc(db, "site_editors", user.uid)),
  ]);
  const isPlatformAdmin = platformAdmin.exists();
  const isSiteEditor = siteEditor.exists();
  const withoutClub = () => isPlatformAdmin
    ? { kind: "platform-admin" as const, uid: user.uid, email, siteEditor: isSiteEditor }
    : isSiteEditor ? { kind: "site-editor" as const, uid: user.uid, email } : null;

  const memberQuery = await getDocsFromServer(
    query(collection(db, "members"), where("authUid", "==", user.uid)),
  );
  const memberDocument = memberQuery.docs[0];
  if (!memberDocument) return withoutClub() ?? { kind: "no-profile", uid: user.uid, email };

  const memberData = memberDocument.data();
  const memberId = memberDocument.id;
  const memberships = await getDocsFromServer(
    query(
      collection(db, "memberships"),
      where("memberId", "==", memberId),
      where("authUid", "==", user.uid),
      where("status", "==", "active"),
    ),
  );
  if (memberships.empty) {
    return withoutClub() ?? { kind: "no-membership", uid: user.uid, email, memberId };
  }

  const clubs = (
    await Promise.all(
      memberships.docs.map(async (membershipDocument) => {
        const membership = membershipDocument.data();
        const clubDocument = await getDocFromServer(doc(db, "clubs", membership.clubId));
        if (!clubDocument.exists()) return null;
        const club = clubDocument.data();
        return {
          id: clubDocument.id,
          name: stringValue(club.name) || "Club",
          role: roleFromMembership(membership.role),
          subscriptionStatus: stringValue(club.subscriptionStatus),
          licenseNumber: stringValue(membership.licenseNumber),
          seasonStatus: stringValue(membership.seasonStatus),
        } satisfies ClubAccess;
      }),
    )
  )
    .filter((club): club is ClubAccess => club !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  if (!clubs.length) {
    return withoutClub() ?? { kind: "no-membership", uid: user.uid, email, memberId };
  }
  return {
    kind: "club-member",
    platformAdmin: isPlatformAdmin,
    siteEditor: isSiteEditor,
    uid: user.uid,
    email,
    memberId,
    firstName: stringValue(memberData.firstName),
    lastName: stringValue(memberData.lastName),
    defaultClubId: stringValue(memberData.defaultClubId) || null,
    clubs,
  };
}

export async function loadClubWorkspace(
  clubId: string,
  memberId: string,
): Promise<ClubWorkspaceData> {
  const db = clientDb();
  const [announcements, events, attendance, tournaments, tournamentEntries, roster] =
    await Promise.all([
      getDocs(query(collection(db, "announcements"), where("clubId", "==", clubId))),
      getDocs(query(collection(db, "events"), where("clubId", "==", clubId))),
      getDocs(
        query(
          collection(db, "event_registrations"),
          where("clubId", "==", clubId),
        ),
      ),
      getDocs(query(collection(db, "tournaments"), where("clubId", "==", clubId))),
      getDocs(
        query(collection(db, "tournament_entries"), where("clubId", "==", clubId)),
      ),
      loadClubRoster(clubId),
    ]);

  const entries = tournamentEntries.docs.map((snapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      tournamentId: stringValue(data.tournamentId),
      tableau: stringValue(data.tableau),
      tour: stringValue(data.tour),
      playerA: stringValue(data.playerA),
      playerB: stringValue(data.playerB),
      scoreA: persistedScore(data.scoreA),
      scoreB: persistedScore(data.scoreB),
    };
  });

  return {
    announcements: announcements.docs
      .map((snapshot) => {
        const data = snapshot.data();
        return {
          id: snapshot.id,
          title: stringValue(data.title),
          body: stringValue(data.body),
          createdAt: dateValue(data.createdAt),
          publishedAt: dateValue(data.publishedAt),
          isPinned: data.isPinned === true,
          authorId: stringValue(data.createdByMemberId),
        };
      })
      .sort((a, b) => (b.publishedAt?.getTime() ?? b.createdAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? a.createdAt?.getTime() ?? 0)),
    events: events.docs
      .map((snapshot) => {
        const data = snapshot.data();
        return {
          id: snapshot.id,
          title: stringValue(data.title),
          description: stringValue(data.description),
          startsAt: dateValue(data.startsAt),
          location: stringValue(data.location),
          category: stringValue(data.category),
        };
      })
      .sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0)),
    attendance: attendance.docs
      .filter((snapshot) => snapshot.data().memberId === memberId && persistedAttendance(snapshot.data().status) !== null)
      .map((snapshot) => {
        const data = snapshot.data();
        return {
          eventId: stringValue(data.eventId),
          memberId: stringValue(data.memberId),
          status: persistedAttendance(data.status)!,
        };
      }),
    members: roster,
    tournaments: tournaments.docs
      .map((snapshot) => {
        const data = snapshot.data();
        return {
          id: snapshot.id,
          name: stringValue(data.name),
          date: dateValue(data.date),
          location: stringValue(data.location),
          isFinished: typeof data.isFinished === "boolean" ? data.isFinished : null,
          markerIds: Array.isArray(data.markerIds)
            ? data.markerIds.filter((value): value is string => typeof value === "string")
            : [],
          entries: entries.filter((entry) => entry.tournamentId === snapshot.id),
        };
      })
      .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0)),
  };
}

async function loadClubRoster(clubId: string): Promise<ClubRosterMember[]> {
  if (process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true") {
    const db = clientDb();
    const memberships = await getDocs(
      query(collection(db, "memberships"), where("clubId", "==", clubId)),
    );
    const roster = await Promise.all(
      memberships.docs.map(async (membershipDocument) => {
        const membership = membershipDocument.data();
        const id = stringValue(membership.memberId);
        const profile = await getDoc(doc(db, "members", id));
        const member = profile.data();
        if (!profile.exists() || !member) return null;
        return {
          id,
          firstName: stringValue(member.firstName),
          lastName: stringValue(member.lastName),
          role: roleFromMembership(membership.role),
          membershipStatus: stringValue(membership.status),
          profileStatus: stringValue(member.status),
          licenseNumber: stringValue(membership.licenseNumber),
          seasonStatus: stringValue(membership.seasonStatus),
        } satisfies ClubRosterMember;
      }),
    );
    return roster.filter((member): member is ClubRosterMember => member !== null);
  }

  const rosterCall = httpsCallable<{ clubId: string }, { members: Array<Record<string, unknown>> }>(
    clientFunctions(),
    "clubRoster",
  );
  const result = await rosterCall({ clubId });
  return result.data.members.map((member) => ({
    id: stringValue(member.id),
    firstName: stringValue(member.firstName),
    lastName: stringValue(member.lastName),
    role: roleFromMembership(member.role),
    membershipStatus: stringValue(member.membershipStatus),
    profileStatus: stringValue(member.profileStatus),
    licenseNumber: stringValue(member.licenseNumber),
    seasonStatus: stringValue(member.seasonStatus),
  }));
}

export async function saveEventAttendance(
  clubId: string,
  eventId: string,
  memberId: string,
  status: EventAttendance["status"] | null,
): Promise<void> {
  const registration = doc(
    clientDb(),
    "event_registrations",
    `${eventId}_${memberId}`,
  );
  if (status === null) {
    await deleteDoc(registration);
    return;
  }
  await setDoc(registration, { clubId, eventId, memberId, status });
}

export async function createClubEvent(
  clubId: string,
  memberId: string,
  role: ClubRole,
  input: {
    title: string;
    description: string;
    startsAt: Date;
    location: string;
    category: string;
    visibility: "public" | "members";
  },
): Promise<void> {
  if (!canManageClub(role)) throw new Error("permission-denied");
  const eventId = crypto.randomUUID().toUpperCase();
  await setDoc(doc(clientDb(), "events", eventId), {
    clubId,
    title: input.title.trim(),
    description: input.description.trim(),
    startsAt: input.startsAt,
    location: input.location.trim(),
    category: input.category,
    visibility: input.visibility,
    createdByMemberId: memberId,
  });
}

export async function createClubAnnouncement(
  clubId: string,
  memberId: string,
  role: ClubRole,
  input: { title: string; body: string; isPinned: boolean; notify: boolean },
): Promise<void> {
  if (!canManageClub(role)) throw new Error("permission-denied");
  const announcementId = crypto.randomUUID().toUpperCase();
  await setDoc(doc(clientDb(), "announcements", announcementId), {
    clubId,
    createdByMemberId: memberId,
    title: input.title.trim(),
    body: input.body.trim(),
    isPinned: input.isPinned,
    publishedAt: serverTimestamp(),
    visibility: "members",
    notify: input.notify,
    createdAt: serverTimestamp(),
  });
}

export async function createClubTournament(
  clubId: string,
  role: ClubRole,
  input: { name: string; date: Date; location: string; markerIds: string[] },
): Promise<void> {
  if (!canManageClub(role)) throw new Error("permission-denied");
  const tournamentId = crypto.randomUUID().toUpperCase();
  await setDoc(doc(clientDb(), "tournaments", tournamentId), {
    clubId,
    name: input.name.trim(),
    date: input.date,
    location: input.location.trim(),
    markerIds: [...new Set(input.markerIds)],
    isFinished: false,
  });
}

export async function recordTournamentResult(
  clubId: string,
  tournamentId: string,
  memberId: string,
  role: ClubRole,
  isMarker: boolean,
  input: {
    tableau: string;
    tour: string;
    playerA: string;
    playerB: string;
    scoreA: number;
    scoreB: number;
    note: string;
  },
): Promise<void> {
  if (!canManageClub(role) && !isMarker) throw new Error("permission-denied");
  const entryId = crypto.randomUUID().toUpperCase();
  await setDoc(doc(clientDb(), "tournament_entries", entryId), {
    clubId,
    tournamentId,
    tableau: input.tableau.trim(),
    tour: input.tour.trim(),
    playerA: input.playerA.trim(),
    playerB: input.playerB.trim(),
    scoreA: input.scoreA,
    scoreB: input.scoreB,
    note: input.note.trim(),
    recordedByMemberId: memberId,
    recordedAt: serverTimestamp(),
  });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}
