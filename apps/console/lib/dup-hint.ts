export function duplicatePatients(
  rows: readonly { patientName: string | null; status: string }[],
): string[] {
  const counts = new Map<string, { name: string; n: number }>();
  for (const row of rows) {
    if (row.status !== "awaiting_review") continue;
    const name = row.patientName?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const current = counts.get(key);
    if (current) current.n += 1;
    else counts.set(key, { name, n: 1 });
  }
  return [...counts.values()]
    .filter((entry) => entry.n > 1)
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}
