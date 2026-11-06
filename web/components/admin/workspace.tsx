"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Space changes reload and recheck the authenticated session. */

import Image from "next/image";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Home,
  LogOut,
  MapPin,
  Megaphone,
  Pin,
  Plus,
  Search,
  ShieldCheck,
  Trophy,
  UsersRound,
  X,
  ChevronDown,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import {
  createClubAnnouncement,
  createClubEvent,
  createClubTournament,
  loadClubWorkspace,
  recordTournamentResult,
  resolveClubSession,
  saveEventAttendance,
  type ClubAccess,
  type ClubEvent,
  type ClubRosterMember,
  type ClubTournament,
  type ClubSessionResult,
  type ClubWorkspaceData,
  type EventAttendance,
} from "@/lib/admin/data";
import { canManageClub, chooseInitialClub } from "@/lib/admin/roles";
import { parseWorkspacePath, workspacePath, type WorkspaceTabId } from "@/lib/admin/navigation";
import { clientAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { messages } from "@/lib/messages";
import PlatformWorkspace from "@/components/admin/platform";
import SiteWorkspace from "@/components/admin/site";

type TabId = WorkspaceTabId;
type AdminSession = Extract<ClubSessionResult, { kind: "club-member" }>;
type DialogType = "event" | "announcement" | "tournament" | "entry" | null;
type CreationDialogType = Exclude<DialogType, null>;

type DialogContext = {
  fields: FormData;
  club: ClubAccess;
  memberId: string;
  role: ClubAccess["role"];
  workspace: ClubWorkspaceData | null;
};

const tabs: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "home", label: messages.adminWorkspace.tabs.home, icon: Home },
  { id: "news", label: messages.adminWorkspace.tabs.news, icon: Megaphone },
  { id: "events", label: messages.adminWorkspace.tabs.events, icon: CalendarDays },
  { id: "members", label: messages.adminWorkspace.tabs.members, icon: UsersRound },
  { id: "tournaments", label: messages.adminWorkspace.tabs.tournaments, icon: Trophy },
];

