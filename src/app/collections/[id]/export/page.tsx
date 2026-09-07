"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useCollections } from "@/components/CollectionsProvider";
import { useProducts } from "@/components/ProductsProvider";
import { CURRENT_USER_NAME, CUSTOMERS, formatSizeVariantDimensions, todayDDMMYYYY } from "@/lib/mock-data";
import { TINT_BG, TINT_FG } from "@/lib/badges";
import { canManageCollections } from "@/lib/permissions";
import { generateCollectionPptx, PRODUCTS_PER_SLIDE_OPTIONS, type ProductsPerSlide } from "@/lib/pptxExport";
import { useSettings } from "@/components/SettingsProvider";

function sizeSummary(sizeVariants?: { size: string; length?: number; width?: number; height?: number }[]) {
  if (!sizeVariants || sizeVariants.length === 0) return "—";
  return sizeVariants
    .map((v) => {
      const dims = formatSizeVariantDimensions(v);
      return dims ? `${v.size} (${dims})` : v.size;
    })
    .join(", ");
}

// One line per size variant for the PPTX's "Dimension:" rows (e.g.
// "S: 40 x 40 x 45 cm") — distinct from sizeSummary's comma-joined
// single-line version used in the PDF/HTML preview.
function sizeLines(sizeVariants?: { size: string; length?: number; width?: number; height?: number }[]): string[] {
  if (!sizeVariants || sizeVariants.length === 0) return [];
  return sizeVariants.map((v) => {
    const dims = formatSizeVariantDimensions(v);
    return dims ? `${v.size}: ${dims}` : v.size;
  });
}

export default function CollectionExportPage() {
  const params = useParams<{ id: string }>();
  const { role } = useRole();
  const userName = CURRENT_USER_NAME[role];
  const { collections, logPitch } = useCollections();
  const { products } = useProducts();
  const { pptxTemplate } = useSettings();
  const collection = collections.find((c) => c.id === params.id);

  const items = useMemo(
    () =>
      collection
        ? collection.productCodes.map((code) => products.find((p) => p.code === code)).filter((p): p is NonNullable<typeof p> => !!p)
        : [],
    [collection, products],
  );

  const [included, setIncluded] = useState<Set<string>>(() => new Set(items.map((p) => p.code)));
  const [customer, setCustomer] = useState(CUSTOMERS[0]);
  const [note, setNote] = useState("");
  const [perSlide, setPerSlide] = useState<ProductsPerSlide>(6);
  const [logged, setLogged] = useState(false);
  const [pptxBusy, setPptxBusy] = useState(false);
  const [pptxError, setPptxError] = useState("");

  if (!canManageCollections(role)) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <TopNav />
        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-20">
          <h2 className="text-[17px] font-extrabold">Không có quyền truy cập</h2>
        </div>
      </div>
    );
  }

  if (!collection) return notFound();

  const selectedItems = items.filter((p) => included.has(p.code));

  function toggle(code: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function ensureLogged() {
    if (!logged && collection) {
      logPitch(collection.id, customer, userName, note);
      setLogged(true);
    }
  }

  function handlePrint() {
    ensureLogged();
    window.print();
  }

  async function handlePptx() {
    setPptxError("");
    setPptxBusy(true);
    try {
      await generateCollectionPptx({
        collectionName: collection!.name,
        customer,
        note,
        date: todayDDMMYYYY(),
        perSlide,
        items: selectedItems.map((p) => ({
          code: p.code,
          category: p.category,
          material: p.material,
          sizeLines: sizeLines(p.sizeVariants),
          mainImage: p.mainImage,
          tint: p.tint,
        })),
        template: {
          backgroundImage: pptxTemplate.coverImage,
          closingBackgroundImage: pptxTemplate.closingImage,
          closingText: pptxTemplate.closingText,
        },
      });
      ensureLogged();
    } catch {
      setPptxError("Xuất PPTX thất bại — thử lại hoặc bỏ bớt sản phẩm có ảnh lỗi.");
    } finally {
      setPptxBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg print:bg-white">
      <div className="print:hidden">
        <TopNav />
      </div>

      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-5 p-7 print:max-w-none print:gap-0 print:p-0">
        <div className="flex items-center justify-between print:hidden">
          <div className="text-[13px] text-text-faint">
            <Link href={`/collections/${collection.id}`} className="text-accent hover:text-accent-hover">
              {collection.name}
            </Link>{" "}
            / <span className="text-text">Xuất PDF</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePptx}
              disabled={selectedItems.length === 0 || pptxBusy}
              className="h-10 rounded-lg border border-line bg-surface px-4 text-[13px] font-bold hover:bg-bg disabled:opacity-40"
            >
              {pptxBusy ? "Đang tạo PPTX…" : "Xuất PPTX"}
            </button>
            <button
              onClick={handlePrint}
              disabled={selectedItems.length === 0}
              className="h-10 rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
            >
              In / Xuất PDF
            </button>
          </div>
        </div>

        {pptxError && (
          <div className="rounded-lg border border-red-soft bg-red-soft px-4 py-2.5 text-[12.5px] font-semibold text-red print:hidden">
            {pptxError}
          </div>
        )}

        {/* Customize panel — hidden when printing */}
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 print:hidden">
          <div className="grid grid-cols-3 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold">Chào khách nào</span>
              <select
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
              >
                {CUSTOMERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold">Ghi chú (hiện trên file)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Không bắt buộc"
                className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold">Số sản phẩm/trang (PPTX)</span>
              <select
                value={perSlide}
                onChange={(e) => setPerSlide(Number(e.target.value) as ProductsPerSlide)}
                className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
              >
                {PRODUCTS_PER_SLIDE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} sản phẩm/trang
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold">
              Chọn sản phẩm đưa vào file ({selectedItems.length}/{items.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {items.map((p) => {
                const active = included.has(p.code);
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => toggle(p.code)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                      active ? "border-accent bg-accent-soft text-accent-soft-text" : "border-line text-text-faint"
                    }`}
                  >
                    {active && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                    {p.code}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Printable document */}
        <div className="flex flex-col gap-5 rounded-xl border border-line bg-white p-6 print:rounded-none print:border-0 print:p-0">
          <div className="flex items-center justify-between border-b border-line pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Artex Nam An" className="h-7 w-auto self-start" />
            <span className="text-[12px] text-text-faint">{todayDDMMYYYY()}</span>
          </div>

          <div>
            <h1 className="text-xl font-extrabold">{collection.name}</h1>
            {customer && <p className="mt-1 text-[13px] text-text-muted">Gửi: {customer}</p>}
            {note.trim() && <p className="mt-1 text-[13px] text-text">{note}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {selectedItems.map((p) => (
              <div key={p.code} className="overflow-hidden rounded-xl border border-line">
                <div className={`flex h-28 items-center justify-center ${p.mainImage ? "" : TINT_BG[p.tint]}`}>
                  {p.mainImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.mainImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className={TINT_FG[p.tint]} stroke="currentColor" strokeWidth="1.4">
                      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                      <path d="M3 8v8l9 5 9-5V8" />
                      <path d="M12 13v8" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <div className="text-[12.5px] font-bold">{p.code}</div>
                  <div className="text-[11px] text-text-muted">
                    {p.category} · {p.material}
                  </div>
                  <div className="text-[11px] text-text-faint">{sizeSummary(p.sizeVariants)}</div>
                </div>
              </div>
            ))}
          </div>

          {selectedItems.length === 0 && (
            <p className="py-10 text-center text-sm text-text-faint">Chưa chọn sản phẩm nào để xuất.</p>
          )}
        </div>
      </div>
    </div>
  );
}
