"use client";

// Wraps the browser's native date picker while keeping the app's
// "dd/mm/yyyy" string format everywhere else — the input itself only
// speaks ISO (yyyy-mm-dd), so this just converts at the boundary.
interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function toIso(ddmmyyyy: string): string {
  const parts = ddmmyyyy.split("/");
  if (parts.length !== 3) return "";
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy.padStart(4, "0")}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function toDDMMYYYY(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const [yyyy, mm, dd] = parts;
  if (!dd || !mm || !yyyy) return "";
  return `${dd}/${mm}/${yyyy}`;
}

export function DateInput({ value, onChange, className }: DateInputProps) {
  return (
    <input
      type="date"
      value={toIso(value)}
      onChange={(e) => onChange(toDDMMYYYY(e.target.value))}
      className={className}
    />
  );
}
