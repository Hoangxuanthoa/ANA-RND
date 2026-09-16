import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// One round trip for the two checks almost every new API route needs:
// is there a real signed-in session, and what's this person's role in
// our own User table (never trust a client-sent role). Returns the full
// Prisma User row, or null if there's no session or no matching row.
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findUnique({ where: { id: user.id } });
}
