// Client-side counterpart to /api/upload — replaces URL.createObjectURL()
// call sites that need a real, persisted image instead of a session-only
// blob: URL. `folder` namespaces the R2 key (e.g. "products").
export async function uploadFile(file: File, folder: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Tải ảnh lên thất bại — thử lại.");
  return body.url as string;
}
