import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadFile } from "@/lib/storage/r2";
import { EXT_BY_MIME, RELAY_MAX_BYTES } from "@/lib/uploadTypes";

// aws-sdk needs the Node runtime, not Edge.
export const runtime = "nodejs";

// Generic file upload, reused by every module that needs a real file
// behind an object-URL-style picker (Products, Projects, Collections) —
// the caller picks a `folder` to namespace R2 keys, nothing here is
// product-specific. Any signed-in user can upload; role restrictions
// belong on whatever mutation later attaches the returned URL to a record.
// Anything over RELAY_MAX_BYTES needs /api/upload/presign instead — see
// that file for why (Vercel's own request-size ceiling).
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
  if (file.size > RELAY_MAX_BYTES) {
    return NextResponse.json({ error: "File quá lớn (tối đa 4MB)." }, { status: 400 });
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
