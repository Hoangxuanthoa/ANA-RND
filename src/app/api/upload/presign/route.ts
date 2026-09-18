import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPresignedUploadUrl } from "@/lib/storage/r2";
import { EXT_BY_MIME, PRESIGNED_MAX_BYTES } from "@/lib/uploadTypes";

// aws-sdk needs the Node runtime, not Edge.
export const runtime = "nodejs";

// Counterpart to /api/upload for anything too big for that route's
// single-request relay (see RELAY_MAX_BYTES) — hands back a short-lived
// URL the browser then PUTs the file straight to, so the bytes never
// pass through our own serverless function at all. `fileSize` is
// trusted only as a client-side courtesy check here (the actual upload
// happens outside this request), same trust model as the relay route's
// other validations for this internal, small-user-base tool.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const fileType = typeof body.fileType === "string" ? body.fileType : "";
  const folder = typeof body.folder === "string" ? body.folder : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
  if (!fileType || !folder) {
    return NextResponse.json({ error: "Thiếu fileType hoặc folder." }, { status: 400 });
  }
  if (!(fileType in EXT_BY_MIME)) {
    return NextResponse.json({ error: "Định dạng file không được hỗ trợ." }, { status: 400 });
  }
  if (fileSize > PRESIGNED_MAX_BYTES) {
    return NextResponse.json({ error: `File quá lớn (tối đa ${PRESIGNED_MAX_BYTES / 1024 / 1024}MB).` }, { status: 400 });
  }

  const ext = EXT_BY_MIME[fileType];
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  try {
    const uploadUrl = await getPresignedUploadUrl({ key, contentType: fileType });
    const publicUrl = `${process.env.R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch {
    return NextResponse.json({ error: "Không tạo được link tải lên — thử lại." }, { status: 500 });
  }
}
