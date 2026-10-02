export function ViewPlaceholder({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#fafafa] text-center">
      <span className="text-[13px] font-semibold text-text-muted">{title}</span>
      <p className="max-w-[220px] text-[12px] text-text-faint">{message}</p>
    </div>
  );
}
