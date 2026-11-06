import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Firestore } from "firebase/firestore";

const state = vi.hoisted(() => ({ docs: {} as Record<string, Record<string, unknown>>, writes: [] as string[] }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, _collection: string, id: string) => id,
  serverTimestamp: () => "server timestamp",
  runTransaction: async (_db: unknown, callback: (tx: unknown) => Promise<unknown>) => {
    const pending: Array<[string, Record<string, unknown>]> = [];
    const result = await callback({
      get: async (id: string) => ({ data: () => state.docs[id] }),
      set: (id: string, data: Record<string, unknown>) => pending.push([id, data]),
    });
    for (const [id, data] of pending) { state.docs[id] = data; state.writes.push(id); }
    return result;
  },
}));
import { ContentConflict, contentVersion, saveHomeContent } from "./editor";
import { emptyHomeContent } from "./content";

const db = {} as Firestore;
const first = { ...emptyHomeContent, headline: "Titre A", description: "Description A" };
const second = { ...emptyHomeContent, headline: "Titre B", description: "Description B" };
beforeEach(() => { state.docs = {}; state.writes = []; });

describe("site editing", () => {
  it("publishes draft and public content together", async () => {
    const versions = await saveHomeContent(db, "editor", first, { draft: null, published: null }, true);
    expect(state.writes.slice(0, 2)).toEqual(["home_draft", "home_published"]);
    expect(state.writes).toHaveLength(3);
    expect(state.docs.home_published.headline).toBe("Titre A");
    expect(versions.draft).toBe(versions.published);
  });
  it("rejects stale drafts and never overwrites a concurrent edit", async () => {
    const old = { draft: null, published: null };
    await saveHomeContent(db, "first", first, old, false);
    state.writes = [];
    await expect(saveHomeContent(db, "second", second, old, true)).rejects.toBeInstanceOf(ContentConflict);
    expect(state.docs.home_draft.headline).toBe("Titre A");
    expect(state.docs.home_published).toBeUndefined();
    expect(state.writes).toEqual([]);
  });
  it("allows a new save after refreshing revisions", async () => {
    const versions = await saveHomeContent(db, "editor", first, { draft: null, published: null }, false);
    await saveHomeContent(db, "editor", second, versions, true);
    expect(state.docs.home_published.headline).toBe("Titre B");
  });
  it("detects changes in older documents without revisions", () => {
    expect(contentVersion({ headline: "A", updatedAt: { seconds: 1 } })).not.toBe(contentVersion({ headline: "A", updatedAt: { seconds: 2 } }));
  });
});
