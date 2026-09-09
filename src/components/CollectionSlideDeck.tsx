"use client";

import { LAYOUTS as CONTENT_LAYOUTS, hasVisibleInfo, type ProductsPerSlide, type ExportItem, type InfoVisibility } from "@/lib/exportLayout";
import { TINT_BG, TINT_FG } from "@/lib/badges";

// HTML/CSS mirror of the same layout geometry the real exports use
// (src/lib/exportLayout.ts — same cols/rows/inner decision per mode,
// same labeled info rows), so this preview always matches what "Xuất
// PPTX"/"Xuất PDF" actually produce. Both of those now draw their own
// output directly (pptxgenjs / jsPDF) rather than capturing this DOM, so
// this component is purely the on-page preview.

export type SlideDeckItem = ExportItem;

interface TextScale {
  code: string;
  meta: string;
  size: string;
}

const TEXT_SCALE: Record<ProductsPerSlide, TextScale> = {
  1: { code: "text-xl", meta: "text-sm", size: "text-[12px]" },
  2: { code: "text-base", meta: "text-[13px]", size: "text-[11px]" },
  3: { code: "text-sm", meta: "text-[12px]", size: "text-[10px]" },
  4: { code: "text-[13px]", meta: "text-[11px]", size: "text-[9.5px]" },
  6: { code: "text-[11px]", meta: "text-[9.5px]", size: "text-[9px]" },
};

function SlideFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-line ${className ?? ""}`}>
      {children}
    </div>
  );
}

function BrandSlide({
  image,
  children,
}: {
  image?: string;
  children: React.ReactNode;
}) {
  return (
    <SlideFrame className="bg-accent">
      {image && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
        </>
      )}
      <div className="relative flex h-full flex-col justify-center p-[6%] text-white">{children}</div>
    </SlideFrame>
  );
}

function ProductCell({
  item,
  inner,
  scale,
  infoVisibility,
}: {
  item: SlideDeckItem;
  inner: "LR" | "TB";
  scale: TextScale;
  infoVisibility: InfoVisibility;
}) {
  const isLR = inner === "LR";
  const hasInfo = hasVisibleInfo(infoVisibility);
  const lines = item.sizeLines.length > 0 ? item.sizeLines : ["—"];
  return (
    <div className={`flex h-full min-h-0 min-w-0 gap-2.5 ${hasInfo && isLR ? "flex-row" : "flex-col"}`}>
      <div
        className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-lg ${
          !hasInfo ? "h-full w-full" : isLR ? "h-full w-[42%]" : "h-[55%] w-full"
        } ${item.mainImage ? "" : TINT_BG[item.tint]}`}
      >
        {item.mainImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.mainImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <svg width="28%" height="28%" viewBox="0 0 24 24" fill="none" className={TINT_FG[item.tint]} stroke="currentColor" strokeWidth="1.4">
            <path d="M21 8l-9-5-9 5 9 5 9-5z" />
            <path d="M3 8v8l9 5 9-5V8" />
            <path d="M12 13v8" />
          </svg>
        )}
      </div>
      {hasInfo && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
          {infoVisibility.code && <div className={`truncate font-bold text-text ${scale.code}`}>Item code: {item.code}</div>}
          {infoVisibility.category && <div className={`truncate text-text-muted ${scale.meta}`}>Category: {item.category}</div>}
          {infoVisibility.material && <div className={`truncate text-text-muted ${scale.meta}`}>Material: {item.material}</div>}
          {infoVisibility.dimension && (
            <>
              <div className={`text-text-muted ${scale.meta}`}>Dimension:</div>
              {lines.map((line, i) => (
                <div key={i} className={`truncate text-text-faint ${scale.size}`}>
                  {line}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ContentSlide({
  chunk,
  layout,
  scale,
  infoVisibility,
}: {
  chunk: SlideDeckItem[];
  layout: { cols: number; rows: number; inner: "LR" | "TB" };
  scale: TextScale;
  infoVisibility: InfoVisibility;
}) {
  const slots = Array.from({ length: layout.cols * layout.rows });
  return (
    <SlideFrame className="bg-white p-[3%]">
      <div className="flex h-full flex-col gap-[2%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-[9%] w-auto flex-shrink-0 self-start" />
        <div
          className="grid min-h-0 flex-1 gap-3"
          style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)`, gridTemplateRows: `repeat(${layout.rows}, 1fr)` }}
        >
          {slots.map((_, idx) =>
            chunk[idx] ? (
              <ProductCell key={chunk[idx].code} item={chunk[idx]} inner={layout.inner} scale={scale} infoVisibility={infoVisibility} />
            ) : (
              <div key={idx} />
            ),
          )}
        </div>
      </div>
    </SlideFrame>
  );
}

export interface CollectionSlideDeckProps {
  collectionName: string;
  customer: string;
  date: string;
  items: SlideDeckItem[];
  perSlide: ProductsPerSlide;
  coverImage?: string;
  closingImage?: string;
  closingText: string;
  infoVisibility: InfoVisibility;
}

export function CollectionSlideDeck({
  collectionName,
  customer,
  date,
  items,
  perSlide,
  coverImage,
  closingImage,
  closingText,
  infoVisibility,
}: CollectionSlideDeckProps) {
  const layout = CONTENT_LAYOUTS[perSlide];
  const scale = TEXT_SCALE[perSlide];
  const chunks: SlideDeckItem[][] = [];
  for (let i = 0; i < items.length; i += perSlide) chunks.push(items.slice(i, i + perSlide));

  return (
    <div id="slide-deck" className="flex flex-col gap-6">
      <BrandSlide image={coverImage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-[10%] w-auto flex-shrink-0 self-start" />
        <h1 className="mt-[4%] max-w-[75%] text-3xl font-extrabold">{collectionName}</h1>
        <div className="mt-[3%] flex flex-col gap-1 text-sm">
          {customer && <p>Gửi: {customer}</p>}
          <p>{date}</p>
        </div>
      </BrandSlide>

      {chunks.map((chunk, i) => (
        <ContentSlide key={i} chunk={chunk} layout={layout} scale={scale} infoVisibility={infoVisibility} />
      ))}

      {chunks.length === 0 && (
        <SlideFrame className="flex items-center justify-center bg-white">
          <p className="text-sm text-text-faint">Chưa chọn sản phẩm nào để xuất.</p>
        </SlideFrame>
      )}

      <BrandSlide image={closingImage}>
        <div className="flex h-full items-center justify-center">
          <p className="text-center text-2xl font-extrabold">{closingText.trim() || "Cảm ơn quý khách"}</p>
        </div>
      </BrandSlide>
    </div>
  );
}
