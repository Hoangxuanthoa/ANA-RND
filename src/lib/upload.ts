// Client-side counterpart to /api/upload — replaces URL.createObjectURL()
// call sites that need a real, persisted image instead of a session-only
// blob: URL. `folder` namespaces the R2 key (e.g. "products").
export async function uploadFile(file: File, folder: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    // A platform-level rejection (e.g. Vercel's own 413 for an
    // oversized body, rejected before this route's own size check ever
    // runs) comes back as plain text, not JSON — .json() would throw
    // and mask the real reason with a generic "unexpected error".
    const message = await res
      .json()
      .then((body) => body.error as string | undefined)
      .catch(() => undefined);
    throw new Error(message ?? (res.status === 413 ? "File quá lớn (tối đa 4MB)." : "Tải tệp lên thất bại — thử lại."));
  }
  const body = await res.json();
  return body.url as string;
}
