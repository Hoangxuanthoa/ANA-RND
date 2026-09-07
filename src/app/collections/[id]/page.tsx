"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useCollections } from "@/components/CollectionsProvider";
import { useProducts } from "@/components/ProductsProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LogPitchModal } from "@/components/LogPitchModal";
import { AddProductsToCollectionModal } from "@/components/AddProductsToCollectionModal";
import { CURRENT_USER_NAME, type Product } from "@/lib/mock-data";
import { TINT_BG, TINT_FG } from "@/lib/badges";
import { canManageCollections, canEditCollection } from "@/lib/permissions";

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useRole();
  const userName = CURRENT_USER_NAME[role];
  const { collections, renameCollection, deleteCollection, removeProductFromCollection, logPitch } = useCollections();
  const { products } = useProducts();
  const collection = collections.find((c) => c.id === params.id);

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [shareBannerOpen, setShareBannerOpen] = useState(false);
  const [addProductsOpen, setAddProductsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Product | null>(null);
  const [notice, setNotice] = useState<React.ReactNode | null>(null);

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

  const editable = canEditCollection(role, userName, collection);
  const items = collection.productCodes.map((code) => products.find((p) => p.code === code)).filter((p): p is NonNullable<typeof p> => !!p);
  // Same RELEASED-only rule AddToCollectionButton uses from the Library
  // side — Collections are for finished designs, not works-in-progress.
  const addCandidates = products.filter((p) => p.status === "RELEASED" && !collection.productCodes.includes(p.code));

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/collections/${collection.id}/share` : "";

  function copyShareLink() {
    navigator.clipboard?.writeText(shareUrl);
    setNotice("Đã copy link vào clipboard.");
    setTimeout(() => setNotice(null), 3000);
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-5 p-7">
        <div className="text-[13px] text-text-faint">
          <Link href="/collections" className="text-accent hover:text-accent-hover">
            Collections
          </Link>{" "}
          / <span className="text-text">{collection.name}</span>
        </div>

        <div className="flex items-start justify-between gap-5 rounded-xl border border-line bg-surface p-6">
          <div className="flex flex-1 flex-col gap-2">
            {renaming ? (
              <div className="flex gap-2">
                <input
                  value={nameDraft}
                  autoFocus
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nameDraft.trim()) {
                      renameCollection(collection.id, nameDraft.trim());
                      setRenaming(false);
                    }
                    if (e.key === "Escape") setRenaming(false);
                  }}
                  className="h-9 flex-1 rounded-lg border border-accent px-3 text-[15px] font-bold focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (nameDraft.trim()) renameCollection(collection.id, nameDraft.trim());
                    setRenaming(false);
                  }}
                  className="h-9 rounded-lg bg-accent px-3 text-[12.5px] font-bold text-white hover:bg-accent-hover"
                >
                  Lưu
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-extrabold">{collection.name}</h1>
                {editable && (
                  <button
                    onClick={() => {
                      setNameDraft(collection.name);
                      setRenaming(true);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-bg hover:text-text"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>
                )}
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    collection.status === "DRAFT" ? "bg-slate-soft text-slate-text" : "bg-green-soft text-green"
                  }`}
                >
                  {collection.status === "DRAFT" ? "Draft" : "Đã gửi"}
                </span>
              </div>
            )}
            <p className="text-[13px] text-text-faint">
              Tạo bởi {collection.createdByName} · {collection.createdAt} · {items.length} sản phẩm
            </p>
          </div>

          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            <div className="flex gap-2">
              <Link
                href={`/collections/${collection.id}/export`}
                aria-disabled={items.length === 0}
                className={`flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[12px] font-bold hover:bg-bg ${
                  items.length === 0 ? "pointer-events-none opacity-40" : ""
                }`}
              >
                Xuất PDF
              </Link>
              <button
                onClick={() => setLinkModalOpen(true)}
                disabled={items.length === 0}
                className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px] font-bold hover:bg-bg disabled:opacity-40"
              >
                Lấy link online
              </button>
            </div>
            {editable && (
              <div className="flex gap-2">
                <button
                  onClick={() => setAddProductsOpen(true)}
                  className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold hover:bg-bg"
                >
                  + Thêm sản phẩm
                </button>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold text-red hover:bg-red-soft"
                >
                  Xóa
                </button>
              </div>
            )}
          </div>
        </div>

        {shareBannerOpen && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-green-soft bg-green-soft px-4 py-3 text-[12.5px] font-semibold text-green">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span>Link xem trước cho khách hàng:</span>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="truncate underline">
                {shareUrl}
              </a>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <button
                onClick={copyShareLink}
                className="h-8 rounded-md border border-green/30 bg-white px-3 text-[12px] font-bold text-green hover:bg-green-soft"
              >
                Copy link
              </button>
              <button
                onClick={() => setShareBannerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-green hover:bg-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {notice && (
          <div className="rounded-lg border border-green-soft bg-green-soft px-4 py-2.5 text-[12.5px] font-semibold text-green">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {items.map((p) => (
            <div key={p.code} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className={`relative flex h-32 items-center justify-center overflow-hidden ${p.mainImage ? "" : TINT_BG[p.tint]}`}>
                {p.mainImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.mainImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className={TINT_FG[p.tint]} stroke="currentColor" strokeWidth="1.4">
                    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                    <path d="M3 8v8l9 5 9-5V8" />
                    <path d="M12 13v8" />
                  </svg>
                )}
                {editable && (
                  <button
                    onClick={() => setRemoveTarget(p)}
                    title="Bỏ khỏi collection"
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-text-faint hover:text-red"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1 p-3">
                <Link href={`/library/${p.code}`} className="truncate text-[12.5px] font-bold hover:text-accent">
                  {p.name}
                </Link>
                <div className="text-[11px] font-semibold text-text-faint">{p.code}</div>
                <div className="truncate text-[11px] text-text-muted">
                  {p.category} · {p.material}
                </div>
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-text-faint">
            <p>Chưa có sản phẩm nào trong collection này.</p>
            {editable ? (
              <button
                onClick={() => setAddProductsOpen(true)}
                className="h-9 rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover"
              >
                + Thêm sản phẩm
              </button>
            ) : (
              <p>
                Vào{" "}
                <Link href="/library" className="text-accent hover:text-accent-hover">
                  Design Library
                </Link>{" "}
                và chọn &quot;Add to Collection&quot; trên sản phẩm đã Released.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3.5">
          <h2 className="text-[16px] font-extrabold">Lịch sử chào hàng</h2>
          {collection.pitches.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-[13px] text-text-faint">
              Chưa có lượt chào nào — bấm &quot;Xuất PDF&quot; hoặc &quot;Lấy link online&quot; để ghi lại khi chào khách.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              {[...collection.pitches]
                .reverse()
                .map((pitch, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1 border-b border-line px-4.5 py-3.5 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-bold">Đã chào {pitch.customer}</span>
                      <span className="whitespace-nowrap text-xs text-text-faint">{pitch.date}</span>
                    </div>
                    <div className="text-[12.5px] text-text-muted">bởi {pitch.loggedByName}</div>
                    {pitch.note && <div className="mt-1 text-[13px] text-text">{pitch.note}</div>}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <AddProductsToCollectionModal
        open={addProductsOpen}
        collectionId={collection.id}
        userName={userName}
        candidates={addCandidates}
        onClose={() => setAddProductsOpen(false)}
      />

      <LogPitchModal
        open={linkModalOpen}
        actionLabel="Lấy link online"
        onCancel={() => setLinkModalOpen(false)}
        onConfirm={(customer, note) => {
          logPitch(collection.id, customer, userName, note);
          setShareBannerOpen(true);
          setLinkModalOpen(false);
        }}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        danger
        title="Bỏ sản phẩm khỏi collection?"
        description={removeTarget ? `"${removeTarget.name}" sẽ bị bỏ khỏi collection này.` : ""}
        confirmLabel="Bỏ khỏi collection"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) removeProductFromCollection(collection.id, removeTarget.code);
          setRemoveTarget(null);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        danger
        title="Xóa collection?"
        description={`"${collection.name}" sẽ bị xóa hoàn toàn, không khôi phục được.`}
        confirmLabel="Xóa"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteCollection(collection.id);
          router.push("/collections");
        }}
      />
    </div>
  );
}
