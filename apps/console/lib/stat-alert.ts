const WAITING = new Set(["awaiting_review", "ready", "needs_human", "flagged"]);

export type StatRow = {
  id: string;
  status: string;
  triage: string | null;
};

export function isWaitingStat(row: StatRow) {
  return row.triage === "STAT" && WAITING.has(row.status);
}

export function statArrivals<T extends StatRow>(seen: ReadonlySet<string>, rows: T[]) {
  return rows.filter((row) => isWaitingStat(row) && !seen.has(row.id));
}
