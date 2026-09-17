"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email hoặc mật khẩu không đúng.");
      setStatus("idle");
      return;
    }
    router.push("/library");
    router.refresh();
  }

  return (
    <main className="flex h-screen w-full items-center justify-center overflow-hidden bg-surface">
      <form onSubmit={handleSubmit} className="flex w-full max-w-[360px] flex-col gap-7">
        <div className="flex flex-col gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Artex Nam An" className="mb-2 h-8 w-auto self-start" />
          <h2 className="text-[22px] font-bold">Đăng nhập</h2>
          <p className="text-sm text-text-muted">Dùng tài khoản công ty được Admin cấp.</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-soft bg-red-soft px-3.5 py-2.5 text-[13px] font-semibold text-red">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-lg border border-line bg-surface px-3.5 text-sm focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Mật khẩu</span>
            <div className="relative flex items-center">
              <input
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-lg border border-line bg-surface px-3.5 pr-11 text-sm focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2.5 flex p-1.5 text-text-faint hover:text-text"
              >
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a21.6 21.6 0 015.06-6.06M9.9 4.24A10.4 10.4 0 0112 4c7 0 11 7 11 7a21.6 21.6 0 01-2.61 3.68" />
                    <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                    <path d="M1 1l22 22" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <div className="flex justify-end">
            <a href="#" className="text-[13px] font-semibold text-accent hover:text-accent-hover">
              Quên mật khẩu?
            </a>
          </div>
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="flex h-[46px] items-center justify-center rounded-lg bg-accent text-sm font-bold text-white shadow-md hover:bg-accent-hover disabled:opacity-80"
        >
          {status === "loading" ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>

        <p className="text-center text-[13px] text-text-faint">
          Chưa có tài khoản? Liên hệ Admin để được cấp quyền.
        </p>
      </form>
    </main>
  );
}
