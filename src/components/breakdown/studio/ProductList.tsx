"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductState } from "@/lib/breakdown/geometry/types";

interface ProductListProps {
  products: ProductState[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onCodeChange: (id: string, code: string) => void;
  // Swap a product with its neighbour: -1 = one place earlier, +1 = one later.
  onMove: (id: string, delta: -1 | 1) => void;
  // Copy a product (placed right after it, then selected).
  onDuplicate: (id: string) => void;
  // Shared-with-me breakdown: browse products but not add/rename/delete.
  readOnly?: boolean;
}

function productLabel(product: ProductState, index: number): string {
  const name = product.name || `Sản phẩm ${index + 1}`;
  return product.code ? `${name} — ${product.code}` : name;
}

// A searchable combobox + prev/next pager (not a vertical card list, nor a
// plain <select>) — a tab strip needs sideways scrolling once it overflows
// the panel, a vertical list pushes the rest of the form down, and a plain
// dropdown still makes you scan/scroll a long list by eye once there are
// dozens of products. Typing filters by name or code and jumps straight to
// a match; ‹ › step through in order without opening anything. Only the
// active product gets an edit row (name + code + delete).
export function ProductList({ products, activeId, onSelect, onAdd, onRemove, onRename, onCodeChange, onMove, onDuplicate, readOnly = false }: ProductListProps) {
  // A native window.confirm() never appears at all inside an embedded
  // preview pane (it's OS/browser-chrome, not page content) — so deleting
  // silently did nothing there with no visible prompt. An in-page confirm
  // step (the "Xóa" link turning into "Xóa thật?" / "Hủy") always renders,
  // regardless of how the page is being viewed.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const activeIndex = products.findIndex((p) => p.id === activeId);
  const active = products[activeIndex];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const indexed = products.map((product, index) => ({ product, index }));
  const filtered = query.trim()
    ? indexed.filter(({ product, index }) => productLabel(product, index).toLowerCase().includes(query.trim().toLowerCase()))
    : indexed;

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  // Close on any click outside the input+list — clicks ON a list option are
  // kept from ever blurring the input in the first place (see onMouseDown
  // below), so this only has to handle "clicked elsewhere on the page".
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function choose(id: string) {
    setConfirmingId(null);
    onSelect(id);
    setOpen(false);
    setQuery("");
    // Force a real blur so the NEXT focus (click or Tab back in) fires
    // onFocus again and clears the field — otherwise, since the input is
    // already focused post-selection, clicking it again doesn't re-fire
    // focus at all, and typing would land on top of the still-displayed
    // product label instead of starting a fresh search.
    inputRef.current?.blur();
  }

  function step(delta: number) {
    const next = products[activeIndex + delta];
    if (next) {
      setConfirmingId(null);
      onSelect(next.id);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const match = filtered[highlight];
      if (match) choose(match.product.id);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold tracking-wide text-text-muted uppercase">Sản phẩm</span>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={activeIndex <= 0}
          title="Sản phẩm trước"
          className="flex h-8 w-7 flex-shrink-0 items-center justify-center rounded-md border border-line bg-surface text-[13px] font-bold text-text-muted hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹
        </button>

        <div ref={boxRef} className="relative min-w-0 max-w-[300px] flex-1">
          <input
            ref={inputRef}
            value={open ? query : active ? productLabel(active, activeIndex) : ""}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={(e) => {
              setOpen(true);
              setQuery("");
              e.target.select();
            }}
            onBlur={() => {
              setOpen(false);
              setQuery("");
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tìm sản phẩm theo tên hoặc mã…"
            className="h-8 w-full rounded-md border border-line bg-surface px-2.5 text-[12.5px] font-semibold text-text focus:border-accent focus:outline-none"
          />
          {open && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-20 max-h-64 overflow-y-auto rounded-md border border-line bg-white shadow-lg">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-[12.5px] text-text-faint">Không tìm thấy sản phẩm nào</div>
              ) : (
                filtered.map(({ product, index }, i) => (
                  <button
                    key={product.id}
                    type="button"
                    // Keep the input focused across this click — otherwise its
                    // own blur fires first and closes the list before onClick
                    // below ever runs.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(product.id)}
                    className={
                      product.id === activeId
                        ? "flex w-full items-center justify-between bg-accent-soft px-3 py-1.5 text-left text-[12.5px] font-bold text-text"
                        : i === highlight
                          ? "flex w-full items-center justify-between bg-bg px-3 py-1.5 text-left text-[12.5px] text-text"
                          : "flex w-full items-center justify-between px-3 py-1.5 text-left text-[12.5px] text-text hover:bg-bg"
                    }
                  >
                    <span className="truncate">
                      {index + 1}. {product.name || `Sản phẩm ${index + 1}`}
                    </span>
                    {product.code && <span className="flex-shrink-0 truncate pl-2 text-[11px] text-text-faint">{product.code}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => step(1)}
          disabled={activeIndex >= products.length - 1}
          title="Sản phẩm tiếp theo"
          className="flex h-8 w-7 flex-shrink-0 items-center justify-center rounded-md border border-line bg-surface text-[13px] font-bold text-text-muted hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          ›
        </button>
        <span className="flex-shrink-0 text-[11px] text-text-faint">
          {activeIndex + 1}/{products.length}
        </span>
        {!readOnly && (
          <button
            type="button"
            onClick={onAdd}
            title="Thêm sản phẩm"
            className="ml-1 flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 text-[12.5px] font-bold text-white hover:bg-accent-hover"
          >
            <span className="text-[15px] leading-none">+</span> Thêm sản phẩm mới
          </button>
        )}
      </div>

      {active && (
        <div className="flex items-center gap-2">
          <input
            value={active.name}
            readOnly={readOnly}
            onChange={(e) => onRename(active.id, e.target.value)}
            placeholder={`Sản phẩm ${activeIndex + 1}`}
            className="h-8 flex-1 rounded-md border border-line bg-surface px-2.5 text-[13px] font-bold focus:border-accent focus:outline-none"
          />
          <input
            value={active.code}
            readOnly={readOnly}
            onChange={(e) => onCodeChange(active.id, e.target.value)}
            placeholder="Mã sản phẩm (tùy chọn)"
            className="h-8 w-44 flex-shrink-0 rounded-md border border-line bg-surface px-2.5 text-[12.5px] focus:border-accent focus:outline-none"
          />
          {!readOnly && (
            <button
              type="button"
              onClick={() => onDuplicate(active.id)}
              title="Nhân bản sản phẩm này (đặt ngay sau nó)"
              className="h-8 flex-shrink-0 rounded-md border border-line bg-surface px-2 text-[12px] font-semibold text-text-muted hover:bg-bg hover:text-text"
            >
              Nhân bản
            </button>
          )}
          {!readOnly && products.length > 1 && (
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onMove(active.id, -1)}
                disabled={activeIndex <= 0}
                title="Chuyển lên (đổi chỗ với sản phẩm trước)"
                className="flex h-8 w-7 items-center justify-center rounded-md border border-line bg-surface text-[11px] font-bold text-text-muted hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => onMove(active.id, 1)}
                disabled={activeIndex >= products.length - 1}
                title="Chuyển xuống (đổi chỗ với sản phẩm sau)"
                className="flex h-8 w-7 items-center justify-center rounded-md border border-line bg-surface text-[11px] font-bold text-text-muted hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
              >
                ▼
              </button>
            </div>
          )}
          {!readOnly && products.length > 1 &&
            (confirmingId === active.id ? (
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <span className="text-[11.5px] font-semibold text-text-faint">Xóa thật?</span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingId(null);
                    onRemove(active.id);
                  }}
                  className="rounded bg-red px-2 py-1 text-[11.5px] font-bold text-white hover:opacity-90"
                >
                  Xóa
                </button>
                <button type="button" onClick={() => setConfirmingId(null)} className="text-[11.5px] font-semibold text-text-muted hover:underline">
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingId(active.id)}
                className="flex-shrink-0 text-[12px] font-semibold text-red hover:underline"
              >
                Xóa
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
