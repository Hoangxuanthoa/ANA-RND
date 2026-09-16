"use client";

import { useState } from "react";
import { ROLE_LABEL, initialsFromName, type Role } from "@/lib/mock-data";
import { TINT_AVATAR_BG } from "@/lib/badges";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface ProfileModalProps {
  open: boolean;
  role: Role;
  name: string;
  email: string;
  phone: string;
  onSave: (patch: { phone: string }) => void;
  onCancel: () => void;
}

export function ProfileModal({ open, role, name, email, phone, onSave, onCancel }: ProfileModalProps) {
  const [phoneInput, setPhoneInput] = useState(phone);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const wantsPasswordChange = currentPassword || newPassword || confirmPassword;
    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordError("Điền đủ cả 3 ô để đổi mật khẩu.");
        return;
      }
      if (newPassword.length < 6) {
        setPasswordError("Mật khẩu mới cần ít nhất 6 ký tự.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError("Xác nhận mật khẩu mới không khớp.");
        return;
      }
    }
    setPasswordError("");
    onSave({ phone: phoneInput });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-[400px] flex-col gap-4 overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-md"
      >
        <h3 className="text-[15px] font-bold">Cập nhật thông tin</h3>

        <div className="flex items-center gap-3 rounded-lg bg-bg p-3">
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${TINT_AVATAR_BG[role]}`}
          >
            {initialsFromName(name)}
          </div>
          <div>
            <p className="text-[13.5px] font-bold">{name}</p>
            <p className="text-[12px] text-text-faint">{ROLE_LABEL[role]}</p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Email</span>
          <input
            type="email"
            value={email}
            disabled
            className="h-10 rounded-lg border border-line bg-bg px-3 text-[13px] text-text-faint"
          />
          <span className="text-[11.5px] text-text-faint">Email đăng nhập — chưa hỗ trợ đổi tại đây.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Số điện thoại</span>
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>

        <div className="flex flex-col gap-1 border-t border-line pt-3.5">
          <span className="text-[12.5px] font-semibold">Đổi mật khẩu</span>
          <span className="text-[11.5px] text-text-faint">Để trống nếu không muốn đổi.</span>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Mật khẩu hiện tại</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Mật khẩu mới</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Xác nhận mật khẩu mới</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-10 rounded-lg border border-line px-3 text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
          />
        </label>

        {passwordError && <p className="text-[12px] font-semibold text-red">{passwordError}</p>}

        <div className="mt-1 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setConfirmCloseOpen(true)}
            className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-bg"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover"
          >
            Lưu
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmCloseOpen}
        danger
        title="Hủy thao tác?"
        description="Thông tin bạn vừa sửa sẽ không được lưu lại. Bạn có chắc muốn thoát không?"
        confirmLabel="Thoát"
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={() => {
          setConfirmCloseOpen(false);
          onCancel();
        }}
      />
    </div>
  );
}
