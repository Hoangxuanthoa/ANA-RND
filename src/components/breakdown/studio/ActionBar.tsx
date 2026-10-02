"use client";

// Generate Solid / Generate Frame do not exist here — this is a live
// preview, not the SketchUp plugin's on-demand build step. Calculate and
// Export are still distinct actions (not just "build the shape"), so they
// stay as their own buttons once built.
export function ActionBar({
  onExportDrawing,
  exportEnabled,
  onCalculateBom,
  bomEnabled,
}: {
  onExportDrawing: () => void;
  exportEnabled: boolean;
  onCalculateBom: () => void;
  bomEnabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3.5">
      <button
        type="button"
        onClick={onCalculateBom}
        disabled={!bomEnabled}
        title={bomEnabled ? undefined : "Chưa dựng được khung sắt cho sản phẩm này"}
        className={
          bomEnabled
            ? "flex h-10 items-center justify-center rounded-lg border border-line bg-white text-[13px] font-bold text-text hover:bg-bg"
            : "flex h-10 cursor-not-allowed items-center justify-center rounded-lg border border-line bg-bg text-[13px] font-bold text-text-faint"
        }
      >
        Calculate (BOM)
      </button>
      <button
        type="button"
        onClick={onExportDrawing}
        disabled={!exportEnabled}
        title={exportEnabled ? undefined : "Sắp có"}
        className={
          exportEnabled
            ? "flex h-10 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-white hover:bg-accent-hover"
            : "flex h-10 cursor-not-allowed items-center justify-between rounded-lg border border-line bg-bg px-3.5 text-[13px] font-bold text-text-faint"
        }
      >
        {exportEnabled ? <span>Xuất bản vẽ</span> : (
          <>
            <span>Export bản vẽ</span>
            <span className="text-[11px] font-semibold">Sắp có</span>
          </>
        )}
      </button>
    </div>
  );
}
