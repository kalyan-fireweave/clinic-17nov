export const AGE_TINT_AFTER_MS = 2 * 60 * 60 * 1000;

export function waitingAgeMs(createdAt: string | undefined, now: number): number | null {
  if (!createdAt) return null;
  const at = new Date(createdAt).getTime();
  if (Number.isNaN(at)) return null;
  return Math.max(0, now - at);
}

export function ageTintBackground(ageMs: number | null, status: string): string | null {
  if (status !== "awaiting_review" || ageMs === null || ageMs < AGE_TINT_AFTER_MS) return null;
  return "#fff3d6";
}
