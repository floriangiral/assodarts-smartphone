import {
  onDocumentCreated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Kept in sync by hand with `backend/types.ts` (that file lives outside this
// function's deployment bundle, so it can't be imported directly here).
type NotificationKind =
  | "announcement"
  | "message"
  | "payment_due"
  | "payment_to_confirm"
  | "payment_confirmed"
  | "platform_announcement"
  | "event"
  | "tournament";

interface NotificationPayload {
  callId?: string;
  itemId?: string;
  announcementId?: string;
  conversationId?: string;
  eventId?: string;
  tournamentId?: string;
  label?: string;
  amountCents?: number;
  memberName?: string;
  method?: string;
  dueDate?: string;
  startsAt?: string;
}

type PreferenceField =
  | "notifyAnnouncements"
  | "notifyEvents"
  | "notifyPayments"
  | "notifyTournaments";

type NotificationRecipient = {
  memberId: string;
  clubId: string;
};

function preferenceField(kind: NotificationKind): PreferenceField | undefined {
  switch (kind) {
    case "announcement":
    case "platform_announcement":
      return "notifyAnnouncements";
    case "event":
      return "notifyEvents";
    case "payment_due":
    case "payment_to_confirm":
    case "payment_confirmed":
      return "notifyPayments";
    case "tournament":
      return "notifyTournaments";
    default:
      return undefined;
  }
}

function chunks<T>(values: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size));
  }
  return groups;
}

async function allowedMemberIds(
  memberIds: string[],
  kind: NotificationKind,
): Promise<Set<string>> {
  const uniqueMemberIds = Array.from(new Set(memberIds));
  const field = preferenceField(kind);
  if (!field) return new Set(uniqueMemberIds);

  const db = getFirestore();
  const allowed = new Set<string>();
  const refs = uniqueMemberIds.map((memberId) =>
    db.collection("members").doc(memberId),
  );
  for (const refChunk of chunks(refs, 300)) {
    const snapshots = await db.getAll(...refChunk);
    snapshots.forEach((snapshot, index) => {
      const member = snapshot.data();
      if (!member) return;
      const memberId = refChunk[index].id;
      if (kind === "tournament") {
        if (member[field] === true) allowed.add(memberId);
        return;
      }
      if (member[field] !== false) allowed.add(memberId);
    });
  }
  return allowed;
}

/**
 * Replaces the Postgres triggers that used to fill the `notifications` table
 * server-side: club events write a notification document here, and a second
 * trigger below pushes it to every device of that member through FCM.
 */
async function notifyMember(
  memberId: string,
  clubId: string,
  kind: NotificationKind,
  title: string,
  body: string,
  payload: NotificationPayload,
): Promise<void> {
  await notifyMembers([{ memberId, clubId }], kind, title, body, payload);
}

async function notifyMembers(
  recipients: NotificationRecipient[],
  kind: NotificationKind,
  title: string,
  body: string,
  payload: NotificationPayload,
): Promise<void> {
  const deduplicated = Array.from(
    new Map(
      recipients
        .filter(({ memberId, clubId }) => memberId && clubId)
        .map((recipient) => [
          `${recipient.memberId}:${recipient.clubId}`,
          recipient,
        ]),
    ).values(),
  );
  if (deduplicated.length === 0) return;

  const allowed = await allowedMemberIds(
    deduplicated.map((recipient) => recipient.memberId),
    kind,
  );
  const db = getFirestore();
  const writableRecipients = deduplicated.filter((recipient) =>
    allowed.has(recipient.memberId),
  );

  for (const recipientChunk of chunks(writableRecipients, 450)) {
    const batch = db.batch();
    for (const recipient of recipientChunk) {
      batch.set(db.collection("notifications").doc(), {
        memberId: recipient.memberId,
        clubId: recipient.clubId,
        kind,
        title,
        body,
        payload,
        createdAt: FieldValue.serverTimestamp(),
        readAt: null,
      });
    }
    await batch.commit();
  }
}

async function activeMemberships(clubId: string, roles?: string[]) {
  let query = getFirestore()
    .collection("memberships")
    .where("clubId", "==", clubId)
    .where("status", "==", "active");
  if (roles) query = query.where("role", "in", roles);
  return query.get();
}

async function activeMemberIds(
  clubId: string,
  roles?: string[],
): Promise<Set<string>> {
  const memberships = await activeMemberships(clubId, roles);
  return new Set(
    memberships.docs
      .map((doc) => doc.data().memberId as unknown)
      .filter((memberId): memberId is string => typeof memberId === "string"),
  );
}

async function activePlatformMemberships(audience: string) {
  let query = getFirestore()
    .collection("memberships")
    .where("status", "==", "active");
  if (audience === "admins")
    query = query.where("role", "in", ["admin", "board"]);
  return query.get();
}

async function memberDisplayName(
  memberId: string,
): Promise<string | undefined> {
  const snap = await getFirestore().collection("members").doc(memberId).get();
  return snap.data()?.displayName as string | undefined;
}

