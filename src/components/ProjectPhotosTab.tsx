"use client";

import { useRef, useState } from "react";
import { useProjectPhotos } from "@/components/ProjectPhotosProvider";
import { useProducts } from "@/components/ProductsProvider";
import { useProjects } from "@/components/ProjectsProvider";
import { NewProductModal } from "@/components/NewProductModal";
import { PhotoViewerModal } from "@/components/PhotoViewerModal";
import { PhotoExportModal } from "@/components/PhotoExportModal";
import { PhotoCommentsModal } from "@/components/PhotoCommentsModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { safeFileName } from "@/lib/exportLayout";
import { canCreateProduct } from "@/lib/permissions";
import { autoSquareCropUrl } from "@/lib/cropImage";
import type { Project, ProjectPhoto, Role } from "@/lib/mock-data";

function stripExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

interface ProjectPhotosTabProps {
  project: Project;
  role: Role;
  userName: string;
}

export function ProjectPhotosTab({ project, role, userName }: ProjectPhotosTabProps) {
  const { photos: allPhotos, addPhotos, deletePhoto, markPhotoReleased, addPhotoComment } = useProjectPhotos();
  const { createProductsBulk } = useProducts();
  const { addProductToProject, addProductsToProjectBulk } = useProjects();
  const canManage = canCreateProduct(role);

  const photos = allPhotos.filter((p) => p.projectCode === project.code);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<ProjectPhoto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectPhoto | null>(null);
  const [commentsTargetId, setCommentsTargetId] = useState<string | null>(null);
  const commentsPhoto = photos.find((p) => p.id === commentsTargetId) ?? null;
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkReleasing, setBulkReleasing] = useState(false);
  const [croppingId, setCroppingId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPhotos = photos.filter((p) => selected.has(p.id));
  // Zip/export act on the selection when there is one, otherwise fall
  // back to the whole folder — mirrors "Release tất cả"'s all-by-default
  // feel elsewhere in this page.
  const activeSet = selectedPhotos.length > 0 ? selectedPhotos : photos;
  const selectedUnreleased = selectedPhotos.filter((p) => !p.releasedProductCode);
  const allSelected = photos.length > 0 && selected.size === photos.length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(photos.map((p) => p.id)));
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    addPhotos(
      project.code,
      files.map((f) => ({ fileName: f.name, url: URL.createObjectURL(f) })),
    );
    e.target.value = "";
  }

  async function handleZip() {
    setZipError("");
    setZipBusy(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      await Promise.all(
        activeSet.map(async (p, i) => {
          const res = await fetch(p.url);
          const blob = await res.blob();
          zip.file(`${i + 1}-${p.fileName}`, blob);
        }),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileName(project.name)}-anh-du-an.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setZipError("Tải ZIP thất bại — thử lại.");
    } finally {
      setZipBusy(false);
    }
  }

  // Photos in the folder keep their original aspect ratio, but a
  // released product's main image is displayed in a fixed square frame
  // everywhere (Sản phẩm dạng up grid, Library) — same auto-crop
  // "Up hàng loạt" already applies, so released products look consistent
  // no matter which path created them.
  async function openRelease(p: ProjectPhoto) {
    setCroppingId(p.id);
    try {
      const cropped = await autoSquareCropUrl(p.url);
      setReleaseTarget({ ...p, url: cropped });
    } finally {
      setCroppingId(null);
    }
  }

  async function handleBulkRelease() {
    if (selectedUnreleased.length === 0) return;
    setBulkReleasing(true);
    try {
      const croppedUrls = await Promise.all(selectedUnreleased.map((p) => autoSquareCropUrl(p.url)));
      const codes = createProductsBulk(
        selectedUnreleased.map((p, i) => ({ name: stripExtension(p.fileName), mainImage: croppedUrls[i] })),
        project.customer,
      );
      addProductsToProjectBulk(project.code, codes, "NEW", role === "RND" ? userName : undefined);
      selectedUnreleased.forEach((p, i) => markPhotoReleased(p.id, codes[i]));
      setSelected(new Set());
      setBulkConfirmOpen(false);
    } finally {
      setBulkReleasing(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          {photos.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-[12.5px] font-semibold text-accent hover:text-accent-hover"
            >
              {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
          )}
          {selected.size > 0 && (
            <span className="text-[12.5px] text-text-faint">Đã chọn {selected.size}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {photos.length > 0 && (
            <>
              <button
                onClick={handleZip}
                disabled={zipBusy}
                className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-bold hover:bg-bg disabled:opacity-40"
              >
                {zipBusy ? "Đang nén…" : selectedPhotos.length > 0 ? `Tải ZIP đã chọn (${activeSet.length})` : `Tải ZIP tất cả (${activeSet.length})`}
              </button>
              <button
                onClick={() => setExportOpen(true)}
                className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-bold hover:bg-bg"
              >
                Xuất ảnh
              </button>
              {canManage && selectedUnreleased.length > 0 && (
                <button
                  onClick={() => setBulkConfirmOpen(true)}
                  className="h-9 rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover"
                >
                  Release hàng loạt ({selectedUnreleased.length})
                </button>
              )}
            </>
          )}
          {canManage && (
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-bold hover:bg-bg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v12M7 8l5-5 5 5" />
                <path d="M5 21h14" />
              </svg>
              Up ảnh
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
            </label>
          )}
        </div>
      </div>

      {zipError && (
        <div className="rounded-lg border border-red-soft bg-red-soft px-3.5 py-2.5 text-[12px] font-semibold text-red">
          {zipError}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {photos.map((p) => {
          const isSelected = selected.has(p.id);
          const photoIndex = photos.findIndex((x) => x.id === p.id);
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => setViewerIndex(photoIndex)}
              onKeyDown={(e) => e.key === "Enter" && setViewerIndex(photoIndex)}
              className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-line bg-surface hover:border-accent/40"
            >
              <div className="relative aspect-square overflow-hidden bg-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.fileName} className="h-full w-full object-cover" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(p.id);
                  }}
                  className={`absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-md border-2 ${
                    isSelected ? "border-accent bg-accent text-white" : "border-white bg-black/25 text-transparent"
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </button>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(p);
                    }}
                    className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white opacity-0 group-hover:opacity-100"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                <div className="truncate text-[12px] font-semibold" title={p.fileName}>
                  {p.fileName}
                </div>
                <div className="flex items-center justify-between gap-2">
                  {p.releasedProductCode ? (
                    <span className="truncate text-[11px] font-bold text-green">Đã release → {p.releasedProductCode}</span>
                  ) : canManage ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openRelease(p);
                      }}
                      disabled={croppingId === p.id}
                      className="h-7 w-fit flex-shrink-0 rounded-md bg-accent px-2.5 text-[11px] font-bold text-white hover:bg-accent-hover disabled:opacity-60"
                    >
                      {croppingId === p.id ? "Đang xử lý…" : "Release"}
                    </button>
                  ) : (
                    <span className="truncate text-[11px] text-text-faint">{p.uploadedAt}</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCommentsTargetId(p.id);
                    }}
                    className="flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-bold text-text-faint hover:bg-bg hover:text-text"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                    </svg>
                    Comment ({p.comments.length})
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {photos.length === 0 && (
        <div className="py-10 text-center text-sm text-text-faint">Chưa có ảnh nào trong dự án này.</div>
      )}

      <PhotoCommentsModal
        photo={commentsPhoto}
        onAddComment={(content) => {
          if (commentsTargetId) addPhotoComment(commentsTargetId, content);
        }}
        onClose={() => setCommentsTargetId(null)}
      />

      {viewerIndex !== null && photos[viewerIndex] && (
        <PhotoViewerModal
          photos={photos}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          comments={{
            items: photos[viewerIndex].comments,
            onAdd: (content) => addPhotoComment(photos[viewerIndex].id, content),
          }}
        />
      )}

      <PhotoExportModal
        open={exportOpen}
        photos={activeSet}
        projectName={project.name}
        defaultCustomer={project.customer}
        onClose={() => setExportOpen(false)}
      />

      {releaseTarget && (
        <NewProductModal
          open
          title="Release ảnh vào sản phẩm mới"
          projectCustomer={project.customer}
          initialMainImage={releaseTarget.url}
          onCancel={() => setReleaseTarget(null)}
          onCreate={(code) => {
            addProductToProject(project.code, code, "NEW", role === "RND" ? userName : undefined);
            markPhotoReleased(releaseTarget.id, code);
            setReleaseTarget(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title="Xóa ảnh?"
        description={`"${deleteTarget?.fileName}" sẽ bị xóa khỏi Sản phẩm dạng ảnh, không khôi phục được.`}
        confirmLabel="Xóa"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deletePhoto(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        title="Release hàng loạt?"
        description={`${selectedUnreleased.length} ảnh đã chọn sẽ trở thành sản phẩm mới (thiếu thông tin, điền chi tiết sau) trong Sản phẩm dạng up.`}
        confirmLabel={bulkReleasing ? "Đang xử lý…" : "Release"}
        confirmDisabled={bulkReleasing}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkRelease}
      />
    </div>
  );
}
