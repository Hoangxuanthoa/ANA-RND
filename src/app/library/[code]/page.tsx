"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useProducts } from "@/components/ProductsProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { NewProductModal } from "@/components/NewProductModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { UploadVersionModal } from "@/components/UploadVersionModal";
import { ROLE_INITIALS, CURRENT_USER_NAME, formatSizeVariantDimensions, type VersionItem } from "@/lib/mock-data";
import {
  productStatusBadge,
  reusePermissionBadge,
  usageBadge,
  projectProductStatusBadge,
  TINT_BG,
  TINT_FG,
} from "@/lib/badges";
import { canManageProduct, canPickProduct, canManageCollections, canEditProduct, canHardDeleteProduct, getPickableProjects } from "@/lib/permissions";
import { AddToCollectionButton } from "@/components/AddToCollectionButton";
import { ImageLightbox } from "@/components/ImageLightbox";
import { useExclusiveGuard } from "@/components/useExclusiveGuard";

const TABS = [
  { key: "versions", label: "Versions" },
  { key: "projects", label: "Used in Projects" },
  { key: "feedback", label: "Feedback" },
] as const;

export default function ProductDetailPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const {
    products,
    favoritedCodes,
    toggleFavorite,
    submitForReview,
    productFeedback,
    addProductFeedback,
    productVersions,
    addProductVersion,
    archiveProduct,
    deleteProduct,
  } = useProducts();
  const { projects, projectProducts, addProductToProject } = useProjects();
  const product = products.find((p) => p.code === params.code);
  const { role, effectiveUserName } = useRole();
  // getPickableProjects still checks Projects' mock ownership fields, so
  // it needs the old per-role fictional name until Projects is wired for
  // real — everything else here checks real Product.designer/exclusiveBy,
  // so it needs the real signed-in name.
  const userName = CURRENT_USER_NAME[role];
  const [assetIndex, setAssetIndex] = useState(0);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("versions");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploadVersionOpen, setUploadVersionOpen] = useState(false);
  const { guardPick, guardModal } = useExclusiveGuard(effectiveUserName);

  if (!product) return notFound();

  const feedback = productFeedback.filter((f) => f.productCode === product.code);
  const realVersions = productVersions.filter((v) => v.productCode === product.code);
  // Every product shows an implicit "V01 — Bản thiết kế gốc" derived from
  // its own creation info, appended after any real versions (which are
  // kept newest-first) so the history always reads as one continuous
  // line back to the origin, never jumping straight from V02 to nothing.
  const impliedV01: VersionItem = { productCode: product.code, number: "V01", note: "Bản thiết kế gốc", by: product.designer, date: product.createdAt };
  const hasRealOrigin = realVersions.some((v) => v.number === "V01");
  const versions = hasRealOrigin ? realVersions : [...realVersions, impliedV01];

  const status = productStatusBadge(product.status);
  const reuse = reusePermissionBadge(product.reuse);
  const images = [product.mainImage, ...(product.images ?? [])].filter((src): src is string => !!src);
  const activeImage = images[Math.min(assetIndex, images.length - 1)];
  const isFavorited = favoritedCodes.has(product.code);
  // product.favorites is a real per-user aggregate now (ProductFavorite
  // rows), already including your own favorite if isFavorited is true —
  // no "+1" compensation needed like the old mock/session-only count did.
  const favoriteCount = product.favorites;
  const usages = projectProducts.filter((pp) => pp.productCode === product.code);
  const reusedCount = usages.filter((u) => u.usage === "REUSE").length;
  const isReleased = product.status === "RELEASED";
  const pickableProjects = getPickableProjects(role, userName, projects);
  // Only set once a design has actually been Released from a (completed)
  // project — not shown for standalone uploads or work still in progress.
  const relatedProject = product.sourceProjectName
    ? projects.find((p) => p.name === product.sourceProjectName)
    : undefined;
  const editable = canEditProduct(role, effectiveUserName, product);
  const hardDelete = canHardDeleteProduct(product, usages.length);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-5 p-7">
        <div className="text-[13px] text-text-faint">
          <Link href="/library" className="text-accent hover:text-accent-hover">
            Library
          </Link>{" "}
          / <span className="text-text">{product.code}</span>
        </div>

        <div className="flex items-start gap-6">
          {/* Asset viewer */}
          <div className="flex flex-1 flex-col gap-3">
            <div
              onClick={() => activeImage && setZoomOpen(true)}
              className={`flex h-[440px] items-center justify-center overflow-hidden rounded-xl border border-line ${
                activeImage ? "cursor-zoom-in" : ""
              } ${images.length === 0 ? TINT_BG[product.tint] : ""}`}
            >
              {activeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeImage} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <svg width="72" height="72" viewBox="0 0 24 24" fill="none" className={TINT_FG[product.tint]} stroke="currentColor" strokeWidth="1.2">
                  <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                  <path d="M3 8v8l9 5 9-5V8" />
                  <path d="M12 13v8" />
                </svg>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button
                    key={src}
                    onClick={() => setAssetIndex(i)}
                    className={`h-[76px] w-[76px] flex-shrink-0 overflow-hidden rounded-lg border-2 ${
                      i === assetIndex ? "border-accent" : "border-transparent hover:border-text-faint"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {images.length === 0 && (
              <div className="text-xs text-text-faint">Chưa có ảnh cho thiết kế này.</div>
            )}
          </div>

          {/* Info panel */}
          <div className="flex w-[360px] flex-shrink-0 flex-col gap-4.5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <span className={status.className}>{status.label}</span>
                  <span className={reuse.className}>{reuse.label}</span>
                </div>
                {editable && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setEditOpen(true)}
                      title="Sửa"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-bg hover:text-text"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteOpen(true)}
                      title={hardDelete ? "Xóa" : "Lưu trữ"}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-red-soft hover:text-red"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="mb-1 text-[21px] font-extrabold">{product.name}</h1>
                  <div className="text-[13px] font-semibold text-text-faint">{product.code}</div>
                </div>
                <button
                  onClick={() => toggleFavorite(product.code)}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold transition ${
                    isFavorited
                      ? "border-red bg-red-soft text-red"
                      : "border-line bg-surface text-text-muted hover:border-red hover:text-red"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
                    <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 000-7.8z" />
                  </svg>
                  {favoriteCount}
                </button>
              </div>
            </div>

            <div>
              {[
                ["Category", product.category],
                ["Material", product.material],
                ["Designer", product.designer],
                ["Origin customer", product.originCustomer],
                ...(relatedProject ? [["Related Project", relatedProject.name]] : []),
                ...(product.color ? [["Màu sắc", product.color]] : []),
              ].map(([label, value]) =>
                label === "Related Project" && relatedProject ? (
                  <Link
                    key={label}
                    href={`/projects/${relatedProject.code}`}
                    className="flex justify-between border-b border-line py-2.5 text-[13px] hover:bg-bg"
                  >
                    <span className="text-text-muted">{label}</span>
                    <span className="font-semibold text-accent hover:text-accent-hover">{value} →</span>
                  </Link>
                ) : (
                  <div key={label} className="flex justify-between border-b border-line py-2.5 text-[13px]">
                    <span className="text-text-muted">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ),
              )}
              {(product.sizeVariants ?? []).map((v, i) => (
                <div key={`size-${i}`} className="flex justify-between border-b border-line py-2.5 text-[13px]">
                  <span className="text-text-muted">Size {v.size}</span>
                  <span className="font-semibold">{formatSizeVariantDimensions(v) ?? "—"}</span>
                </div>
              ))}
            </div>

            {product.description && (
              <p className="text-[13px] leading-relaxed text-text-muted">{product.description}</p>
            )}

            {product.status === "DRAFT" && product.lastRejectionReason && (
              <div className="rounded-lg border border-red-soft bg-red-soft px-3.5 py-3">
                <div className="text-[12px] font-bold text-red">Bị từ chối bởi Admin</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-text">{product.lastRejectionReason}</p>
              </div>
            )}

            {product.status === "PENDING_REVIEW" && (
              <div className="rounded-lg border border-line bg-bg px-3.5 py-3 text-[12.5px] font-semibold text-text-faint">
                Đang chờ Admin duyệt{product.sourceProjectName ? ` — release từ ${product.sourceProjectName}` : ""}.
              </div>
            )}

            <div className="rounded-[10px] bg-bg p-3 text-center">
              <div className="text-lg font-extrabold">{reusedCount}</div>
              <div className="text-[10.5px] font-semibold text-text-faint">Reused</div>
            </div>

            <div className="flex flex-col gap-2">
              {canPickProduct(role) && isReleased && (
                <div className="relative">
                  <button
                    onClick={() => setPickerOpen((v) => !v)}
                    className="inline-flex h-[38px] w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-[13px] font-bold text-white hover:bg-accent-hover"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add to Project
                  </button>
                  {pickerOpen && (
                    <div className="absolute top-11 left-0 z-20 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-md">
                      {pickableProjects.length === 0 && (
                        <p className="p-3 text-[12px] text-text-faint">Không có project nào đang mở để thêm.</p>
                      )}
                      {pickableProjects.map((p) => (
                        <button
                          key={p.code}
                          onClick={() => {
                            guardPick(product, () => addProductToProject(p.code, product.code, "REUSE"));
                            setPickerOpen(false);
                            setAddedNotice(p.name);
                            setTimeout(() => setAddedNotice(null), 2500);
                          }}
                          className="flex w-full flex-col px-3.5 py-2.5 text-left hover:bg-bg"
                        >
                          <span className="text-[12.5px] font-bold">{p.name}</span>
                          <span className="text-[11px] text-text-faint">{p.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {addedNotice && (
                <p className="text-[12px] font-semibold text-green">Đã thêm vào {addedNotice}.</p>
              )}
              {canManageCollections(role) && isReleased && <AddToCollectionButton product={product} />}
              {canManageProduct(role) && product.status === "DRAFT" && (
                <button
                  onClick={() => submitForReview(product.code)}
                  className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-[13px] font-bold hover:bg-bg"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v12M7 8l5-5 5 5" />
                    <path d="M5 21h14" />
                  </svg>
                  Nộp duyệt
                </button>
              )}
              {canManageProduct(role) && isReleased && (
                <button
                  onClick={() => setUploadVersionOpen(true)}
                  className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-[13px] font-bold hover:bg-bg"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v12M7 8l5-5 5 5" />
                    <path d="M5 21h14" />
                  </svg>
                  Upload Version
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`h-[42px] border-b-2 text-[13.5px] font-bold ${
                tab === t.key ? "border-accent text-text" : "border-transparent text-text-faint"
              }`}
            >
              {t.key === "projects"
                ? `${t.label} (${usages.length})`
                : t.key === "feedback"
                  ? `${t.label} (${feedback.length})`
                  : `${t.label} (${versions.length})`}
            </button>
          ))}
        </div>

        {tab === "versions" && (
          <div className="flex flex-col pt-4">
            <p className="mb-3 text-xs text-text-faint">Lịch sử version — không ghi đè, chỉ thêm mới.</p>
            {versions.map((v, i) => (
              <div key={v.number} className="flex items-center gap-4 border-b border-line py-3.5 last:border-b-0">
                {v.image ? (
                  <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.image} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-bg text-xs font-extrabold text-text-muted">
                    {v.number}
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-[13.5px] font-bold">{v.note}</div>
                  <div className="mt-0.5 text-xs text-text-faint">
                    {v.number} · bởi {v.by} · {v.date}
                  </div>
                </div>
                {i === 0 && (
                  <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-1 text-[10.5px] font-bold text-accent-soft-text">
                    Mới nhất
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "projects" && (
          <div className="flex flex-col pt-4">
            {usages.map((u) => {
              const proj = projects.find((p) => p.code === u.projectCode);
              if (!proj) return null;
              const usage = usageBadge(u.usage);
              const s = projectProductStatusBadge(u.status);
              return (
                <Link
                  key={u.projectCode}
                  href={`/projects/${proj.code}`}
                  className="flex items-center gap-4 border-b border-line py-3.5 last:border-b-0 hover:bg-bg"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-soft text-blue">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-bold">{proj.name}</div>
                    <div className="mt-0.5 text-xs text-text-faint">{proj.customer ?? proj.type}</div>
                  </div>
                  <span className={usage.className}>{usage.label}</span>
                  <span className={s.className}>{s.label}</span>
                </Link>
              );
            })}
            {usages.length === 0 && (
              <div className="py-10 text-center text-sm text-text-faint">Chưa được dùng trong project nào.</div>
            )}
          </div>
        )}

        {tab === "feedback" && (
          <div className="flex max-w-[720px] flex-col gap-4 pt-4">
            {feedback.map((f, i) => (
              <div key={i} className="flex gap-3">
                <div className={`flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${TINT_BG[f.tint]} ${TINT_FG[f.tint]}`}>
                  {f.initials}
                </div>
                <div className="flex-1 rounded-[10px] bg-bg p-3.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-[12.5px] font-bold">{f.author}</span>
                    <span className="text-[11.5px] text-text-faint">{f.time}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed">{f.content}</p>
                </div>
              </div>
            ))}
            {feedback.length === 0 && (
              <p className="text-[12.5px] text-text-faint">Chưa có bình luận nào.</p>
            )}
            <div className="flex items-start gap-2.5 pt-1.5">
              <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                {ROLE_INITIALS[role]}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Viết bình luận…"
                  className="min-h-[64px] w-full rounded-[10px] border border-line p-2.5 text-[13px]"
                />
                <button
                  disabled={!commentText.trim()}
                  onClick={() => {
                    addProductFeedback(product.code, commentText.trim());
                    setCommentText("");
                  }}
                  className="inline-flex h-[38px] items-center justify-center self-end rounded-lg bg-accent px-4 text-[13px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
                >
                  Gửi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {zoomOpen && activeImage && (
        <ImageLightbox src={activeImage} alt={product.name} onClose={() => setZoomOpen(false)} />
      )}

      {editOpen && (
        <NewProductModal
          open
          title="Sửa sản phẩm"
          product={product}
          onCancel={() => setEditOpen(false)}
          onCreate={() => setEditOpen(false)}
        />
      )}

      {uploadVersionOpen && (
        <UploadVersionModal
          open
          productName={product.name}
          onCancel={() => setUploadVersionOpen(false)}
          onConfirm={async (note, image) => {
            await addProductVersion(product.code, note, image);
            setUploadVersionOpen(false);
          }}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        danger
        title={hardDelete ? "Xóa sản phẩm?" : "Lưu trữ sản phẩm?"}
        description={
          hardDelete
            ? `"${product.name}" chưa được dùng ở đâu — xóa sẽ mất hoàn toàn, không khôi phục được.`
            : `"${product.name}" đã có lịch sử sử dụng — sẽ chuyển sang trạng thái Archived và giữ nguyên dữ liệu liên quan, không xóa hẳn.`
        }
        confirmLabel={hardDelete ? "Xóa" : "Lưu trữ"}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (hardDelete) {
            deleteProduct(product.code);
            router.push("/library");
          } else {
            archiveProduct(product.code);
          }
          setDeleteOpen(false);
        }}
      />

      {guardModal}
    </div>
  );
}
