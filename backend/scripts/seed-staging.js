#!/usr/bin/env node
/**
 * Seed a staging club with a complete demo configuration.
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
 *     --apple-review-email apple-review@assodarts.app \
 *     --demo-password Demo1234!
 *
 * Notes:
 * - The admin/board/member demo accounts are created or updated with the
 *   provided simple password.
 * - The Apple review account is created or updated with the same demo password.
 */

const { randomUUID } = require("crypto");
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

const DEFAULT_DEMO_PASSWORD = "Demo1234!";
const SEEDED_COUPON_ID = "3e8688f3-2fb5-4d49-8f11-1e54dc5a0101";
const SEEDED_PLATFORM_ANNOUNCEMENT_ID =
  "89ef8d8b-f20c-480b-a31d-f11a3cf38201";

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

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
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

async function ensureOrCreateUser(auth, email, firstName, lastName, password) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const displayName = `${firstName} ${lastName}`.trim();

  try {
    const existing = await auth.getUserByEmail(normalizedEmail);
    await auth.updateUser(existing.uid, {
      displayName,
      password,
      emailVerified: true,
      disabled: false,
    });
    return {
      uid: existing.uid,
      created: false,
      password,
      email: normalizedEmail,
    };
  } catch (error) {
    if (error && error.code !== "auth/user-not-found") {
      throw error;
    }
  }

  const created = await auth.createUser({
    email: normalizedEmail,
    password,
    displayName,
    emailVerified: true,
  });

  return {
    uid: created.uid,
    created: true,
    password,
    email: normalizedEmail,
  };
}

function setNotification(batch, db, clubId, targetMemberId, name, payload) {
  batch.set(
    db.collection("notifications").doc(seedDocumentId(clubId, name)),
    {
      memberId: targetMemberId,
      clubId,
      kind: payload.kind,
      title: payload.title,
      body: payload.body,
      payload: payload.payload || {},
      createdAt: Timestamp.fromDate(payload.createdAt || new Date()),
      readAt: payload.read ? Timestamp.fromDate(daysFromNow(-1)) : null,
    },
    { merge: true },
  );
}

