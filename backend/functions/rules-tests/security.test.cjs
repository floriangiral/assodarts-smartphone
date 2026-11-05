const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = require('firebase/firestore');
const { ref, uploadString, getBytes } = require('firebase/storage');

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-assodarts-rules',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(__dirname, '../../storage.rules'), 'utf8') },
  });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const club of ['a', 'b']) {
      await setDoc(doc(db, 'clubs', club), { name: club, subscriptionStatus: 'trial' });
      await setDoc(doc(db, 'events', `event-${club}`), { clubId: club, title: club, createdByMemberId: 'author-id' });
    }
    for (const [club, uid, role, status] of [['a','manager-a','admin','active'],['b','manager-b','board','active'],['a','member-a','member','active'],['a','inactive','admin','inactive'],['a','both','admin','active'],['b','both','board','active']]) {
      await setDoc(doc(db, 'memberships', `${club}_${uid}`), { clubId: club, authUid: uid, memberId: `member-${uid}`, role, status });
    }
    await setDoc(doc(db, 'members', 'member-a'), { authUid: 'member-a', clubId: 'a', defaultClubId: 'a' });
    await setDoc(doc(db, 'platform_admins', 'platform'), { enabled: true });
    await uploadString(ref(context.storage(), 'profile_photos/member-a'), 'test', 'raw', {contentType:'image/png'});
  });
});
after(async () => { if (env) await env.cleanup(); });

test('club data are isolated and require active membership', async () => {
  const db = uid => env.authenticatedContext(uid).firestore();
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'clubs', 'a')));
  await assertSucceeds(getDoc(doc(db('manager-a'), 'events', 'event-a')));
  await assertSucceeds(updateDoc(doc(db('manager-a'), 'events', 'event-a'), {title: 'updated'}));
  await assertFails(getDoc(doc(db('manager-a'), 'events', 'event-b')));
  await assertFails(updateDoc(doc(db('manager-a'), 'events', 'event-b'), {title: 'blocked'}));
  await assertFails(updateDoc(doc(db('member-a'), 'events', 'event-a'), {title: 'blocked'}));
  await assertFails(getDoc(doc(db('inactive'), 'clubs', 'a')));
  await assertSucceeds(getDoc(doc(db('both'), 'clubs', 'a')));
  await assertSucceeds(getDoc(doc(db('both'), 'clubs', 'b')));
  await assertSucceeds(updateDoc(doc(db('both'), 'events', 'event-a'), {title: 'updated by both'}));
  await assertSucceeds(updateDoc(doc(db('both'), 'events', 'event-b'), {title: 'updated by both'}));
  await assertSucceeds(getDoc(doc(db('platform'), 'clubs', 'a')));
  await assertFails(setDoc(doc(db('manager-a'), 'platform_admins', 'manager-a'), {enabled: true}));
});

test('profile photos are scoped to members and only owners may upload', async () => {
  const storage = uid => env.authenticatedContext(uid).storage();
  const photo = await assertSucceeds(getBytes(ref(storage('manager-a'), 'profile_photos/member-a')));
  assert.equal(Buffer.from(photo).toString(), 'test');
  await assertFails(getBytes(ref(storage('manager-b'), 'profile_photos/member-a')));
  await assertFails(uploadString(ref(storage('manager-a'), 'profile_photos/member-a'), 'x', 'raw', {contentType:'image/png'}));
  await assertSucceeds(uploadString(ref(storage('member-a'), 'profile_photos/member-a'), 'x', 'raw', {contentType:'image/png'}));
});

test('public projections require publication and are never writable by clients', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'clubs_public', 'a'), { name: 'A', isPublished: true });
    await setDoc(doc(db, 'clubs_public', 'b'), { name: 'B', isPublished: false });
    await setDoc(doc(db, 'events_public', 'public-a'), { clubId: 'a', isPublished: true });
    await setDoc(doc(db, 'events_public', 'private-a'), { clubId: 'a', isPublished: false });
    await setDoc(doc(db, 'events_public', 'public-b'), { clubId: 'b', isPublished: true });
    await setDoc(doc(db, 'club_slugs', 'club-a'), {clubId:'a', status:'active'});
    await setDoc(doc(db, 'platform_announcements', 'all'), { audience: 'all', title: 'All members' });
    await setDoc(doc(db, 'platform_announcements', 'admins'), { audience: 'admins', title: 'Committee only' });
  });
  const anonymous = env.unauthenticatedContext().firestore();
  const manager = env.authenticatedContext('manager-a').firestore();
  await assertSucceeds(getDoc(doc(anonymous, 'clubs_public', 'a')));
  await assertFails(getDoc(doc(anonymous, 'clubs_public', 'b')));
  await assertSucceeds(getDoc(doc(anonymous, 'events_public', 'public-a')));
  await assertFails(getDoc(doc(anonymous, 'events_public', 'private-a')));
  await assertFails(getDoc(doc(anonymous, 'events_public', 'public-b')));
  await assertFails(getDoc(doc(anonymous, 'club_slugs', 'club-a')));
  await assertFails(getDoc(doc(anonymous, 'platform_announcements', 'all')));
  await assertFails(getDoc(doc(manager, 'platform_announcements', 'all')));
  await assertFails(getDoc(doc(env.authenticatedContext('platform').firestore(), 'platform_announcements', 'admins')));
  await assertFails(setDoc(doc(manager, 'events_public', 'injected'), {clubId:'a', isPublished:true}));
  await assertFails(updateDoc(doc(manager, 'clubs', 'a'), {slug:'injected'}));
  await assertFails(updateDoc(doc(manager, 'events', 'event-a'), {visibility:'invalid'}));
  await assertSucceeds(updateDoc(doc(manager, 'events', 'event-a'), {visibility:'public'}));
});

test('members can only mark their own notifications as read', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'notifications', 'notification-a'), {
      clubId: 'a', memberId: 'member-manager-a', title: 'Payment update', body: 'Details', readAt: null,
    });
  });
  const owner = env.authenticatedContext('manager-a').firestore();
  const otherMember = env.authenticatedContext('member-a').firestore();
  const notification = doc(owner, 'notifications', 'notification-a');
  await assertFails(updateDoc(notification, { title: 'Forged notification' }));
  await assertFails(updateDoc(notification, { memberId: 'member-member-a', readAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(notification, { readAt: serverTimestamp() }));
  await assertFails(updateDoc(notification, { readAt: null }));
  await assertFails(updateDoc(doc(otherMember, 'notifications', 'notification-a'), { readAt: serverTimestamp() }));
});
