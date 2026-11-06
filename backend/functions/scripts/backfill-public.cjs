// Emulator only until a production migration procedure has been reviewed.
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is required');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-assodarts' });
const { projectClub, projectEvent } = require('../lib/publicProjections');
async function processPage(db, collection, project, cursor) {
  let query = db.collection(collection).orderBy('__name__').limit(100);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  await Promise.all(page.docs.map(doc => project(doc.id)));
  if (page.size === 100) {
    await processPage(db, collection, project, page.docs[page.docs.length - 1]);
  }
}
async function main() {
  const db = getFirestore();
  await Promise.all([
    processPage(db, 'clubs', projectClub),
    processPage(db, 'events', projectEvent),
  ]);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
