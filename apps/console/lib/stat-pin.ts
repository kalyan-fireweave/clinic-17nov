export function pinStatFirst<T extends { triage: string | null; status: string }>(rows: readonly T[]): T[] {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const row of rows) {
    if (row.triage === "STAT" && row.status === "awaiting_review") pinned.push(row);
    else rest.push(row);
  }
  return [...pinned, ...rest];
}
