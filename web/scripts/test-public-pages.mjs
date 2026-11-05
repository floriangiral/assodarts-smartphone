import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
const get = (host, path) => new Promise((resolve, reject) => { const req = request({hostname:'127.0.0.1', port:3000, path, headers:{host:`${host}:3000`}}, res => { const chunks=[]; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({status:res.statusCode, headers:new Map(Object.entries(res.headers)), text:async () => Buffer.concat(chunks).toString()})); }); req.on('error', reject); req.end(); });
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is required');
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-assodarts-rules' });
const db = getFirestore();
const clubId = '11111111-1111-4111-8111-111111111111';
await db.doc('club_slugs/club-a').set({clubId, status:'active'});
await db.doc('club_slugs/ancien-club').set({clubId, status:'alias'});
await db.doc(`clubs_public/${clubId}`).set({name:'Club Démo', slug:'club-a', isPublished:true});
await db.doc('events_public/demo').set({clubId, isPublished:true, title:'Tournoi Démo', startsAt:Timestamp.fromDate(new Date('2030-05-10T10:00:00Z'))});
await db.doc('events_public/prive').set({clubId, isPublished:false, title:'Secret'});
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3000'], { env: {...process.env, ROOT_DOMAIN:'localhost'}, stdio:'inherit' });
try {
  let ready = false;
  for (let i=0; i<60; i++) { try { const r = await get('localhost','/'); if(r.status === 200) {ready = true; break;} } catch {} await new Promise(r => setTimeout(r,250)); }
  assert(ready, 'Next server did not start');
  let response = await get('club-a.localhost','/e/demo');
  assert.equal(response.status,200); const body = await response.text(); assert.match(body,/Tournoi Démo/); assert.match(body,/Club Démo/); assert.match(body,/schema.org/);
  assert.equal((await get('club-a.localhost','/e/prive')).status,404);
  assert.equal((await get('inconnu.localhost','/')).status,404);
  response = await get('ancien-club.localhost','/e/demo'); assert.equal(response.status,308); assert.match(response.headers.get('location'),/club-a\.localhost:3000\/e\/demo/);
  assert.equal((await get('club-a.localhost','/robots.txt')).status,200);
  response = await get('club-a.localhost','/sitemap.xml'); assert.equal(response.status,200); assert.match(await response.text(), /club-a\.localhost:3000\/e\/demo/);
  assert.equal((await get('club-a.localhost','/e/demo/opengraph-image')).status,200);
  console.log('Public HTTP rendering, private/unknown 404, alias, robots, sitemap and OG: passed');
} finally { server.kill('SIGTERM'); await db.terminate(); }
