export type WorkspaceTabId = "home" | "news" | "events" | "members" | "tournaments";

const paths: Record<WorkspaceTabId, string> = {
  home: "/",
  news: "/actualites",
  events: "/evenements",
  members: "/membres",
  tournaments: "/tournois",
};

export function workspacePath(tab: WorkspaceTabId, eventId?: string | null): string {
  return tab === "events" && eventId
    ? `${paths.events}/${encodeURIComponent(eventId)}`
    : paths[tab];
}

export function parseWorkspacePath(pathname: string): { tab: WorkspaceTabId; eventId: string | null } | null {
  const path = pathname.replace(/^\/admin(?=\/|$)/, "") || "/";
  for (const [tab, value] of Object.entries(paths)) {
    if (path === value || (value !== "/" && path === `${value}/`)) {
      return { tab: tab as WorkspaceTabId, eventId: null };
    }
  }
  const match = /^\/evenements\/([^/]+)\/?$/.exec(path);
  if (!match) return null;
  try {
    return { tab: "events", eventId: decodeURIComponent(match[1]) };
  } catch {
    return null;
  }
}
