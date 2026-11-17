export function ownerLabel(owner: string | null | undefined): string {
  const name = owner?.trim();
  return name ? name : "Unassigned";
}
