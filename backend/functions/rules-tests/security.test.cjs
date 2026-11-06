const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { collection, deleteDoc, doc, documentId, getDoc, getDocs, limit, orderBy, query, startAfter, where, setDoc, updateDoc, serverTimestamp, writeBatch } = require('firebase/firestore');
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
    await Promise.all(['a', 'b'].map(async club => {
      await setDoc(doc(db, 'clubs', club), { name: club, subscriptionStatus: 'trial' });
      await setDoc(doc(db, 'events', `event-${club}`), { clubId: club, title: club, createdByMemberId: 'author-id' });
    }));
    await Promise.all([['a','manager-a','admin','active'],['b','manager-b','board','active'],['a','member-a','member','active'],['a','inactive','admin','inactive'],['a','both','admin','active'],['b','both','board','active']].map(async ([club, uid, role, status]) => {
      await setDoc(doc(db, 'memberships', `${club}_${uid}`), { clubId: club, authUid: uid, memberId: `member-${uid}`, role, status });
    }));
    await setDoc(doc(db, 'members', 'member-a'), { authUid: 'member-a', clubId: 'a', defaultClubId: 'a' });
    await setDoc(doc(db, 'platform_admins', 'platform'), { enabled: true });
    await setDoc(doc(db, 'platform_admins', 'dual'), { enabled: true });
    await setDoc(doc(db, 'members', 'member-dual'), { authUid: 'dual', clubId: 'a', defaultClubId: 'a' });
    await setDoc(doc(db, 'memberships', 'a_dual'), { clubId: 'a', authUid: 'dual', memberId: 'member-dual', role: 'member', status: 'active' });
    await setDoc(doc(db, 'coupons', 'platform-test'), { code: 'test' });
    await setDoc(doc(db, 'site_editors', 'editor'), { email: 'editor@example.test' });
    await uploadString(ref(context.storage(), 'profile_photos/member-a'), 'test', 'raw', {contentType:'image/png'});
  });
});

test('site editing is separate from platform and club privileges', async () => {
  const editor = env.authenticatedContext('editor').firestore();
  const platform = env.authenticatedContext('platform').firestore();
  const anonymous = env.unauthenticatedContext().firestore();
  const content = { headline: 'Un titre', description: 'Une description', updatedBy: 'editor', updatedAt: serverTimestamp(), revision: '12345678-1234-4123-8123-123456789012' };
  await assertFails(setDoc(doc(platform, 'site_content', 'home_published'), { ...content, updatedBy: 'platform' }));
  await assertFails(setDoc(doc(editor, 'site_editors', 'editor'), { email: 'changed' }));
  await assertFails(getDoc(doc(editor, 'clubs', 'a')));
  await assertFails(getDoc(doc(editor, 'coupons', 'platform-test')));
  await assertFails(setDoc(doc(editor, 'site_content', 'home_published'), { ...content, updatedBy: 'other' }));
  await assertFails(setDoc(doc(editor, 'site_content', 'home_published'), { ...content, headline: 'x'.repeat(121) }));
  await assertFails(setDoc(doc(editor, 'site_content', 'home_draft'), { ...content, feature1Title: 'x'.repeat(121) }));
  await assertFails(setDoc(doc(editor, 'site_content', 'home_draft'), { ...content, unapproved: 'x' }));
  await assertFails(setDoc(doc(editor, 'site_content', 'other'), content));
  await assertSucceeds(setDoc(doc(editor, 'site_content', 'home_draft'), { ...content, featuresTitle: 'Fonctionnalités', feature1Title: 'Les membres' }));
  const savedDraft = await assertSucceeds(getDoc(doc(editor, 'site_content', 'home_draft')));
  assert.equal(savedDraft.data().featuresTitle, 'Fonctionnalités');
  await assertFails(getDoc(doc(anonymous, 'site_content', 'home_draft')));
  await assertFails(setDoc(doc(editor, 'site_content', 'home_published'), content));
  const batch = writeBatch(editor);
  batch.set(doc(editor, 'site_content', 'home_published'), content);
  batch.set(doc(editor, 'site_publication_history', content.revision), content);
  await assertSucceeds(batch.commit());
  const published = await assertSucceeds(getDoc(doc(anonymous, 'site_content', 'home_published')));
  assert.equal(published.data().headline, 'Un titre');
  await assertFails(getDoc(doc(anonymous, 'site_publication_history', content.revision)));
  await assertSucceeds(getDoc(doc(editor, 'site_publication_history', content.revision)));
  await assertFails(updateDoc(doc(editor, 'site_publication_history', content.revision), { headline: 'Modifié' }));
  await assertFails(deleteDoc(doc(editor, 'site_publication_history', content.revision)));
  await env.withSecurityRulesDisabled(async context => { await deleteDoc(doc(context.firestore(), 'site_editors', 'editor')); });
  await assertFails(setDoc(doc(editor, 'site_content', 'home_published'), content));
});

