"use client";

import { useState } from "react";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { useProducts } from "@/components/ProductsProvider";
import { useSettings } from "@/components/SettingsProvider";
import { useStaff } from "@/components/StaffProvider";
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
  const { staff, addStaff, updateStaffRole, removeStaff, resetPassword } = useStaff();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Exclude<Role, "CUSTOMER">>("SALES");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const removeTarget = staff.find((s) => s.id === removeId) ?? null;
  // Which row's "Đặt lại mật khẩu" form is open — at most one at a time.
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetValue, setResetValue] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  function openReset(id: string) {
    setResetTargetId(id);
    setResetValue("");
    setResetError(null);
  }

  async function handleResetPassword(id: string) {
    if (!resetValue.trim()) {
      setResetError("Nhập mật khẩu mới.");
      return;
    }
    setResetError(null);
    setResetting(true);
    const { error } = await resetPassword(id, resetValue.trim());
    setResetting(false);
    if (error) {
      setResetError(error);
      return;
    }
    setResetTargetId(null);
  }

  async function handleAdd() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Điền đủ Tên, Email và Mật khẩu tạm.");
      return;
    }
    setError(null);
    setCreating(true);
    const { error } = await addStaff({ name: name.trim(), email: email.trim(), role, password: password.trim() });
    setCreating(false);
    if (error) {
      setError(error);
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên nhân viên…"
          className="h-9 w-40 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email đăng nhập…"
          className="h-9 w-52 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu tạm…"
          className="h-9 w-36 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
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
          onClick={handleAdd}
          disabled={creating}
          className="h-9 rounded-lg bg-accent px-3.5 text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {creating ? "Đang tạo…" : "Thêm"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-soft bg-red-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-red">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {staff.map((s, i) => (
          <div key={s.id} className={i > 0 ? "border-t border-line" : ""}>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-[13.5px] font-semibold">{s.name}</div>
                <div className="text-[11.5px] text-text-faint">{s.email}</div>
              </div>
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
                  onClick={() => (resetTargetId === s.id ? setResetTargetId(null) : openReset(s.id))}
                  title="Đặt lại mật khẩu"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-bg hover:text-text"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </button>
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

            {resetTargetId === s.id && (
              <div className="flex items-center gap-2 border-t border-line bg-bg px-4 py-3">
                <span className="text-[12.5px] font-semibold text-text-muted">Mật khẩu mới cho {s.name}:</span>
                <input
                  autoFocus
                  value={resetValue}
                  onChange={(e) => setResetValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword(s.id)}
                  placeholder="Mật khẩu mới…"
                  className="h-8 w-44 rounded-md border border-line bg-surface px-2.5 text-[12.5px] focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => handleResetPassword(s.id)}
                  disabled={resetting}
                  className="h-8 rounded-md bg-accent px-3 text-[12px] font-bold text-white hover:bg-accent-hover disabled:opacity-40"
                >
                  {resetting ? "Đang lưu…" : "Lưu"}
                </button>
                <button
                  onClick={() => setResetTargetId(null)}
                  className="h-8 rounded-md border border-line bg-surface px-3 text-[12px] font-bold hover:bg-bg"
                >
                  Hủy
                </button>
                {resetError && <span className="text-[12px] font-semibold text-red">{resetError}</span>}
              </div>
            )}
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
