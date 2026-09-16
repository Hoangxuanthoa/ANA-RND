import { prisma } from "@/lib/prisma";

// Server-side equivalent of mock-data.ts's nextProjectCode — same three
// conventions (PRJ-YYYY-NNN for customer projects, PRJ-INT-NNN /
// PRJ-MKT-NNN for the other two types), scanning the real `projects`
// table instead of an in-memory array. Note the customer sequence is
// NOT scoped to the current year even though the prefix includes one —
// same quirk the mock had, kept for continuity.
export async function nextProjectCode(type: "CUSTOMER" | "INTERNAL" | "MARKETING"): Promise<string> {
  if (type === "INTERNAL" || type === "MARKETING") {
    const prefix = type === "INTERNAL" ? "PRJ-INT-" : "PRJ-MKT-";
    const existing = await prisma.project.findMany({
      where: { projectCode: { startsWith: prefix } },
      select: { projectCode: true },
    });
    const nums = existing
      .map((p) => parseInt(p.projectCode.slice(prefix.length), 10))
      .filter((n) => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
  }
  const existing = await prisma.project.findMany({
    where: { type: "CUSTOMER" },
    select: { projectCode: true },
  });
  const nums = existing
    .map((p) => parseInt(p.projectCode.split("-").pop() ?? "", 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `PRJ-${new Date().getFullYear()}-${String(next).padStart(3, "0")}`;
}
