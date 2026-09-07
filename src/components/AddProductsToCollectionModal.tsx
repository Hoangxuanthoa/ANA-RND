"use client";

import { useState } from "react";
import type { Product } from "@/lib/mock-data";
import { useCollections } from "@/components/CollectionsProvider";
import { useExclusiveGuard } from "@/components/useExclusiveGuard";

interface AddProductsToCollectionModalProps {
  open: boolean;
  collectionId: string;
  userName: string;
  // Products RELEASED and not already in this collection — the exact
  // "still pickable" set, computed by the caller (same RELEASED-only rule
  // AddToCollectionButton follows from the Library side).
  candidates: Product[];
  onClose: () => void;
}

export function AddProductsToCollectionModal({
  open,
  collectionId,
  userName,
  candidates,
  onClose,
}: AddProductsToCollectionModalProps) {
  const { addProductToCollection } = useCollections();
  const { guardPick, guardModal } = useExclusiveGuard(userName);
  const [query, setQuery] = useState("");

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? candidates.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
    : candidates;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-[15px] font-bold">Thêm sản phẩm vào collection</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint hover:bg-bg hover:text-text">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 pb-0">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc mã…"
            className="h-10 w-full rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </div>

        <div className="mt-3 max-h-[360px] overflow-y-auto">
          {filtered.map((p) => (
            <div key={p.code} className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold">{p.name}</div>
                <div className="truncate text-[11px] text-text-faint">
                  {p.code} · {p.category} · {p.material}
                </div>
              </div>
              <button
                onClick={() => guardPick(p, () => addProductToCollection(collectionId, p.code))}
                className="h-8 flex-shrink-0 rounded-md border border-line bg-surface px-3 text-[12px] font-bold hover:bg-bg"
              >
                Thêm
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="border-t border-line p-6 text-center text-[12.5px] text-text-faint">
              {candidates.length === 0 ? "Không còn sản phẩm nào để thêm." : "Không tìm thấy sản phẩm phù hợp."}
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-line p-3.5">
          <button onClick={onClose} className="h-9 rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover">
            Xong
          </button>
        </div>
      </div>

      {guardModal}
    </div>
  );
}
