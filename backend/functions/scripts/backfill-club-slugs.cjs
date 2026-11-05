// Emulator-only migration rehearsal. Production execution requires a separately reviewed procedure.
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const { clubSlugSchema, slugify } = require("../lib/shared/club-slug");

const projectId = process.env.GCLOUD_PROJECT || "";
const emulator = process.env.FIRESTORE_EMULATOR_HOST || "";
if (!projectId.startsWith("demo-") || !/^(127\.0\.0\.1|localhost):\d+$/.test(emulator)) {
  throw new Error("This script only runs against a local demo Firestore emulator.");
}

const args = new Set(process.argv.slice(2));
for (const arg of args) {
  if (arg !== "--apply") throw new Error(`Unknown option: ${arg}`);
}
const apply = args.has("--apply");
initializeApp({ projectId });

function fallbackSlug(clubId) {
  return `club-${clubId.replace(/-/g, "").slice(0, 8).toLowerCase()}`;
}

function candidateSlug(base, suffix) {
  const tail = suffix === 0 ? "" : `-${suffix + 1}`;
  const prefix = base.slice(0, 40 - tail.length).replace(/-+$/g, "");
  return `${prefix}${tail}`;
}

async function migrateClub(db, clubId, reserved) {
  const clubRef = db.collection("clubs").doc(clubId);
  const initial = await clubRef.get();
  if (!initial.exists) return { status: "missing", clubId };

  const data = initial.data() ?? {};
  const currentSlug =
    typeof data.slug === "string" && clubSlugSchema.safeParse(data.slug).success
      ? data.slug
      : null;
  const suggested = slugify(String(data.name ?? ""));
  const base = clubSlugSchema.safeParse(suggested).success
    ? suggested
    : fallbackSlug(clubId);
  const firstChoice = currentSlug ?? base;

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix === 0 ? firstChoice : candidateSlug(base, suffix);
    if (slug === currentSlug && suffix > 0) continue;
    if (reserved.has(slug) && slug !== currentSlug) continue;

    const result = await db.runTransaction(async (transaction) => {
      const currentClub = await transaction.get(clubRef);
      if (!currentClub.exists) return { status: "missing", slug };
      const newSlugRef = db.collection("club_slugs").doc(slug);
      const newSlug = await transaction.get(newSlugRef);
      const newSlugData = newSlug.data();
      if (newSlug.exists && newSlugData?.clubId !== clubId) {
        return { status: "collision", slug };
      }

      const latestSlug = currentClub.get("slug");
      const previousSlug =
        typeof latestSlug === "string" &&
        clubSlugSchema.safeParse(latestSlug).success &&
        latestSlug !== slug
          ? latestSlug
          : null;
      const oldSlugRef = previousSlug
        ? db.collection("club_slugs").doc(previousSlug)
        : null;
      const oldSlug = oldSlugRef ? await transaction.get(oldSlugRef) : null;

      const alreadyCurrent =
        latestSlug === slug &&
        newSlug.exists &&
        newSlugData?.clubId === clubId &&
        newSlugData?.status === "active";
      if (!apply || alreadyCurrent) {
        return { status: alreadyCurrent ? "unchanged" : "planned", slug };
      }

      const createdAt = newSlugData?.createdAt ?? FieldValue.serverTimestamp();
      transaction.set(
        newSlugRef,
        { clubId, status: "active", createdAt },
        { merge: true },
      );
      if (oldSlugRef && oldSlug?.exists && oldSlug.data()?.clubId === clubId) {
        transaction.set(
          oldSlugRef,
          { clubId, status: "alias", aliasOf: slug },
          { merge: true },
        );
      }
      transaction.update(clubRef, { slug });
      return { status: "updated", slug };
    });

    if (result.status === "collision") continue;
    if (result.status !== "missing") reserved.add(result.slug);
    return { clubId, ...result };
  }
  return { status: "exhausted", clubId };
}

async function main() {
  const db = getFirestore();
  const reserved = new Set();
  const counts = { planned: 0, updated: 0, unchanged: 0, missing: 0, exhausted: 0 };
  let cursor;

  for (;;) {
    let pageQuery = db.collection("clubs").orderBy("__name__").limit(100);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const page = await pageQuery.get();
    for (const club of page.docs) {
      const result = await migrateClub(db, club.id, reserved);
      counts[result.status] = (counts[result.status] ?? 0) + 1;
      console.log(`${result.status}: ${club.id} -> ${result.slug ?? "-"}`);
    }
    if (page.size < 100) break;
    cursor = page.docs[page.docs.length - 1];
  }

  console.log(`${apply ? "Applied" : "Dry run"}: ${JSON.stringify(counts)}`);
  await db.terminate();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});