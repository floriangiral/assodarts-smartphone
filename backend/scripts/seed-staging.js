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
const DEMO_PASSWORD = "Assodarts-Demo-2026!";

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
    { uid: adminUid, email: ADMIN_EMAIL, firstName: "Admin", lastName: "Demo", role: "admin" },
    { uid: boardUid, email: BOARD_EMAIL, firstName: "Bureau", lastName: "Demo", role: "board" },
    { uid: memberUid, email: MEMBER_EMAIL, firstName: "Membre", lastName: "Demo", role: "member" },
  ];

  for (const m of members) {
    batch.set(
      db.collection("members").doc(m.uid),
      {
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
    batch.set(db.collection("memberships").doc(`${clubId}_${m.uid}`), {
      clubId,
      memberId: m.uid,
      role: m.role,
      status: "active",
      joinDate: Timestamp.now(),
      licenseNumber: null,
    });
  }

  batch.set(db.collection("announcements").doc(), {
    clubId,
    createdByMemberId: adminUid,
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
    memberId: memberUid,
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
