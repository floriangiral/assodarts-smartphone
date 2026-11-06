/* eslint-disable @next/next/no-html-link-for-pages -- /admin redirects to another host and needs a document navigation. */
import { Shell } from "@/components/shell";
import { publishedHomeContent } from "@/lib/site/public";
import { defaultHomeContent } from "@/lib/site/content";
import { connection } from "next/server";
import { ArrowDown, ArrowRight, CalendarDays, CircleUserRound, UsersRound } from "lucide-react";

export async function generateMetadata() {
  await connection();
  const content = await publishedHomeContent() ?? defaultHomeContent;
  return { description: content.description };
}

export default async function Home() {
  await connection();
  const content = await publishedHomeContent() ?? defaultHomeContent;
  const cards = [
    { title: content.feature1Title, description: content.feature1Description, icon: UsersRound },
    { title: content.feature2Title, description: content.feature2Description, icon: CalendarDays },
    { title: content.feature3Title, description: content.feature3Description, icon: CircleUserRound },
  ].filter((card) => card.title || card.description);
  const hasFeatures = Boolean(content.featuresTitle || content.featuresDescription || cards.length);
  return (
    <Shell featuresAvailable={hasFeatures}>
      <section className="relative isolate overflow-hidden border-b border-border bg-background">
        <div aria-hidden="true" className="pointer-events-none absolute -right-36 -top-32 -z-10 size-[34rem] rounded-full border border-green/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-4 -z-10 size-[25rem] rounded-full border border-orange/20" />
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:py-36">
          {content.eyebrow && <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs font-bold uppercase text-muted"><span className="size-2 rounded-full bg-green" />{content.eyebrow}</p>}
          <h1 className="font-display max-w-4xl whitespace-pre-line text-5xl leading-[1.04] text-ink sm:text-6xl xl:text-7xl">{content.headline}</h1>
          <p className="mt-7 max-w-2xl whitespace-pre-line text-lg leading-8 text-muted">{content.description}</p>
          <div className="mt-9 flex flex-wrap gap-3"><a className="focus-ring inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-navy px-6 text-sm font-bold text-white transition hover:bg-navy-deep" href="/admin">Espace club <ArrowRight aria-hidden="true" size={17} /></a>{hasFeatures && <a className="focus-ring inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-border bg-surface px-6 text-sm font-bold text-ink transition hover:bg-soft" href="#fonctionnalites">Voir les fonctionnalités <ArrowDown aria-hidden="true" size={16} /></a>}</div>
        </div>
      </section>
      {hasFeatures && <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28" id="fonctionnalites">
        {(content.featuresTitle || content.featuresDescription) && <div className="border-b border-border pb-12">{content.featuresTitle && <h2 className="font-display max-w-3xl whitespace-pre-line text-4xl leading-tight sm:text-5xl">{content.featuresTitle}</h2>}{content.featuresDescription && <p className="mt-5 max-w-2xl whitespace-pre-line leading-7 text-muted">{content.featuresDescription}</p>}</div>}
        {cards.length > 0 && <div className="grid gap-px bg-border md:grid-cols-3">{cards.map(({ title, description, icon: Icon }, index) => <article className="bg-background p-6 sm:p-8" key={index}><span className="grid size-11 place-items-center rounded-xl bg-green-soft text-green"><Icon aria-hidden="true" size={21} /></span>{title && <h3 className="mt-8 text-lg font-bold">{title}</h3>}{description && <p className="mt-3 max-w-xs whitespace-pre-line text-sm leading-6 text-muted">{description}</p>}</article>)}</div>}
      </section>}
      {(content.mobileTitle || content.mobileDescription) && <section className="border-y border-border bg-green-soft/50" id="clubs"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">{content.mobileTitle && <h2 className="font-display max-w-2xl whitespace-pre-line text-3xl leading-tight sm:text-4xl">{content.mobileTitle}</h2>}{content.mobileDescription && <p className="mt-4 max-w-xl whitespace-pre-line leading-7 text-muted">{content.mobileDescription}</p>}</div></section>}
    </Shell>
  );
}
