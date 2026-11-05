const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const functionsTest = require('firebase-functions-test');
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Emulator required');
const projectId = process.env.GCLOUD_PROJECT || 'demo-assodarts-rules';
initializeApp({ projectId });
const db = getFirestore();
const env = functionsTest();
process.env.GCLOUD_PROJECT = projectId;
const call = env.wrap(require('../lib/clubSlugs').setClubSlug);
const request = (uid, clubId, slug) => ({ auth: uid ? {uid, token:{}} : undefined, data: {clubId, slug} });
async function main() {
  const a = randomUUID(), b = randomUUID();
  for (const [id, uid, published] of [[a,'a',true], [b,'b',false]]) {
    await db.collection('clubs').doc(id).set({name: `Club ${uid}`, secret: 'never public', publicProfile: {isPublished: published, city:'Paris'}});
    await db.collection('memberships').doc(`${id}_${uid}`).set({clubId:id, authUid:uid, role:'admin', status:'active'});
    await db.collection('events').doc(`public-${uid}`).set({clubId:id, title:'Public', visibility:'public', startsAt:Timestamp.now(), secret:'never public'});
    await db.collection('events').doc(`private-${uid}`).set({clubId:id, title:'Private'});
  }
  await assert.rejects(call(request(null,a,'club-a')));
  await assert.rejects(call(request('b',a,'club-a')));
  await assert.rejects(call(request('a',a,'admin')));
  const competing = await Promise.allSettled([call(request('a',a,'unique-club')), call(request('b',b,'unique-club'))]);
  assert.equal(competing.filter(x => x.status === 'fulfilled').length, 1);
  const winner = competing[0].status === 'fulfilled' ? a : b;
  const uid = winner === a ? 'a' : 'b';
  await call(request(uid,winner,'nouveau-club'));
  assert.equal((await db.doc('club_slugs/unique-club').get()).data().status, 'alias');
  assert.equal((await db.doc('club_slugs/nouveau-club').get()).data().status, 'active');
  const backfill = () => execFileSync(process.execPath, ['scripts/backfill-public.cjs'], {stdio:'inherit', env:process.env});
  backfill();
  const before = (await db.doc(`clubs_public/${a}`).get()).updateTime;
  backfill();
  assert(before.isEqual((await db.doc(`clubs_public/${a}`).get()).updateTime));
  assert.equal((await db.doc(`clubs_public/${a}`).get()).data().secret, undefined);
  assert.equal((await db.doc(`events_public/private-a`).get()).data().isPublished, false);
  assert.equal((await db.doc(`events_public/public-a`).get()).data().secret, undefined);
  assert.equal((await db.doc(`clubs_public/${b}`).get()).data().isPublished, false);
  console.log('Projection backfill and slug authorization, alias and concurrency: passed');
}
main().then(() => {env.cleanup();}).catch(error => { console.error(error); process.exitCode = 1; env.cleanup(); });
