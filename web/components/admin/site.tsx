"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Switching spaces reloads the session. */
import { collection, doc, getDocFromServer, getDocsFromServer, limit, orderBy, query, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { clientDb } from "@/lib/firebase/client";
import { emptyHomeContent, homeContentFields, parseHomeContent, validHomeContent, type HomeContent } from "@/lib/site/content";
import { ContentConflict, contentVersion, saveHomeContent, type ContentVersions } from "@/lib/site/editor";

export default function SiteWorkspace({ uid, hasClub, hasPlatform, onSignOut }: { uid: string; hasClub: boolean; hasPlatform: boolean; onSignOut: () => void }) {
  const [content, setContent] = useState<HomeContent>(emptyHomeContent);
  const [savedContent, setSavedContent] = useState<HomeContent>(emptyHomeContent);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [versions, setVersions] = useState<ContentVersions>({ draft: null, published: null });
  const [history, setHistory] = useState<Array<HomeContent & { id: string; date: Date | null }>>([]);
  const [historyError, setHistoryError] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const db = clientDb();
    Promise.all([getDocFromServer(doc(db, "site_content", "home_draft")), getDocFromServer(doc(db, "site_content", "home_published"))]).then(([draft, published]) => {
      if (!active) return;
      const data = draft.exists() ? draft.data() : published.data();
      const parsed = parseHomeContent(data);
      if (data && !parsed) throw new Error("Invalid site content");
      const loaded = parsed ?? emptyHomeContent;
      setContent(loaded);
      setSavedContent(loaded);
      setVersions({ draft: contentVersion(draft.data()), published: contentVersion(published.data()) });
      setMessage(""); setConflict(false); setFailed(false); setReady(true);
    }).catch(() => { if (active) { setFailed(true); setMessage("Impossible de charger le contenu. Vérifiez votre connexion et vos droits."); } });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    let active = true;
    getDocsFromServer(query(collection(clientDb(), "site_publication_history"), orderBy("updatedAt", "desc"), limit(10)))
      .then((snapshot) => {
        if (!active) return;
        setHistory(snapshot.docs.flatMap((item) => {
          const data = item.data();
          const updatedAt = data.updatedAt;
          const content = parseHomeContent(data);
          return content ? [{ id: item.id, ...content, date: updatedAt instanceof Timestamp ? updatedAt.toDate() : null }] : [];
        }));
        setHistoryError(false);
        setHistoryLoading(false);
      })
      .catch(() => { if (active) { setHistoryError(true); setHistoryLoading(false); } });
    return () => { active = false; };
  }, [historyRefresh]);
  async function save(publish: boolean) {
    if (!validHomeContent(content)) { setFailed(true); setMessage("Le titre et la description sont obligatoires."); return; }
    setBusy(true); setMessage("");
    try {
      const nextVersions = await saveHomeContent(clientDb(), uid, content, versions, publish);
      setVersions(nextVersions);
      const normalized = Object.fromEntries(homeContentFields.map(({ key }) => [key, content[key].trim()])) as HomeContent;
      setSavedContent(normalized);
      setContent(normalized);
      if (publish) { setHistoryLoading(true); setHistoryRefresh((value) => value + 1); }
      setFailed(false); setMessage(publish ? "Page d’accueil publiée." : "Brouillon enregistré.");
    } catch (error) {
      setFailed(true);
      if (error instanceof ContentConflict) {
        setConflict(true);
        setMessage("Le contenu a été modifié par une autre personne. Copiez vos modifications si nécessaire, puis rechargez la dernière version.");
      } else setMessage("Enregistrement impossible. Vérifiez votre connexion et vos droits.");
    }
    finally { setBusy(false); }
  }
  function restoreVersion(item: HomeContent) {
    const changed = homeContentFields.some(({ key }) => content[key] !== savedContent[key]);
    if (changed && !window.confirm("Vos modifications non enregistrées seront remplacées. Continuer ?")) return;
    setContent(Object.fromEntries(homeContentFields.map(({ key }) => [key, item[key]])) as HomeContent);
    setMessage("Version reprise dans l’éditeur. Elle n’est pas encore publiée.");
    setFailed(false);
  }
  return <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-surface"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8"><div><p className="text-sm font-bold">Assodarts</p><p className="mt-1 text-xs text-muted">Gestion du site</p></div><nav className="flex flex-wrap items-center gap-3 text-sm font-semibold" aria-label="Changer d’espace">{hasClub && <a className="focus-ring rounded p-2 text-navy" href="/">Espace club</a>}{hasPlatform && <a className="focus-ring rounded p-2 text-navy" href="/plateforme">Administration Assodarts</a>}<a className="focus-ring rounded p-2 text-navy" href="/retour-accueil">Voir le site ↗</a><button className="focus-ring rounded p-2 text-muted" onClick={onSignOut} type="button">Déconnexion</button></nav></div></header>
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><p className="text-xs font-bold uppercase tracking-wide text-green">Gestion du site</p><h1 className="mt-3 text-3xl font-bold">Page d’accueil</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Modifiez les contenus de la vitrine. Les champs facultatifs laissés vides ne sont pas affichés.</p>
      {message && <div role={failed ? "alert" : "status"} className={`mt-6 rounded-xl border p-4 text-sm ${failed ? "border-red-300 bg-red-50 text-red-800" : "border-green/20 bg-green-soft text-green"}`}>{message}{(!ready || conflict) && <button onClick={() => { setReady(false); setRetry((value) => value + 1); }} type="button" className="focus-ring ml-2 font-bold underline">{conflict ? "Recharger la dernière version" : "Réessayer"}</button>}</div>}
      {!ready && !failed && <p className="mt-6 text-sm text-muted">Chargement du contenu…</p>}
      {ready && <div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-border bg-surface p-6"><h2 className="text-lg font-bold">Contenu</h2>{homeContentFields.map(({ key, label, max, required }) => <label className="mt-5 block text-sm font-semibold" key={key}>{label}{required ? " *" : ""}{max > 160 ? <textarea className="focus-ring mt-2 min-h-28 w-full rounded-xl border border-border bg-background p-3 font-normal" disabled={busy} maxLength={max} onChange={(event) => setContent({ ...content, [key]: event.target.value })} value={content[key]} /> : <input className="focus-ring mt-2 w-full rounded-xl border border-border bg-background p-3 font-normal" disabled={busy} maxLength={max} onChange={(event) => setContent({ ...content, [key]: event.target.value })} value={content[key]} />}</label>)}<div className="mt-6 flex flex-wrap gap-3"><button className="focus-ring min-h-11 rounded-full border border-border px-5 text-sm font-bold disabled:opacity-50" disabled={busy || conflict} onClick={() => save(false)} type="button">Enregistrer le brouillon</button><button className="focus-ring min-h-11 rounded-full bg-navy px-5 text-sm font-bold text-white disabled:opacity-50" disabled={busy || conflict} onClick={() => save(true)} type="button">Publier</button></div></section><section className="rounded-2xl border border-border bg-surface p-6"><p className="text-xs font-bold uppercase tracking-wide text-green">Aperçu du contenu</p><h2 className="mt-8 text-4xl font-bold leading-tight">{content.headline}</h2><p className="mt-6 max-w-lg whitespace-pre-line text-lg leading-8 text-muted">{content.description}</p>{content.featuresTitle && <h3 className="mt-8 text-2xl font-bold">{content.featuresTitle}</h3>}{content.featuresDescription && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">{content.featuresDescription}</p>}<div className="mt-5 space-y-4">{([1, 2, 3] as const).map((index) => { const title = content[`feature${index}Title`]; const description = content[`feature${index}Description`]; return (title || description) && <div className="rounded-xl bg-background p-4" key={index}>{title && <p className="font-bold">{title}</p>}{description && <p className="mt-2 whitespace-pre-line text-sm text-muted">{description}</p>}</div>; })}</div>{content.mobileTitle && <h3 className="mt-8 text-2xl font-bold">{content.mobileTitle}</h3>}{content.mobileDescription && <p className="mt-3 whitespace-pre-line text-sm text-muted">{content.mobileDescription}</p>}</section></div>}
      {ready && <section className="mt-8 rounded-2xl border border-border bg-surface p-6"><h2 className="text-lg font-bold">Dernières publications</h2><p className="mt-2 text-sm text-muted">Les dix dernières versions publiées. Reprenez-en une dans l’éditeur avant de la publier à nouveau.</p>{historyLoading ? <p className="mt-4 text-sm text-muted">Chargement de l’historique…</p> : historyError ? <p role="alert" className="mt-4 text-sm text-red-800">Impossible de charger l’historique. <button className="focus-ring font-semibold underline" onClick={() => { setHistoryLoading(true); setHistoryRefresh((value) => value + 1); }} type="button">Réessayer</button></p> : history.length === 0 ? <p className="mt-4 text-sm text-muted">Aucune publication enregistrée.</p> : <ul className="mt-4 divide-y divide-border">{history.map((item) => <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={item.id}><div className="min-w-0"><p className="font-semibold">{item.headline}</p><p className="mt-1 text-xs text-muted">{item.date ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(item.date) : "Date indisponible"}</p></div><button className="focus-ring rounded-full border border-border px-4 py-2 text-sm font-semibold text-navy hover:bg-background disabled:opacity-50" disabled={busy || conflict} onClick={() => restoreVersion(item)} type="button">Reprendre dans l’éditeur</button></li>)}</ul>}</section>}
    </main></div>;
}
