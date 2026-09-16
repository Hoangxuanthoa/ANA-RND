import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client — for Server Components, Route Handlers,
// and Server Actions. Reads/writes the session via Next.js's cookie
// store, so `supabase.auth.getUser()` here reflects the real signed-in
// session (verified against Supabase's servers, unlike getSession()).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component that can't set cookies —
            // fine as long as middleware.ts is also refreshing sessions.
          }
        },
      },
    },
  );
}
