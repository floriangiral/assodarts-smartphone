import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Kept in sync by hand with `backend/types.ts` (that file lives outside this
// function's deployment bundle, so it can't be imported directly here).
type NotificationKind = "announcement" | "payment_due" | "payment_to_confirm" | "payment_confirmed" | "event";

interface NotificationPayload {
  callId?: string;
  itemId?: string;
  announcementId?: string;
  eventId?: string;
  label?: string;
  amountCents?: number;
  memberName?: string;
  method?: string;
  dueDate?: string;
  startsAt?: string;
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

async function memberDisplayName(memberId: string): Promise<string | undefined> {
  const snap = await getFirestore().collection("members").doc(memberId).get();
  return snap.data()?.displayName as string | undefined;
}

/** A member declared a payment (notify the board), or the board validated one (notify the member). */
export const onPaymentItemWritten = onDocumentWritten(
  { document: "payment_call_items/{itemId}", region: "europe-west9" },
  async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after) return;

  const call = (await getFirestore().collection("payment_calls").doc(after.paymentCallId).get()).data();
  const label = call?.title ?? "";
  const amountCents = call?.amountCents as number | undefined;

  if (after.declaredAt && !before?.declaredAt) {
    const memberName = await memberDisplayName(after.memberId);
    const board = await activeMemberships(after.clubId, ["admin", "board"]);
    await Promise.all(
      board.docs.map((doc) =>
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
    await notifyMember(
      after.memberId,
      after.clubId,
      "payment_confirmed",
      "Paiement validé",
      "Votre paiement a été confirmé.",
      { itemId: event.params.itemId, label, amountCents },
    );
  }
});

/** A board member just published an announcement — notify every active member. */
export const onAnnouncementCreated = onDocumentCreated(
  { document: "announcements/{announcementId}", region: "europe-west9" },
  async (event) => {
  const announcement = event.data?.data();
  if (!announcement?.publishedAt) return;

  const members = await activeMemberships(announcement.clubId);
  await Promise.all(
    members.docs.map((doc) =>
      notifyMember(
        doc.data().memberId,
        announcement.clubId,
        "announcement",
        announcement.title,
        announcement.body,
        { announcementId: event.params.announcementId, label: announcement.title },
      ),
    ),
  );
});

/** Pushes every notification the moment it is written, to every device of that member. */
export const onNotificationCreated = onDocumentCreated(
  { document: "notifications/{notificationId}", region: "europe-west9" },
  async (event) => {
  const notification = event.data?.data();
  if (!notification) return;

  const tokens = await getFirestore()
    .collection("device_push_tokens")
    .where("memberId", "==", notification.memberId)
    .get();
  if (tokens.empty) return;

  await getMessaging().sendEachForMulticast({
    tokens: tokens.docs.map((doc) => doc.id),
    notification: { title: notification.title, body: notification.body },
  });
});

