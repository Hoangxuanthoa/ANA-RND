import { prisma } from "@/lib/prisma";
import { canViewBreakdown } from "@/lib/permissions";
import type { Role } from "@/lib/mock-data";

// Who can do what with ONE breakdown (a "Bóc tách kỹ thuật" project):
//  - owner  : the creator — full control (edit, delete, share)
//  - admin  : Admin sees and controls every breakdown, shared or not
//  - shared : someone the owner shared it with — read-only (open it, view
//             products/drawings/BOM, export), cannot edit/delete/re-share
// Anyone else — including a staff member with Bóc tách access who simply
// isn't the owner or a share recipient — gets null and must see a 404, not
// the data. Every /api/breakdowns/[id]/... route goes through this; the
// client-side read-only UI is only a convenience on top of it.
export type BreakdownAccess = "owner" | "admin" | "shared";

export async function getBreakdownAccess(me: { id: string; role: Role }, breakdownId: string): Promise<BreakdownAccess | null> {
  if (!canViewBreakdown(me.role)) return null;
  if (me.role === "ADMIN") {
    const exists = await prisma.breakdown.findUnique({ where: { id: breakdownId }, select: { id: true } });
    return exists ? "admin" : null;
  }
  const row = await prisma.breakdown.findUnique({
    where: { id: breakdownId },
    select: { createdById: true, shares: { where: { userId: me.id }, select: { id: true } } },
  });
  if (!row) return null;
  if (row.createdById === me.id) return "owner";
  return row.shares.length > 0 ? "shared" : null;
}

export const canEditBreakdown = (access: BreakdownAccess | null) => access === "owner" || access === "admin";
