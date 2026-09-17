import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Called from src/middleware.ts on every request — refreshes the auth
// cookie (Supabase sessions expire and need silent renewal) and gates
// every route except /login behind having a real signed-in user.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() (not getSession()) actually revalidates the token against
  // Supabase's servers — required for a real gate, not just reading a
  // cookie that could be stale/forged.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname.startsWith("/login");
  // The one deliberately public surface in the app — a Collection's
  // "Lấy link online" share page, meant for a customer with no account
  // at all (see NotificationType's Collections schema comment). Its data
  // route (keyed by an unguessable publicSlug, never the internal id)
  // skips the session check the same way.
  const isPublicShare = pathname.startsWith("/share/") || pathname.startsWith("/api/collections/public/");

  if (isPublicShare) return supabaseResponse;

  if (!user && !isLoginPage) {
    // An API route should fail with a JSON 401 a fetch() caller can
    // handle, not a redirect a JSON parser then chokes on.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/library";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
