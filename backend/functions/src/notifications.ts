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

async function memberAllowsNotification(
  memberId: string,
  kind: NotificationKind,
): Promise<boolean> {
  const field = preferenceField(kind);
  if (!field) return true;

  const member = (
    await getFirestore().collection("members").doc(memberId).get()
  ).data();
  if (kind === "tournament") return !!member && member[field] === true;
  return !!member && member[field] !== false;
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
  if (!(await memberAllowsNotification(memberId, kind))) return;

  await getFirestore().collection("notifications").add({
    memberId,
    clubId,
    kind,
    title,
    body,
    payload,
    createdAt: FieldValue.serverTimestamp(),
    readAt: null,
  });
}

async function activeMemberships(clubId: string, roles?: string[]) {
  let query = getFirestore()
    .collection("memberships")
    .where("clubId", "==", clubId)
    .where("status", "==", "active");
  if (roles) query = query.where("role", "in", roles);
  return query.get();
}

async function activeMemberIds(clubId: string, roles?: string[]): Promise<Set<string>> {
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
      await Promise.all(
        board.docs
          .filter((doc) => doc.data().memberId !== after.memberId)
          .map((doc) =>
            notifyMember(
              doc.data().memberId,
              after.clubId,
              "payment_to_confirm",
              "Paiement déclaré",
              "Un membre a déclaré un paiement à valider.",
              { itemId: event.params.itemId, label, amountCents, memberName },
            ),
          ),
      );
    }

    if (after.isPaid && !before?.isPaid) {
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
    await Promise.all(
      members.docs
        .filter((doc) => doc.data().memberId !== announcement.createdByMemberId)
        .map((doc) =>
          notifyMember(
            doc.data().memberId,
            announcement.clubId,
            "announcement",
            announcement.title,
            announcement.body,
            {
              announcementId: event.params.announcementId,
              label: announcement.title,
            },
          ),
        ),
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
    await Promise.all(
      members.docs
        .filter((doc) => doc.data().memberId !== clubEvent.createdByMemberId)
        .map((doc) =>
          notifyMember(
            doc.data().memberId,
            clubEvent.clubId,
            "event",
            clubEvent.title,
            clubEvent.location ?? "",
            {
              eventId: event.params.eventId,
              label: clubEvent.title,
              startsAt: clubEvent.startsAt?.toDate?.().toISOString?.(),
            },
          ),
        ),
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

    await Promise.all(
      recipientIds.map((memberId) =>
        notifyMember(
          memberId,
          conversation.clubId,
          "message",
          "Nouveau message",
          `${senderName}: ${textPreview(message.text ?? "")}`,
          {
            conversationId: event.params.conversationId,
            memberName: senderName,
          },
        ),
      ),
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

    await Promise.all(
      members.docs
        .filter((doc) => doc.data().memberId !== entry.recordedByMemberId)
        .map((doc) =>
          notifyMember(
            doc.data().memberId,
            entry.clubId,
            "tournament",
            "Résultat de tournoi",
            body,
            {
              tournamentId: entry.tournamentId,
              label,
            },
          ),
        ),
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
    // This simple fan-out is sufficient at the current scale; revisit it once
    // a broadcast can reach more than a few hundred recipients.
    await Promise.all(
      memberships.docs
        .filter((doc) => {
          // publishedBy is the auth uid of the platform admin who broadcast it.
          const authUid = doc.data().authUid;
          return !announcement.publishedBy || authUid !== announcement.publishedBy;
        })
        .map((doc) => {
          const membership = doc.data();
          return notifyMember(
            membership.memberId,
            membership.clubId,
            "platform_announcement",
            announcement.title,
            announcement.body,
            {
              announcementId: event.params.announcementId,
              label: announcement.title,
            },
          );
        }),
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