function textPreview(text: string): string {
  const trimmed = text.trim();
  return trimmed.length <= 140 ? trimmed : `${trimmed.slice(0, 137)}...`;
}

async function notifyActiveClubMember(
  memberId: string,
  clubId: string,
  kind: NotificationKind,
  title: string,
  body: string,
  payload: NotificationPayload,
): Promise<void> {
  if (!(await activeMemberIds(clubId)).has(memberId)) return;
  await notifyMember(memberId, clubId, kind, title, body, payload);
}

async function markContributionPaid(
  data: Record<string, unknown>,
): Promise<void> {
  const seasonId =
    typeof data.contributionSeasonId === "string"
      ? data.contributionSeasonId
      : "";
  const option =
    typeof data.contributionOption === "string" ? data.contributionOption : "";
  const clubId = typeof data.clubId === "string" ? data.clubId : "";
  const memberId = typeof data.memberId === "string" ? data.memberId : "";
  if (!seasonId || !option || !clubId || !memberId) return;
  const db = getFirestore();
  await db
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
  const memberships = await db
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

/** A member declared a payment (notify the board), or the board validated one (notify the member). */
export const onPaymentItemWritten = onDocumentWritten(
  { document: "payment_call_items/{itemId}", region: "europe-west9" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after) return;

    const call = (
      await getFirestore()
        .collection("payment_calls")
        .doc(after.paymentCallId)
        .get()
    ).data();
    const label = call?.title ?? "";
    const amountCents = call?.amountCents as number | undefined;

    if (!before && call?.notify !== false) {
      await notifyActiveClubMember(
        after.memberId,
        after.clubId,
        "payment_due",
        "Nouvel appel à paiement",
        "Un nouveau paiement est à régler.",
        {
          callId: after.paymentCallId,
          itemId: event.params.itemId,
          label,
          amountCents,
          dueDate: call?.dueDate?.toDate?.().toISOString?.(),
        },
      );
    }

    if (after.declaredAt && !before?.declaredAt) {
      const memberName = await memberDisplayName(after.memberId);
      const board = await activeMemberships(after.clubId, ["admin", "board"]);
      await notifyMembers(
        board.docs
          .map((doc) => doc.data().memberId as unknown)
          .filter(
            (memberId): memberId is string =>
              typeof memberId === "string" && memberId !== after.memberId,
          )
          .map((memberId) => ({ memberId, clubId: after.clubId })),
        "payment_to_confirm",
        "Paiement déclaré",
        "Un membre a déclaré un paiement à valider.",
        { itemId: event.params.itemId, label, amountCents, memberName },
      );
    }

    if (after.isPaid && !before?.isPaid) {
      await markContributionPaid(after as Record<string, unknown>);
      await notifyActiveClubMember(
        after.memberId,
        after.clubId,
        "payment_confirmed",
        "Paiement validé",
        "Votre paiement a été confirmé.",
        { itemId: event.params.itemId, label, amountCents },
      );
    }
  },
);

/** A board member just published an announcement — notify every active member. */
export const onAnnouncementCreated = onDocumentCreated(
  { document: "announcements/{announcementId}", region: "europe-west9" },
  async (event) => {
    const announcement = event.data?.data();
    if (!announcement?.publishedAt || announcement.notify === false) return;

    const members = await activeMemberships(announcement.clubId);
    await notifyMembers(
      members.docs
        .map((doc) => doc.data().memberId as unknown)
        .filter(
          (memberId): memberId is string =>
            typeof memberId === "string" &&
            memberId !== announcement.createdByMemberId,
        )
        .map((memberId) => ({ memberId, clubId: announcement.clubId })),
      "announcement",
      announcement.title,
      announcement.body,
      {
        announcementId: event.params.announcementId,
        label: announcement.title,
      },
    );
  },
);

/** A board member just created an event — notify every active member. */
export const onEventCreated = onDocumentCreated(
  { document: "events/{eventId}", region: "europe-west9" },
  async (event) => {
    const clubEvent = event.data?.data();
    if (!clubEvent) return;

    const members = await activeMemberships(clubEvent.clubId);
    await notifyMembers(
      members.docs
        .map((doc) => doc.data().memberId as unknown)
        .filter(
          (memberId): memberId is string =>
            typeof memberId === "string" &&
            memberId !== clubEvent.createdByMemberId,
        )
        .map((memberId) => ({ memberId, clubId: clubEvent.clubId })),
      "event",
      clubEvent.title,
      clubEvent.location ?? "",
      {
        eventId: event.params.eventId,
        label: clubEvent.title,
        startsAt: clubEvent.startsAt?.toDate?.().toISOString?.(),
      },
    );
  },
);

