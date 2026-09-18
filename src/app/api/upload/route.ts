import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadFile } from "@/lib/storage/r2";

// aws-sdk needs the Node runtime, not Edge.
export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  // Project attachments (brief, moodboard, spec sheet) aren't always
  // images — everything else here is deliberately still an allowlist,
  // not "anything goes", to keep R2 from becoming an arbitrary file host.
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/zip": "zip",
};

// Generic file upload, reused by every module that needs a real file
// behind an object-URL-style picker (Products, Projects, Collections) —
// the caller picks a `folder` to namespace R2 keys, nothing here is
// product-specific. Any signed-in user can upload; role restrictions
// belong on whatever mutation later attaches the returned URL to a record.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const folder = form.get("folder");
  if (!(file instanceof File) || typeof folder !== "string" || !folder) {
    return NextResponse.json({ error: "Thiếu file hoặc folder." }, { status: 400 });
  }
  if (!(file.type in EXT_BY_MIME)) {
    return NextResponse.json({ error: "Định dạng file không được hỗ trợ." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File quá lớn (tối đa 15MB)." }, { status: 400 });
  }
  const ext = EXT_BY_MIME[file.type];
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadFile({ buffer, key, contentType: file.type });
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Tải ảnh lên thất bại — thử lại." }, { status: 500 });
  }
}
