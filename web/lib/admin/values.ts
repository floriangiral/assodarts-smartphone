/** Preserve absent or invalid persisted values instead of inventing results. */
export function persistedScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function persistedAttendance(value: unknown): "going" | "declined" | null {
  return value === "going" || value === "declined" ? value : null;
}
