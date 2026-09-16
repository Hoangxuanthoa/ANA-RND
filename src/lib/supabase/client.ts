"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client — safe to use in Client Components (uses
// the public anon/publishable key, RLS-scoped). Session/cookies are
// handled automatically by @supabase/ssr, kept in sync with the server
// client below via the middleware.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