function paymentItemPayload({
  paymentCallId,
  clubId,
  memberId,
  isPaid = false,
  paidAt = null,
  method = null,
  declaredAt = null,
  reference = null,
  validatedByMemberId = null,
  remindedAt = null,
}) {
  return {
    paymentCallId,
    clubId,
    memberId,
    isPaid,
    paidAt: paidAt ? Timestamp.fromDate(paidAt) : null,
    method,
    declaredAt: declaredAt ? Timestamp.fromDate(declaredAt) : null,
    reference,
    validatedByMemberId,
    remindedAt: remindedAt ? Timestamp.fromDate(remindedAt) : null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    updatedAt: FieldValue.serverTimestamp(),
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
  const demoPassword = String(
    args["demo-password"] || DEFAULT_DEMO_PASSWORD,
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
  if (demoPassword.length < 6) {
    throw new Error("--demo-password must contain at least 6 characters");
  }

  initializeApp({
    credential: applicationDefault(),
    projectId,
  });

  const db = getFirestore();
  const auth = getAuth();

  const clubId = slugify(clubName);
  const secondClubId = slugify(secondClubName);
  const trialEndsAt = daysFromNow(30);

  const adminAccount = await ensureOrCreateUser(
    auth,
    adminEmail,
    "Admin",
    "Démo",
    demoPassword,
  );
  const appleReviewAccount = await ensureOrCreateUser(
    auth,
    appleReviewEmail,
    "Apple",
    "Review",
    demoPassword,
  );
  const boardAccount = await ensureOrCreateUser(
    auth,
    boardEmail,
    "Bureau",
    "Démo",
    demoPassword,
  );
  const memberAccount = await ensureOrCreateUser(
    auth,
    memberEmail,
    "Membre",
    "Démo",
    demoPassword,
  );

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
    appleReviewAccount.uid,
    randomUUID(),
  );
  const inactiveMemberId = seedDocumentId(clubId, "inactive-member");
  const stripe = await prepareStripeAccount(db, clubId, clubName);
  let platformAdminUid = null;
  if (platformAdminEmail) {
    platformAdminUid = (await auth.getUserByEmail(platformAdminEmail)).uid;
  }

  const batch = db.batch();

  batch.set(
    db.collection("clubs").doc(clubId),
    {
      name: clubName,
      address: "Saint-Flour",
      country: "FR",
      createdAt: Timestamp.fromDate(daysFromNow(-45)),
      subscriptionStatus: "trial",
      trialEndsAt: Timestamp.fromDate(trialEndsAt),
      couponCode: "DEMO50",
    },
    { merge: true },
  );

  const members = [
    {
      memberId: adminMemberId,
      authUid: adminAccount.uid,
      firstName: "Admin",
      lastName: "Démo",
      email: adminAccount.email,
      phone: "0600000001",
      role: "admin",
      licenseNumber: "FFD-DEMO-001",
      displayName: "Admin Démo",
      notifyTournaments: true,
    },
    {
      memberId: boardMemberId,
      authUid: boardAccount.uid,
      firstName: "Bureau",
      lastName: "Démo",
      email: boardAccount.email,
      phone: "0600000002",
      role: "board",
      licenseNumber: "FFD-DEMO-002",
      displayName: "Bureau Démo",
      notifyTournaments: true,
    },
    {
      memberId: memberMemberId,
      authUid: memberAccount.uid,
      firstName: "Membre",
      lastName: "Démo",
      email: memberAccount.email,
      phone: "0600000003",
      role: "member",
      licenseNumber: null,
      displayName: "Membre Démo",
      notifyTournaments: false,
    },
    {
      memberId: appleMemberId,
      authUid: appleReviewAccount.uid,
      firstName: "Apple",
      lastName: "Review",
      email: appleReviewEmail,
      phone: null,
      role: "admin",
      licenseNumber: "FFD-APPLE-REVIEW",
      displayName: "Apple Review",
      notifyTournaments: true,
    },
    {
      memberId: inactiveMemberId,
      authUid: `${clubId}-inactive-member`,
      firstName: "Ancien",
      lastName: "Membre",
      email: "ancien.membre@assodarts.test",
      phone: "0600000004",
      role: "member",
      licenseNumber: "FFD-DEMO-999",
      displayName: "Ancien Membre",
      notifyTournaments: false,
      inactive: true,
    },
  ];

  for (const member of members) {
    batch.set(
      db.collection("members").doc(member.memberId),
      {
        authUid: member.authUid,
        clubId,
        defaultClubId: clubId,
        firstName: member.firstName,
        lastName: member.lastName,
        displayName: member.displayName,
        email: member.email,
        phone: member.phone,
        birthDate: Timestamp.fromDate(daysFromNow(-365 * 30)),
        notifyAnnouncements: true,
        notifyEvents: true,
        notifyPayments: true,
        notifyTournaments: member.notifyTournaments,
        status: member.inactive ? "inactive" : "active",
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
        status: member.inactive ? "inactive" : "active",
        joinDate: Timestamp.fromDate(daysFromNow(member.inactive ? -450 : -35)),
        licenseNumber: member.licenseNumber,
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
      stripeChargesEnabled: stripe.status === "verified",
      stripeDetailsSubmitted: stripe.status === "verified",
      acceptsTransfer: true,
      acceptsCash: true,
      transferNote: "Virement avec le nom du membre en référence.",
      cashNote: "Règlement en espèces au bureau pendant les entraînements.",
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
      createdAt: Timestamp.fromDate(daysFromNow(-20)),
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
        joinDate: Timestamp.fromDate(daysFromNow(-10)),
        licenseNumber: null,
      },
      { merge: true },
    );
  }

  const announcements = [
    {
      id: seedDocumentId(clubId, "announcement-welcome"),
      title: `Bienvenue dans ${clubName}`,
      body: "Le club est prêt pour la saison. Retrouvez ici les annonces importantes du bureau.",
      isPinned: true,
      createdByMemberId: adminMemberId,
      publishedAt: daysFromNow(-5),
    },
    {
      id: seedDocumentId(clubId, "announcement-equipment"),
      title: "Commande de maillots",
      body: "Dernier délai vendredi pour confirmer la taille du maillot de compétition.",
      isPinned: false,
      createdByMemberId: boardMemberId,
      publishedAt: daysFromNow(-2),
    },
  ];
  for (const announcement of announcements) {
    batch.set(
      db.collection("announcements").doc(announcement.id),
      {
        clubId,
        createdByMemberId: announcement.createdByMemberId,
        title: announcement.title,
        body: announcement.body,
        isPinned: announcement.isPinned,
        publishedAt: Timestamp.fromDate(announcement.publishedAt),
        createdAt: Timestamp.fromDate(announcement.publishedAt),
        visibility: "members",
      },
      { merge: true },
    );
  }

  const events = [
    {
      id: seedDocumentId(clubId, "event-training"),
      title: "Entraînement libre",
      description: "Créneaux ouverts, travail des doubles et matchs amicaux.",
      startsAt: daysFromNow(3),
      location: "Salle du club",
      category: "entrainement",
    },
    {
      id: seedDocumentId(clubId, "event-competition"),
      title: "Déplacement championnat",
      description: "Rendez-vous au club avant le départ groupé.",
      startsAt: daysFromNow(9),
      location: "Issoire",
      category: "competition",
    },
    {
      id: seedDocumentId(clubId, "event-meeting"),
      title: "Réunion du bureau",
      description: "Préparation du calendrier et point trésorerie.",
      startsAt: daysFromNow(12),
      location: "Bureau associatif",
      category: "reunion",
    },
    {
      id: seedDocumentId(clubId, "event-social"),
      title: "Repas du club",
      description: "Soirée conviviale ouverte aux adhérents.",
      startsAt: daysFromNow(18),
      location: "Maison des associations",
      category: "convivial",
    },
  ];
  for (const event of events) {
    batch.set(
      db.collection("events").doc(event.id),
      {
        clubId,
        title: event.title,
        description: event.description,
        startsAt: Timestamp.fromDate(event.startsAt),
        location: event.location,
        category: event.category,
      },
      { merge: true },
    );
  }

  const registrations = [
    [events[0].id, adminMemberId, "going"],
    [events[0].id, boardMemberId, "going"],
    [events[0].id, memberMemberId, "declined"],
    [events[1].id, boardMemberId, "going"],
    [events[1].id, appleMemberId, "going"],
    [events[3].id, memberMemberId, "going"],
  ];
  for (const [eventId, memberId, status] of registrations) {
    batch.set(
      db
        .collection("event_registrations")
        .doc(seedDocumentId(clubId, `registration-${eventId}-${memberId}`)),
      {
        clubId,
        eventId,
        memberId,
        status,
      },
      { merge: true },
    );
  }

  const paymentCalls = [
    {
      id: seedDocumentId(clubId, "payment-cotisation"),
      title: "Cotisation de saison",
      detail: "Cotisation annuelle pour la saison en cours",
      category: "cotisation",
      amountCents: 5000,
      dueDate: daysFromNow(-5),
      notify: true,
      items: [
        {
          memberId: adminMemberId,
          isPaid: true,
          paidAt: daysFromNow(-15),
          method: "card",
          validatedByMemberId: adminMemberId,
        },
        {
          memberId: boardMemberId,
          declaredAt: daysFromNow(-2),
          method: "transfer",
          reference: "VIR BUREAU DEMO",
        },
        {
          memberId: memberMemberId,
          remindedAt: daysFromNow(-1),
        },
        {
          memberId: appleMemberId,
          isPaid: true,
          paidAt: daysFromNow(-3),
          method: "apple_pay",
          validatedByMemberId: adminMemberId,
        },
      ],
    },
    {
      id: seedDocumentId(clubId, "payment-kit"),
      title: "Commande de maillot",
      detail: "Maillot club saison 2026-2027",
      category: "tenue",
      amountCents: 3200,
      dueDate: daysFromNow(16),
      notify: true,
      items: [
        {
          memberId: adminMemberId,
          isPaid: true,
          paidAt: daysFromNow(-1),
          method: "cash",
          validatedByMemberId: boardMemberId,
        },
        { memberId: boardMemberId },
        { memberId: memberMemberId },
        { memberId: appleMemberId },
      ],
    },
    {
      id: seedDocumentId(clubId, "payment-trip"),
      title: "Participation déplacement",
      detail: "Frais partagés pour le championnat extérieur",
      category: "deplacement",
      amountCents: 1200,
      dueDate: daysFromNow(8),
      notify: false,
      items: [
        {
          memberId: boardMemberId,
          isPaid: true,
          paidAt: daysFromNow(-1),
          method: "transfer",
          validatedByMemberId: adminMemberId,
        },
        {
          memberId: memberMemberId,
          declaredAt: daysFromNow(-1),
          method: "cash",
          reference: "Espèces remises à l'entraînement",
        },
      ],
    },
    {
      id: seedDocumentId(clubId, "payment-other"),
      title: "Don buvette",
      detail: "Participation libre pour la buvette du tournoi",
      category: "autre",
      amountCents: 500,
      dueDate: daysFromNow(21),
      notify: true,
      items: [
        { memberId: adminMemberId },
        {
          memberId: memberMemberId,
          isPaid: true,
          paidAt: daysFromNow(-2),
          method: "google_pay",
          validatedByMemberId: adminMemberId,
        },
      ],
    },
  ];
  for (const call of paymentCalls) {
    batch.set(
      db.collection("payment_calls").doc(call.id),
      {
        clubId,
        title: call.title,
        detail: call.detail,
        category: call.category,
        amountCents: call.amountCents,
        currency: "eur",
        dueDate: Timestamp.fromDate(call.dueDate),
        createdByMemberId: adminMemberId,
        createdAt: Timestamp.fromDate(daysFromNow(-18)),
        notify: call.notify,
      },
      { merge: true },
    );
    for (const item of call.items) {
      batch.set(
        db
          .collection("payment_call_items")
          .doc(seedDocumentId(clubId, `${call.id}-${item.memberId}`)),
        paymentItemPayload({
          paymentCallId: call.id,
          clubId,
          memberId: item.memberId,
          isPaid: item.isPaid,
          paidAt: item.paidAt,
          method: item.method,
          declaredAt: item.declaredAt,
          reference: item.reference,
          validatedByMemberId: item.validatedByMemberId,
          remindedAt: item.remindedAt,
        }),
        { merge: true },
      );
    }
  }

  const upcomingTournamentId = seedDocumentId(clubId, "tournament-upcoming");
  const finishedTournamentId = seedDocumentId(clubId, "tournament-finished");
  const tournaments = [
    {
      id: upcomingTournamentId,
      name: "Tournoi de rentrée",
      date: daysFromNow(14),
      location: "Salle du club",
      markerIds: [boardMemberId, appleMemberId],
      isFinished: false,
    },
    {
      id: finishedTournamentId,
      name: "Open interne de démo",
      date: daysFromNow(-6),
      location: "Salle du club",
      markerIds: [adminMemberId],
      isFinished: true,
    },
  ];
  for (const tournament of tournaments) {
    batch.set(
      db.collection("tournaments").doc(tournament.id),
      {
        clubId,
        name: tournament.name,
        date: Timestamp.fromDate(tournament.date),
        location: tournament.location,
        markerIds: tournament.markerIds,
        isFinished: tournament.isFinished,
      },
      { merge: true },
    );
  }

  const tournamentEntries = [
    {
      tournamentId: upcomingTournamentId,
      name: "upcoming-match-a",
      tableau: "A",
      tour: "Poules",
      playerA: "Bureau Démo",
      playerB: "Membre Démo",
      scoreA: 3,
      scoreB: 1,
      note: "Match saisi par un marqueur.",
      recordedByMemberId: boardMemberId,
    },
    {
      tournamentId: finishedTournamentId,
      name: "finished-final",
      tableau: "Finale",
      tour: "Finale",
      playerA: "Admin Démo",
      playerB: "Apple Review",
      scoreA: 4,
      scoreB: 2,
      note: "Finale terminée.",
      recordedByMemberId: adminMemberId,
    },
  ];
  for (const entry of tournamentEntries) {
    batch.set(
      db.collection("tournament_entries").doc(seedDocumentId(clubId, entry.name)),
      {
        clubId,
        tournamentId: entry.tournamentId,
        tableau: entry.tableau,
        tour: entry.tour,
        playerA: entry.playerA,
        playerB: entry.playerB,
        scoreA: entry.scoreA,
        scoreB: entry.scoreB,
        note: entry.note,
        recordedByMemberId: entry.recordedByMemberId,
        recordedAt: Timestamp.fromDate(daysFromNow(-1)),
      },
      { merge: true },
    );
  }

  const conversations = [
    {
      id: seedDocumentId(clubId, "bureau-conversation"),
      kind: "bureau",
      participantIds: [adminMemberId, boardMemberId, appleMemberId],
      messages: [
        {
          id: seedDocumentId(clubId, "bureau-message-admin"),
          senderId: adminMemberId,
          text: "Bienvenue dans la messagerie du bureau.",
          readBy: [adminMemberId, boardMemberId],
        },
        {
          id: seedDocumentId(clubId, "bureau-message-apple"),
          senderId: appleMemberId,
          text: "Compte de revue Apple rattaché au club de démo.",
          readBy: [appleMemberId],
        },
      ],
    },
    {
      id: seedDocumentId(clubId, "direct-conversation"),
      kind: "direct",
      participantIds: [boardMemberId, memberMemberId],
      messages: [
        {
          id: seedDocumentId(clubId, "direct-message-board"),
          senderId: boardMemberId,
          text: "Bonjour, prêt pour le prochain entraînement ?",
          readBy: [boardMemberId],
        },
        {
          id: seedDocumentId(clubId, "direct-message-member"),
          senderId: memberMemberId,
          text: "Oui, je passerai après le travail.",
          readBy: [boardMemberId, memberMemberId],
        },
      ],
    },
  ];
  for (const conversation of conversations) {
    batch.set(
      db.collection("conversations").doc(conversation.id),
      {
        clubId,
        kind: conversation.kind,
        participantIds: conversation.participantIds,
      },
      { merge: true },
    );
    for (const message of conversation.messages) {
      batch.set(
        db
          .collection("conversations")
          .doc(conversation.id)
          .collection("messages")
          .doc(message.id),
        {
          senderId: message.senderId,
          text: message.text,
          sentAt: Timestamp.fromDate(daysFromNow(-1)),
          readBy: message.readBy,
        },
        { merge: true },
      );
    }
  }

  const invitationEmail = "invite.demo@assodarts.test";
  batch.set(
    db.collection("invitations").doc(`${clubId}_${invitationEmail}`),
    {
      clubId,
      email: invitationEmail,
      role: "member",
      licenseNumber: "FFD-INVITE-001",
      status: "pending",
      invitedByMemberId: adminMemberId,
      createdAt: Timestamp.fromDate(daysFromNow(-1)),
      acceptedAt: null,
      acceptedByMemberId: null,
    },
    { merge: true },
  );

  batch.set(
    db.collection("coupons").doc(SEEDED_COUPON_ID),
    {
      code: "DEMO50",
      percent: 50,
      expiresAt: Timestamp.fromDate(daysFromNow(60)),
      clubIds: [clubId],
      autoRenew: false,
      createdAt: Timestamp.fromDate(daysFromNow(-3)),
      createdBy: platformAdminUid || adminAccount.uid,
    },
    { merge: true },
  );

  batch.set(
    db.collection("platform_announcements").doc(SEEDED_PLATFORM_ANNOUNCEMENT_ID),
    {
      title: "Maintenance de démonstration",
      body: "Annonce plateforme visible dans la console développeur.",
      audience: "all",
      publishedAt: Timestamp.fromDate(daysFromNow(-1)),
      publishedBy: platformAdminUid || adminAccount.uid,
    },
    { merge: true },
  );

  setNotification(batch, db, clubId, memberMemberId, "notification-announcement", {
    kind: "announcement",
    title: "Nouvelle annonce",
    body: "Commande de maillots publiée par le bureau.",
    payload: { announcementId: announcements[1].id },
    createdAt: daysFromNow(-2),
  });
  setNotification(batch, db, clubId, memberMemberId, "notification-event", {
    kind: "event",
    title: "Nouvel événement",
    body: "Repas du club ajouté au calendrier.",
    payload: { eventId: events[3].id, startsAt: events[3].startsAt.toISOString() },
    createdAt: daysFromNow(-1),
  });
  setNotification(batch, db, clubId, memberMemberId, "notification-payment-due", {
    kind: "payment_due",
    title: "Paiement en attente",
    body: "Cotisation de saison à régler.",
    payload: {
      callId: paymentCalls[0].id,
      label: paymentCalls[0].title,
      amountCents: paymentCalls[0].amountCents,
      dueDate: paymentCalls[0].dueDate.toISOString(),
    },
    createdAt: daysFromNow(-1),
  });
  setNotification(batch, db, clubId, boardMemberId, "notification-payment-confirm", {
    kind: "payment_to_confirm",
    title: "Paiement à confirmer",
    body: "Membre Démo a déclaré un paiement en espèces.",
    payload: {
      callId: paymentCalls[2].id,
      memberName: "Membre Démo",
      method: "cash",
    },
    createdAt: daysFromNow(-1),
  });
  setNotification(batch, db, clubId, memberMemberId, "notification-message", {
    kind: "message",
    title: "Nouveau message",
    body: "Bureau Démo vous a écrit.",
    payload: { conversationId: conversations[1].id },
    createdAt: daysFromNow(-1),
    read: true,
  });
  setNotification(batch, db, clubId, appleMemberId, "notification-platform", {
    kind: "platform_announcement",
    title: "Annonce plateforme",
    body: "Compte Apple Review prêt pour la vérification.",
    payload: { label: "Apple Review" },
    createdAt: daysFromNow(-1),
  });
  setNotification(batch, db, clubId, adminMemberId, "notification-tournament", {
    kind: "tournament",
    title: "Résultat de tournoi",
    body: "Finale de l'Open interne enregistrée.",
    payload: { tournamentId: finishedTournamentId },
    createdAt: daysFromNow(-1),
  });

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
  console.log(`admin: ${adminAccount.email} / ${adminAccount.password}`);
  console.log(`board: ${boardAccount.email} / ${boardAccount.password}`);
  console.log(`member: ${memberAccount.email} / ${memberAccount.password}`);
  console.log(`apple-review: ${appleReviewAccount.email} / ${appleReviewAccount.password}`);
  console.log(`trialEndsAt: ${trialEndsAt.toISOString()}`);
  console.log(`announcements: ${announcements.map((item) => item.id).join(", ")}`);
  console.log(`events: ${events.map((item) => item.id).join(", ")}`);
  console.log(`paymentCalls: ${paymentCalls.map((item) => item.id).join(", ")}`);
  console.log(
    `tournaments: ${upcomingTournamentId}, ${finishedTournamentId}`,
  );
  console.log(
    `conversations: ${conversations.map((item) => item.id).join(", ")}`,
  );
  console.log(`coupon: DEMO50 (${SEEDED_COUPON_ID})`);
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
