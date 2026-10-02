"use client";

export type InputMode = "params" | "photo" | "draw";

export function InputModeToggle({ value, onChange }: { value: InputMode; onChange: (mode: InputMode) => void }) {
  return (
    <div className="flex rounded-lg border border-line bg-bg p-1">
      {(
        [
          { key: "params", label: "Nhập thông số" },
          { key: "photo", label: "Đính kèm ảnh" },
          { key: "draw", label: "Vẽ tay" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`h-8 flex-1 rounded-md text-[13px] font-bold transition-colors ${
            value === opt.key ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
