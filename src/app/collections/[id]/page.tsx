"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useCollections } from "@/components/CollectionsProvider";
import { useProducts } from "@/components/ProductsProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CURRENT_USER_NAME } from "@/lib/mock-data";
import { TINT_BG, TINT_FG } from "@/lib/badges";
import { canManageCollections, canEditCollection } from "@/lib/permissions";

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useRole();
  const userName = CURRENT_USER_NAME[role];
  const { collections, renameCollection, deleteCollection, removeProductFromCollection, sendCollection } = useCollections();
  const { products } = useProducts();
  const collection = collections.find((c) => c.id === params.id);

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  function flash(message: string) {
    setNotice(message);
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
              <button
                onClick={() => flash("Đã tạo file PDF (mô phỏng) — sẵn sàng tải xuống.")}
                className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px] font-bold hover:bg-bg"
              >
                Xuất PDF
              </button>
              <button
                onClick={() => flash(`Đã tạo link: designlibrary.internal/share/${collection.id}`)}
                className="h-9 rounded-lg border border-line bg-surface px-3 text-[12px] font-bold hover:bg-bg"
              >
                Lấy link online
              </button>
            </div>
            {editable && (
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold text-red hover:bg-red-soft"
                >
                  Xóa
                </button>
                <button
                  onClick={() => setSendOpen(true)}
                  disabled={items.length === 0}
                  className="h-8 rounded-md bg-accent px-3 text-[12px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
                >
                  Gửi
                </button>
              </div>
            )}
          </div>
        </div>

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
                    onClick={() => removeProductFromCollection(collection.id, p.code)}
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
          <div className="py-16 text-center text-sm text-text-faint">
            Chưa có sản phẩm nào. Vào{" "}
            <Link href="/library" className="text-accent hover:text-accent-hover">
              Design Library
            </Link>{" "}
            và chọn &quot;Add to Collection&quot; trên sản phẩm đã Released.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={sendOpen}
        title="Gửi collection?"
        description={`"${collection.name}" sẽ chuyển sang trạng thái Đã gửi và không thể chỉnh sửa thêm — đúng như một bản đã gửi cho khách hàng/đối tác.`}
        confirmLabel="Gửi"
        onCancel={() => setSendOpen(false)}
        onConfirm={() => {
          sendCollection(collection.id);
          setSendOpen(false);
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
