import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// One round trip for the two checks almost every new API route needs:
// is there a real signed-in session, and what's this person's role in
// our own User table (never trust a client-sent role). Returns the full
// Prisma User row, or null if there's no session or no matching row.
//
// Mua hàng (PURCHASING) may only use "Bóc tách kỹ thuật": for them this returns
// null — a plain 401 from the route — unless the caller passes
// { allowBreakdownOnly: true }, which only the breakdown + drawing-template
// routes do. So a new route is closed to Mua hàng by default.
export async function getSessionUser(options?: { allowBreakdownOnly?: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (dbUser?.role === "PURCHASING" && !options?.allowBreakdownOnly) return null;
  return dbUser;
}
