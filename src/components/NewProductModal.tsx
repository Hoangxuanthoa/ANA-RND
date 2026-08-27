"use client";

import { useState } from "react";
import { useProducts } from "@/components/ProductsProvider";

interface NewProductModalProps {
  open: boolean;
  title?: string;
  onCancel: () => void;
  onCreate: (code: string) => void;
}

export function NewProductModal({ open, title, onCancel, onCreate }: NewProductModalProps) {
  const { categories, materials, createProduct } = useProducts();
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "");
  const [material, setMaterial] = useState(materials[0] ?? "");
  const [originCustomer, setOriginCustomer] = useState("");
  const [description, setDescription] = useState("");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !category || !material) return;
    const code = createProduct({
      name: name.trim(),
      category,
      material,
      description: description.trim(),
      originCustomer,
    });
    onCreate(code);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[460px] flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold">{title ?? "Thiết kế sản phẩm mới"}</h3>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Tên sản phẩm</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Rattan Bookshelf Slim"
            autoFocus
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>

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

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Khách hàng tham chiếu (không bắt buộc)</span>
          <input
            value={originCustomer}
            onChange={(e) => setOriginCustomer(e.target.value)}
            placeholder="VD: JYSK"
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Mô tả</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả ngắn gọn thiết kế…"
            className="min-h-[80px] rounded-lg border border-line p-3 text-[13px]"
          />
        </label>

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
            Tạo sản phẩm
          </button>
        </div>
      </form>
    </div>
  );
}
