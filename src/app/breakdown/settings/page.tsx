"use client";

import { useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { useRole } from "@/components/RoleProvider";
import { canViewBreakdown } from "@/lib/permissions";
import { useBreakdownSettingsAccess } from "@/components/breakdown/settings/useBreakdownSettingsAccess";
import { WeaveSpecEditor } from "@/components/breakdown/settings/WeaveSpecEditor";
import { SettingsAccessTab } from "@/components/breakdown/settings/SettingsAccessTab";

// "Cài đặt Bóc tách" — settings that belong to the Bóc tách module (so they live
// here, not in the system-wide Settings). Admin always has it; other roles only
// when Admin switched them on in the "Phân quyền" tab (Admin-only tab).
export default function BreakdownSettingsPage() {
  const { role } = useRole();
  const access = useBreakdownSettingsAccess();
  const isAdmin = role === "ADMIN";
  const tabs = [{ key: "weave", label: "Quy cách hàng đan" }, ...(isAdmin ? [{ key: "access", label: "Phân quyền" }] : [])];
  const [tab, setTab] = useState("weave");

  const denied = !canViewBreakdown(role) || (access.loaded && !access.canOpen);
  if (denied) {
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
          <p className="max-w-[380px] text-center text-sm text-text-muted">Cài đặt Bóc tách chỉ dành cho Admin, hoặc vai trò được Admin cho phép.</p>
          <Link href="/breakdown" className="text-[13px] font-semibold text-accent hover:underline">
            ← Về Bóc tách kỹ thuật
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-5 p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-[17px] font-extrabold">Cài đặt Bóc tách</h1>
          <Link href="/breakdown" className="rounded-md border border-line bg-white px-3 py-1 text-[12.5px] font-semibold text-text-muted hover:bg-bg hover:text-text">
            ← Bóc tách kỹ thuật
          </Link>
        </div>
        <div className="flex gap-6 border-b border-line">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`h-[42px] border-b-2 text-[13.5px] font-bold ${tab === t.key ? "border-accent text-text" : "border-transparent text-text-faint"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {!access.loaded ? <p className="text-[13px] text-text-faint">Đang tải…</p> : tab === "weave" ? <WeaveSpecEditor /> : <SettingsAccessTab />}
      </div>
    </div>
  );
}
