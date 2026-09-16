// Deadlines/dates arrive from the client as dd/mm/yyyy strings
// (DateInput's own format, or "—" for empty) — shared parser for every
// route that accepts one.
export function parseDeadline(value: string): Date | null {
  const [dd, mm, yyyy] = value.split("/").map(Number);
  if (!dd || !mm || !yyyy) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}
