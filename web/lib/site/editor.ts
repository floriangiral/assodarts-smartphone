import { doc, runTransaction, serverTimestamp, type DocumentData, type Firestore } from "firebase/firestore";
import { homeContentFields, type HomeContent } from "./content";

export type ContentVersions = { draft: string | null; published: string | null };

// Older documents have no revision; include their full content and timestamp so
// they still participate in conflict detection until they are saved again.
export function contentVersion(data: DocumentData | undefined): string | null {
  if (!data) return null;
  return typeof data.revision === "string" ? `revision:${data.revision}` : `legacy:${JSON.stringify(data)}`;
}

export class ContentConflict extends Error {
  constructor() { super("Site content changed since it was loaded"); }
}

export async function saveHomeContent(db: Firestore, uid: string, content: HomeContent, versions: ContentVersions, publish: boolean): Promise<ContentVersions> {
  const draftRef = doc(db, "site_content", "home_draft");
  const publishedRef = doc(db, "site_content", "home_published");
  const revision = crypto.randomUUID();
  const historyRef = doc(db, "site_publication_history", revision);
  return runTransaction(db, async (transaction) => {
    const [draft, published] = await Promise.all([transaction.get(draftRef), transaction.get(publishedRef)]);
    if (contentVersion(draft.data()) !== versions.draft || contentVersion(published.data()) !== versions.published) throw new ContentConflict();
    const fields = Object.fromEntries(homeContentFields.map(({ key }) => [key, content[key].trim()]));
    const value = { ...fields, updatedBy: uid, updatedAt: serverTimestamp(), revision };
    transaction.set(draftRef, value);
    if (publish) {
      transaction.set(publishedRef, value);
      transaction.set(historyRef, value);
    }
    return { draft: `revision:${revision}`, published: publish ? `revision:${revision}` : versions.published };
  });
}
