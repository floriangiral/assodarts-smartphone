import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

if (
  process.env.GCLOUD_PROJECT !== "demo-assodarts-web" ||
  !/^(127\.0\.0\.1|localhost):8080$/.test(
    process.env.FIRESTORE_EMULATOR_HOST ?? "",
  )
) {
  throw new Error(
    "Les données de démonstration nécessitent l'émulateur local et le projet demo-assodarts-web.",
  );
}
initializeApp({ projectId: "demo-assodarts-web" });
const db = getFirestore();
const clubId = "11111111-1111-4111-8111-111111111111";
const now = Date.now();
const days = (number) => Timestamp.fromDate(new Date(now + number * 86400000));
const data = [
  ["club_slugs/club-a", { clubId, status: "active" }],
  ["club_slugs/ancien-club", { clubId, status: "alias" }],
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
];
const batch = db.batch();
for (const [path, value] of data) batch.set(db.doc(path), value);
await batch.commit();
await db.terminate();
console.log("Données de démonstration installées dans l'émulateur local.");
