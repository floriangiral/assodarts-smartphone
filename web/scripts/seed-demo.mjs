import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

if (
  process.env.GCLOUD_PROJECT !== "demo-assodarts-web" ||
  !/^(127\.0\.0\.1|localhost):8080$/.test(
    process.env.FIRESTORE_EMULATOR_HOST ?? "",
  ) ||
  !/^(127\.0\.0\.1|localhost):9099$/.test(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "",
  )
) {
  throw new Error(
    "La démonstration nécessite les émulateurs Auth/Firestore locaux et le projet demo-assodarts-web.",
  );
}
initializeApp({ projectId: "demo-assodarts-web" });
const auth = getAuth();
const db = getFirestore();
const clubId = "11111111-1111-4111-8111-111111111111";
const members = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    uid: "demo-member-uid",
    email: "membre@demo.assodarts.test",
    password: "DartsDemo123!",
    firstName: "Alex",
    lastName: "Martin",
    role: "member",
    licenseNumber: "FFD-1024",
    seasonStatus: "player",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    uid: "demo-board-uid",
    email: "bureau@demo.assodarts.test",
    password: "DartsDemo123!",
    firstName: "Camille",
    lastName: "Durand",
    role: "board",
    licenseNumber: "",
    seasonStatus: "member",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    uid: "demo-admin-uid",
    email: "admin@demo.assodarts.test",
    password: "DartsDemo123!",
    firstName: "Morgan",
    lastName: "Petit",
    role: "admin",
    licenseNumber: "FFD-1001",
    seasonStatus: "player",
  },
];
const platformAdmin = {
  uid: "demo-platform-admin-uid",
  email: "developpeur@demo.assodarts.test",
  password: "DartsDemo123!",
  firstName: "Sam",
  lastName: "Demo",
};
for (const user of [...members, platformAdmin]) {
  const credentials = {
    email: user.email,
    password: user.password,
    displayName: `${user.firstName} ${user.lastName}`,
    emailVerified: true,
  };
  try {
    await auth.updateUser(user.uid, credentials);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    try {
      const byEmail = await auth.getUserByEmail(user.email);
      await auth.deleteUser(byEmail.uid);
    } catch (lookupError) {
      if (lookupError.code !== "auth/user-not-found") throw lookupError;
    }
    await auth.createUser({ uid: user.uid, ...credentials });
  }
}
const now = Date.now();
const days = (number) => Timestamp.fromDate(new Date(now + number * 86400000));
const data = [
  ["club_slugs/club-a", { clubId, status: "active" }],
  ["club_slugs/ancien-club", { clubId, status: "alias" }],
  [
    `clubs/${clubId}`,
    {
      name: "Les Fléchettes du Centre",
      address: "Maison des associations, Lyon",
      country: "FR",
      createdAt: Timestamp.fromDate(new Date(now - 365 * 86400000)),
      subscriptionStatus: "trial",
      trialEndsAt: days(14),
    },
  ],
  [
    `clubs_public/${clubId}`,
    {
      slug: "club-a",
      name: "Les Fléchettes du Centre",
      city: "Lyon",
      description:
        "Un club convivial ouvert aux débutants comme aux joueurs confirmés. Retrouvez-nous pour partager notre passion des fléchettes.",
      schedule: "Mardi et jeudi, de 19 h à 22 h",
      address: "Maison des associations\nLyon",
      contactEmail: "contact@example.org",
      isPublished: true,
    },
  ],
  [
    "events_public/tournoi-decouverte",
    {
      clubId,
      title: "Tournoi découverte",
      description:
        "Une soirée amicale pour découvrir le club et rencontrer ses joueurs. Tous les niveaux sont bienvenus.",
      startsAt: days(7),
      location: "Maison des associations, Lyon",
      isPublished: true,
    },
  ],
  [
    "events_public/entrainement",
    {
      clubId,
      title: "Entraînement du club",
      description:
        "Entraînement ouvert aux membres et aux personnes qui souhaitent découvrir les fléchettes.",
      startsAt: days(14),
      location: "Salle du club",
      isPublished: true,
    },
  ],
  [
    "events_public/soiree-passee",
    {
      clubId,
      title: "Soirée amicale précédente",
      description:
        "Une rencontre passée pour illustrer l'historique de l'agenda.",
      startsAt: days(-14),
      location: "Salle du club",
      isPublished: true,
    },
  ],
  [
    "events_public/evenement-prive",
    { clubId, title: "Événement privé", startsAt: days(3), isPublished: false },
  ],
  [
    "events/55555555-5555-4555-8555-555555555555",
    {
      clubId,
      title: "Entraînement hebdomadaire",
      description: "Séance ouverte à tous les membres du club.",
      startsAt: days(2),
      location: "Maison des associations, Lyon",
      category: "entrainement",
      visibility: "members",
      createdByMemberId: members[1].id,
    },
  ],
  [
    "events/66666666-6666-4666-8666-666666666666",
    {
      clubId,
      title: "Rencontre amicale",
      description: "Une soirée conviviale entre membres.",
      startsAt: days(8),
      location: "Salle du club",
      category: "convivial",
      visibility: "members",
      createdByMemberId: members[1].id,
    },
  ],
  [
    "events/77777777-7777-4777-8777-777777777777",
    {
      clubId,
      title: "Tournoi interclubs",
      description: "Une journée de compétition à Lyon.",
      startsAt: days(12),
      location: "Gymnase municipal, Lyon",
      category: "competition",
      visibility: "public",
      createdByMemberId: members[2].id,
    },
  ],
  [
    "announcements/88888888-8888-4888-8888-888888888888",
    {
      clubId,
      createdByMemberId: members[1].id,
      title: "Bienvenue dans l’espace club",
      body: "Les informations et les prochains rendez-vous sont réunis ici.",
      isPinned: true,
      publishedAt: Timestamp.fromDate(new Date(now - 86400000)),
      visibility: "members",
      notify: false,
      createdAt: Timestamp.fromDate(new Date(now - 86400000)),
    },
  ],
  [
    "announcements/99999999-9999-4999-8999-999999999999",
    {
      clubId,
      createdByMemberId: members[2].id,
      title: "Inscription à la compétition",
      body: "Merci de confirmer votre présence auprès du bureau.",
      isPinned: false,
      publishedAt: Timestamp.fromDate(new Date(now - 3600000)),
      visibility: "members",
      notify: false,
      createdAt: Timestamp.fromDate(new Date(now - 3600000)),
    },
  ],
  [
    "event_registrations/55555555-5555-4555-8555-555555555555_22222222-2222-4222-8222-222222222222",
    {
      clubId,
      eventId: "55555555-5555-4555-8555-555555555555",
      memberId: members[0].id,
      status: "going",
    },
  ],
  [
    "tournaments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    {
      clubId,
      name: "Tournoi de rentrée",
      date: days(10),
      location: "Salle du club",
      markerIds: [members[0].id],
      isFinished: false,
    },
  ],
  [
    "tournament_entries/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    {
      clubId,
      tournamentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tableau: "Tableau principal",
      tour: "Demi-finale",
      playerA: "Alex Martin",
      playerB: "Camille Durand",
      scoreA: 3,
      scoreB: 2,
      note: "Belle rencontre",
      recordedByMemberId: members[0].id,
      recordedAt: Timestamp.fromDate(new Date(now - 7200000)),
    },
  ],
];
const batch = db.batch();
for (const [path, value] of data) batch.set(db.doc(path), value);
for (const member of members) {
  batch.set(db.doc(`members/${member.id}`), {
    authUid: member.uid,
    clubId,
    defaultClubId: clubId,
    firstName: member.firstName,
    lastName: member.lastName,
    displayName: `${member.firstName} ${member.lastName}`,
    email: member.email,
    phone: null,
    status: "active",
  });
  batch.set(db.doc(`memberships/${clubId}_${member.uid}`), {
    clubId,
    memberId: member.id,
    authUid: member.uid,
    role: member.role,
    status: "active",
    joinDate: Timestamp.fromDate(new Date(now - 180 * 86400000)),
    licenseNumber: member.licenseNumber,
    seasonStatus: member.seasonStatus,
  });
}
batch.set(db.doc(`platform_admins/${platformAdmin.uid}`), {
  authUid: platformAdmin.uid,
  email: platformAdmin.email,
});
await batch.commit();
await db.terminate();
console.log("Données et comptes de démonstration installés dans les émulateurs locaux.");
