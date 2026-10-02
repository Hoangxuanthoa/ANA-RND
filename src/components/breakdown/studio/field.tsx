// Shared form-field wrapper matching ANA-RND's input conventions
// (see ANA-RND/src/components/NewProductModal.tsx) so this module drops
// into the Design Library without a visual seam later.
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-text">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15";

export const selectClass = "h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none";