export default function AdminWorkspace({ space = "club" }: { space?: "club" | "platform" | "site" }) {
  const configured = isFirebaseClientConfigured();
  const [authReady, setAuthReady] = useState(!configured);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<ClubSessionResult | null>(null);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState(false);
  const [activeClubId, setActiveClubId] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;

    let active = true;
    let generation = 0;
    const unsubscribe = onAuthStateChanged(clientAuth(), async (nextUser) => {
      if (!active) return;
      const current = ++generation;
      setUser(nextUser);
      setSession(null);
      setActiveClubId(null);
      setIdentityError(false);
      setAuthReady(true);
      if (!nextUser) {
        setIdentityLoading(false);
        return;
      }

      setIdentityLoading(true);
      try {
        const nextSession = await resolveClubSession(nextUser);
        if (!active || current !== generation) return;
        setSession(nextSession);
        if (nextSession.kind === "club-member") {
          setActiveClubId(
            chooseInitialClub(
              nextSession.clubs,
              readClubPreference(nextUser.uid),
              nextSession.defaultClubId,
            ),
          );
        }
      } catch {
        if (active && current === generation) setIdentityError(true);
      } finally {
        if (active && current === generation) setIdentityLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [configured]);

  async function handleSignOut() {
    await signOut(clientAuth());
    setSession(null);
    setActiveClubId(null);
  }

  if (!configured) return <AccessState title={messages.adminWorkspace.configurationTitle} description={messages.adminWorkspace.configurationDescription} />;
  if (!authReady || identityLoading) return <LoadingScreen />;
  if (!user) return <SignInScreen />;
  if (identityError) {
    return <AccessState title={messages.adminWorkspace.dataError} onSignOut={handleSignOut} />;
  }
  if (space === "site" || (space === "club" && session?.kind === "site-editor")) {
    if (session?.kind === "site-editor" || (session?.kind === "platform-admin" && session.siteEditor) || (session?.kind === "club-member" && session.siteEditor)) {
      return <SiteWorkspace uid={session.uid} hasClub={session.kind === "club-member"} hasPlatform={session.kind === "platform-admin" || (session.kind === "club-member" && session.platformAdmin)} onSignOut={handleSignOut} />;
    }
    return <AccessState title="Accès à la gestion du site non autorisé" description="Ce compte ne dispose pas des droits d’édition du site." onSignOut={handleSignOut} clubLink={session?.kind === "club-member"} />;
  }
  if (space === "platform") {
    if (session?.kind === "platform-admin" || (session?.kind === "club-member" && session.platformAdmin)) {
      return <PlatformWorkspace email={session.email} hasClubs={session.kind === "club-member"} siteEditor={session.siteEditor} onSignOut={handleSignOut} />;
    }
    return <AccessState title="Accès à la plateforme non autorisé" description="Ce compte ne dispose pas des droits d’administration de la plateforme." onSignOut={handleSignOut} clubLink={session?.kind === "club-member"} />;
  }
  if (session?.kind === "platform-admin") {
    return <PlatformWorkspace email={session.email} hasClubs={false} siteEditor={session.siteEditor} onSignOut={handleSignOut} />;
  }
  if (session?.kind === "no-profile") {
    return <AccessState title={messages.adminWorkspace.noProfileTitle} onSignOut={handleSignOut} />;
  }
  if (session?.kind !== "club-member" || !activeClubId) {
    return <AccessState title={messages.adminWorkspace.noMembershipTitle} description={messages.adminWorkspace.noMembershipDescription} onSignOut={handleSignOut} />;
  }

  return (
    <ClubWorkspace
      key={`${session.uid}:${activeClubId}`}
      activeClubId={activeClubId}
      onClubChange={(clubId) => {
        writeClubPreference(session.uid, clubId);
        setActiveClubId(clubId);
      }}
      onSignOut={handleSignOut}
      session={session}
    />
  );
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 text-muted">
      <p className="flex items-center gap-3 text-sm font-semibold">
        <span className="size-2 animate-pulse rounded-full bg-green" />
        {messages.adminWorkspace.loading}
      </p>
    </main>
  );
}

function SignInScreen() {
  const copy = messages.adminWorkspace;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(clientAuth(), email.trim().toLowerCase(), password);
    } catch (authError) {
      const code = typeof authError === "object" && authError && "code" in authError ? String(authError.code) : "";
      setError(
        code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password"
          ? copy.invalidCredentials
          : copy.signInError,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword() {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError(copy.email);
      return;
    }
    try {
      await sendPasswordResetEmail(clientAuth(), email.trim().toLowerCase());
    } catch {
      // Keep the response generic to avoid revealing whether an account exists.
    }
    setInfo(copy.resetSent);
  }

  return (
    <main className="grid min-h-screen bg-background px-5 py-10 sm:place-items-center sm:px-8">
      <div className="mx-auto w-full max-w-[28rem] sm:-mt-8">
        <a className="focus-ring inline-flex items-center gap-3 rounded-sm" href="/retour-accueil" aria-label="Retour au site Assodarts">
          <Image alt="" aria-hidden="true" className="size-11 rounded-xl" height={44} src="/assodarts-mark.png" unoptimized width={44} />
          <span className="text-base font-bold">Assodarts</span>
        </a>
        <a className="focus-ring mt-6 flex w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-navy" href="/retour-accueil"><ArrowLeft aria-hidden="true" size={16} /> Site Assodarts</a>
        <section className="mt-10 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold text-green">{copy.appName}</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-ink">{copy.signInTitle}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{copy.signInDescription}</p>
          <form className="mt-7 space-y-5" onSubmit={submit}>
            <label className="block text-sm font-semibold" htmlFor="admin-email">
              {copy.email}
              <input autoComplete="email" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base font-normal text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20" id="admin-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </label>
            <label className="block text-sm font-semibold" htmlFor="admin-password">
              {copy.password}
              <input autoComplete="current-password" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base font-normal text-ink outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20" id="admin-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            </label>
            {error && <p className="text-sm font-medium text-[#c0362c]" role="alert">{error}</p>}
            {info && <p className="text-sm font-medium text-green" role="status">{info}</p>}
            <button className="focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-white transition hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit">
              {submitting ? copy.signingIn : copy.signIn}
              {!submitting && <ArrowRight aria-hidden="true" size={17} />}
            </button>
          </form>
          <button className="focus-ring mt-5 rounded-sm text-sm font-semibold text-muted hover:text-ink" onClick={resetPassword} type="button">{copy.forgotPassword}</button>
        </section>
      </div>
    </main>
  );
}

function AccessState({
  title,
  description,
  role,
  onSignOut,
  clubLink = false,
}: {
  title: string;
  description?: string;
  role?: string;
  onSignOut?: () => void;
  clubLink?: boolean;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-12">
      <section className="w-full max-w-xl border-l-2 border-orange pl-6 sm:pl-8">
        <div className="flex items-center gap-3">
          <Image alt="" aria-hidden="true" className="size-11 rounded-xl" height={44} src="/assodarts-mark.png" unoptimized width={44} />
          <div>
            <p className="text-sm font-bold">Assodarts</p>
            {role && <p className="mt-1 text-xs text-muted">{role}</p>}
          </div>
        </div>
        <h1 className="mt-8 text-3xl font-bold leading-tight">{title}</h1>
        {description && <p className="mt-4 text-sm leading-6 text-muted">{description}</p>}
        <div className="mt-7 flex flex-wrap items-center gap-3">
        {clubLink && <a className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-5 text-sm font-bold hover:bg-soft" href="/">Espace club <ArrowRight aria-hidden="true" size={16} /></a>}
        <a className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-white hover:bg-navy-deep" href="/retour-accueil"><ArrowLeft aria-hidden="true" size={16} /> Site Assodarts</a>
        {onSignOut && (
          <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-5 text-sm font-bold hover:bg-soft" onClick={onSignOut} type="button">
            <LogOut aria-hidden="true" size={16} /> {messages.adminWorkspace.signOut}
          </button>
        )}
        </div>
      </section>
    </main>
  );
}

function ClubWorkspace({
  session,
  activeClubId,
  onClubChange,
  onSignOut,
}: {
  session: AdminSession;
  activeClubId: string;
  onClubChange: (clubId: string) => void;
  onSignOut: () => void;
}) {
  const copy = messages.adminWorkspace;
  const [tab, setTab] = useState<TabId>("home");
  const [loadState, setLoadState] = useState<
    | { clubId: string; data: ClubWorkspaceData }
    | { clubId: string; error: true }
    | null
  >(null);
  const [now, setNow] = useState<number | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [period, setPeriod] = useState<"upcoming" | "past">("upcoming");
  const [search, setSearch] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const club = session.clubs.find((item) => item.id === activeClubId);
  const role = club?.role ?? "membre";
  const manager = canManageClub(role);
  const roleLabel = role === "admin" ? copy.role.admin : role === "bureau" ? copy.role.committee : copy.role.member;
  const loading = loadState?.clubId !== activeClubId;
  const loadError = loadState?.clubId === activeClubId && "error" in loadState;
  const workspace = loadState?.clubId === activeClubId && "data" in loadState ? loadState.data : null;

  useEffect(() => {
    function syncLocation() {
      const location = parseWorkspacePath(window.location.pathname);
      if (location) {
        setTab(location.tab);
        setSelectedEventId(location.eventId);
      }
    }
    syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, []);

  function navigate(nextTab: TabId, eventId: string | null = null) {
    const prefix = /^\/admin(?:\/|$)/.test(window.location.pathname) ? "/admin" : "";
    const path = workspacePath(nextTab, eventId);
    window.history.pushState(null, "", `${prefix}${path}`);
    setTab(nextTab);
    setSelectedEventId(eventId);
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    loadClubWorkspace(activeClubId, session.memberId)
      .then((data) => { if (active) setLoadState({ clubId: activeClubId, data }); })
      .catch(() => { if (active) setLoadState({ clubId: activeClubId, error: true }); });
    return () => { active = false; };
  }, [activeClubId, refreshVersion, session.memberId]);

  async function submitDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!club || !dialog) return;
    setSaving(true);
    setDialogError("");
    try {
      const notice = await persistDialog(dialog, {
        fields: new FormData(event.currentTarget),
        club,
        memberId: session.memberId,
        role,
        workspace,
      });
      setMessage(notice);
      setMessageError(false);
      setDialog(null);
      setRefreshVersion((value) => value + 1);
    } catch {
      setDialogError(copy.writeError);
    } finally {
      setSaving(false);
    }
  }

  async function changeAttendance(event: ClubEvent, status: EventAttendance["status"] | null) {
    if (!club) return;
    setAttendanceSaving(true);
    try {
      await saveEventAttendance(club.id, event.id, session.memberId, status);
      setMessage("");
      setRefreshVersion((value) => value + 1);
    } catch {
      setMessage(copy.writeError);
      setMessageError(true);
    } finally {
      setAttendanceSaving(false);
    }
  }

  function changeClub(clubId: string) {
    navigate("home");
    setMessage("");
    onClubChange(clubId);
  }

  if (!club) return <AccessState title={copy.noMembershipTitle} onSignOut={onSignOut} />;
  const activeMembers = (workspace?.members ?? []).filter((member) => member.membershipStatus === "active" && member.profileStatus !== "deleted");
  const upcomingEvents = (workspace?.events ?? []).filter((event) => now !== null && event.startsAt && event.startsAt.getTime() >= now);
  const selectedEvent = workspace?.events.find((event) => event.id === selectedEventId);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface px-4 py-5 md:flex">
        <a className="focus-ring mb-8 flex items-center gap-3 rounded-sm px-2" href="/retour-accueil" aria-label="Retour au site Assodarts">
          <Image alt="" aria-hidden="true" className="size-10 rounded-xl" height={40} src="/assodarts-mark.png" unoptimized width={40} />
          <span><span className="block text-sm font-bold">Assodarts</span><span className="mt-0.5 block text-xs text-muted">{copy.appName}</span></span>
        </a>
        <ClubNavigation
          activeTab={tab}
          onSelect={(nextTab) => navigate(nextTab)}
        />
        <div className="mt-auto border-t border-border pt-4">
          {session.platformAdmin && <a className="focus-ring mb-1 flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted transition hover:bg-background hover:text-navy" href="/plateforme"><ShieldCheck aria-hidden="true" size={16} /> Administration Assodarts</a>}
          {session.siteEditor && <a className="focus-ring mb-1 flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted transition hover:bg-background hover:text-navy" href="/site"><ExternalLink aria-hidden="true" size={16} /> Gestion du site</a>}
          <a className="focus-ring mb-4 flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted transition hover:bg-background hover:text-navy" href="/retour-accueil"><ExternalLink aria-hidden="true" size={16} /> Site Assodarts</a>
          <p className="truncate px-3 text-sm font-semibold">{session.firstName} {session.lastName}</p>
          <p className="mt-1 px-3 text-xs text-muted">{roleLabel}</p>
          <button aria-label={copy.signOut} className="focus-ring mt-3 inline-flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted transition hover:bg-soft hover:text-ink" onClick={onSignOut} type="button">
            <LogOut aria-hidden="true" size={16} /> {copy.signOut}
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <Image alt="" aria-hidden="true" className="size-9 shrink-0 rounded-lg" height={36} src="/assodarts-mark.png" unoptimized width={36} />
              <span className="hidden truncate text-sm font-bold sm:block">{copy.appName}</span>
            </div>
            <label className="flex min-w-0 items-center gap-2">
              <span className="sr-only">{copy.clubSwitcher}</span>
              <select aria-label={copy.clubSwitcher} className="focus-ring min-h-10 max-w-[12rem] rounded-lg border border-border bg-background px-3 text-sm font-semibold text-ink sm:max-w-[18rem]" onChange={(event) => changeClub(event.target.value)} value={activeClubId}>
                {session.clubs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs font-semibold text-muted sm:inline">{roleLabel}</span>
              <details className="group relative">
                <summary aria-label="Compte et navigation" className="focus-ring flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-full px-1 [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-soft text-sm font-bold text-navy">{initials(session.firstName, session.lastName)}</span>
                  <ChevronDown aria-hidden="true" className="text-muted transition group-open:rotate-180" size={15} />
                </summary>
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-surface p-2 shadow-xl">
                  <div className="border-b border-border px-3 py-3"><p className="truncate text-sm font-bold">{session.firstName} {session.lastName}</p><p className="mt-1 truncate text-xs text-muted">{roleLabel} · {club.name}</p></div>
                  <a className="focus-ring mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold hover:bg-background" href="/retour-accueil"><ExternalLink aria-hidden="true" size={16} /> Site Assodarts</a>
                  {session.platformAdmin && <a className="focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold hover:bg-background" href="/plateforme"><ShieldCheck aria-hidden="true" size={16} /> Administration Assodarts</a>}
                  {session.siteEditor && <a className="focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold hover:bg-background" href="/site"><ExternalLink aria-hidden="true" size={16} /> Gestion du site</a>}
                  <button className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold hover:bg-background" onClick={onSignOut} type="button"><LogOut aria-hidden="true" size={16} /> {copy.signOut}</button>
                </div>
              </details>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-28 pt-7 sm:px-7 sm:pt-10 md:pb-12">
          {message && (
            <div className={`mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${messageError ? "border-red-300 bg-red-50 text-red-800" : "border-green/20 bg-green-soft text-green"}`} role={messageError ? "alert" : "status"}>
              <span>{message}</span>
              <button aria-label="Fermer" className="focus-ring rounded-sm" onClick={() => setMessage("")} type="button"><X aria-hidden="true" size={16} /></button>
            </div>
          )}
          {loadError && (
            <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-orange/30 bg-[#fdf0df] px-4 py-3 text-sm text-[#7c3f04]" role="alert">
              <span>{copy.dataError}</span>
              <button className="focus-ring rounded-sm font-bold" onClick={() => setRefreshVersion((value) => value + 1)} type="button">Réessayer</button>
            </div>
          )}
          {loading ? <LoadingScreen /> : !workspace ? <EmptyState icon={CalendarDays} text={copy.dataError} /> : selectedEvent ? (
            <EventDetails
              attendance={workspace.attendance.find((item) => item.eventId === selectedEvent.id)?.status ?? null}
              event={selectedEvent}
              now={now}
              onAttendance={(status) => changeAttendance(selectedEvent, status)}
              onBack={() => navigate("events")}
              saving={attendanceSaving}
            />
          ) : selectedEventId ? (
            <div className="rounded-2xl border border-border bg-surface p-6"><h1 className="text-xl font-bold">Événement indisponible</h1><p className="mt-2 text-sm text-muted">Cet événement est introuvable dans le club actif.</p><button className="focus-ring mt-5 font-semibold text-navy" onClick={() => navigate("events")} type="button">Retour aux événements</button></div>
          ) : (
            <WorkspaceTab
              activeMembers={activeMembers}
              club={club}
              data={workspace}
              manager={manager}
              onCreateAnnouncement={() => { setDialog("announcement"); setDialogError(""); }}
              onCreateEvent={() => { setDialog("event"); setDialogError(""); }}
              onCreateTournament={() => { setSelectedTournamentId(null); setDialog("tournament"); setDialogError(""); }}
              onRecordResult={(tournamentId) => { setSelectedTournamentId(tournamentId); setDialog("entry"); setDialogError(""); }}
              onSelectEvent={(id) => navigate("events", id)}
              onOpenEvents={() => navigate("events")}
              period={period}
              role={role}
              roleLabel={roleLabel}
              search={search}
              session={session}
              setPeriod={setPeriod}
              setSearch={setSearch}
              tab={tab}
              now={now}
              upcomingEvents={upcomingEvents}
            />
          )}
        </main>
      </div>

      <nav aria-label="Navigation du club" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button aria-current={tab === id ? "page" : undefined} className={`focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold ${tab === id ? "text-navy" : "text-muted"}`} key={id} onClick={() => navigate(id)} type="button">
              <Icon aria-hidden="true" size={19} /><span className="max-w-full truncate">{label}</span>
            </button>
          ))}
        </div>
      </nav>
      {dialog && workspace && (
        <CreationDialog
          error={dialogError}
          isSaving={saving}
          members={activeMembers}
          onClose={() => setDialog(null)}
          onSubmit={submitDialog}
          tournament={workspace.tournaments.find((item) => item.id === selectedTournamentId)}
          type={dialog}
        />
      )}
    </div>
  );
}

