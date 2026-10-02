"use client";

import { useState } from "react";
import type { ProductState } from "@/lib/breakdown/geometry/types";

interface ProductListProps {
  products: ProductState[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onCodeChange: (id: string, code: string) => void;
}

export function ProductList({ products, activeId, onSelect, onAdd, onRemove, onRename, onCodeChange }: ProductListProps) {
  // A native window.confirm() never appears at all inside an embedded
  // preview pane (it's OS/browser-chrome, not page content) — so deleting
  // silently did nothing there with no visible prompt. An in-page confirm
  // step (the "Xóa" link turning into "Xóa thật?" / "Hủy") always renders,
  // regardless of how the page is being viewed.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold tracking-wide text-text-muted uppercase">Sản phẩm</span>
      {products.map((product, i) => {
        const active = product.id === activeId;
        if (!active) {
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                setConfirmingId(null);
                onSelect(product.id);
              }}
              className="flex h-10 items-center justify-between rounded-lg border border-line bg-surface px-3 text-left text-[13px] font-semibold text-text-muted hover:bg-bg"
            >
              <span>{product.name || `Sản phẩm ${i + 1}`}</span>
              {product.code && <span className="truncate text-[11px] font-normal text-text-faint">{product.code}</span>}
            </button>
          );
        }
        return (
          <div key={product.id} className="rounded-lg border border-accent bg-accent-soft/40 p-3">
            <div className="flex items-center gap-2">
              <input
                value={product.name}
                onChange={(e) => onRename(product.id, e.target.value)}
                placeholder={`Sản phẩm ${i + 1}`}
                className="h-8 flex-1 rounded-md border border-line bg-surface px-2.5 text-[13px] font-bold focus:border-accent focus:outline-none"
              />
              {products.length > 1 &&
                (confirmingId === product.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11.5px] font-semibold text-text-faint">Xóa thật?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingId(null);
                        onRemove(product.id);
                      }}
                      className="rounded bg-red px-2 py-1 text-[11.5px] font-bold text-white hover:opacity-90"
                    >
                      Xóa
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="text-[11.5px] font-semibold text-text-muted hover:underline"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(product.id)}
                    className="text-[12px] font-semibold text-red hover:underline"
                  >
                    Xóa
                  </button>
                ))}
            </div>
            <input
              value={product.code}
              onChange={(e) => onCodeChange(product.id, e.target.value)}
              placeholder="Mã sản phẩm (tùy chọn)"
              className="mt-1.5 h-8 w-full rounded-md border border-line bg-surface px-2.5 text-[12.5px] focus:border-accent focus:outline-none"
            />
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="h-9 rounded-lg border border-dashed border-line text-[13px] font-semibold text-text-muted hover:border-accent hover:text-accent"
      >
        + Thêm sản phẩm
      </button>
    </div>
  );
}
