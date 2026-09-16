import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// The real, authenticated identity behind the current session — role,
// name, email, phone — used by RoleProvider to seed who's actually
// logged in (as opposed to which role Admin is currently previewing).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "No matching user record" }, { status: 404 });

  return NextResponse.json({
    id: dbUser.id,
    fullName: dbUser.fullName,
    email: dbUser.email,
    phone: dbUser.phone,
    role: dbUser.role,
  });
}

// Only `phone` is editable here for now — email is the login credential
// (changing it means a real Supabase confirmation-email round trip, not
// meaningful yet while every account uses a placeholder @rattanco.vn
// address) and password changes go through Supabase Auth directly on
// the client, not this route.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  if (phone === undefined) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const dbUser = await prisma.user.update({ where: { id: user.id }, data: { phone } });
  return NextResponse.json({ phone: dbUser.phone });
}
