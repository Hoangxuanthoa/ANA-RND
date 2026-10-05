import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Edit history for a breakdown ("Lịch sử chỉnh sửa", BreakdownActivity rows).
//
// The studio autosaves continuously (every change, 400ms after the last), so
// logging one row per save would bury the useful lines. Instead edits by the
// SAME person to the SAME product within MERGE_WINDOW_MS fold into one row whose
// list of changed field groups grows as they keep working.
//
// Logging is best-effort: a failure here must never fail the save it describes,
// so every exported function swallows its own errors.

const MERGE_WINDOW_MS = 10 * 60 * 1000;

// ProductState top-level key → what the person would call it. Keys not listed
// fall under "khác". Order of GROUP_ORDER is the order shown in the summary.
const GROUP_BY_KEY: Record<string, string> = {
  name: "tên",
  code: "mã sản phẩm",
  shape: "dáng sản phẩm",
  rings: "kích thước / hình dạng",
  rectProfile: "kích thước / hình dạng",
  ovalProfile: "kích thước / hình dạng",
  ellipseProfile: "kích thước / hình dạng",
  photoCurve: "kích thước / hình dạng",
  photoCurveSource: "kích thước / hình dạng",
  preLockRings: "kích thước / hình dạng",
  ovalPhotoCurve: "kích thước / hình dạng",
  ovalPreLockRings: "kích thước / hình dạng",
  ellipsePhotoCurve: "kích thước / hình dạng",
  ellipsePreLockRings: "kích thước / hình dạng",
  photoTrace: "kích thước / hình dạng",
  lid: "nắp",
  handle: "quai",
  scallop: "miệng cánh hoa",
  frame: "khung sắt",
  rectFrame: "khung sắt",
  ovalFrame: "khung sắt",
  ellipseFrame: "khung sắt",
  material: "vật liệu",
  drawingDoc: "bản vẽ",
};
const GROUP_ORDER = ["tên", "mã sản phẩm", "dáng sản phẩm", "kích thước / hình dạng", "nắp", "quai", "miệng cánh hoa", "khung sắt", "vật liệu", "bản vẽ", "khác"];

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "undefined";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

// Which groups of a product's saved data differ between two versions. A key
// that only exists in the NEW version is skipped (the studio fills in newly
// added fields with defaults the first time it opens an older product, which
// isn't something the person did) — except drawingDoc, whose first appearance
// really is the person saving a drawing.
export function changedGroups(oldData: unknown, newData: unknown): string[] {
  if (!oldData || typeof oldData !== "object" || !newData || typeof newData !== "object") return [];
  const o = oldData as Record<string, unknown>;
  const n = newData as Record<string, unknown>;
  const found = new Set<string>();
  for (const key of new Set([...Object.keys(o), ...Object.keys(n)])) {
    if (key === "id") continue;
    if (o[key] === undefined && key !== "drawingDoc") continue;
    if (stableStringify(o[key]) !== stableStringify(n[key])) found.add(GROUP_BY_KEY[key] ?? "khác");
  }
  return GROUP_ORDER.filter((g) => found.has(g));
}

interface Base {
  breakdownId: string;
  userId: string;
}

// Folds into this person's recent "edit" row for the product when there is
// one, otherwise starts a new row.
export async function recordProductEdit(args: Base & { productCode: string; productName: string; groups: string[] }) {
  if (args.groups.length === 0) return;
  try {
    const since = new Date(Date.now() - MERGE_WINDOW_MS);
    const recent = await prisma.breakdownActivity.findFirst({
      where: { breakdownId: args.breakdownId, userId: args.userId, kind: "edit", productCode: args.productCode, updatedAt: { gte: since } },
      orderBy: { updatedAt: "desc" },
    });
    const previous = (recent?.details as { groups?: string[] } | null)?.groups ?? [];
    const groups = GROUP_ORDER.filter((g) => previous.includes(g) || args.groups.includes(g));
    const summary = `Sửa ${args.productName || args.productCode}: ${groups.join(", ")}`;
    if (recent) {
      await prisma.breakdownActivity.update({ where: { id: recent.id }, data: { summary, productName: args.productName, details: { groups } } });
    } else {
      await prisma.breakdownActivity.create({
        data: {
          breakdownId: args.breakdownId,
          userId: args.userId,
          kind: "edit",
          productCode: args.productCode,
          productName: args.productName,
          summary,
          details: { groups },
        },
      });
    }
  } catch (e) {
    console.error("recordProductEdit failed", e);
  }
}

// A one-off line. With `mergeKind`, repeats of the same kind by the same person
// inside the window just bump the existing row instead of adding another
// (used for reordering, where a few ▲/▼ clicks in a row are one action).
export async function recordActivity(
  args: Base & { kind: string; summary: string; productCode?: string; productName?: string; details?: Prisma.InputJsonValue; mergeRepeats?: boolean },
) {
  try {
    if (args.mergeRepeats) {
      const since = new Date(Date.now() - MERGE_WINDOW_MS);
      const recent = await prisma.breakdownActivity.findFirst({
        where: { breakdownId: args.breakdownId, userId: args.userId, kind: args.kind, updatedAt: { gte: since } },
        orderBy: { updatedAt: "desc" },
      });
      if (recent) {
        await prisma.breakdownActivity.update({ where: { id: recent.id }, data: { summary: args.summary } });
        return;
      }
    }
    await prisma.breakdownActivity.create({
      data: {
        breakdownId: args.breakdownId,
        userId: args.userId,
        kind: args.kind,
        productCode: args.productCode,
        productName: args.productName,
        summary: args.summary,
        details: args.details,
      },
    });
  } catch (e) {
    console.error("recordActivity failed", e);
  }
}
