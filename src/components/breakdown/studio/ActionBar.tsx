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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onCalculateBom}
        disabled={!bomEnabled}
        title={bomEnabled ? undefined : "Chưa dựng được khung sắt cho sản phẩm này"}
        className={
          bomEnabled
            ? "flex h-8 items-center justify-center rounded-md border border-line bg-white px-3 text-[12.5px] font-bold text-text hover:bg-bg"
            : "flex h-8 cursor-not-allowed items-center justify-center rounded-md border border-line bg-bg px-3 text-[12.5px] font-bold text-text-faint"
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
            ? "flex h-8 items-center justify-center rounded-md bg-accent px-3 text-[12.5px] font-bold text-white hover:bg-accent-hover"
            : "flex h-8 cursor-not-allowed items-center gap-1.5 rounded-md border border-line bg-bg px-3 text-[12.5px] font-bold text-text-faint"
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
