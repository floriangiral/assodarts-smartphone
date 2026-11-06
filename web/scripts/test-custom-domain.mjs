import { spawn } from "node:child_process";
import { createServer, request } from "node:http";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { join } from "node:path";

if (!process.env.FIRESTORE_EMULATOR_HOST || !String(process.env.GCLOUD_PROJECT ?? "").startsWith("demo-")) {
  throw new Error("Ce test exige l'émulateur Firestore et un projet demo- ; aucune donnée réelle ne doit être utilisée.");
}
const port = 3101;
const available = await new Promise((resolve) => {
  const s = createServer();
  s.once("error", () => resolve(false));
  s.listen(port, "127.0.0.1", () => s.close(() => resolve(true)));
});
if (!available) throw new Error(`Le port ${port} est occupé ; aucun processus n'a été arrêté.`);
const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore(app);
const clubId = "4aee74c1-377c-40a3-a69c-74c6be749c63";
const privateClubId = "5bff85d2-488d-41b4-b7ad-85d7bf850c74";
const eventId = randomUUID();
const paths = [
  "domains/club.example",
  `clubs_public/${clubId}`,
  `events_public/${eventId}`,
  "domains/private.example",
  `clubs_public/${privateClubId}`,
];
const writes = [
  ["domains/club.example", { clubId }],
  [
    `clubs_public/${clubId}`,
    {
      name: "Club Domaine Personnalisé",
      slug: "club-a",
      city: "Lyon",
      description: "Présentation du club sur son domaine personnalisé.",
      logoUrl: "https://images.example/club-logo.png",
      coverUrl: "https://images.example/club-cover.jpg",
      socialLinks: { Instagram: "https://instagram.com/club-example" },
      schedule: "Mardi, 19 h",
      isPublished: true,
    },
  ],
  [
    `events_public/${eventId}`,
    {
      clubId,
      isPublished: true,
      title: "Tournoi sur domaine personnalisé",
      description: "Événement de test.",
      startsAt: Timestamp.fromDate(new Date("2030-05-10T10:00:00Z")),
      endsAt: Timestamp.fromDate(new Date("2030-05-10T12:00:00Z")),
      location: "Lyon",
      category: "Compétition",
      categories: ["Adultes"],
    },
  ],
  ["domains/private.example", { clubId: privateClubId }],
  [
    `clubs_public/${privateClubId}`,
    { name: "Club non publié", slug: "club-prive", isPublished: false },
  ],
];
const batch = db.batch();
for (const [path, data] of writes) batch.set(db.doc(path), data);
await batch.commit();
const child = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(), detached: true, stdio: "ignore", env: { ...process.env, ROOT_DOMAIN: "localhost" },
});
async function get(host, path = "/") {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port, path, headers: { host }, timeout: 5000 }, (res) => {
      let body = ""; res.setEncoding("utf8"); res.on("data", (part) => { body += part; }); res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("timeout"))); req.end();
  });
}
async function waitForServer(attempts) {
  try {
    if ((await get(`localhost:${port}`)).status === 200) return true;
  } catch {
    // The development server may still be starting.
  }
  if (attempts <= 1) return false;
  await delay(200);
  return waitForServer(attempts - 1);
}
try {
  if (!(await waitForServer(100))) throw new Error("Le serveur de test n'a pas démarré.");
  const home = await get("club.example");
  const agenda = await get("club.example", "/agenda");
  const event = await get("club.example", `/e/${eventId}`);
  const robots = await get("club.example", "/robots.txt");
  const sitemap = await get("club.example", "/sitemap.xml");
  const unpublished = await get("private.example");
  const unknown = await get("unknown.example");
  if (
    home.status !== 200 || !home.body.includes("Club Domaine Personnalisé") ||
    !home.body.includes("club-logo.png") || !home.body.includes("club-cover.jpg") ||
    !home.body.includes("instagram.com/club-example") ||
    agenda.status !== 200 || !agenda.body.includes("Tournoi sur domaine personnalisé") ||
    event.status !== 200 || !event.body.includes("schema.org") ||
    !event.body.includes("Compétition") || !event.body.includes("Adultes") ||
    !event.body.includes("2030-05-10T12:00:00.000Z") ||
    robots.status !== 200 || !robots.body.includes("Sitemap:") ||
    sitemap.status !== 200 || !sitemap.body.includes("club-a.localhost") ||
    unpublished.status !== 404 || unknown.status !== 404
  ) {
    throw new Error(`Résultats inattendus : home ${home.status}, agenda ${agenda.status}, event ${event.status}, robots ${robots.status}, sitemap ${sitemap.status}, non publié ${unpublished.status}, inconnu ${unknown.status}`);
  }
  console.log("Domaine custom : profil, agenda, événement, robots/sitemap publics; club non publié et hôte inconnu en 404.");
} finally {
  if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already stopped */ } }
  const cleanup = db.batch();
  for (const path of paths) cleanup.delete(db.doc(path));
  await cleanup.commit();
  await deleteApp(app);
}
