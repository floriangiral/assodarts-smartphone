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
const compareSlugs = (left, right) => left.localeCompare(right);
async function main() {
  const a = randomUUID(), b = randomUUID();
  const contestedSlug = `unique-${randomUUID().slice(0, 8)}`;
  const replacementSlug = `nouveau-${randomUUID().slice(0, 8)}`;
  await Promise.all([[a,'a',true], [b,'b',false]].map(async ([id, uid, published]) => {
    await db.collection('clubs').doc(id).set({name: `Club ${uid}`, secret: 'never public', publicProfile: {isPublished: published, city:'Paris'}});
    await db.collection('memberships').doc(`${id}_${uid}`).set({clubId:id, authUid:uid, role:'admin', status:'active'});
    await db.collection('events').doc(`public-${uid}`).set({clubId:id, title:'Public', visibility:'public', startsAt:Timestamp.now(), secret:'never public'});
    await db.collection('events').doc(`private-${uid}`).set({clubId:id, title:'Private'});
  }));
  await assert.rejects(call(request(null,a,'club-a')));
  await assert.rejects(call(request('b',a,'club-a')));
  await assert.rejects(call(request('a',a,'admin')));
  const competing = await Promise.allSettled([call(request('a',a,contestedSlug)), call(request('b',b,contestedSlug))]);
  assert.equal(competing.filter(x => x.status === 'fulfilled').length, 1);
  const winner = competing[0].status === 'fulfilled' ? a : b;
  const uid = winner === a ? 'a' : 'b';
  await call(request(uid,winner,replacementSlug));
  assert.equal((await db.doc(`club_slugs/${contestedSlug}`).get()).data().status, 'alias');
  assert.equal((await db.doc(`club_slugs/${replacementSlug}`).get()).data().status, 'active');
  const legacyA = randomUUID(), legacyB = randomUUID();
  const legacyBase = `club-commun-${randomUUID().slice(0, 6)}`;
  await Promise.all([
    db.doc(`clubs/${legacyA}`).set({ name: legacyBase.replace(/-/g, ' ') }),
    db.doc(`clubs/${legacyB}`).set({ name: legacyBase.replace(/-/g, ' ') }),
  ]);
  const runSlugBackfill = (args = []) => execFileSync(
    process.execPath,
    ['scripts/backfill-club-slugs.cjs', ...args],
    { encoding: 'utf8', env: process.env },
  );
  assert.match(runSlugBackfill(), /Dry run/);
  assert.equal((await db.doc(`clubs/${legacyA}`).get()).data().slug, undefined);
  runSlugBackfill(['--apply']);
  const legacySlugs = [
    (await db.doc(`clubs/${legacyA}`).get()).data().slug,
    (await db.doc(`clubs/${legacyB}`).get()).data().slug,
  ].sort(compareSlugs);
  assert.deepEqual(legacySlugs, [legacyBase, `${legacyBase}-2`].sort(compareSlugs));
  runSlugBackfill(['--apply']);
  assert.deepEqual(
    [
      (await db.doc(`clubs/${legacyA}`).get()).data().slug,
      (await db.doc(`clubs/${legacyB}`).get()).data().slug,
    ].sort(compareSlugs),
    legacySlugs,
  );
  const backfill = () => execFileSync(process.execPath, ['scripts/backfill-public.cjs'], {stdio:'inherit', env:process.env});
  backfill();
  const before = (await db.doc(`clubs_public/${a}`).get()).updateTime;
  backfill();
  assert(before.isEqual((await db.doc(`clubs_public/${a}`).get()).updateTime));
  assert.equal((await db.doc(`clubs_public/${a}`).get()).data().secret, undefined);
  assert.equal((await db.doc(`events_public/private-a`).get()).data().isPublished, false);
  assert.equal((await db.doc(`events_public/public-a`).get()).data().secret, undefined);
  assert.equal((await db.doc(`clubs_public/${b}`).get()).data().isPublished, false);
  console.log('Projection/slug backfills, dry-run, collision, idempotency, alias, authorization and concurrency: passed');
}
main().then(() => {env.cleanup();}).catch(error => { console.error(error); process.exitCode = 1; env.cleanup(); });
