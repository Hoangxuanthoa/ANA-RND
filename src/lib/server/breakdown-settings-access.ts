import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/mock-data";

// Who may open and edit "Cài đặt Bóc tách" (Quy cách hàng đan, later the Tre ép
// settings…). Admin always can. Other roles only if Admin switched them on in
// that page's "Phân quyền" tab — stored as a JSON array of roles on AppSettings.
// Only roles that can use Bóc tách at all are grantable.
export const GRANTABLE_ROLES = ["RND", "PURCHASING"] as const satisfies readonly Role[];
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

export async function allowedBreakdownSettingsRoles(): Promise<GrantableRole[]> {
  const row = await prisma.appSettings.findFirst({ select: { breakdownSettingsRoles: true } });
  const raw = row?.breakdownSettingsRoles;
  if (!Array.isArray(raw)) return [];
  return GRANTABLE_ROLES.filter((r) => raw.includes(r));
}

export async function canOpenBreakdownSettings(me: { role: Role }): Promise<boolean> {
  if (me.role === "ADMIN") return true;
  return (await allowedBreakdownSettingsRoles()).includes(me.role as GrantableRole);
}
