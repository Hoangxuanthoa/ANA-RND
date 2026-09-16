import { prisma } from "@/lib/prisma";

// Server-side equivalent of mock-data.ts's nextProductCode — same format
// (RND + month(2) + year(2) + a 3-digit sequence that resets monthly),
// just scanning the real `products` table instead of an in-memory array.
// Low-concurrency team, so a scan-then-create is fine; POST /api/products
// still retries once on a rare unique-constraint race (see its caller).
export async function nextProductCode(): Promise<string> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const prefix = `RND${mm}${yy}`;
  const existing = await prisma.product.findMany({
    where: { productCode: { startsWith: prefix } },
    select: { productCode: true },
  });
  const nums = existing
    .map((p) => parseInt(p.productCode.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

// Bulk variant — computes N sequential codes off one scan (not N separate
// calls, which would all see the same "current max" and collide) for
// createProductsBulk.
export async function nextProductCodes(count: number): Promise<string[]> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const prefix = `RND${mm}${yy}`;
  const existing = await prisma.product.findMany({
    where: { productCode: { startsWith: prefix } },
    select: { productCode: true },
  });
  const nums = existing
    .map((p) => parseInt(p.productCode.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const start = (nums.length ? Math.max(...nums) : 0) + 1;
  return Array.from({ length: count }, (_, i) => `${prefix}${String(start + i).padStart(3, "0")}`);
}

// The UI always shows an implicit "V01 — Bản thiết kế gốc" ahead of any
// real version rows (see library/[code]/page.tsx), so the first real
// version is V02, not V01 — offset by 2, not 1.
export async function nextVersionNumber(productId: string): Promise<string> {
  const count = await prisma.productVersion.count({ where: { productId } });
  return `V${String(count + 2).padStart(2, "0")}`;
}