async function persistDialog(
  type: CreationDialogType,
  context: DialogContext,
): Promise<string> {
  const handlers: Record<CreationDialogType, (value: DialogContext) => Promise<string>> = {
    event: saveEventDialog,
    announcement: saveAnnouncementDialog,
    tournament: saveTournamentDialog,
    entry: saveResultDialog,
  };
  return handlers[type](context);
}

async function saveEventDialog({ fields, club, memberId, role }: DialogContext) {
  const startsAt = new Date(formString(fields, "startsAt"));
  if (Number.isNaN(startsAt.getTime())) throw new Error("invalid-date");
  await createClubEvent(club.id, memberId, role, {
    title: formString(fields, "title"),
    category: formString(fields, "category") || "entrainement",
    startsAt,
    location: formString(fields, "location"),
    description: formString(fields, "description"),
    visibility: formString(fields, "visibility") === "public" ? "public" : "members",
  });
  return messages.adminWorkspace.eventCreated;
}

async function saveAnnouncementDialog({ fields, club, memberId, role }: DialogContext) {
  // DECISION: Web announcements publish without push notifications until delivery is implemented here.
  await createClubAnnouncement(club.id, memberId, role, {
    title: formString(fields, "title"),
    body: formString(fields, "body"),
    isPinned: fields.get("isPinned") === "on",
    notify: false,
  });
  return messages.adminWorkspace.announcementPublished;
}

