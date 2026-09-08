#!/usr/bin/env node
/**
 * Read-only diagnostic: lists every `memberships` document whose `role` field
 * holds the incorrect French raw values ("bureau"/"membre") instead of the
 * canonical English values ("board"/"member") expected by `isBoard()` in
 * firestore.rules and by `VALID_ROLES` in functions/src/invitations.ts.
 *
 * This never writes or deletes anything — it only reports what it finds so
 * you can decide how to fix affected accounts.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=<path-to-service-account.json> \
 *     node backend/scripts/check-role-mismatch.js --project-id <firebase-project-id>
 *
 * Example:
 *   node backend/scripts/check-role-mismatch.js --project-id assodarts-staging
 */

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const INCORRECT_ROLES = ["bureau", "membre"];

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectId = String(args["project-id"] || "").trim();
  if (!projectId) {
    throw new Error("Missing required --project-id");
  }

  initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();

  const found = [];
  for (const role of INCORRECT_ROLES) {
    const snapshot = await db.collection("memberships").where("role", "==", role).get();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      found.push({
        membershipId: doc.id,
        clubId: data.clubId ?? null,
        memberId: data.memberId ?? null,
        authUid: data.authUid ?? null,
        role: data.role ?? null,
        status: data.status ?? null,
      });
    }
  }

  if (found.length === 0) {
    console.log(`No membership found with role in ${JSON.stringify(INCORRECT_ROLES)}. Nothing to fix.`);
    return;
  }

  console.log(`Found ${found.length} membership(s) with an incorrect role value:\n`);
  console.log(JSON.stringify(found, null, 2));
  console.log(
    `\nThese accounts silently fail every Firestore write gated by isBoard() ` +
      `(announcements, events, payment calls, member management, etc.) because ` +
      `the security rules only accept role in ['admin', 'board'].`,
  );
}

main().catch((error) => {
  console.error("Diagnostic failed.");
  console.error(error);
  process.exit(1);
});
