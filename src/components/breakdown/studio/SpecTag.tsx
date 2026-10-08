"use client";

import type { SpecField } from "@/lib/breakdown/weaveSpec";

// What the forms need to show "Quy cách hàng đan" state on a product: whether
// it follows the rules, which fields the person took over by hand, and how to
// hand a field (or everything) back to the rules.
export interface SpecUi {
  auto: boolean;
  manual: string[];
  hasRule: (field: SpecField) => boolean;
  onReapply: (field?: SpecField) => void;
}

// Small note under a field the rules can fill: "theo quy cách" while it follows
// them, "thủ công · ⟲ theo quy cách" once edited by hand.
export function SpecTag({ spec, field }: { spec?: SpecUi; field: SpecField }) {
  if (!spec || !spec.auto || !spec.hasRule(field)) return null;
  if (spec.manual.includes(field)) {
    return (
      <button type="button" onClick={() => spec.onReapply(field)} className="self-start text-[10.5px] font-semibold text-amber-700 hover:underline">
        thủ công · ⟲ theo quy cách
      </button>
    );
  }
  return <span className="self-start text-[10.5px] font-semibold text-accent">theo quy cách</span>;
}

// Header strip of the frame panel: turn the rules on for an older product, or
// hand everything back to them.
export function SpecHeader({ spec }: { spec?: SpecUi }) {
  if (!spec) return null;
  return spec.auto ? (
    <span className="flex items-center gap-2 text-[11px] text-text-faint">
      Đang theo quy cách
      <button type="button" onClick={() => spec.onReapply()} className="font-semibold text-accent hover:underline">
        ⟲ Áp dụng lại tất cả
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => spec.onReapply()}
      title="Điền số nan, số vòng ngang, FI… theo bảng Quy cách hàng đan (ghi đè các ô đó)"
      className="rounded-md border border-line bg-white px-2.5 py-1 text-[11.5px] font-bold text-text hover:bg-bg"
    >
      Áp dụng quy cách
    </button>
  );
}
