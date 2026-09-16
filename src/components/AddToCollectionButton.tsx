"use client";

import { useState } from "react";
import { useRole } from "@/components/RoleProvider";
import { useCollections } from "@/components/CollectionsProvider";
import { CURRENT_USER_NAME, type Product } from "@/lib/mock-data";
import { getPickableCollections } from "@/lib/permissions";
import { useExclusiveGuard } from "@/components/useExclusiveGuard";

interface AddToCollectionButtonProps {
  product: Product;
  className?: string;
  align?: "left" | "right";
  // The full product-detail page has room below (a sidebar with more
  // buttons under this one), so the dropdown opens downward there. The
  // compact quick-view modal has this button on its bottom-most row —
  // opening downward pushes the dropdown off-screen, so it needs to open
  // upward instead, same as that modal's "Add to Project" button.
  openUp?: boolean;
}

export function AddToCollectionButton({ product, className, align = "left", openUp = false }: AddToCollectionButtonProps) {
  const { role, effectiveUserName } = useRole();
  // getPickableCollections checks Collections' mock ownership field (not
  // real yet), so it keeps the old per-role fictional name; the
  // exclusive guard checks real Product.exclusiveBy, so it needs the
  // real name.
  const userName = CURRENT_USER_NAME[role];
  const { collections, createCollection, addProductToCollection } = useCollections();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const pickable = getPickableCollections(role, userName, collections);
  const { guardPick, guardModal } = useExclusiveGuard(effectiveUserName);

  function handleAdd(id: string, name: string) {
    guardPick(product, () => addProductToCollection(id, product.code));
    setOpen(false);
    setAddedNotice(name);
    setTimeout(() => setAddedNotice(null), 2500);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          className ??
          "inline-flex h-[38px] w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-[13px] font-bold hover:bg-bg"
        }
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add to Collection
      </button>
      {addedNotice && <p className="mt-1.5 text-[12px] font-semibold text-green">Đã thêm vào {addedNotice}.</p>}
      {open && (
        <div
          className={`absolute z-20 w-64 overflow-hidden rounded-lg border border-line bg-surface shadow-md ${
            openUp ? "bottom-11" : "top-11"
          } ${align === "right" ? "right-0" : "left-0"}`}
        >
          {pickable.map((c) => (
            <button
              key={c.id}
              onClick={() => handleAdd(c.id, c.name)}
              className="flex w-full flex-col px-3.5 py-2.5 text-left hover:bg-bg"
            >
              <span className="text-[12.5px] font-bold">{c.name}</span>
              <span className="text-[11px] text-text-faint">{c.productCodes.length} sản phẩm</span>
            </button>
          ))}
          {pickable.length === 0 && (
            <p className="p-3 text-[12px] text-text-faint">Chưa có collection nào đang soạn.</p>
          )}
          <div className="flex gap-1.5 border-t border-line p-2.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên collection mới…"
              className="h-8 flex-1 rounded-md border border-line px-2 text-[12px] focus:border-accent focus:outline-none"
            />
            <button
              onClick={() => {
                if (!newName.trim()) return;
                const id = createCollection(newName.trim(), userName);
                handleAdd(id, newName.trim());
                setNewName("");
              }}
              className="h-8 flex-shrink-0 rounded-md bg-accent px-2.5 text-[11px] font-bold text-white hover:bg-accent-hover"
            >
              Tạo
            </button>
          </div>
        </div>
      )}
      {guardModal}
    </div>
  );
}
