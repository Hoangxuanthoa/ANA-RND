import { createClient } from "@supabase/supabase-js";

// Server-only client with the service role key — bypasses RLS and can
// manage auth users directly (admin.createUser, etc). Never import this
// from a Client Component or anything that ships to the browser.
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
