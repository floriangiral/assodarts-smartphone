// Firestore document shapes for the collections the app and Cloud Functions
// use. This replaces the auto-generated Supabase/Postgres `Database` type —
// Firestore has no schema introspection, so this is hand-maintained. Keep it
// in sync with `functions/src` and the iOS `RemoteModels.swift` mapping.

export interface ClubDoc {
  name: string;
  address: string | null;
  country: string | null;
  createdAt: FirebaseFirestore.Timestamp;
  subscriptionStatus: string;
  trialEndsAt: FirebaseFirestore.Timestamp | null;
}

/** Document ID is `${clubId}_${authUid}` so security rules can `get()` it directly. */
export interface MembershipDoc {
  clubId: string;
  memberId: string;
  authUid: string;
  role: "admin" | "board" | "member";
  status: "active" | "invited" | "inactive";
  joinDate: FirebaseFirestore.Timestamp;
  licenseNumber: string | null;
}

/** Document ID is the application UUID; `authUid` links it to Firebase Auth. */
export interface MemberDoc {
  authUid: string;
  /** Null until a board member links this profile to a club membership. */
  clubId: string | null;
  /** The club the app opens on when the member belongs to several. */
  defaultClubId: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string | null;
  status: string;
}

/** Document ID is the club ID (one bank account per club). */
export interface ClubBankAccountDoc {
  clubId: string;
  holder: string;
  iban: string;
  bic: string;
  bankName: string;
  stripeAccountId: string | null;
  stripeStatus: "not_connected" | "pending" | "verified";
  stripeChargesEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  acceptsTransfer: boolean;
  acceptsCash: boolean;
  transferNote: string;
  cashNote: string;
  updatedByMemberId: string | null;
  updatedAt: FirebaseFirestore.Timestamp | null;
}

export interface AnnouncementDoc {
  clubId: string;
  createdByMemberId: string;
  title: string;
  body: string;
  isPinned: boolean;
  publishedAt: FirebaseFirestore.Timestamp | null;
  createdAt: FirebaseFirestore.Timestamp;
  visibility: string;
}

export interface EventDoc {
  clubId: string;
  title: string;
  description: string | null;
  startsAt: FirebaseFirestore.Timestamp;
  location: string | null;
  category: string;
}

export interface EventRegistrationDoc {
  clubId: string;
  eventId: string;
  memberId: string;
  status: string;
}

export interface TournamentDoc {
  clubId: string;
  name: string;
  date: FirebaseFirestore.Timestamp;
  location: string;
  markerIds: string[];
  isFinished: boolean;
}

export interface TournamentEntryDoc {
  clubId: string;
  tournamentId: string;
  tableau: string;
  tour: string;
  playerA: string;
  playerB: string;
  scoreA: number;
  scoreB: number;
  note: string;
  recordedByMemberId: string;
  recordedAt: FirebaseFirestore.Timestamp;
}

export interface ConversationDoc {
  clubId: string;
  kind: "bureau" | "direct";
  participantIds: string[];
}

export interface MessageDoc {
  senderId: string;
  text: string;
  sentAt: FirebaseFirestore.Timestamp;
  readBy: string[];
}

export interface PaymentCallDoc {
  clubId: string;
  title: string;
  detail: string;
  category: string;
  amountCents: number;
  currency: string;
  dueDate: FirebaseFirestore.Timestamp;
  createdByMemberId: string | null;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface PaymentCallItemDoc {
  paymentCallId: string;
  clubId: string;
  memberId: string;
  isPaid: boolean;
  paidAt: FirebaseFirestore.Timestamp | null;
  method: string | null;
  declaredAt: FirebaseFirestore.Timestamp | null;
  reference: string | null;
  validatedByMemberId: string | null;
  remindedAt: FirebaseFirestore.Timestamp | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  updatedAt: FirebaseFirestore.Timestamp | null;
}

/** Extra data carried by a notification; shape depends on `kind`. */
export interface NotificationPayload {
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

export interface NotificationDoc {
  memberId: string;
  clubId: string;
  kind: "announcement" | "payment_due" | "payment_to_confirm" | "payment_confirmed" | "event";
  title: string;
  body: string;
  payload: NotificationPayload;
  createdAt: FirebaseFirestore.Timestamp;
  readAt: FirebaseFirestore.Timestamp | null;
}

/** Document ID is the FCM registration token. */
export interface DevicePushTokenDoc {
  memberId: string;
  platform: "ios" | "android";
  environment: string;
  locale: string;
}

/**
 * Document ID is `${clubId}_${email}`. Not readable/writable by clients —
 * created by `createInvitation`, consumed by `acceptInvitation`.
 */
export interface InvitationDoc {
  clubId: string;
  email: string;
  role: "admin" | "board" | "member";
  licenseNumber: string | null;
  status: "pending" | "accepted";
  invitedByMemberId: string;
  createdAt: FirebaseFirestore.Timestamp;
  acceptedAt: FirebaseFirestore.Timestamp | null;
  acceptedByMemberId: string | null;
}
