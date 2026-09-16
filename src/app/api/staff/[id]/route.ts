import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const me = await prisma.user.findUnique({ where: { id: user.id } });
  return me?.role === "ADMIN" ? user : null;
}

// Role change and/or deactivate ("Xóa" in the UI — a real account can't
// be hard-deleted without breaking every Product/Project/etc. it's
// referenced from, so this sets isActive: false instead, same spirit as
// canHardDeleteProduct/Project elsewhere in this app). Deactivating also
// bans the real Supabase Auth login, not just hides them from pickers —
// otherwise a "removed" staff member could still sign in.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const data: { role?: "ADMIN" | "RND" | "SALES" | "MARKETING"; isActive?: boolean } = {};
  if (typeof body.role === "string") data.role = body.role;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id }, data });

  if (body.isActive === false) {
    await getSupabaseAdmin().auth.admin.updateUserById(id, { ban_duration: "876000h" });
  } else if (body.isActive === true) {
    await getSupabaseAdmin().auth.admin.updateUserById(id, { ban_duration: "none" });
  }

  return NextResponse.json(updated);
}
