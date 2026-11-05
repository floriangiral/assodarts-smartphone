// Emulator only until a production migration procedure has been reviewed.
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is required');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-assodarts' });
const { projectClub, projectEvent } = require('../lib/publicProjections');
async function main() {
  const db = getFirestore();
  for (const [collection, project] of [['clubs', projectClub], ['events', projectEvent]]) {
    let cursor;
    for (;;) {
      let query = db.collection(collection).orderBy('__name__').limit(100);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      for (const doc of page.docs) await project(doc.id);
      if (page.size < 100) break;
      cursor = page.docs[page.docs.length - 1];
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
