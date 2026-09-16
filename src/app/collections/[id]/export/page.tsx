"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useCollections } from "@/components/CollectionsProvider";
import { useProducts } from "@/components/ProductsProvider";
import { CollectionSlideDeck } from "@/components/CollectionSlideDeck";
import { CUSTOMERS, formatSizeVariantDimensions, todayDDMMYYYY } from "@/lib/mock-data";
import { canManageCollections } from "@/lib/permissions";
import { generateCollectionPptx, PRODUCTS_PER_SLIDE_OPTIONS, type ProductsPerSlide } from "@/lib/pptxExport";
import { generateCollectionPdf } from "@/lib/pdfExport";
import { ALL_INFO_VISIBLE, type InfoVisibility } from "@/lib/exportLayout";
import { useSettings } from "@/components/SettingsProvider";

const INFO_FIELD_OPTIONS: { key: keyof InfoVisibility; label: string }[] = [
  { key: "code", label: "Item code" },
  { key: "category", label: "Category" },
  { key: "material", label: "Material" },
  { key: "dimension", label: "Dimension" },
];

function CheckMark() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function TogglePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
        active ? "border-accent bg-accent-soft text-accent-soft-text" : "border-line text-text-faint"
      }`}
    >
      {active && <CheckMark />}
      {label}
    </button>
  );
}

// One line per size variant (e.g. "S: 40 x 40 x 45 cm") — feeds both the
// PPTX's and the slide-deck preview/PDF's "Dimension:" rows, so the two
// exports always show the same thing.
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
  const { collections, collectionsLoaded, logPitch } = useCollections();
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
  const [perSlide, setPerSlide] = useState<ProductsPerSlide>(2);
  const [infoVisibility, setInfoVisibility] = useState<InfoVisibility>(ALL_INFO_VISIBLE);
  const allFieldsSelected = INFO_FIELD_OPTIONS.every(({ key }) => infoVisibility[key]);

  function toggleAllFields() {
    setInfoVisibility(
      allFieldsSelected
        ? { code: false, category: false, material: false, dimension: false }
        : ALL_INFO_VISIBLE,
    );
  }

  function toggleField(key: keyof InfoVisibility) {
    setInfoVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  const [logged, setLogged] = useState(false);
  const [pptxBusy, setPptxBusy] = useState(false);
  const [pptxError, setPptxError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");

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

  if (!collection) {
    // Same loading-vs-not-found distinction as collections/[id]/page.tsx
    // — `collections` starts empty until the real fetch resolves.
    if (!collectionsLoaded) return null;
    return notFound();
  }

  const selectedItems = items.filter((p) => included.has(p.code));
  const deckItems = selectedItems.map((p) => ({
    code: p.code,
    category: p.category,
    material: p.material,
    sizeLines: sizeLines(p.sizeVariants),
    mainImage: p.mainImage,
    tint: p.tint,
  }));

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
      logPitch(collection.id, customer).catch(() => {});
      setLogged(true);
    }
  }

  async function handlePdf() {
    setPdfError("");
    setPdfBusy(true);
    try {
      await generateCollectionPdf({
        collectionName: collection!.name,
        customer,
        date: todayDDMMYYYY(),
        perSlide,
        items: deckItems,
        template: {
          backgroundImage: pptxTemplate.coverImage,
          closingBackgroundImage: pptxTemplate.closingImage,
          closingText: pptxTemplate.closingText,
        },
        infoVisibility,
      });
      ensureLogged();
    } catch {
      setPdfError("Xuất PDF thất bại — thử lại hoặc bỏ bớt sản phẩm có ảnh lỗi.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function handlePptx() {
    setPptxError("");
    setPptxBusy(true);
    try {
      await generateCollectionPptx({
        collectionName: collection!.name,
        customer,
        date: todayDDMMYYYY(),
        perSlide,
        items: deckItems,
        template: {
          backgroundImage: pptxTemplate.coverImage,
          closingBackgroundImage: pptxTemplate.closingImage,
          closingText: pptxTemplate.closingText,
        },
        infoVisibility,
      });
      ensureLogged();
    } catch {
      setPptxError("Xuất PPTX thất bại — thử lại hoặc bỏ bớt sản phẩm có ảnh lỗi.");
    } finally {
      setPptxBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />

      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-5 p-7">
        <div className="flex items-center justify-between">
          <div className="text-[13px] text-text-faint">
            <Link href={`/collections/${collection.id}`} className="text-accent hover:text-accent-hover">
              {collection.name}
            </Link>{" "}
            / <span className="text-text">Xuất Collection</span>
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
              onClick={handlePdf}
              disabled={selectedItems.length === 0 || pdfBusy}
              className="h-10 rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
            >
              {pdfBusy ? "Đang tạo PDF…" : "Xuất PDF"}
            </button>
          </div>
        </div>

        {(pptxError || pdfError) && (
          <div className="rounded-lg border border-red-soft bg-red-soft px-4 py-2.5 text-[12.5px] font-semibold text-red">
            {pptxError || pdfError}
          </div>
        )}

        {/* Customize panel */}
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <div className="grid grid-cols-2 gap-4">
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
              <span className="text-[12.5px] font-semibold">Số sản phẩm/trang</span>
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
            <span className="text-[12.5px] font-semibold">Hiển thị thông tin sản phẩm</span>
            <div className="flex flex-wrap gap-2">
              <TogglePill label="Tất cả" active={allFieldsSelected} onClick={toggleAllFields} />
              {INFO_FIELD_OPTIONS.map(({ key, label }) => (
                <TogglePill key={key} label={label} active={infoVisibility[key]} onClick={() => toggleField(key)} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold">
              Chọn sản phẩm đưa vào file ({selectedItems.length}/{items.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {items.map((p) => (
                <TogglePill key={p.code} label={p.code} active={included.has(p.code)} onClick={() => toggle(p.code)} />
              ))}
            </div>
          </div>
        </div>

        <CollectionSlideDeck
          collectionName={collection.name}
          customer={customer}
          date={todayDDMMYYYY()}
          items={deckItems}
          perSlide={perSlide}
          coverImage={pptxTemplate.coverImage}
          closingImage={pptxTemplate.closingImage}
          closingText={pptxTemplate.closingText}
          infoVisibility={infoVisibility}
        />
      </div>
    </div>
  );
}
