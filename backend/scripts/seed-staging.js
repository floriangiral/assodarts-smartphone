#!/usr/bin/env node
/**
 * Seed a staging club with a clean demo configuration.
 *
 * Usage:
 *   node backend/scripts/seed-staging.js \
 *     --project-id assodarts-staging \
 *     --club-name "Saint-Flour Fléchettes" \
 *     --admin-email admin@assodarts.test \
 *     --board-email bureau@assodarts.test \
 *     --member-email membre@assodarts.test \
 *     --apple-review-email apple-review@assodarts.app
 *
 * Notes:
 * - No hard-coded secrets or fixed passwords.
 * - Passwords are generated with crypto.randomBytes for each newly created account.
 * - The Apple review account is never recreated if it already exists.
 * - If the Apple review account does not exist at all, the script exits with an explicit error.
 */

const { randomUUID, randomBytes } = require("crypto");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generatePassword() {
  return randomBytes(18).toString("base64url").replace(/[-_]/g, "").slice(0, 24);
}

async function ensureOrCreateUser(auth, email, firstName, lastName) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const displayName = `${firstName} ${lastName}`.trim();

  try {
    const existing = await auth.getUserByEmail(normalizedEmail);
    return {
      uid: existing.uid,
      created: false,
      password: null,
      email: normalizedEmail,
    };
  } catch (error) {
    if (error && error.code !== "auth/user-not-found") {
      throw error;
    }
  }

  const password = generatePassword();
  const created = await auth.createUser({
    email: normalizedEmail,
    password,
    displayName,
  });

  return {
    uid: created.uid,
    created: true,
    password,
    email: normalizedEmail,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const projectId = String(args["project-id"] || "").trim();
  if (!projectId) {
    throw new Error("Missing required --project-id");
  }

  const clubName = String(args["club-name"] || "Saint-Flour Fléchettes").trim();
  const adminEmail = String(args["admin-email"] || "").trim().toLowerCase();
  const boardEmail = String(args["board-email"] || "").trim().toLowerCase();
  const memberEmail = String(args["member-email"] || "").trim().toLowerCase();
  const appleReviewEmail = String(args["apple-review-email"] || "").trim().toLowerCase();

  if (!adminEmail || !boardEmail || !memberEmail || !appleReviewEmail) {
    throw new Error(
      "Missing required args: --admin-email, --board-email, --member-email, --apple-review-email",
    );
  }

  initializeApp({
    credential: applicationDefault(),
    projectId,
  });

  const db = getFirestore();
  const auth = getAuth();

  const clubId = slugify(clubName);
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const adminAccount = await ensureOrCreateUser(auth, adminEmail, "Admin", "Club");
  const boardAccount = await ensureOrCreateUser(auth, boardEmail, "Bureau", "Club");
  const memberAccount = await ensureOrCreateUser(auth, memberEmail, "Membre", "Club");

  let appleReviewUid = null;
  try {
    const appleUser = await auth.getUserByEmail(appleReviewEmail);
    appleReviewUid = appleUser.uid;
  } catch (error) {
    if (error && error.code !== "auth/user-not-found") {
      throw error;
    }
    throw new Error(`Apple review account does not exist: ${appleReviewEmail}`);
  }

  const adminMemberId = randomUUID();
  const boardMemberId = randomUUID();
  const memberMemberId = randomUUID();
  const appleMemberId = randomUUID();

  const batch = db.batch();

  batch.set(
    db.collection("clubs").doc(clubId),
    {
      name: clubName,
      address: "Saint-Flour",
      country: "FR",
      createdAt: Timestamp.now(),
      subscriptionStatus: "trial",
      trialEndsAt: Timestamp.fromDate(trialEndsAt),
    },
    { merge: true },
  );

  const members = [
    {
      memberId: adminMemberId,
      authUid: adminAccount.uid,
      firstName: "Admin",
      lastName: "Club",
      email: adminAccount.email,
      role: "admin",
      displayName: "Admin Club",
    },
    {
      memberId: boardMemberId,
      authUid: boardAccount.uid,
      firstName: "Bureau",
      lastName: "Club",
      email: boardAccount.email,
      role: "board",
      displayName: "Bureau Club",
    },
    {
      memberId: memberMemberId,
      authUid: memberAccount.uid,
      firstName: "Membre",
      lastName: "Club",
      email: memberAccount.email,
      role: "member",
      displayName: "Membre Club",
    },
    {
      memberId: appleMemberId,
      authUid: appleReviewUid,
      firstName: "Apple",
      lastName: "Review",
      email: appleReviewEmail,
      role: "board",
      displayName: "Apple Review",
    },
  ];

  for (const member of members) {
    batch.set(
      db.collection("members").doc(member.memberId),
      {
        authUid: member.authUid,
        clubId,
        firstName: member.firstName,
        lastName: member.lastName,
        displayName: member.displayName,
        email: member.email,
        phone: null,
        status: "active",
      },
      { merge: true },
    );

    batch.set(db.collection("memberships").doc(`${clubId}_${member.authUid}`), {
      clubId,
      memberId: member.memberId,
      authUid: member.authUid,
      role: member.role,
      status: "active",
      joinDate: Timestamp.now(),
      licenseNumber: null,
    });
  }

  const announcementId = randomUUID();
  batch.set(db.collection("announcements").doc(announcementId), {
    clubId,
    createdByMemberId: adminMemberId,
    title: "Bienvenue dans Saint-Flour Fléchettes",
    body: "Le club est prêt pour la saison. Bienvenue à tous !",
    isPinned: true,
    publishedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    visibility: "members",
  });

  const eventId = randomUUID();
  batch.set(db.collection("events").doc(eventId), {
    clubId,
    title: "Soirée d'ouverture",
    description: "Première rencontre de la saison, suivi d'entraînement libre.",
    startsAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    location: "Salle du club",
    category: "training",
  });

  const paymentCallId = randomUUID();
  batch.set(db.collection("payment_calls").doc(paymentCallId), {
    clubId,
    title: "Cotisation de saison",
    detail: "Cotisation annuelle pour la saison en cours",
    category: "cotisation",
    amountCents: 5000,
    currency: "eur",
    dueDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    createdByMemberId: adminMemberId,
    createdAt: Timestamp.now(),
  });

  batch.set(db.collection("payment_call_items").doc(randomUUID()), {
    paymentCallId,
    clubId,
    memberId: memberMemberId,
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

  console.log("Seed complete.");
  console.log(`clubId: ${clubId}`);
  console.log(`clubName: ${clubName}`);
  console.log(`admin: ${adminAccount.email} / ${adminAccount.password ?? "[existing account]"}`);
  console.log(`board: ${boardAccount.email} / ${boardAccount.password ?? "[existing account]"}`);
  console.log(`member: ${memberAccount.email} / ${memberAccount.password ?? "[existing account]"}`);
  console.log(`apple-review: ${appleReviewEmail} / [password not displayed, account preserved]`);
  console.log(`trialEndsAt: ${trialEndsAt.toISOString()}`);
}

main().catch((error) => {
  console.error("Seed failed.");
  console.error(error);
  process.exit(1);
});
