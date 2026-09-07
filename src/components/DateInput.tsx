"use client";

import { useEffect, useRef, useState } from "react";

// A self-built calendar dropdown instead of the browser's native
// <input type="date"> picker — the native one positions itself wherever
// the browser/OS decides (often not directly under the field), which we
// can't control. This renders as a plain absolutely-positioned panel
// right below the field every time, on every browser.
interface DateInputProps {
  value: string; // "dd/mm/yyyy" or ""
  onChange: (value: string) => void;
  className?: string;
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function parseDDMMYYYY(v: string): Date | null {
  const parts = v.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function DateInput({ value, onChange, className }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDDMMYYYY(value);
  const [viewDate, setViewDate] = useState(selected ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function openPicker() {
    setViewDate(selected ?? new Date());
    setOpen((v) => !v);
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`${className ?? "h-10 rounded-lg border border-line px-3 text-[13px]"} flex items-center gap-2 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/15`}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={openPicker}
          placeholder="dd/mm/yyyy"
          className="min-w-0 flex-1 bg-transparent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPicker())}
          className="flex-shrink-0 text-text-faint hover:text-text"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-1.5 w-64 rounded-lg border border-line bg-surface p-3 shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-bg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="text-[13px] font-bold">
              Tháng {month + 1}/{year}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-bg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-text-faint">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) =>
              d ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onChange(formatDDMMYYYY(d));
                    setOpen(false);
                  }}
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-[12px] ${
                    selected && isSameDay(d, selected) ? "bg-accent font-bold text-white" : "hover:bg-bg"
                  }`}
                >
                  {d.getDate()}
                </button>
              ) : (
                <div key={i} />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
