"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Switching spaces reloads the session. */

import Image from "next/image";
import { collection, documentId, getDocsFromServer, limit, orderBy, query, startAfter } from "firebase/firestore";
import { ArrowLeft, Building2, ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { clientDb } from "@/lib/firebase/client";

type PlatformClub = { id: string; name: string; city: string; status: string };
const statusLabels: Record<string, string> = { trial: "Essai", active: "Actif", grace: "À régulariser", expired: "Expiré" };

export default function PlatformWorkspace({ email, hasClubs, siteEditor, onSignOut }: { email: string; hasClubs: boolean; siteEditor: boolean; onSignOut: () => void }) {
  const [clubs, setClubs] = useState<PlatformClub[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);

  useEffect(() => {
    let active = true;
    getDocsFromServer(query(collection(clientDb(), "clubs"), orderBy(documentId()), limit(51)))
      .then((snapshot) => {
        if (!active) return;
        const page = snapshot.docs.slice(0, 50);
        setCursor(page.at(-1)?.id ?? null);
        setHasMore(snapshot.docs.length > 50);
        setClubs(page.map((item) => {
          const data = item.data();
          return { id: item.id, name: typeof data.name === "string" ? data.name : "Club", city: typeof data.city === "string" ? data.city : "", status: typeof data.subscriptionStatus === "string" ? data.subscriptionStatus : "" };
        }));
        setError(false);
      })
      .catch(() => { if (active) { setClubs(null); setError(true); } });
    return () => { active = false; };
  }, [attempt]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const snapshot = await getDocsFromServer(query(collection(clientDb(), "clubs"), orderBy(documentId()), startAfter(cursor), limit(51)));
      const page = snapshot.docs.slice(0, 50);
      setClubs((previous) => [...(previous ?? []), ...page.map((item) => {
        const data = item.data();
        return { id: item.id, name: typeof data.name === "string" ? data.name : "Club", city: typeof data.city === "string" ? data.city : "", status: typeof data.subscriptionStatus === "string" ? data.subscriptionStatus : "" };
      })]);
      setCursor(page.at(-1)?.id ?? null);
      setHasMore(snapshot.docs.length > 50);
    } catch { setMoreError(true); }
    finally { setLoadingMore(false); }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-18 max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3"><Image alt="" aria-hidden="true" className="size-10 rounded-xl" src="/assodarts-mark.png" height={40} width={40} unoptimized /><div><p className="text-sm font-bold">Assodarts</p><p className="text-xs text-muted">Administration de la plateforme</p></div></div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {hasClubs && <a className="focus-ring rounded-full px-3 py-2 font-semibold text-navy hover:bg-soft" href="/">Espace club</a>}
            {siteEditor && <a className="focus-ring rounded-full px-3 py-2 font-semibold text-navy hover:bg-soft" href="/site">Gestion du site</a>}
            <a className="focus-ring rounded-full px-3 py-2 font-semibold text-muted hover:bg-soft" href="/retour-accueil">Site Assodarts <ExternalLink aria-hidden="true" className="inline" size={14} /></a>
            <button className="focus-ring rounded-full border border-border px-3 py-2 font-semibold hover:bg-soft" onClick={onSignOut} type="button"><LogOut aria-hidden="true" className="inline" size={15} /> Déconnexion</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-green"><ShieldCheck aria-hidden="true" size={16} /> Administration Assodarts</p><h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Vue d’ensemble</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Retrouvez les clubs de la plateforme. Les informations privées d’un club restent accessibles selon les droits de ses membres.</p></div><span className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-muted">{email}</span></div>
        <section className="mt-10 overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="platform-clubs">
          <div className="flex items-center gap-3 border-b border-border px-5 py-5 sm:px-7"><span className="grid size-10 place-items-center rounded-xl bg-green-soft text-green"><Building2 aria-hidden="true" size={19} /></span><div><h2 id="platform-clubs" className="font-bold">Clubs</h2><p className="mt-1 text-xs text-muted">Chargement par groupes de 50 clubs</p></div></div>
          {error ? <div role="alert" className="p-6 text-sm text-muted">Impossible de charger les clubs. Vérifiez votre connexion et vos droits. <button className="focus-ring ml-2 font-bold text-navy" onClick={() => setAttempt((value) => value + 1)} type="button">Réessayer</button></div> : clubs === null ? <p className="p-6 text-sm text-muted">Chargement des clubs…</p> : clubs.length === 0 ? <p className="p-6 text-sm text-muted">Aucun club pour le moment.</p> : <ul className="divide-y divide-border">{clubs.map((club) => <li key={club.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-7"><div className="min-w-0"><p className="truncate text-sm font-bold">{club.name}</p>{club.city && <p className="mt-1 text-xs text-muted">{club.city}</p>}</div><span className="shrink-0 rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted">{statusLabels[club.status] ?? "Statut indisponible"}</span></li>)}</ul>}
          {hasMore && <div className="border-t border-border p-5 sm:px-7">{moreError && <p role="alert" className="mb-3 text-sm text-red-800">Impossible de charger la suite. Réessayez.</p>}<button className="focus-ring rounded-full border border-border px-5 py-2 text-sm font-semibold text-navy hover:bg-background disabled:opacity-50" disabled={loadingMore} onClick={loadMore} type="button">{loadingMore ? "Chargement…" : "Afficher plus de clubs"}</button></div>}
        </section>
        <p className="mt-6 text-sm leading-6 text-muted">Les autres fonctions de plateforme ne sont pas encore disponibles sur le web.</p>
        {hasClubs && <a className="focus-ring mt-6 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:underline" href="/"><ArrowLeft aria-hidden="true" size={16} /> Retour à l’espace club</a>}
      </main>
    </div>
  );
}
