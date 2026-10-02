"use client";

import type { ShapeKind } from "@/lib/breakdown/geometry/types";

const SHAPES: { key: ShapeKind; label: string; enabled: boolean }[] = [
  { key: "round", label: "Round", enabled: true },
  { key: "square", label: "Square", enabled: true },
  { key: "rectangle", label: "Rectangle", enabled: true },
  { key: "oval", label: "Oval", enabled: true },
  { key: "ellipse", label: "Ellipse", enabled: true },
];

export function ShapeTabs({ value, onChange }: { value: ShapeKind; onChange: (shape: ShapeKind) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SHAPES.map((shape) => {
        const active = shape.key === value;
        return (
          <button
            key={shape.key}
            type="button"
            disabled={!shape.enabled}
            onClick={() => onChange(shape.key)}
            title={shape.enabled ? undefined : "Sắp có"}
            className={`h-9 rounded-lg px-3.5 text-[13px] font-bold transition-colors ${
              active
                ? "bg-accent-soft text-accent-soft-text"
                : shape.enabled
                  ? "border border-line bg-surface text-text hover:bg-bg"
                  : "cursor-not-allowed border border-line bg-bg text-text-faint"
            }`}
          >
            {shape.label}
            {!shape.enabled && <span className="ml-1.5 text-[10px] font-semibold">(sắp có)</span>}
          </button>
        );
      })}
    </div>
  );
}
