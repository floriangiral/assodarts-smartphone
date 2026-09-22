#!/usr/bin/env node
/**
 * Read-only diagnostic for club rosters.
 *
 * Reports:
 * - memberships pointing to a missing members/{memberId} profile
 * - memberships whose profile is not visibly attached to that club through
 *   members.clubId/defaultClubId (the historical cause of missing members in
 *   client-built lists)
 * - likely duplicate profiles in the same club, grouped by normalized email
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=<path-to-service-account.json> \
 *     node backend/scripts/audit-club-roster.js --project-id <firebase-project-id> [--club-id <clubId>]
 */

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

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

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fullName(member) {
  return `${clean(member.firstName)} ${clean(member.lastName)}`.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectId = clean(args["project-id"]);
  const clubId = clean(args["club-id"]);
  if (!projectId) throw new Error("Missing required --project-id");

  initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();

  let query = db.collection("memberships");
  if (clubId) query = query.where("clubId", "==", clubId);
  const membershipsSnap = await query.get();

  const missingProfiles = [];
  const invisibleProfiles = [];
  const byClubAndEmail = new Map();

  for (const doc of membershipsSnap.docs) {
    const membership = doc.data();
    const memberId = clean(membership.memberId);
    const membershipClubId = clean(membership.clubId);
    if (!memberId || !membershipClubId) continue;

    const memberSnap = await db.collection("members").doc(memberId).get();
    if (!memberSnap.exists) {
      missingProfiles.push({
        membershipId: doc.id,
        clubId: membershipClubId,
        memberId,
        authUid: clean(membership.authUid),
        status: clean(membership.status),
      });
      continue;
    }

    const member = memberSnap.data() || {};
    const memberClubId = clean(member.clubId);
    const defaultClubId = clean(member.defaultClubId);
    if (memberClubId !== membershipClubId && defaultClubId !== membershipClubId) {
      invisibleProfiles.push({
        membershipId: doc.id,
        clubId: membershipClubId,
        memberId,
        authUid: clean(membership.authUid),
        name: fullName(member),
        email: clean(member.email).toLowerCase(),
        memberClubId: memberClubId || null,
        defaultClubId: defaultClubId || null,
        status: clean(membership.status),
      });
    }

    const email = clean(member.email).toLowerCase();
    if (email) {
      const key = `${membershipClubId}:${email}`;
      const bucket = byClubAndEmail.get(key) || [];
      bucket.push({
        membershipId: doc.id,
        clubId: membershipClubId,
        memberId,
        authUid: clean(membership.authUid),
        name: fullName(member),
        email,
        status: clean(membership.status),
      });
      byClubAndEmail.set(key, bucket);
    }
  }

  const duplicateEmails = Array.from(byClubAndEmail.values()).filter(
    (bucket) => bucket.length > 1,
  );

  const report = {
    scannedMemberships: membershipsSnap.size,
    missingProfiles,
    invisibleProfiles,
    duplicateEmails,
  };

  console.log(JSON.stringify(report, null, 2));
  if (
    missingProfiles.length === 0 &&
    invisibleProfiles.length === 0 &&
    duplicateEmails.length === 0
  ) {
    console.log("\nNo roster issue found.");
  } else {
    console.log(
      "\nRead-only audit complete. Fix data manually or with a reviewed migration before deleting any profile.",
    );
  }
}

main().catch((error) => {
  console.error("Roster audit failed.");
  console.error(error);
  process.exit(1);
});
