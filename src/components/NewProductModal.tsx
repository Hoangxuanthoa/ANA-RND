"use client";

import { useMemo, useState } from "react";
import { useProducts } from "@/components/ProductsProvider";
import { nextProductCode, type Product } from "@/lib/mock-data";

interface NewProductModalProps {
  open: boolean;
  title?: string;
  // When creating from inside a customer project, the customer is already
  // known — show it read-only instead of asking again.
  projectCustomer?: string;
  // Present when editing an existing product instead of creating a new
  // one — prefills every field and calls updateProduct on submit.
  product?: Product;
  // Standalone Library/Dashboard creation submits straight for review
  // instead of leaving a manual "Nộp duyệt" step. Ignored when editing.
  autoSubmit?: boolean;
  onCancel: () => void;
  onCreate: (code: string) => void;
}

// A filled tile (main image already picked, or one of the additional
// images) — just shows the preview with a remove button, no file input.
function FilledImageTile({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// An empty tile that opens a file picker when clicked.
function PickImageTile({ label, onPick }: { label: string; onPick: (file: File) => void }) {
  return (
    <label className="flex h-24 w-24 flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line px-1.5 text-center text-text-faint hover:border-accent hover:text-accent">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className="text-[11px] font-semibold">{label}</span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function NewProductModal({ open, title, projectCustomer, product, autoSubmit, onCancel, onCreate }: NewProductModalProps) {
  const { products, categories, materials, sizes, colors, createProduct, updateProduct } = useProducts();
  const isEditing = !!product;
  const [name, setName] = useState(product?.name ?? "");
  const [mainImage, setMainImage] = useState<string | undefined>(product?.mainImage);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [category, setCategory] = useState(product?.category ?? categories[0] ?? "");
  const [material, setMaterial] = useState(product?.material ?? materials[0] ?? "");
  const [size, setSize] = useState(product?.size ?? sizes[0] ?? "");
  const [color, setColor] = useState(product?.color ?? colors[0] ?? "");
  const [length, setLength] = useState(product?.length != null ? String(product.length) : "");
  const [width, setWidth] = useState(product?.width != null ? String(product.width) : "");
  const [height, setHeight] = useState(product?.height != null ? String(product.height) : "");

  const previewCode = useMemo(() => nextProductCode(products), [products]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !category || !material) return;
    const fields = {
      name: name.trim(),
      category,
      material,
      size,
      color,
      length: length ? Number(length) : undefined,
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      mainImage,
      images,
    };
    if (product) {
      updateProduct(product.code, fields);
      onCreate(product.code);
    } else {
      const code = createProduct({ ...fields, originCustomer: projectCustomer }, { autoSubmit });
      onCreate(code);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[520px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold">{title ?? (isEditing ? "Sửa sản phẩm" : "Thiết kế sản phẩm mới")}</h3>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Tên sản phẩm</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Rattan Bookshelf Slim"
              autoFocus
              className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
          </label>
          <label className="flex w-[150px] flex-shrink-0 flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Mã sản phẩm</span>
            <input
              value={isEditing ? product!.code : previewCode}
              disabled
              className="h-10 rounded-lg border border-line bg-bg px-3 text-[13px] text-text-faint"
            />
          </label>
        </div>

        {projectCustomer && !isEditing && (
          <div className="rounded-lg bg-bg px-3.5 py-2.5 text-[12.5px]">
            <span className="text-text-muted">Khách hàng: </span>
            <span className="font-bold">{projectCustomer}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Hình ảnh</span>
          <div className="flex flex-wrap gap-2.5">
            {mainImage ? (
              <FilledImageTile src={mainImage} onRemove={() => setMainImage(undefined)} />
            ) : (
              <PickImageTile label="Ảnh chính" onPick={(file) => setMainImage(URL.createObjectURL(file))} />
            )}
            {images.map((src, i) => (
              <FilledImageTile
                key={src}
                src={src}
                onRemove={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
            <PickImageTile
              label="Thêm ảnh"
              onPick={(file) => setImages((prev) => [...prev, URL.createObjectURL(file)])}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Material</span>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
            >
              {materials.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Size</span>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
            >
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Màu sắc</span>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
            >
              {colors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Kích thước (cm)</span>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              placeholder="Dài"
              className="h-10 flex-1 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
            <input
              type="number"
              min="0"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="Rộng"
              className="h-10 flex-1 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
            <input
              type="number"
              min="0"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="Cao"
              className="h-10 flex-1 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
          </div>
        </div>

        <div className="mt-1 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-bg"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {isEditing ? "Lưu thay đổi" : "Tạo sản phẩm"}
          </button>
        </div>
      </form>
    </div>
  );
}
