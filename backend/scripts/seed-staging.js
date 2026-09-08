#!/usr/bin/env node
/**
 * Seed a staging club with a clean demo configuration.
 *
 * Usage:
 *   node backend/scripts/seed-staging.js \
 *     --project-id assodarts-staging \
 *     --club-name "Saint-Flour Fléchettes" \
 *     --second-club-name "Clermont Darts Club" \
 *     --platform-admin-email admin@assodarts.test \
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

// Seed entities use deterministic ids so rerunning the script merges fixtures
// instead of duplicating them; account and member ids remain generated.
const { randomUUID, randomBytes } = require("crypto");
const { createRequire } = require("module");
const functionsRequire = createRequire(
  require.resolve("../functions/package.json"),
);
const { initializeApp, applicationDefault } =
  functionsRequire("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = functionsRequire(
  "firebase-admin/firestore",
);
const { getAuth } = functionsRequire("firebase-admin/auth");

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
  return randomBytes(18)
    .toString("base64url")
    .replace(/[-_]/g, "")
    .slice(0, 24);
}

function seedDocumentId(clubId, name) {
  return `${clubId}__seed__${slugify(name)}`;
}

async function existingMemberId(db, authUid, fallbackId) {
  const snapshot = await db
    .collection("members")
    .where("authUid", "==", authUid)
    .limit(1)
    .get();
  return snapshot.empty ? fallbackId : snapshot.docs[0].id;
}

function loadStripeClient() {
  const stripeModule = functionsRequire("stripe");
  const Stripe = stripeModule.default || stripeModule;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function prepareStripeAccount(db, clubId, clubName) {
  const bankRef = db.collection("club_bank_accounts").doc(clubId);
  const existing = await bankRef.get();
  const current = existing.data() || {};

  if (current.stripeStatus === "verified") {
    return { accountId: current.stripeAccountId || null, status: "verified" };
  }
  if (current.stripeAccountId || !process.env.STRIPE_SECRET_KEY) {
    return {
      accountId: current.stripeAccountId || null,
      status: current.stripeStatus || "pending",
    };
  }

  try {
    const account = await loadStripeClient().accounts.create({
      type: "express",
      country: "FR",
      business_type: "non_profit",
      business_profile: { name: clubName },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { club_id: clubId },
    });
    return { accountId: account.id, status: "pending" };
  } catch (error) {
    console.warn(
      `Stripe seed skipped for ${clubId}: ${error.message || error}`,
    );
    return { accountId: null, status: "pending" };
  }
}

async function ensureOrCreateUser(auth, email, firstName, lastName) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
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
  const secondClubName = String(
    args["second-club-name"] || "Clermont Darts Club",
  ).trim();
  const adminEmail = String(args["admin-email"] || "")
    .trim()
    .toLowerCase();
  const boardEmail = String(args["board-email"] || "")
    .trim()
    .toLowerCase();
  const memberEmail = String(args["member-email"] || "")
    .trim()
    .toLowerCase();
  const appleReviewEmail = String(args["apple-review-email"] || "")
    .trim()
    .toLowerCase();
  const platformAdminEmail = String(args["platform-admin-email"] || "")
    .trim()
    .toLowerCase();

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
  const secondClubId = slugify(secondClubName);
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const adminAccount = await ensureOrCreateUser(
    auth,
    adminEmail,
    "Admin",
    "Club",
  );
  const boardAccount = await ensureOrCreateUser(
    auth,
    boardEmail,
    "Bureau",
    "Club",
  );
  const memberAccount = await ensureOrCreateUser(
    auth,
    memberEmail,
    "Membre",
    "Club",
  );

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

  const adminMemberId = await existingMemberId(
    db,
    adminAccount.uid,
    randomUUID(),
  );
  const boardMemberId = await existingMemberId(
    db,
    boardAccount.uid,
    randomUUID(),
  );
  const memberMemberId = await existingMemberId(
    db,
    memberAccount.uid,
    randomUUID(),
  );
  const appleMemberId = await existingMemberId(
    db,
    appleReviewUid,
    randomUUID(),
  );
  const stripe = await prepareStripeAccount(db, clubId, clubName);
  let platformAdminUid = null;
  if (platformAdminEmail) {
    platformAdminUid = (await auth.getUserByEmail(platformAdminEmail)).uid;
  }
  const paymentItemId = seedDocumentId(clubId, "season-payment-member");
  const paymentItemExists = (
    await db.collection("payment_call_items").doc(paymentItemId).get()
  ).exists;

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

    batch.set(
      db.collection("memberships").doc(`${clubId}_${member.authUid}`),
      {
        clubId,
        memberId: member.memberId,
        authUid: member.authUid,
        role: member.role,
        status: "active",
        joinDate: Timestamp.now(),
        licenseNumber: null,
      },
      { merge: true },
    );
  }

  batch.set(
    db.collection("club_bank_accounts").doc(clubId),
    {
      clubId,
      holder: clubName,
      iban: "FR1420041010050500013M02606",
      bic: "PSSTFRPPXXX",
      bankName: "Banque de test",
      stripeStatus: stripe.status,
      stripeAccountId: stripe.accountId,
      acceptsTransfer: true,
      acceptsCash: true,
      transferNote: "Virement avec le nom du membre en référence.",
      cashNote: "Règlement en espèces au bureau.",
      updatedAt: FieldValue.serverTimestamp(),
      updatedByMemberId: adminMemberId,
    },
    { merge: true },
  );

  batch.set(
    db.collection("clubs").doc(secondClubId),
    {
      name: secondClubName,
      address: "Clermont-Ferrand",
      country: "FR",
      createdAt: Timestamp.now(),
      subscriptionStatus: "trial",
      trialEndsAt: Timestamp.fromDate(trialEndsAt),
    },
    { merge: true },
  );

  const secondMemberships = [
    { memberId: adminMemberId, authUid: adminAccount.uid, role: "admin" },
    { memberId: memberMemberId, authUid: memberAccount.uid, role: "board" },
  ];
  for (const membership of secondMemberships) {
    batch.set(
      db.collection("memberships").doc(`${secondClubId}_${membership.authUid}`),
      {
        clubId: secondClubId,
        memberId: membership.memberId,
        authUid: membership.authUid,
        role: membership.role,
        status: "active",
        joinDate: Timestamp.now(),
        licenseNumber: null,
      },
      { merge: true },
    );
  }

  const announcementId = seedDocumentId(clubId, "announcement");
  batch.set(db.collection("announcements").doc(announcementId), {
    clubId,
    createdByMemberId: adminMemberId,
    title: `Bienvenue dans ${clubName}`,
    body: "Le club est prêt pour la saison. Bienvenue à tous !",
    isPinned: true,
    publishedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    visibility: "members",
  });

  const eventId = seedDocumentId(clubId, "opening-event");
  batch.set(db.collection("events").doc(eventId), {
    clubId,
    title: "Soirée d'ouverture",
    description: "Première rencontre de la saison, suivi d'entraînement libre.",
    startsAt: Timestamp.fromDate(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ),
    location: "Salle du club",
    category: "training",
  });

  const paymentCallId = seedDocumentId(clubId, "season-payment");
  batch.set(db.collection("payment_calls").doc(paymentCallId), {
    clubId,
    title: "Cotisation de saison",
    detail: "Cotisation annuelle pour la saison en cours",
    category: "cotisation",
    amountCents: 5000,
    currency: "eur",
    dueDate: Timestamp.fromDate(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ),
    createdByMemberId: adminMemberId,
    createdAt: Timestamp.now(),
  });

  if (!paymentItemExists) {
    batch.set(
      db.collection("payment_call_items").doc(paymentItemId),
      {
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
      },
      { merge: true },
    );
  }

  const tournamentId = seedDocumentId(clubId, "back-to-school-tournament");
  batch.set(
    db.collection("tournaments").doc(tournamentId),
    {
      clubId,
      name: "Tournoi de rentrée",
      date: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
      location: "Salle du club",
      markerIds: [boardMemberId],
      isFinished: false,
    },
    { merge: true },
  );

  batch.set(
    db
      .collection("tournament_entries")
      .doc(seedDocumentId(clubId, "back-to-school-match")),
    {
      clubId,
      tournamentId,
      tableau: "A",
      tour: "1",
      playerA: "Bureau Club",
      playerB: "Membre Club",
      scoreA: 3,
      scoreB: 1,
      note: "",
      recordedByMemberId: boardMemberId,
      recordedAt: Timestamp.now(),
    },
    { merge: true },
  );

  const bureauConversationId = seedDocumentId(clubId, "bureau-conversation");
  batch.set(
    db.collection("conversations").doc(bureauConversationId),
    {
      clubId,
      kind: "bureau",
      participantIds: [adminMemberId, boardMemberId],
    },
    { merge: true },
  );
  batch.set(
    db
      .collection("conversations")
      .doc(bureauConversationId)
      .collection("messages")
      .doc(seedDocumentId(clubId, "bureau-message")),
    {
      senderId: adminMemberId,
      text: "Bienvenue dans la messagerie du bureau.",
      sentAt: Timestamp.now(),
      readBy: [adminMemberId],
    },
    { merge: true },
  );

  const directConversationId = seedDocumentId(clubId, "direct-conversation");
  batch.set(
    db.collection("conversations").doc(directConversationId),
    {
      clubId,
      kind: "direct",
      participantIds: [boardMemberId, memberMemberId],
    },
    { merge: true },
  );
  batch.set(
    db
      .collection("conversations")
      .doc(directConversationId)
      .collection("messages")
      .doc(seedDocumentId(clubId, "direct-message")),
    {
      senderId: boardMemberId,
      text: "Bonjour, prêt pour le prochain entraînement ?",
      sentAt: Timestamp.now(),
      readBy: [boardMemberId],
    },
    { merge: true },
  );

  await batch.commit();

  if (platformAdminUid) {
    await db.collection("platform_admins").doc(platformAdminUid).set({
      email: platformAdminEmail,
      addedAt: FieldValue.serverTimestamp(),
      addedBy: null,
    }, { merge: true });
  }

  console.log("Seed complete.");
  console.log(`clubId: ${clubId}`);
  console.log(`clubName: ${clubName}`);
  console.log(`secondClubId: ${secondClubId}`);
  console.log(`secondClubName: ${secondClubName}`);
  if (platformAdminUid) console.log(`platformAdmin: ${platformAdminEmail}`);
  console.log(
    `admin: ${adminAccount.email} / ${adminAccount.password ?? "[existing account]"}`,
  );
  console.log(
    `board: ${boardAccount.email} / ${boardAccount.password ?? "[existing account]"}`,
  );
  console.log(
    `member: ${memberAccount.email} / ${memberAccount.password ?? "[existing account]"}`,
  );
  console.log(
    `apple-review: ${appleReviewEmail} / [password not displayed, account preserved]`,
  );
  console.log(`trialEndsAt: ${trialEndsAt.toISOString()}`);
  console.log(`tournament: ${tournamentId} / played entry seeded`);
  console.log(
    `conversations: ${bureauConversationId}, ${directConversationId}`,
  );
  if (stripe.status === "verified") {
    console.log(`stripe: existing verified account ${stripe.accountId}`);
  } else if (stripe.accountId) {
    console.log(
      `stripe: Express test account ${stripe.accountId} created with status pending`,
    );
    console.log(
      "stripe: finish onboarding once in BankSettingsView to receive account.updated/verified",
    );
  } else {
    console.log(
      "stripe: no account created; set STRIPE_SECRET_KEY to create one, then finish onboarding in BankSettingsView",
    );
  }
}

main().catch((error) => {
  console.error("Seed failed.");
  console.error(error);
  process.exit(1);
});