async function saveTournamentDialog({ fields, club, role }: DialogContext) {
  const date = new Date(formString(fields, "date"));
  if (Number.isNaN(date.getTime())) throw new Error("invalid-date");
  const markerIds = fields.getAll("markerIds").filter(isFormString);
  await createClubTournament(club.id, role, {
    name: formString(fields, "name"),
    date,
    location: formString(fields, "location"),
    markerIds,
  });
  return messages.adminWorkspace.tournamentCreated;
}

async function saveResultDialog({ fields, club, memberId, role, workspace }: DialogContext) {
  const tournamentId = formString(fields, "tournamentId");
  const tournament = workspace?.tournaments.find((item) => item.id === tournamentId);
  if (!tournament) throw new Error("tournament-not-found");
  await recordTournamentResult(
    club.id,
    tournamentId,
    memberId,
    role,
    tournament.markerIds.includes(memberId),
    {
      tableau: formString(fields, "tableau"),
      tour: formString(fields, "tour"),
      playerA: formString(fields, "playerA"),
      playerB: formString(fields, "playerB"),
      scoreA: formNumber(fields, "scoreA"),
      scoreB: formNumber(fields, "scoreB"),
      note: formString(fields, "note"),
    },
  );
  return messages.adminWorkspace.resultRecorded;
}

