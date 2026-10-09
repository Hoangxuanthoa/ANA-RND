import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canViewBreakdown } from "@/lib/permissions";
import { parseJsonBody } from "@/lib/server/parse-json";
import { allowedBreakdownSettingsRoles, canOpenBreakdownSettings, GRANTABLE_ROLES } from "@/lib/server/breakdown-settings-access";

// Access to "Cài đặt Bóc tách": which roles Admin has switched on (besides
// Admin) and whether the caller may open it. Any Bóc tách user can read it (the
// list page needs it to show the ⚙ button); only Admin can change it.
export async function GET() {
  const me = await getSessionUser({ allowBreakdownOnly: true });
  if (!me || !canViewBreakdown(me.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ allowedRoles: await allowedBreakdownSettingsRoles(), canOpen: await canOpenBreakdownSettings(me) });
}

export async function PUT(request: Request) {
  const me = await getSessionUser({ allowBreakdownOnly: true });
  if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody(request);
  if (!body || !Array.isArray(body.allowedRoles)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const roles = GRANTABLE_ROLES.filter((r) => (body.allowedRoles as unknown[]).includes(r));

  const existing = await prisma.appSettings.findFirst();
  if (existing) await prisma.appSettings.update({ where: { id: existing.id }, data: { breakdownSettingsRoles: roles } });
  else await prisma.appSettings.create({ data: { breakdownSettingsRoles: roles } });
  return NextResponse.json({ allowedRoles: roles, canOpen: true });
}