test('platform and club permissions remain independent for a dual-role account', async () => {
  const dual = env.authenticatedContext('dual').firestore();
  const platform = env.authenticatedContext('platform').firestore();
  const member = env.authenticatedContext('member-a').firestore();
  await assertSucceeds(getDoc(doc(dual, 'platform_admins', 'dual')));
  await assertFails(getDoc(doc(member, 'platform_admins', 'dual')));
  await assertFails(setDoc(doc(member, 'platform_admins', 'member-a'), { enabled: true }));
  await assertSucceeds(getDoc(doc(dual, 'members', 'member-dual')));
  await assertSucceeds(getDoc(doc(dual, 'memberships', 'a_dual')));
  const ownProfiles = await assertSucceeds(getDocs(query(collection(dual, 'members'), where('authUid', '==', 'dual'))));
  assert.equal(ownProfiles.size, 1);
  const ownMemberships = await assertSucceeds(getDocs(query(collection(dual, 'memberships'), where('memberId', '==', 'member-dual'), where('authUid', '==', 'dual'), where('status', '==', 'active'))));
  assert.equal(ownMemberships.size, 1);
  await assertSucceeds(getDoc(doc(dual, 'events', 'event-a')));
  await assertFails(updateDoc(doc(dual, 'events', 'event-a'), { title: 'not a manager' }));
  await assertFails(getDoc(doc(dual, 'events', 'event-b')));
  await assertFails(getDoc(doc(platform, 'events', 'event-a')));
  await assertFails(setDoc(doc(dual, 'memberships', 'b_dual'), { clubId: 'b', authUid: 'dual', memberId: 'member-dual', role: 'admin', status: 'active' }));
  await assertSucceeds(getDoc(doc(dual, 'coupons', 'platform-test')));
  await env.withSecurityRulesDisabled(async context => {
    await deleteDoc(doc(context.firestore(), 'platform_admins', 'dual'));
    await updateDoc(doc(context.firestore(), 'memberships', 'a_dual'), { status: 'inactive' });
  });
  await assertFails(getDoc(doc(dual, 'coupons', 'platform-test')));
  await assertFails(getDoc(doc(dual, 'events', 'event-a')));
});
after(async () => { if (env) await env.cleanup(); });

test('club data are isolated and require active membership', async () => {
  const db = uid => env.authenticatedContext(uid).firestore();
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'clubs', 'a')));
  const ownEvent = await assertSucceeds(getDoc(doc(db('manager-a'), 'events', 'event-a')));
  assert.equal(ownEvent.data().title, 'a');
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
  const platformClubs = await assertSucceeds(getDocs(query(collection(db('platform'), 'clubs'))));
  assert.equal(platformClubs.size, 2);
  await assertFails(getDocs(query(collection(db('member-a'), 'clubs'))));
  await assertFails(setDoc(doc(db('manager-a'), 'platform_admins', 'manager-a'), {enabled: true}));
});