function formString(fields: FormData, name: string) {
  const value = fields.get(name);
  return typeof value === "string" ? value : "";
}

function formNumber(fields: FormData, name: string) {
  const raw = formString(fields, name).trim();
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value < 0 || value > 30) throw new Error("invalid-score");
  return value;
}

function isFormString(value: FormDataEntryValue): value is string {
  return typeof value === "string";
}

function ClubNavigation({ activeTab, onSelect }: { activeTab: TabId; onSelect: (tab: TabId) => void }) {
  return (
    <nav aria-label="Navigation du club" className="space-y-1">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button aria-current={activeTab === id ? "page" : undefined} className={`focus-ring flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${activeTab === id ? "bg-soft text-navy" : "text-muted hover:bg-background hover:text-ink"}`} key={id} onClick={() => onSelect(id)} type="button">
          <Icon aria-hidden="true" size={18} /> {label}
        </button>
      ))}
    </nav>
  );
}

function WorkspaceTab({
  tab,
  club,
  session,
  roleLabel,
  manager,
  role,
  data,
  activeMembers,
  upcomingEvents,
  period,
  setPeriod,
  now,
  search,
  setSearch,
  onSelectEvent,
  onOpenEvents,
  onCreateEvent,
  onCreateAnnouncement,
  onCreateTournament,
  onRecordResult,
}: {
  tab: TabId;
  club: ClubAccess;
  session: AdminSession;
  roleLabel: string;
  manager: boolean;
  role: ClubAccess["role"];
  data: ClubWorkspaceData;
  activeMembers: ClubRosterMember[];
  upcomingEvents: ClubEvent[];
  period: "upcoming" | "past";
  now: number | null;
  setPeriod: (period: "upcoming" | "past") => void;
  search: string;
  setSearch: (search: string) => void;
  onSelectEvent: (eventId: string) => void;
  onOpenEvents: () => void;
  onCreateEvent: () => void;
  onCreateAnnouncement: () => void;
  onCreateTournament: () => void;
  onRecordResult: (tournamentId: string) => void;
}) {
  const copy = messages.adminWorkspace;
  const attendanceFor = (eventId: string) => data.attendance.find((item) => item.eventId === eventId)?.status ?? null;

  if (tab === "home") {
    return (
      <div className="space-y-8">
        <header>
          <p className="text-sm font-semibold text-green">{manager ? copy.manager : copy.memberSpace} · {roleLabel}</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{copy.greeting}, {session.firstName || messages.title}</h1>
          <p className="mt-2 text-sm text-muted">{club.name}</p>
        </header>
        {(club.subscriptionStatus === "grace" || club.subscriptionStatus === "expired") && (
          <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm leading-6 ${club.subscriptionStatus === "expired" ? "border-red-300 bg-red-50 text-red-800" : "border-orange/30 bg-[#fdf0df] text-[#7c3f04]"}`}>
            <ShieldCheck aria-hidden="true" className="mt-1 shrink-0" size={17} />
            {club.subscriptionStatus === "expired" ? copy.subscriptionExpired : copy.subscriptionGrace}
          </div>
        )}
        {manager && (
          <section>
            <SectionHeading title={copy.manager} />
            <div className="mt-3 flex flex-wrap gap-3">
              <ActionButton icon={CalendarDays} onClick={onCreateEvent}>{copy.newEvent}</ActionButton>
              <ActionButton icon={Megaphone} onClick={onCreateAnnouncement}>{copy.newAnnouncement}</ActionButton>
            </div>
          </section>
        )}
        {role === "membre" && (
          <section className="rounded-xl border border-border bg-surface p-5">
            <p className="text-xs font-bold uppercase text-muted">{copy.licensed}</p>
            <p className="mt-2 text-lg font-bold">{club.seasonStatus === "player" || club.licenseNumber ? copy.licensed : copy.standardMember}</p>
            {club.licenseNumber && <p className="mt-1 text-sm text-muted">{club.licenseNumber}</p>}
          </section>
        )}
        {manager && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label={copy.membersCount} value={activeMembers.length} icon={UsersRound} />
            <Metric label={copy.upcomingCount} value={upcomingEvents.length} icon={CalendarDays} />
            <Metric label={copy.tabs.tournaments} value={data.tournaments.length} icon={Trophy} />
          </div>
        )}
        {!manager && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label={copy.upcomingCount} value={upcomingEvents.length} icon={CalendarDays} />
            <Metric label={copy.latestNews} value={data.announcements.length} icon={Megaphone} />
          </div>
        )}
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <section>
            <SectionHeading title={copy.nextEvent} action={copy.tabs.events} onAction={onOpenEvents} />
            <div className="mt-3">
              {upcomingEvents[0] ? <EventRow attendance={attendanceFor(upcomingEvents[0].id)} event={upcomingEvents[0]} onClick={() => onSelectEvent(upcomingEvents[0].id)} /> : <EmptyState icon={CalendarDays} text={copy.noEvents} />}
            </div>
          </section>
          <section>
            <SectionHeading title={copy.latestNews} />
            <div className="mt-3 space-y-3">
              {data.announcements.slice(0, 2).map((announcement) => (
                <article className="rounded-xl border border-border bg-surface p-4" key={announcement.id}>
                  <h3 className="font-bold">{announcement.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{announcement.body}</p>
                </article>
              ))}
              {!data.announcements.length && <EmptyState icon={Megaphone} text={copy.noAnnouncements} />}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (tab === "news") {
    return (
      <div>
        <PageHeading action={manager ? <ActionButton icon={Plus} onClick={onCreateAnnouncement}>{copy.newAnnouncement}</ActionButton> : undefined} description={club.name} title={copy.tabs.news} />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {data.announcements.map((announcement) => (
            <article className="rounded-xl border border-border bg-surface p-5" key={announcement.id}>
              <div className="flex items-center justify-between gap-4">
                {announcement.isPinned ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf0df] px-3 py-1 text-xs font-bold text-[#a75b08]"><Pin aria-hidden="true" size={13} />{copy.pinAnnouncement}</span> : <span className="text-xs text-muted">{formatDate(announcement.publishedAt ?? announcement.createdAt)}</span>}
                {announcement.isPinned && <span className="text-xs text-muted">{formatDate(announcement.publishedAt ?? announcement.createdAt)}</span>}
              </div>
              <h2 className="mt-4 text-lg font-bold">{announcement.title}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">{announcement.body}</p>
            </article>
          ))}
        </div>
        {!data.announcements.length && <EmptyState icon={Megaphone} text={copy.noAnnouncements} />}
      </div>
    );
  }

  if (tab === "events") {
    const events = data.events.filter((event) => {
      const inFuture = now !== null && event.startsAt && event.startsAt.getTime() >= now;
      return period === "upcoming" ? inFuture : !inFuture;
    });
    return (
      <div>
        <PageHeading action={manager ? <ActionButton icon={Plus} onClick={onCreateEvent}>{copy.newEvent}</ActionButton> : undefined} description={club.name} title={copy.tabs.events} />
        <div aria-label="Période" className="mt-6 inline-flex rounded-xl border border-border bg-surface p-1" role="group">
          {(["upcoming", "past"] as const).map((value) => (
            <button aria-pressed={period === value} className={`focus-ring min-h-10 rounded-lg px-4 text-sm font-semibold ${period === value ? "bg-navy text-white" : "text-muted hover:text-ink"}`} key={value} onClick={() => setPeriod(value)} type="button">
              {value === "upcoming" ? copy.upcoming : copy.past}
            </button>
          ))}
        </div>
        <div className="mt-4 divide-y divide-border border-y border-border">
          {events.map((event) => <EventRow attendance={attendanceFor(event.id)} event={event} key={event.id} onClick={() => onSelectEvent(event.id)} />)}
        </div>
        {!events.length && <EmptyState icon={CalendarDays} text={copy.noEvents} />}
      </div>
    );
  }

  if (tab === "members") {
    const normalized = search.trim().toLocaleLowerCase("fr-FR");
    const filtered = activeMembers.filter((member) => `${member.firstName} ${member.lastName}`.toLocaleLowerCase("fr-FR").includes(normalized));
    return (
      <div>
        <PageHeading description={club.name} title={copy.tabs.members} />
        <label className="mt-6 flex min-h-11 max-w-lg items-center gap-3 rounded-xl border border-border bg-surface px-4 text-muted">
          <Search aria-hidden="true" size={17} /><span className="sr-only">{copy.searchMembers}</span>
          <input className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted" onChange={(event) => setSearch(event.target.value)} placeholder={copy.searchMembers} type="search" value={search} />
        </label>
        <div className="mt-5 divide-y divide-border border-y border-border">
          {filtered.map((member) => (
            <div className="flex min-h-[4.5rem] items-center gap-3 py-3" key={member.id}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-soft text-sm font-bold text-navy">{initials(member.firstName, member.lastName)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{member.firstName} {member.lastName}</p>
                <p className="mt-1 text-xs text-muted">{member.seasonStatus === "player" || member.licenseNumber ? `${copy.licensed}${member.licenseNumber ? ` · ${member.licenseNumber}` : ""}` : copy.standardMember}</p>
              </div>
              {member.role !== "membre" && <span className={`rounded-full px-3 py-1 text-xs font-bold ${member.role === "admin" ? "bg-[#fdf0df] text-[#a75b08]" : "bg-soft text-navy"}`}>{member.role === "admin" ? copy.role.admin : copy.role.committee}</span>}
            </div>
          ))}
        </div>
        {!filtered.length && <EmptyState icon={UsersRound} text={copy.noMembers} />}
      </div>
    );
  }

  return (
    <div>
      <PageHeading
        action={manager ? <ActionButton icon={Plus} onClick={onCreateTournament}>{copy.newTournament}</ActionButton> : undefined}
        description={club.name}
        title={copy.tabs.tournaments}
      />
      <div className="mt-6 space-y-5">
        {data.tournaments.map((tournament) => (
          <article className="rounded-xl border border-border bg-surface p-5" key={tournament.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-muted">{formatDate(tournament.date)}</p>
                <h2 className="mt-2 text-lg font-bold">{tournament.name}</h2>
                {tournament.location && <p className="mt-2 flex items-center gap-2 text-sm text-muted"><MapPin aria-hidden="true" size={15} />{tournament.location}</p>}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${tournament.isFinished === false ? "bg-green-soft text-green" : "bg-soft text-muted"}`}>{tournament.isFinished === null ? "Statut indisponible" : tournament.isFinished ? copy.complete : copy.inProgress}</span>
            </div>
            {tournament.entries.length > 0 && (
              <div className="mt-5 overflow-x-auto border-t border-border pt-4">
                <h3 className="mb-3 text-xs font-bold uppercase text-muted">{copy.result}</h3>
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="text-xs text-muted"><tr><th className="pb-2 pr-3 font-semibold">{copy.match}</th><th className="px-3 pb-2 font-semibold">{copy.result}</th><th className="pb-2 pl-3 font-semibold">{copy.stage}</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {tournament.entries.map((entry) => (
                      <tr key={entry.id}><td className="py-2 pr-3">{entry.playerA} · {entry.playerB}</td><td className="px-3 py-2 font-bold tabular-nums">{entry.scoreA ?? "—"} – {entry.scoreB ?? "—"}</td><td className="py-2 pl-3 text-muted">{entry.tableau} · {entry.tour}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(manager || tournament.markerIds.includes(session.memberId)) && (
              <button
                className="focus-ring mt-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-bold text-navy hover:bg-soft"
                onClick={() => onRecordResult(tournament.id)}
                type="button"
              >
                <Plus aria-hidden="true" size={15} /> {copy.recordResult}
              </button>
            )}
          </article>
        ))}
      </div>
      {!data.tournaments.length && <EmptyState icon={Trophy} text={copy.noTournaments} />}
    </div>
  );
}

function EventDetails({
  event,
  attendance,
  saving,
  now,
  onBack,
  onAttendance,
}: {
  event: ClubEvent;
  attendance: EventAttendance["status"] | null;
  saving: boolean;
  now: number | null;
  onBack: () => void;
  onAttendance: (status: EventAttendance["status"] | null) => void;
}) {
  const copy = messages.adminWorkspace;
  const canAnswer = now !== null && event.startsAt && event.startsAt.getTime() >= now;
  return (
    <div className="max-w-4xl">
      <button className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-sm text-sm font-semibold text-muted hover:text-navy" onClick={onBack} type="button"><ArrowLeft aria-hidden="true" size={16} /> {copy.tabs.events}</button>
      <article className="mt-5 rounded-2xl border border-border bg-surface p-5 sm:p-8">
        <p className="text-sm font-bold text-orange">{categoryLabel(event.category)}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{event.title}</h1>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-y border-border py-4 text-sm text-muted">
          <span className="flex items-center gap-2"><Clock3 aria-hidden="true" size={16} />{formatDate(event.startsAt)}</span>
          {event.location && <span className="flex items-center gap-2"><MapPin aria-hidden="true" size={16} />{event.location}</span>}
        </div>
        {event.description && <p className="mt-6 whitespace-pre-line text-sm leading-7 text-muted">{event.description}</p>}
      </article>
      {canAnswer && (
        <section className="mt-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-sm font-bold">{copy.attendance}</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button aria-pressed={attendance === "going"} className={`focus-ring inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold ${attendance === "going" ? "bg-green text-white" : "border border-green/30 text-green hover:bg-green-soft"}`} disabled={saving} onClick={() => onAttendance(attendance === "going" ? null : "going")} type="button"><Check aria-hidden="true" size={16} /> {copy.going}</button>
            <button aria-pressed={attendance === "declined"} className={`focus-ring inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold ${attendance === "declined" ? "bg-[#c0362c] text-white" : "border border-[#c0362c]/30 text-[#c0362c] hover:bg-[#fbe9e7]"}`} disabled={saving} onClick={() => onAttendance(attendance === "declined" ? null : "declined")} type="button"><X aria-hidden="true" size={16} /> {copy.declined}</button>
          </div>
          {attendance && <button className="focus-ring mt-4 rounded-sm text-xs font-semibold text-muted underline" disabled={saving} onClick={() => onAttendance(null)} type="button">{copy.clearAttendance}</button>}
        </section>
      )}
    </div>
  );
}

function CreationDialog({
  type,
  error,
  isSaving,
  members,
  tournament,
  onClose,
  onSubmit,
}: {
  type: Exclude<DialogType, null>;
  error: string;
  isSaving: boolean;
  members: ClubRosterMember[];
  tournament?: ClubTournament;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const copy = messages.adminWorkspace;
  const heading = creationDialogHeading(type, copy);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[#101923]/55 p-0 sm:place-items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="creation-title" aria-modal="true" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-7" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold text-green">{messages.title}</p><h2 className="mt-2 text-xl font-bold" id="creation-title">{heading}</h2></div>
          <button aria-label={copy.cancel} className="focus-ring grid size-10 place-items-center rounded-full text-muted hover:bg-soft" onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button>
        </div>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {renderCreationFields(type, copy, members, tournament)}
          {error && <p className="text-sm font-medium text-[#c0362c]" role="alert">{error}</p>}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button className="focus-ring min-h-11 rounded-full px-4 text-sm font-semibold text-muted hover:bg-soft" onClick={onClose} type="button">{copy.cancel}</button>
            <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-white hover:bg-navy-deep disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? copy.save : creationActionLabel(type, copy)}{!isSaving && <ArrowRight aria-hidden="true" size={16} />}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function creationDialogHeading(
  type: CreationDialogType,
  copy: typeof messages.adminWorkspace,
): string {
  switch (type) {
    case "event":
      return copy.newEvent;
    case "announcement":
      return copy.newAnnouncement;
    case "tournament":
      return copy.newTournament;
    case "entry":
      return copy.recordResult;
  }
}

function creationActionLabel(
  type: CreationDialogType,
  copy: typeof messages.adminWorkspace,
): string {
  if (type === "event" || type === "tournament") return copy.create;
  if (type === "announcement") return copy.publish;
  return copy.save;
}

function renderCreationFields(
  type: CreationDialogType,
  copy: typeof messages.adminWorkspace,
  members: ClubRosterMember[],
  tournament?: ClubTournament,
): ReactNode {
  if (type === "event") {
    return (
      <>
        <FormField label={copy.title} name="title" required />
        <label className="block text-sm font-semibold" htmlFor="event-category">{copy.category}<select className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-ink" id="event-category" name="category"><option value="entrainement">{copy.training}</option><option value="competition">{copy.competition}</option><option value="reunion">{copy.meeting}</option><option value="convivial">{copy.social}</option></select></label>
        <FormField label={copy.dateAndTime} name="startsAt" required type="datetime-local" />
        <FormField label={copy.location} name="location" required />
        <FormField label={copy.description} name="description" multiline />
        <label className="block text-sm font-semibold" htmlFor="event-visibility">
          {copy.visibility}
          <select className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-ink" defaultValue="members" id="event-visibility" name="visibility">
            <option value="members">{copy.membersOnly}</option>
            <option value="public">{copy.public}</option>
          </select>
        </label>
      </>
    );
  }
  if (type === "announcement") {
    return (
      <>
        <FormField label={copy.title} name="title" required />
        <FormField label={copy.message} name="body" required multiline />
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input className="size-4 accent-[#1c3660]" name="isPinned" type="checkbox" />{copy.pinAnnouncement}</label>
      </>
    );
  }
  if (type === "tournament") {
    return (
      <>
        <FormField label={copy.title} name="name" required />
        <FormField label={copy.dateOnly} name="date" required type="date" />
        <FormField label={copy.location} name="location" required />
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{copy.scorers}</legend>
          <p className="text-xs leading-5 text-muted">{copy.scorersHelp}</p>
          <div className="max-h-48 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-background px-3">
            {members.map((member) => (
              <label className="flex min-h-11 items-center gap-3 text-sm" key={member.id}>
                <input className="size-4 accent-[#1c3660]" name="markerIds" type="checkbox" value={member.id} />
                <span>{member.firstName} {member.lastName}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </>
    );
  }
  return (
    <>
      <input name="tournamentId" type="hidden" value={tournament?.id ?? ""} />
      {tournament && <p className="text-sm font-semibold text-muted">{tournament.name}</p>}
      <FormField label={copy.draw} name="tableau" required />
      <FormField label={copy.round} name="tour" />
      <FormField label={copy.playerA} name="playerA" required />
      <label className="block text-sm font-semibold" htmlFor="score-a">{copy.scoreA}<input className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-ink" id="score-a" max={30} min={0} name="scoreA" type="number" required /></label>
      <FormField label={copy.playerB} name="playerB" required />
      <label className="block text-sm font-semibold" htmlFor="score-b">{copy.scoreB}<input className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-ink" id="score-b" max={30} min={0} name="scoreB" type="number" required /></label>
      <FormField label={copy.optionalNote} name="note" multiline />
    </>
  );
}

function FormField({
  label,
  name,
  required = false,
  type = "text",
  multiline = false,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold" htmlFor={`field-${name}`}>
      {label}
      {multiline ? <textarea className="mt-2 min-h-28 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm font-normal text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/20" id={`field-${name}`} name={name} required={required} rows={4} /> : <input className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-normal text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/20" id={`field-${name}`} name={name} required={required} type={type} />}
    </label>
  );
}

function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div><p className="text-sm font-semibold text-green">{description}</p><h1 className="mt-2 text-3xl font-bold">{title}</h1></div>
      {action}
    </header>
  );
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-bold">{title}</h2>{action && onAction && <button className="focus-ring rounded-sm text-xs font-semibold text-navy hover:underline" onClick={onAction} type="button">{action}</button>}</div>;
}

function ActionButton({ children, icon: Icon, onClick }: { children: ReactNode; icon: LucideIcon; onClick: () => void }) {
  return <button className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-4 text-sm font-bold text-white transition hover:bg-navy-deep" onClick={onClick} type="button"><Icon aria-hidden="true" size={16} /> {children}</button>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-muted">{label}</span><span className="grid size-9 place-items-center rounded-lg bg-soft text-navy"><Icon aria-hidden="true" size={18} /></span></div>
      <p className="mt-4 text-3xl font-bold tabular-nums">{value.toLocaleString("fr-FR")}</p>
    </article>
  );
}

function EventRow({ event, attendance, onClick }: { event: ClubEvent; attendance: EventAttendance["status"] | null; onClick: () => void }) {
  return (
    <button className="focus-ring group flex w-full items-center gap-4 rounded-sm py-4 text-left" onClick={onClick} type="button">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-soft text-sm font-bold text-navy">{event.startsAt ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: "Europe/Paris" }).format(event.startsAt) : "—"}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold group-hover:text-navy">{event.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5"><Clock3 aria-hidden="true" size={13} />{formatDate(event.startsAt)}</span>
          {event.location && <span className="flex items-center gap-1.5"><MapPin aria-hidden="true" size={13} />{event.location}</span>}
        </span>
      </span>
      <span className="hidden shrink-0 rounded-full bg-soft px-3 py-1 text-xs font-semibold text-muted sm:inline-flex">{attendanceLabel(attendance)}</span>
      <ArrowRight aria-hidden="true" className="shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-navy" size={16} />
    </button>
  );
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return <div className="mt-5 flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-border px-5 py-7 text-center"><Icon aria-hidden="true" className="text-muted" size={22} /><p className="mt-3 text-sm text-muted">{text}</p></div>;
}

function categoryLabel(category: string) {
  const copy = messages.adminWorkspace;
  if (category === "competition") return copy.competition;
  if (category === "reunion") return copy.meeting;
  if (category === "convivial") return copy.social;
  return copy.training;
}

function attendanceLabel(status: EventAttendance["status"] | null) {
  if (status === "going") return messages.adminWorkspace.going;
  if (status === "declined") return messages.adminWorkspace.declined;
  return messages.adminWorkspace.attendance;
}

function formatDate(date: Date | null) {
  if (!date) return messages.adminWorkspace.noDate;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(date);
}

function initials(firstName: string, lastName: string) {
  const value = `${firstName.trim().at(0) ?? ""}${lastName.trim().at(0) ?? ""}`.toLocaleUpperCase("fr-FR");
  return value || "A";
}

function readClubPreference(uid: string): string | null {
  try { return window.localStorage.getItem(`assodarts.activeClub.${uid}`); } catch { return null; }
}

function writeClubPreference(uid: string, clubId: string) {
  try { window.localStorage.setItem(`assodarts.activeClub.${uid}`, clubId); } catch { /* Optional browser preference only. */ }
}
