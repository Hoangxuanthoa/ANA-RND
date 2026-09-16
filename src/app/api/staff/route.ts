import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

// The company roster — replaces the old hardcoded STAFF mock array.
// Readable by anyone signed in (every role needs it for pickers:
// R&D owner, Sales rep, assignee, task requester, ...), not Admin-only.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staff = await prisma.user.findMany({
    where: { isActive: true, role: { not: "CUSTOMER" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, fullName: true, email: true, role: true },
  });
  return NextResponse.json(staff);
}

// Admin-only: creates a real Supabase Auth user (Admin sets the initial
// password directly, same as scripts/seed-users.mjs did for the first 9 —
// no email-confirmation round trip needed for an internal, admin-vetted
// roster) plus the matching User row.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: user.id } });
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = body.role;
  const password = typeof body.password === "string" ? body.password : "";
  if (!fullName || !email || !role || !password) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Không tạo được tài khoản." }, { status: 400 });
  }

  const created = await prisma.user.create({
    data: { id: data.user.id, fullName, email, role },
  });
  return NextResponse.json(created);
}
