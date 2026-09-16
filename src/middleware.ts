import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Every route except Next.js internals and static assets — those
    // never need a session check.
    "/((?!_next/static|_next/image|favicon.ico|logo.png|icon.png|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
