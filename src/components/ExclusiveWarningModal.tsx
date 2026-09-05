"use client";

interface ExclusiveWarningModalProps {
  open: boolean;
  productName: string;
  exclusiveBy: string;
  onCancel: () => void;
  onConfirm: () => void;
}

// Soft warning, not a hard block: the app has no real request/approval
// system yet, so this just surfaces who to ask before using an Exclusive
// design elsewhere — the person can still proceed if they've already
// cleared it in person.
export function ExclusiveWarningModal({ open, productName, exclusiveBy, onCancel, onConfirm }: ExclusiveWarningModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-[420px] rounded-xl border border-line bg-surface p-5 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold">Sản phẩm Exclusive</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
          &quot;{productName}&quot; đang gắn Exclusive bởi <strong className="text-text">{exclusiveBy}</strong> — cần
          xin phép {exclusiveBy} trước khi dùng cho khách khác.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-bg"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover"
          >
            Vẫn tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}
