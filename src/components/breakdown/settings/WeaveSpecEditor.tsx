"use client";

import { useEffect, useMemo, useState } from "react";
import {
  normalizeRoundSpec,
  ruleWarnings,
  SPEC_DRIVER_LABEL,
  SPEC_FIELD_LABEL,
  SPEC_FIELDS,
  type RoundSpecConfig,
  type SpecField,
  type SpecRow,
} from "@/lib/breakdown/weaveSpec";

const inputClass = "h-8 w-full rounded-md border border-line bg-white px-2 text-[12.5px] focus:border-accent focus:outline-none";

const SHAPES = [
  { key: "round", label: "Round", ready: true },
  { key: "square", label: "Square", ready: false },
  { key: "rectangle", label: "Rectangle", ready: false },
  { key: "oval", label: "Oval", ready: false },
  { key: "ellipse", label: "Ellipse", ready: false },
];

// Settings → "Quy cách hàng đan". Edits the per-shape auto-fill rules the studio
// applies (see lib/breakdown/weaveSpec.ts). Saved explicitly with "Lưu"; saving
// never touches existing products — they only change if their owner presses
// "Áp dụng quy cách" in the studio.
export function WeaveSpecEditor() {
  const [saved, setSaved] = useState<RoundSpecConfig | null>(null);
  const [draft, setDraft] = useState<RoundSpecConfig | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/weave-specs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const cfg = normalizeRoundSpec(data.round);
        setSaved(cfg);
        setDraft(structuredClone(cfg));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  if (!draft) return <p className="text-[13px] text-text-faint">Đang tải…</p>;

  function setRows(field: SpecField, rows: SpecRow[]) {
    setDraft((d) => (d ? { ...d, rules: { ...d.rules, [field]: { ...d.rules[field], rows } } } : d));
    setStatus("idle");
  }

  async function save() {
    if (!draft) return;
    setStatus("saving");
    // Empty/NaN cells from half-typed rows are dropped by the server's normalizer.
    const res = await fetch("/api/weave-specs/round", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: draft }),
    });
    if (!res.ok) {
      setStatus("error");
      return;
    }
    const data = await res.json();
    const cfg = normalizeRoundSpec(data.round);
    setSaved(cfg);
    setDraft(structuredClone(cfg));
    setStatus("saved");
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-lg bg-surface p-3.5 text-[12.5px] leading-relaxed text-text-muted">
        Quy cách để studio <b>tự điền</b> các ô khung sắt theo kích thước sản phẩm. Mỗi dáng một bảng, sửa tự do rồi bấm <b>Lưu</b>. Sản phẩm đã làm không
        bị đổi — chỉ sản phẩm mới, hoặc khi bấm &quot;Áp dụng quy cách&quot; trong sản phẩm.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {SHAPES.map((s) => (
          <span
            key={s.key}
            title={s.ready ? undefined : "Sắp có"}
            className={
              s.key === "round"
                ? "rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-bold text-white"
                : "rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-text-faint opacity-60"
            }
          >
            {s.label}
            {!s.ready && " · sắp có"}
          </span>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <h3 className="text-[13px] font-extrabold">Giá trị cố định (mọi sản phẩm Round)</h3>
        <p className="text-[12px] text-text-faint">
          Kiểu nan dọc liên tục miệng → đáy; đáy và nắp chia nan từ tâm (tất cả đi từ tâm); 1 FI cho tất cả.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-text-muted">
            FI sắt (mm)
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={draft.fixed.diameterMm}
              onChange={(e) => {
                setDraft({ ...draft, fixed: { ...draft.fixed, diameterMm: Number(e.target.value) } });
                setStatus("idle");
              }}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-text-muted">
            Màu khung
            <select
              value={draft.fixed.colorPreset}
              onChange={(e) => {
                setDraft({ ...draft, fixed: { ...draft.fixed, colorPreset: e.target.value as RoundSpecConfig["fixed"]["colorPreset"] } });
                setStatus("idle");
              }}
              className={inputClass}
            >
              <option value="beige">Be</option>
              <option value="black">Đen</option>
              <option value="white">Trắng</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-text-muted">
            Vị trí vòng ngang
            <select
              value={draft.fixed.ringPlacement}
              onChange={(e) => {
                setDraft({ ...draft, fixed: { ...draft.fixed, ringPlacement: e.target.value as "inside" | "outside" } });
                setStatus("idle");
              }}
              className={inputClass}
            >
              <option value="inside">Nằm trong nan dọc</option>
              <option value="outside">Nằm ngoài nan dọc</option>
            </select>
          </label>
        </div>
      </section>

      {SPEC_FIELDS.map((field) => {
        const rule = draft.rules[field];
        const warnings = ruleWarnings(rule.rows);
        return (
          <section key={field} className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[13px] font-extrabold">{SPEC_FIELD_LABEL[field]}</h3>
              <span className="text-[11.5px] text-text-faint">theo {SPEC_DRIVER_LABEL[rule.by]}</span>
            </div>
            {field === "ringCount" && (
              <p className="text-[11.5px] text-text-faint">Vòng ngang đặt cách đều theo chiều cao, đường kính nội suy thẳng từ miệng xuống đáy.</p>
            )}
            {rule.rows.length > 0 && (
              <div className="grid grid-cols-[1fr_1fr_1fr_28px] items-center gap-2 text-[11px] font-bold text-text-muted">
                <span>Từ</span>
                <span>Đến</span>
                <span>{field === "ringCount" ? "Số vòng" : "Số nan"}</span>
                <span />
              </div>
            )}
            {rule.rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_28px] items-center gap-2">
                {(["from", "to", "value"] as const).map((k) => (
                  <input
                    key={k}
                    type="number"
                    value={Number.isNaN(row[k]) ? "" : row[k]}
                    onChange={(e) => {
                      const v = e.target.value === "" ? Number.NaN : Number(e.target.value);
                      setRows(field, rule.rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
                    }}
                    className={inputClass}
                  />
                ))}
                <button
                  type="button"
                  title="Xóa dòng"
                  onClick={() => setRows(field, rule.rows.filter((_, j) => j !== i))}
                  className="flex h-8 w-7 items-center justify-center rounded-md text-[15px] text-text-faint hover:bg-red-soft hover:text-red"
                >
                  ×
                </button>
              </div>
            ))}
            {rule.rows.length === 0 && <p className="text-[12px] italic text-text-faint">Chưa có dòng nào — ô này sẽ để nhập tay.</p>}
            <button
              type="button"
              onClick={() => {
                const last = rule.rows[rule.rows.length - 1];
                setRows(field, [...rule.rows, { from: last ? last.to + 1 : 0, to: last ? last.to + 5 : 0, value: last ? last.value : 0 }]);
              }}
              className="h-8 self-start rounded-md border border-dashed border-line px-3 text-[12px] font-semibold text-text-muted hover:border-accent hover:text-accent"
            >
              + Thêm dòng
            </button>
            {warnings.length > 0 && (
              <ul className="flex flex-col gap-0.5 rounded-md bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
                {warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-line bg-bg py-3">
        {status === "saved" && <span className="text-[12px] font-semibold text-accent">Đã lưu</span>}
        {status === "error" && <span className="text-[12px] font-semibold text-red">Lưu thất bại, thử lại</span>}
        {dirty && status !== "saved" && <span className="text-[12px] text-text-faint">Có thay đổi chưa lưu</span>}
        <button
          type="button"
          onClick={() => {
            if (saved) {
              setDraft(structuredClone(saved));
              setStatus("idle");
            }
          }}
          disabled={!dirty}
          className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-bold hover:bg-bg disabled:opacity-50"
        >
          Hoàn lại
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || status === "saving"}
          className="h-9 rounded-lg bg-accent px-5 text-[12.5px] font-bold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {status === "saving" ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
    </div>
  );
}
