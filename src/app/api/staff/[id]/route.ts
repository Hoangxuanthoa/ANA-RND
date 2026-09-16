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

// Role change, deactivate, and/or reset password. Deactivate ("Xóa" in
// the UI) sets isActive: false rather than hard-deleting — a real
// account can't be removed without breaking every Product/Project/etc.
// it's referenced from, same spirit as canHardDeleteProduct/Project
// elsewhere in this app — and also bans the real Supabase Auth login via
// ban_duration, not just hides them from pickers. Password reset goes
// straight through the Admin API (no "current password" check — Admin
// is resetting someone ELSE's forgotten/temp password, not changing
// their own), unlike the self-service change in /api/me which is the
// signed-in user changing their own via a real Supabase client call.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const data: { role?: "ADMIN" | "RND" | "SALES" | "MARKETING"; isActive?: boolean } = {};
  if (typeof body.role === "string") data.role = body.role;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  const password = typeof body.password === "string" ? body.password : undefined;

  if (Object.keys(data).length === 0 && password === undefined) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (password !== undefined) {
    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (body.isActive === false) {
    await getSupabaseAdmin().auth.admin.updateUserById(id, { ban_duration: "876000h" });
  } else if (body.isActive === true) {
    await getSupabaseAdmin().auth.admin.updateUserById(id, { ban_duration: "none" });
  }

  const updated = Object.keys(data).length > 0 ? await prisma.user.update({ where: { id }, data }) : await prisma.user.findUnique({ where: { id } });

  return NextResponse.json(updated);
}
