#!/usr/bin/env node
/**
 * Delete a club and all of its Firestore data, plus the matching Firebase Auth users
 * for members that belong only to that club.
 *
 * Usage:
 *   node backend/scripts/delete-demo-club.js --club-id <club-id> [--preserve-uid <uid>]
 *
 * Example:
 *   node backend/scripts/delete-demo-club.js --club-id demo-club --preserve-uid 2XctZJlPQdVrSGkrHLk4jAP6VzM2
 */

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

initializeApp({ credential: applicationDefault() });

const db = getFirestore();
const auth = getAuth();

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

function usage() {
  console.error(
    [
      "Usage:",
      "  node backend/scripts/delete-demo-club.js --club-id <club-id> [--preserve-uid <uid>]",
      "",
      "Example:",
      "  node backend/scripts/delete-demo-club.js --club-id demo-club --preserve-uid 2XctZJlPQdVrSGkrHLk4jAP6VzM2",
    ].join("\n"),
  );
}

async function deleteByClubField({ collectionName, fieldName, fieldValue, label }) {
  const snapshot = await db.collection(collectionName).where(fieldName, "==", fieldValue).get();
  const docs = snapshot.docs;
  if (docs.length === 0) {
    console.log(`${label}: 0`);
    return 0;
  }

  let deleted = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + 500);
    for (const doc of chunk) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += chunk.length;
  }

  console.log(`${label}: ${deleted}`);
  return deleted;
}

async function deleteMemberDocsNotBelongingElsewhere(clubId, preserveUid) {
  const membersSnap = await db.collection("members").where("clubId", "==", clubId).get();
  const members = membersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const toDelete = members.filter((member) => {
    const isPreserved = preserveUid && member.authUid === preserveUid;
    return !isPreserved;
  });

  if (toDelete.length === 0) {
    console.log("members: 0");
    return 0;
  }

  for (let i = 0; i < toDelete.length; i += 500) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + 500);
    for (const member of chunk) {
      batch.delete(db.collection("members").doc(member.id));
    }
    await batch.commit();
  }

  console.log(`members: ${toDelete.length}`);
  return toDelete.length;
}

async function deleteAuthUserIfAllowed(uid, preserveUid) {
  if (!uid) return false;
  if (preserveUid && uid === preserveUid) {
    console.log(`Preserved Auth UID: ${uid}`);
    return false;
  }

  try {
    await auth.deleteUser(uid);
    console.log(`Deleted Auth UID: ${uid}`);
    return true;
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      console.log(`Auth UID already absent: ${uid}`);
      return false;
    }
    throw error;
  }
}

/** Resolves every Auth UID tied to this club, before any Firestore document
 * that would make that lookup possible gets deleted. */
async function collectAuthUidsToDelete(clubId) {
  const membershipSnap = await db.collection("memberships").where("clubId", "==", clubId).get();
  const uids = new Set();

  for (const doc of membershipSnap.docs) {
    const membership = doc.data();
    if (!membership?.memberId) continue;
    const memberDoc = await db.collection("members").doc(membership.memberId).get();
    if (!memberDoc.exists) continue;
    const member = memberDoc.data();
    if (member?.clubId === clubId && member.authUid) {
      uids.add(member.authUid);
    }
  }

  return Array.from(uids);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const clubId = args["club-id"];
  const preserveUid = args["preserve-uid"] || null;

  if (!clubId || typeof clubId !== "string" || clubId.trim() === "") {
    usage();
    process.exit(1);
  }

  console.log(`Deleting club: ${clubId}`);
  if (preserveUid) {
    console.log(`Preserve UID: ${preserveUid}`);
  }

  const stats = {
    payment_call_items: 0,
    payment_calls: 0,
    tournament_entries: 0,
    tournaments: 0,
    event_registrations: 0,
    events: 0,
    announcements: 0,
    conversations: 0,
    club_bank_accounts: 0,
    memberships: 0,
    members: 0,
    clubs: 0,
  };

  const deletionOrder = [
    ["payment_call_items", "clubId", clubId, "payment_call_items"],
    ["payment_calls", "clubId", clubId, "payment_calls"],
    ["tournament_entries", "clubId", clubId, "tournament_entries"],
    ["tournaments", "clubId", clubId, "tournaments"],
    ["event_registrations", "clubId", clubId, "event_registrations"],
    ["events", "clubId", clubId, "events"],
    ["announcements", "clubId", clubId, "announcements"],
    ["conversations", "clubId", clubId, "conversations"],
    ["club_bank_accounts", "clubId", clubId, "club_bank_accounts"],
    ["memberships", "clubId", clubId, "memberships"],
  ];

  // Auth UIDs must be resolved from `memberships`/`members` before those
  // Firestore documents are deleted below, otherwise this lookup finds nothing.
  const authUidsToDelete = await collectAuthUidsToDelete(clubId);

  for (const [collectionName, fieldName, fieldValue, label] of deletionOrder) {
    stats[label] = await deleteByClubField({
      collectionName,
      fieldName,
      fieldValue,
      label,
    });
  }

  for (const uid of authUidsToDelete) {
    await deleteAuthUserIfAllowed(uid, preserveUid);
  }

  stats.members = await deleteMemberDocsNotBelongingElsewhere(clubId, preserveUid);

  const clubDoc = await db.collection("clubs").doc(clubId).get();
  if (clubDoc.exists) {
    await db.collection("clubs").doc(clubId).delete();
    stats.clubs = 1;
    console.log("clubs: 1");
  } else {
    console.log("clubs: 0");
  }

  console.log("\nSummary:");
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error("Failed to delete club.");
  console.error(error);
  process.exit(1);
});
