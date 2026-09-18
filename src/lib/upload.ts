import { RELAY_MAX_BYTES } from "@/lib/uploadTypes";

// Client-side counterpart to /api/upload(/presign) — replaces
// URL.createObjectURL() call sites that need a real, persisted file
// instead of a session-only blob: URL. `folder` namespaces the R2 key
// (e.g. "products"). Picks the upload path by size: small files go
// through our own server in one request; anything over RELAY_MAX_BYTES
// (Vercel's own request-size ceiling, not something we can raise) goes
// straight to R2 via a presigned URL instead, bypassing that ceiling
// entirely — see /api/upload/presign/route.ts.
export async function uploadFile(file: File, folder: string): Promise<string> {
  return file.size > RELAY_MAX_BYTES ? uploadViaPresignedUrl(file, folder) : uploadViaRelay(file, folder);
}

async function uploadViaRelay(file: File, folder: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(await errorMessageFrom(res));
  const body = await res.json();
  return body.url as string;
}

async function uploadViaPresignedUrl(file: File, folder: string): Promise<string> {
  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileType: file.type, folder, fileSize: file.size }),
  });
  if (!presignRes.ok) throw new Error(await errorMessageFrom(presignRes));
  const { uploadUrl, publicUrl } = await presignRes.json();

  const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!putRes.ok) throw new Error("Tải tệp lên thất bại — thử lại.");
  return publicUrl as string;
}

// A platform-level rejection (e.g. Vercel's own 413 for an oversized
// body, rejected before our route's own size check ever runs) comes
// back as plain text, not JSON — .json() would throw and mask the real
// reason with a generic "unexpected error".
async function errorMessageFrom(res: Response): Promise<string> {
  const message = await res
    .json()
    .then((body) => body.error as string | undefined)
    .catch(() => undefined);
  return message ?? (res.status === 413 ? "File quá lớn (tối đa 4MB)." : "Tải tệp lên thất bại — thử lại.");
}
