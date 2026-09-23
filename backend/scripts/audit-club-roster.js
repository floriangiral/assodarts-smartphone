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

import { cleanString, loadAdminSdk, parseArgs, runMain } from "./admin-utils.js";

const {
  "firebase-admin/app": { initializeApp, applicationDefault },
  "firebase-admin/firestore": { getFirestore },
} = await loadAdminSdk([
  "firebase-admin/app",
  "firebase-admin/firestore",
]);

function fullName(member) {
  return `${cleanString(member.firstName)} ${cleanString(member.lastName)}`.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectId = cleanString(args["project-id"]);
  const clubId = cleanString(args["club-id"]);
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
    const memberId = cleanString(membership.memberId);
    const membershipClubId = cleanString(membership.clubId);
    if (!memberId || !membershipClubId) continue;

    const memberSnap = await db.collection("members").doc(memberId).get();
    if (!memberSnap.exists) {
      missingProfiles.push({
        membershipId: doc.id,
        clubId: membershipClubId,
        memberId,
        authUid: cleanString(membership.authUid),
        status: cleanString(membership.status),
      });
      continue;
    }

    const member = memberSnap.data() || {};
    const memberClubId = cleanString(member.clubId);
    const defaultClubId = cleanString(member.defaultClubId);
    if (memberClubId !== membershipClubId && defaultClubId !== membershipClubId) {
      invisibleProfiles.push({
        membershipId: doc.id,
        clubId: membershipClubId,
        memberId,
        authUid: cleanString(membership.authUid),
        name: fullName(member),
        email: cleanString(member.email).toLowerCase(),
        memberClubId: memberClubId || null,
        defaultClubId: defaultClubId || null,
        status: cleanString(membership.status),
      });
    }

    const email = cleanString(member.email).toLowerCase();
    if (email) {
      const key = `${membershipClubId}:${email}`;
      const bucket = byClubAndEmail.get(key) || [];
      bucket.push({
        membershipId: doc.id,
        clubId: membershipClubId,
        memberId,
        authUid: cleanString(membership.authUid),
        name: fullName(member),
        email,
        status: cleanString(membership.status),
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

await runMain(main, "Roster audit failed.");
