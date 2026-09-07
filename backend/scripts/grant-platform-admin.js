#!/usr/bin/env node
/**
 * Bootstrap one platform administrator.
 *
 * Usage:
 *   node backend/scripts/grant-platform-admin.js \
 *     --project-id assodarts-staging \
 *     --email admin@assodarts.test
 *
 * Add --force only when deliberately updating an existing record.
 */

const { createRequire } = require("module");
const functionsRequire = createRequire(
  require.resolve("../functions/package.json"),
);
const { initializeApp, applicationDefault } = functionsRequire(
  "firebase-admin/app",
);
const { getFirestore, FieldValue } = functionsRequire("firebase-admin/firestore");
const { getAuth } = functionsRequire("firebase-admin/auth");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith("--")) continue;
    const key = argv[index].slice(2);
    const value = argv[index + 1];
    args[key] = value && !value.startsWith("--") ? value : true;
    if (args[key] !== true) index += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectId = String(args["project-id"] || "").trim();
  const email = String(args.email || "").trim().toLowerCase();
  if (!projectId || !email) {
    throw new Error("Usage requires --project-id and --email");
  }

  initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth();
  const db = getFirestore();
  const user = await auth.getUserByEmail(email);
  const ref = db.collection("platform_admins").doc(user.uid);
  const existing = await ref.get();
  if (existing.exists && !args.force) {
    throw new Error(`Platform admin already exists for ${email}; use --force to overwrite`);
  }

  await ref.set({
    email,
    addedAt: existing.exists ? existing.data()?.addedAt : FieldValue.serverTimestamp(),
    addedBy: existing.exists ? existing.data()?.addedBy ?? null : null,
  }, { merge: true });
  console.log(`Platform admin granted: ${email} (${user.uid})`);
}

main().catch((error) => {
  console.error("Grant failed.");
  console.error(error);
  process.exit(1);
});