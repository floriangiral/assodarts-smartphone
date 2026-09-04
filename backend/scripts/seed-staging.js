// One-off seed script for the staging Firestore database.
// Run with GOOGLE_APPLICATION_CREDENTIALS set to a service account key.
// Usage: node scripts/seed-staging.js

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const PROJECT_ID = "assodarts-staging";
const ADMIN_EMAIL = "admin@assodarts.test";
const BOARD_EMAIL = "bureau@assodarts.test";
const MEMBER_EMAIL = "membre@assodarts.test";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const ADMIN_MEMBER_ID = "e14e3b57-d2c0-493e-a509-296f16b1f801";
const BOARD_MEMBER_ID = "8f726d54-37b5-4dd6-b09e-86e69bd7d802";
const MEMBER_MEMBER_ID = "f5d8cd08-04de-44b6-8cf7-0989e0c4e803";

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();
const auth = getAuth();

async function ensureUser(email, displayName) {
  try {
    const existing = await auth.getUserByEmail(email);
    return existing.uid;
  } catch {
    const created = await auth.createUser({ email, password: DEMO_PASSWORD, displayName });
    return created.uid;
  }
}

async function main() {
  if (!DEMO_PASSWORD) throw new Error("DEMO_PASSWORD must be set");

  const clubId = "demo-club";
  const adminUid = await ensureUser(ADMIN_EMAIL, "Admin Demo");
  const boardUid = await ensureUser(BOARD_EMAIL, "Bureau Demo");
  const memberUid = await ensureUser(MEMBER_EMAIL, "Membre Demo");

  const batch = db.batch();

  batch.set(db.collection("clubs").doc(clubId), {
    name: "Fléchettes Club Demo",
    address: "Lyon",
    country: "FR",
    createdAt: Timestamp.now(),
    subscriptionStatus: "trial",
    trialEndsAt: Timestamp.fromDate(new Date(Date.now() + 365 * 86_400_000)),
  });

  const members = [
    { authUid: adminUid, memberId: ADMIN_MEMBER_ID, email: ADMIN_EMAIL, firstName: "Admin", lastName: "Demo", role: "admin" },
    { authUid: boardUid, memberId: BOARD_MEMBER_ID, email: BOARD_EMAIL, firstName: "Bureau", lastName: "Demo", role: "board" },
    { authUid: memberUid, memberId: MEMBER_MEMBER_ID, email: MEMBER_EMAIL, firstName: "Membre", lastName: "Demo", role: "member" },
  ];

  for (const m of members) {
    batch.set(
      db.collection("members").doc(m.memberId),
      {
        authUid: m.authUid,
        clubId,
        firstName: m.firstName,
        lastName: m.lastName,
        displayName: `${m.firstName} ${m.lastName}`,
        email: m.email,
        phone: null,
        status: "active",
      },
      { merge: true },
    );
    batch.set(db.collection("memberships").doc(`${clubId}_${m.authUid}`), {
      clubId,
      memberId: m.memberId,
      authUid: m.authUid,
      role: m.role,
      status: "active",
      joinDate: Timestamp.now(),
      licenseNumber: null,
    });
  }

  batch.set(db.collection("announcements").doc(), {
    clubId,
    createdByMemberId: ADMIN_MEMBER_ID,
    title: "Bienvenue au club !",
    body: "Ceci est une annonce de démonstration pour l'environnement de staging.",
    isPinned: true,
    publishedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    visibility: "members",
  });

  batch.set(db.collection("events").doc(), {
    clubId,
    title: "Soirée fléchettes",
    description: "Entraînement hebdomadaire",
    startsAt: Timestamp.fromDate(new Date(Date.now() + 7 * 86_400_000)),
    location: "Salle des fêtes",
    category: "training",
  });

  const paymentCallRef = db.collection("payment_calls").doc();
  batch.set(paymentCallRef, {
    clubId,
    title: "Cotisation annuelle 2026",
    detail: "Cotisation obligatoire pour la saison",
    category: "cotisation",
    amountCents: 5000,
    currency: "eur",
    dueDate: Timestamp.fromDate(new Date(Date.now() + 30 * 86_400_000)),
    createdByMemberId: adminUid,
    createdAt: Timestamp.now(),
  });

  batch.set(db.collection("payment_call_items").doc(), {
    paymentCallId: paymentCallRef.id,
    clubId,
    memberId: MEMBER_MEMBER_ID,
    isPaid: false,
    paidAt: null,
    method: null,
    declaredAt: null,
    reference: null,
    validatedByMemberId: null,
    remindedAt: null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const tournamentId = "26e5ad85-09c2-4c7b-9db8-af6b50bd5804";
  batch.set(db.collection("tournaments").doc(tournamentId), {
    clubId,
    name: "Open de rentrée",
    date: Timestamp.fromDate(new Date(Date.now() + 14 * 86_400_000)),
    location: "Club house",
    markerIds: [ADMIN_MEMBER_ID, BOARD_MEMBER_ID],
    isFinished: false,
  });
  batch.set(db.collection("tournament_entries").doc("9b6a61b4-4b51-4ed0-bb7c-ef8546f53d05"), {
    clubId,
    tournamentId,
    tableau: "Tableau principal",
    tour: "Premier tour",
    playerA: "Admin Demo",
    playerB: "Bureau Demo",
    scoreA: 0,
    scoreB: 0,
    note: "Rencontre à venir",
    recordedByMemberId: ADMIN_MEMBER_ID,
    recordedAt: Timestamp.now(),
  });

  const conversationId = "c6ce0ab0-1c4e-4b22-8fad-1a67d17f9806";
  batch.set(db.collection("conversations").doc(conversationId), {
    clubId,
    kind: "bureau",
    participantIds: [MEMBER_MEMBER_ID],
  });
  batch.set(db.collection("conversations").doc(conversationId).collection("messages").doc("92edf416-93c1-4999-86b1-a9fb4b294e07"), {
    senderId: MEMBER_MEMBER_ID,
    text: "Bonjour, pouvez-vous confirmer mon inscription au tournoi ?",
    sentAt: Timestamp.now(),
    readBy: [MEMBER_MEMBER_ID],
  });

  await batch.commit();

  console.log("Seed complete:");
  console.log("  club:", clubId);
  for (const m of members) {
    console.log(`  ${m.role}: ${m.email} / ${DEMO_PASSWORD} (uid ${m.uid})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
