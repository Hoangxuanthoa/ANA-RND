"use client";

import { useState } from "react";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useProducts } from "@/components/ProductsProvider";
import { useSettings } from "@/components/SettingsProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ROLE_LABEL, type Role } from "@/lib/mock-data";
import { canManageSettings } from "@/lib/permissions";

const TABS = [
  { key: "category", label: "Category" },
  { key: "material", label: "Material" },
  { key: "size", label: "Size" },
  { key: "color", label: "Màu sắc" },
  { key: "user", label: "User" },
  { key: "pptx", label: "Mẫu PPTX" },
] as const;

const STAFF_ROLES: Exclude<Role, "CUSTOMER">[] = ["ADMIN", "RND", "SALES", "MARKETING"];

function TagListEditor({
  items,
  usedBy,
  onAdd,
  onRename,
  onRemove,
}: {
  items: string[];
  usedBy: (name: string) => boolean;
  onAdd: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onRemove: (name: string) => void;
}) {
  const [newValue, setNewValue] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newValue.trim()) {
              onAdd(newValue.trim());
              setNewValue("");
            }
          }}
          placeholder="Thêm mới…"
          className="h-9 w-64 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
        />
        <button
          onClick={() => {
            if (!newValue.trim()) return;
            onAdd(newValue.trim());
            setNewValue("");
          }}
          className="h-9 rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover"
        >
          Thêm
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {items.map((item, i) => {
          const inUse = usedBy(item);
          const isEditing = editing === item;
          return (
            <div key={item} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
              {isEditing ? (
                <input
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onRename(item, editValue);
                      setEditing(null);
                    }
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="h-8 flex-1 rounded-md border border-accent px-2.5 text-[13px] focus:outline-none"
                />
              ) : (
                <span className="text-[13.5px] font-semibold">{item}</span>
              )}
              <div className="flex flex-shrink-0 items-center gap-1.5">
                {inUse && (
                  <span className="text-[11px] font-semibold text-text-faint">Đang sử dụng</span>
                )}
                {isEditing ? (
                  <button
                    onClick={() => {
                      onRename(item, editValue);
                      setEditing(null);
                    }}
                    className="h-7 rounded-md bg-accent px-2.5 text-[11px] font-bold text-white hover:bg-accent-hover"
                  >
                    Lưu
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditing(item);
                      setEditValue(item);
                    }}
                    title="Sửa"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-bg hover:text-text"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => setRemoveTarget(item)}
                  disabled={inUse}
                  title={inUse ? "Đang được dùng, không thể xóa" : "Xóa"}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-red-soft hover:text-red disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-faint"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="px-4 py-6 text-center text-[12.5px] text-text-faint">Chưa có mục nào.</div>}
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        danger
        title="Xóa mục này?"
        description={`"${removeTarget}" sẽ bị xóa khỏi danh sách. Thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) onRemove(removeTarget);
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}

function UserTab() {
  const { staff, addStaff, updateStaffRole, removeStaff } = useSettings();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Exclude<Role, "CUSTOMER">>("SALES");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const removeTarget = staff.find((s) => s.id === removeId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên nhân viên…"
          className="h-9 w-56 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Exclude<Role, "CUSTOMER">)}
          className="h-9 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none"
        >
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            if (!name.trim()) return;
            addStaff(name.trim(), role);
            setName("");
          }}
          className="h-9 rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover"
        >
          Thêm
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {staff.map((s, i) => (
          <div key={s.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
            <span className="text-[13.5px] font-semibold">{s.name}</span>
            <div className="flex items-center gap-2">
              <select
                value={s.role}
                onChange={(e) => updateStaffRole(s.id, e.target.value as Exclude<Role, "CUSTOMER">)}
                className="h-8 rounded-md border border-line px-2 text-[12.5px] focus:border-accent focus:outline-none"
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setRemoveId(s.id)}
                title="Xóa"
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-red-soft hover:text-red"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        danger
        title="Xóa người dùng?"
        description={`"${removeTarget?.name}" sẽ không còn xuất hiện trong các danh sách gán việc / phụ trách nữa.`}
        confirmLabel="Xóa"
        onCancel={() => setRemoveId(null)}
        onConfirm={() => {
          if (removeId) removeStaff(removeId);
          setRemoveId(null);
        }}
      />
    </div>
  );
}

function PptxBackgroundPicker({
  label,
  image,
  onPick,
  onClear,
}: {
  label: string;
  image?: string;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold">{label}</span>
      <div className="flex items-center gap-3">
        {image ? (
          <div className="relative h-24 w-40 flex-shrink-0 overflow-hidden rounded-lg border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-full w-full object-cover" />
            <button
              onClick={onClear}
              className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex h-24 w-40 flex-shrink-0 items-center justify-center rounded-lg bg-accent px-2 text-center text-[11px] font-semibold text-white">
            Mặc định (nền xanh thương hiệu)
          </div>
        )}
        <label className="flex h-9 cursor-pointer items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-bold hover:bg-bg">
          {image ? "Đổi ảnh" : "Tải ảnh lên"}
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
      </div>
    </div>
  );
}

function PptxTemplateTab() {
  const { pptxTemplate, updatePptxTemplate } = useSettings();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[12.5px] text-text-faint">
        Áp dụng cho mọi lượt xuất PPTX của cả team (trang thông tin sản phẩm giữ nguyên bố cục cố định, không
        chỉnh ở đây). Ảnh lưu tạm trong trình duyệt — mất khi tải lại trang, giống ảnh sản phẩm.
      </p>

      <PptxBackgroundPicker
        label="Ảnh nền trang bìa"
        image={pptxTemplate.coverImage}
        onPick={(file) => updatePptxTemplate({ coverImage: URL.createObjectURL(file) })}
        onClear={() => updatePptxTemplate({ coverImage: undefined })}
      />

      <PptxBackgroundPicker
        label="Ảnh nền trang cuối"
        image={pptxTemplate.closingImage}
        onPick={(file) => updatePptxTemplate({ closingImage: URL.createObjectURL(file) })}
        onClear={() => updatePptxTemplate({ closingImage: undefined })}
      />

      <label className="flex max-w-sm flex-col gap-1.5">
        <span className="text-[13px] font-bold">Chữ trang cuối</span>
        <input
          value={pptxTemplate.closingText}
          onChange={(e) => updatePptxTemplate({ closingText: e.target.value })}
          className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
        />
      </label>
    </div>
  );
}

export default function SettingsPage() {
  const { role } = useRole();
  const {
    products,
    categories,
    materials,
    sizes,
    colors,
    addCategory,
    renameCategory,
    removeCategory,
    addMaterial,
    renameMaterial,
    removeMaterial,
    addSize,
    renameSize,
    removeSize,
    addColor,
    renameColor,
    removeColor,
  } = useProducts();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("category");

  if (!canManageSettings(role)) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <TopNav />
        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-bg text-text-faint">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 018 0v3" />
            </svg>
          </div>
          <h2 className="text-[17px] font-extrabold">Không có quyền truy cập</h2>
          <p className="max-w-[360px] text-center text-sm text-text-muted">Cài đặt hệ thống chỉ dành cho Admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-5 p-7">
        <div>
          <h1 className="mb-1 text-[22px] font-extrabold">Cài đặt hệ thống</h1>
          <p className="text-[13.5px] text-text-muted">Quản lý Category, Material, Size, Màu sắc và người dùng nội bộ.</p>
        </div>

        <div className="flex gap-6 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`h-[42px] border-b-2 text-[13.5px] font-bold ${
                tab === t.key ? "border-accent text-text" : "border-transparent text-text-faint"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "category" && (
          <TagListEditor
            items={categories}
            usedBy={(name) => products.some((p) => p.category === name)}
            onAdd={addCategory}
            onRename={renameCategory}
            onRemove={removeCategory}
          />
        )}

        {tab === "material" && (
          <TagListEditor
            items={materials}
            usedBy={(name) => products.some((p) => p.material === name)}
            onAdd={addMaterial}
            onRename={renameMaterial}
            onRemove={removeMaterial}
          />
        )}

        {tab === "size" && (
          <TagListEditor
            items={sizes}
            usedBy={(name) => products.some((p) => p.sizeVariants?.some((v) => v.size === name))}
            onAdd={addSize}
            onRename={renameSize}
            onRemove={removeSize}
          />
        )}

        {tab === "color" && (
          <TagListEditor
            items={colors}
            usedBy={(name) => products.some((p) => p.color === name)}
            onAdd={addColor}
            onRename={renameColor}
            onRemove={removeColor}
          />
        )}

        {tab === "user" && <UserTab />}

        {tab === "pptx" && <PptxTemplateTab />}
      </div>
    </div>
  );
}
