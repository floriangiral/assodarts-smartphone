import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
const get = (host, path) => new Promise((resolve, reject) => { const req = request({hostname:'127.0.0.1', port:3000, path, headers:{host:`${host}:3000`}}, res => { const chunks=[]; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({status:res.statusCode, headers:new Map(Object.entries(res.headers)), text:async () => Buffer.concat(chunks).toString()})); }); req.on('error', reject); req.end(); });
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is required');
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-assodarts-rules' });
const db = getFirestore();
const clubId = randomUUID();
const slug = `club-${randomUUID().slice(0, 8)}`;
const aliasSlug = `ancien-${randomUUID().slice(0, 8)}`;
const eventId = randomUUID();
const privateEventId = randomUUID();
const paths = [`club_slugs/${slug}`, `club_slugs/${aliasSlug}`, `clubs_public/${clubId}`, `events_public/${eventId}`, `events_public/${privateEventId}`];
await db.doc(`club_slugs/${slug}`).set({clubId, status:'active'});
await db.doc(`club_slugs/${aliasSlug}`).set({clubId, status:'alias'});
await db.doc(`clubs_public/${clubId}`).set({name:'Club Démo', slug, isPublished:true, logoUrl:'https://images.example/logo.png', coverUrl:'https://images.example/cover.jpg', socialLinks:{Instagram:'https://instagram.com/demo'}});
await db.doc(`events_public/${eventId}`).set({clubId, isPublished:true, title:'Tournoi Démo', startsAt:Timestamp.fromDate(new Date('2030-05-10T10:00:00Z')), endsAt:Timestamp.fromDate(new Date('2030-05-10T12:00:00Z')), category:'Compétition', categories:['Adultes']});
await db.doc(`events_public/${privateEventId}`).set({clubId, isPublished:false, title:'Secret'});
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3000'], { env: {...process.env, ROOT_DOMAIN:'localhost'}, stdio:'inherit' });
try {
  let ready = false;
  for (let i=0; i<60; i++) { try { const r = await get('localhost','/'); if(r.status === 200) {ready = true; break;} } catch {} await new Promise(r => setTimeout(r,250)); }
  assert(ready, 'Next server did not start');
  let response = await get(`${slug}.localhost`,'/');
  assert.equal(response.status,200); const homeBody = await response.text(); assert.match(homeBody,/Club Démo/); assert.match(homeBody,/logo.png/); assert.match(homeBody,/cover.jpg/); assert.match(homeBody,/instagram.com\/demo/);
  response = await get(`${slug}.localhost`,`/e/${eventId}`);
  assert.equal(response.status,200); const body = await response.text(); assert.match(body,/Tournoi Démo/); assert.match(body,/Club Démo/); assert.match(body,/schema.org/); assert.match(body,/Compétition/); assert.match(body,/Adultes/); assert.match(body,/2030-05-10T12:00:00.000Z/);
  assert.equal((await get(`${slug}.localhost`,`/e/${privateEventId}`)).status,404);
  assert.equal((await get('inconnu.localhost','/')).status,404);
  response = await get(`${aliasSlug}.localhost`,`/e/${eventId}`); assert.equal(response.status,308); assert.match(response.headers.get('location'),new RegExp(`${slug}\\.localhost:3000/e/${eventId}`));
  assert.equal((await get(`${slug}.localhost`,'/robots.txt')).status,200);
  response = await get(`${slug}.localhost`,'/sitemap.xml'); assert.equal(response.status,200); assert.match(await response.text(), new RegExp(`${slug}\\.localhost:3000/e/${eventId}`));
  assert.equal((await get(`${slug}.localhost`,`/e/${eventId}/opengraph-image`)).status,200);
  console.log('Public HTTP rendering, private/unknown 404, alias, robots, sitemap and OG: passed');
} finally {
  server.kill('SIGTERM');
  const cleanup = db.batch();
  for (const path of paths) cleanup.delete(db.doc(path));
  await cleanup.commit();
  await db.terminate();
}
