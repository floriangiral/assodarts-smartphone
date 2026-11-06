import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const project = process.env.GCLOUD_PROJECT;
if (!project?.startsWith('demo-') || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) throw new Error('A local demo Firestore emulator is required');
initializeApp({ projectId: project });
const db = getFirestore();
const draft = db.doc('site_content/home_draft');
const published = db.doc('site_content/home_published');
let seeded = false;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3198'], { env: { ...process.env, ROOT_DOMAIN: 'localhost' }, stdio: 'ignore' });
const get = () => new Promise((resolve, reject) => { request({ hostname: '127.0.0.1', port: 3198, path: '/', headers: { host: 'localhost:3198' } }, res => { let body = ''; res.on('data', chunk => body += chunk); res.on('end', () => resolve(body)); }).on('error', reject).end(); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForServer(attempts) {
  try {
    return await get();
  } catch {
    if (attempts <= 1) return null;
    await delay(100);
    return waitForServer(attempts - 1);
  }
}
try {
  const existing = await Promise.all([draft.get(), published.get()]);
  if (existing.some(item => item.exists)) throw new Error('Test requires an empty site_content collection');
  seeded = true;
  await draft.set({ headline: 'BROUILLON PRIVE', description: 'Description brouillon' });
  const body = await waitForServer(60);
  assert(body, 'Server did not start');
  assert(!body.includes('BROUILLON PRIVE'));
  assert(body.includes('Le club en jeu.'));
  await published.set({ headline: 'CONTENU PUBLIE TEST', description: 'Description publiée', featuresTitle: 'FONCTIONS PUBLIEES', feature1Title: 'MEMBRES PUBLIES' });
  body = await get();
  assert(body.includes('CONTENU PUBLIE TEST'));
  assert(body.includes('FONCTIONS PUBLIEES'));
  assert(body.includes('MEMBRES PUBLIES'));
  assert(!body.includes('Tournoi du club'));
  assert(!body.includes('BROUILLON PRIVE'));
  console.log('Public site shows published content and never the draft: passed');
} finally {
  server.kill('SIGTERM');
  if (seeded) {
    await draft.delete();
    await published.delete();
  }
  await db.terminate();
}