test('platform administrators can page through clubs without granting members a global list', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const batch = writeBatch(context.firestore());
    for (let index = 0; index < 55; index++) batch.set(doc(context.firestore(), 'clubs', `page-${String(index).padStart(2, '0')}`), { name: `Club ${index}` });
    await batch.commit();
  });
  const platform = env.authenticatedContext('platform').firestore();
  const page = await assertSucceeds(getDocs(query(collection(platform, 'clubs'), orderBy(documentId()), limit(51))));
  assert.equal(page.size, 51);
  const next = await assertSucceeds(getDocs(query(collection(platform, 'clubs'), orderBy(documentId()), startAfter(page.docs[49].id), limit(51))));
  assert.equal(next.size, 7);
  assert(!page.docs.slice(0, 50).some(item => next.docs.some(other => other.id === item.id)));
  const member = env.authenticatedContext('member-a').firestore();
  await assertFails(getDocs(query(collection(member, 'clubs'), orderBy(documentId()), limit(51))));
});

test('club workspace writes real events, announcements, attendance and tournament results under existing permissions', async () => {
  const manager = env.authenticatedContext('manager-a').firestore();
  const member = env.authenticatedContext('member-a').firestore();
  const outsider = env.authenticatedContext('manager-b').firestore();
  const event = { clubId: 'a', title: 'Entraînement', description: '', startsAt: new Date('2030-01-01T12:00:00Z'), location: '', category: 'entrainement', visibility: 'members', createdByMemberId: 'member-manager-a' };
  await assertSucceeds(setDoc(doc(manager, 'events', 'web-event'), event));
  const savedEvent = await assertSucceeds(getDoc(doc(manager, 'events', 'web-event')));
  assert.equal(savedEvent.data().title, event.title);
  await assertFails(setDoc(doc(member, 'events', 'web-event-member'), { ...event, createdByMemberId: 'member-member-a' }));
  await assertFails(getDoc(doc(outsider, 'events', 'web-event')));
  const announcement = { clubId: 'a', createdByMemberId: 'member-manager-a', title: 'Actualité', body: 'Message', isPinned: false, publishedAt: serverTimestamp(), visibility: 'members', notify: false, createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(manager, 'announcements', 'web-announcement'), announcement));
  await assertFails(setDoc(doc(member, 'announcements', 'web-announcement-member'), { ...announcement, createdByMemberId: 'member-member-a' }));
  const registration = { clubId: 'a', eventId: 'web-event', memberId: 'member-member-a', status: 'going' };
  await assertSucceeds(setDoc(doc(member, 'event_registrations', 'web-event_member-member-a'), registration));
  await assertFails(setDoc(doc(member, 'event_registrations', 'web-event_member-manager-a'), { ...registration, memberId: 'member-manager-a' }));
  await assertSucceeds(deleteDoc(doc(member, 'event_registrations', 'web-event_member-member-a')));
  await assertSucceeds(setDoc(doc(manager, 'tournaments', 'web-tournament'), { clubId: 'a', name: 'Tournoi', date: new Date('2030-01-01T12:00:00Z'), location: '', markerIds: ['member-member-a'], isFinished: false }));
  await assertFails(setDoc(doc(member, 'tournaments', 'web-tournament-member'), { clubId: 'a', name: 'Tournoi', date: new Date(), location: '', markerIds: [], isFinished: false }));
  const entry = { clubId: 'a', tournamentId: 'web-tournament', tableau: 'Principal', tour: '', playerA: 'A', playerB: 'B', scoreA: 2, scoreB: 1, note: '', recordedByMemberId: 'member-member-a', recordedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(member, 'tournament_entries', 'web-result'), entry));
  await assertFails(setDoc(doc(outsider, 'tournament_entries', 'web-result-outsider'), { ...entry, recordedByMemberId: 'member-manager-b' }));
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
  const publishedClub = await assertSucceeds(getDoc(doc(anonymous, 'clubs_public', 'a')));
  assert.equal(publishedClub.data().isPublished, true);
  await assertFails(getDoc(doc(anonymous, 'clubs_public', 'b')));
  const publishedEvent = await assertSucceeds(getDoc(doc(anonymous, 'events_public', 'public-a')));
  assert.equal(publishedEvent.data().clubId, 'a');
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
  const updatedNotification = await assertSucceeds(getDoc(notification));
  assert.ok(updatedNotification.data().readAt);
  await assertFails(updateDoc(notification, { readAt: null }));
  await assertFails(updateDoc(doc(otherMember, 'notifications', 'notification-a'), { readAt: serverTimestamp() }));
});
