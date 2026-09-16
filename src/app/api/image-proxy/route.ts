import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

// Cloudflare R2's free "Public Development URL" (r2.dev) doesn't send
// Access-Control-Allow-Origin — even with a CORS policy configured on
// the bucket, r2.dev specifically doesn't honor it (only a custom
// domain would). That means the browser can't read pixels back from a
// canvas after drawing one of our own uploaded images (a "tainted
// canvas" SecurityError) — needed for square-cropping an
// already-uploaded photo (see ProjectPhotosTab's release flow). This
// route re-serves the image from our own origin instead, so the
// browser treats it as same-origin and canvas reads work normally.
export async function GET(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url).searchParams.get("url");
  const publicBase = process.env.R2_PUBLIC_URL;
  if (!url || !publicBase || !url.startsWith(publicBase)) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const res = await fetch(url);
  if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/octet-stream" },
  });
}