/** A private or committee conversation got a new message — notify recipients. */
export const onMessageCreated = onDocumentCreated(
  {
    document: "conversations/{conversationId}/messages/{messageId}",
    region: "europe-west9",
  },
  async (event) => {
    const message = event.data?.data();
    if (!message) return;

    const conversationSnap = await getFirestore()
      .collection("conversations")
      .doc(event.params.conversationId)
      .get();
    const conversation = conversationSnap.data();
    if (!conversation) return;

    const senderId = message.senderId as string;
    const senderName = (await memberDisplayName(senderId)) ?? "Un membre";
    const participantIds = Array.from(
      new Set(
        ((conversation.participantIds ?? []) as unknown[]).filter(
          (memberId): memberId is string => typeof memberId === "string",
        ),
      ),
    );
    const activeMembers = await activeMemberIds(conversation.clubId);
    const senderIsActive = activeMembers.has(senderId);
    if (!senderIsActive) return;

    let recipientIds: string[] = [];
    if (conversation.kind === "direct") {
      if (participantIds.length !== 2 || !participantIds.includes(senderId)) {
        return;
      }
      recipientIds = participantIds.filter((memberId) => memberId !== senderId);
    } else if (conversation.kind === "bureau") {
      if (participantIds.length !== 1) return;
      const boardIds = await activeMemberIds(conversation.clubId, [
        "admin",
        "board",
      ]);
      if (participantIds.includes(senderId)) {
        recipientIds = Array.from(boardIds).filter(
          (memberId) => memberId !== senderId,
        );
      } else if (boardIds.has(senderId)) {
        recipientIds = participantIds;
      } else {
        return;
      }
    } else {
      return;
    }

    recipientIds = Array.from(new Set(recipientIds)).filter(
      (memberId) => memberId !== senderId && activeMembers.has(memberId),
    );

    await notifyMembers(
      recipientIds.map((memberId) => ({
        memberId,
        clubId: conversation.clubId,
      })),
      "message",
      "Nouveau message",
      `${senderName}: ${textPreview(message.text ?? "")}`,
      {
        conversationId: event.params.conversationId,
        memberName: senderName,
      },
    );
  },
);

/** A tournament result was recorded — notify members who opted in. */
export const onTournamentEntryCreated = onDocumentCreated(
  { document: "tournament_entries/{entryId}", region: "europe-west9" },
  async (event) => {
    const entry = event.data?.data();
    if (!entry) return;

    const tournament = (
      await getFirestore()
        .collection("tournaments")
        .doc(entry.tournamentId)
        .get()
    ).data();
    const label = tournament?.name ?? "Tournoi";
    const body = `${entry.playerA} ${entry.scoreA} - ${entry.scoreB} ${entry.playerB}`;
    const members = await activeMemberships(entry.clubId);

    await notifyMembers(
      members.docs
        .map((doc) => doc.data().memberId as unknown)
        .filter(
          (memberId): memberId is string =>
            typeof memberId === "string" &&
            memberId !== entry.recordedByMemberId,
        )
        .map((memberId) => ({ memberId, clubId: entry.clubId })),
      "tournament",
      "Résultat de tournoi",
      body,
      {
        tournamentId: entry.tournamentId,
        label,
      },
    );
  },
);

/** Notifies active memberships after a platform-wide announcement is published. */
export const onPlatformAnnouncementCreated = onDocumentCreated(
  {
    document: "platform_announcements/{announcementId}",
    region: "europe-west9",
  },
  async (event) => {
    const announcement = event.data?.data();
    if (!announcement?.publishedAt) return;

    const memberships = await activePlatformMemberships(announcement.audience);
    await notifyMembers(
      memberships.docs
        .filter((doc) => {
          // publishedBy is the auth uid of the platform admin who broadcast it.
          const authUid = doc.data().authUid;
          return (
            !announcement.publishedBy || authUid !== announcement.publishedBy
          );
        })
        .map((doc) => {
          const membership = doc.data();
          return {
            memberId: membership.memberId,
            clubId: membership.clubId,
          };
        }),
      "platform_announcement",
      announcement.title,
      announcement.body,
      {
        announcementId: event.params.announcementId,
        label: announcement.title,
      },
    );
  },
);

/** Pushes every notification the moment it is written, to every device of that member. */
export const onNotificationCreated = onDocumentCreated(
  { document: "notifications/{notificationId}", region: "europe-west9" },
  async (event) => {
    const notification = event.data?.data();
    if (!notification) return;

    const tokenDocs = await getFirestore()
      .collection("device_push_tokens")
      .where("memberId", "==", notification.memberId)
      .get();
    if (tokenDocs.empty) return;

    const payload = notification.payload ?? {};
    const data = Object.fromEntries(
      Object.entries({
        notificationId: event.params.notificationId,
        memberId: notification.memberId,
        clubId: notification.clubId,
        kind: notification.kind,
        ...payload,
      })
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)]),
    );

    const response = await getMessaging().sendEachForMulticast({
      tokens: tokenDocs.docs.map((doc) => doc.id),
      notification: { title: notification.title, body: notification.body },
      data,
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    });

    const deletions = response.responses
      .map((result, index) => ({ result, tokenDoc: tokenDocs.docs[index] }))
      .filter(({ result }) =>
        [
          "messaging/invalid-registration-token",
          "messaging/registration-token-not-registered",
        ].includes(result.error?.code ?? ""),
      )
      .map(({ tokenDoc }) => tokenDoc.ref.delete());

    await Promise.all(deletions);
  },
);
