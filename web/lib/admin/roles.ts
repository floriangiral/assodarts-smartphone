export type ClubRole = "membre" | "bureau" | "admin";

export function roleFromMembership(value: unknown): ClubRole {
  if (value === "admin") return "admin";
  if (value === "board" || value === "bureau" || value === "treasurer") {
    return "bureau";
  }
  return "membre";
}

export function canManageClub(role: ClubRole): boolean {
  return role === "bureau" || role === "admin";
}

export function canManageRoles(role: ClubRole): boolean {
  return role === "admin";
}

export function roleRank(role: ClubRole): number {
  if (role === "admin") return 2;
  if (role === "bureau") return 1;
  return 0;
}

export function chooseInitialClub(
  clubs: Array<{ id: string; role: ClubRole }>,
  localClubId: string | null,
  defaultClubId: string | null,
): string | null {
  if (localClubId && clubs.some((club) => club.id === localClubId)) {
    return localClubId;
  }
  if (defaultClubId && clubs.some((club) => club.id === defaultClubId)) {
    return defaultClubId;
  }
  return [...clubs].sort((a, b) => roleRank(b.role) - roleRank(a.role))[0]?.id ?? null;
}