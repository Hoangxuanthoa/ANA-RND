"use client";

import { useEffect, useMemo, useState } from "react";
import {
  normalizeSpec,
  ruleWarnings,
  SHAPE_SPEC_DEFS,
  SPEC_DRIVER_LABEL,
  SPEC_SHAPE_LABEL,
  SPEC_SHAPES,
  type ShapeSpecConfig,
  type SpecDriver,
  type SpecRow,
  type SpecShape,
} from "@/lib/breakdown/weaveSpec";

const inputClass = "h-8 w-full rounded-md border border-line bg-white px-2 text-[12.5px] focus:border-accent focus:outline-none";

type Configs = Record<SpecShape, ShapeSpecConfig>;

// Cài đặt Bóc tách → "Quy cách hàng đan". Edits the per-shape auto-fill rules the
// studio applies (see lib/breakdown/weaveSpec.ts). Saved explicitly with "Lưu"
// (one shape at a time); saving never touches existing products — they only
// change if their owner presses "Áp dụng quy cách" in the studio.
export function WeaveSpecEditor() {
  const [saved, setSaved] = useState<Configs | null>(null);
  const [drafts, setDrafts] = useState<Configs | null>(null);
  const [shape, setShape] = useState<SpecShape>("round");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/weave-specs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const all = Object.fromEntries(SPEC_SHAPES.map((s) => [s, normalizeSpec(s, data.specs?.[s])])) as Configs;
        setSaved(all);
        setDrafts(structuredClone(all));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirtyShapes = useMemo(
    () => (saved && drafts ? SPEC_SHAPES.filter((s) => JSON.stringify(saved[s]) !== JSON.stringify(drafts[s])) : []),
    [saved, drafts],
  );

  if (!drafts || !saved) return <p className="text-[13px] text-text-faint">Đang tải…</p>;

  const def = SHAPE_SPEC_DEFS[shape];
  const draft = drafts[shape];
  const dirty = dirtyShapes.includes(shape);

  function update(fn: (d: ShapeSpecConfig) => ShapeSpecConfig) {
    setDrafts((all) => (all ? { ...all, [shape]: fn(all[shape]) } : all));
    setStatus("idle");
  }
  const setRows = (key: string, rows: SpecRow[]) => update((d) => ({ ...d, rules: { ...d.rules, [key]: { ...d.rules[key], rows } } }));
  const setDriver = (key: string, by: SpecDriver) => update((d) => ({ ...d, rules: { ...d.rules, [key]: { ...d.rules[key], by } } }));

  async function save() {
    setStatus("saving");
    // Empty/NaN cells from half-typed rows are dropped by the server's normalizer.
    const res = await fetch(`/api/weave-specs/${shape}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: draft }),
    });
    if (!res.ok) {
      setStatus("error");
      return;
    }
    const data = await res.json();
    const cfg = normalizeSpec(shape, data.config);
    setSaved((s) => (s ? { ...s, [shape]: cfg } : s));
    setDrafts((d) => (d ? { ...d, [shape]: structuredClone(cfg) } : d));
    setStatus("saved");
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-lg bg-surface p-3.5 text-[12.5px] leading-relaxed text-text-muted">
        Quy cách để studio <b>tự điền</b> các ô khung sắt theo kích thước sản phẩm. Mỗi dáng một bảng, sửa tự do rồi bấm <b>Lưu</b> (lưu từng dáng). Sản phẩm đã làm không
        bị đổi — chỉ sản phẩm mới, hoặc khi bấm &quot;Áp dụng quy cách&quot; trong sản phẩm.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {SPEC_SHAPES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setShape(s);
              setStatus("idle");
            }}
            className={
              s === shape
                ? "rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-bold text-white"
                : "rounded-md border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-text-muted hover:text-text"
            }
          >
            {SPEC_SHAPE_LABEL[s]}
            {dirtyShapes.includes(s) && <span title="Có thay đổi chưa lưu"> ●</span>}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <h3 className="text-[13px] font-extrabold">Giá trị cố định (mọi sản phẩm {SPEC_SHAPE_LABEL[shape]})</h3>
        {def.fixedNote && <p className="text-[12px] text-text-faint">{def.fixedNote}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-text-muted">
            FI sắt (mm)
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={draft.fixed.diameterMm}
              onChange={(e) => update((d) => ({ ...d, fixed: { ...d.fixed, diameterMm: Number(e.target.value) } }))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-text-muted">
            Màu khung
            <select
              value={draft.fixed.colorPreset}
              onChange={(e) => update((d) => ({ ...d, fixed: { ...d.fixed, colorPreset: e.target.value as ShapeSpecConfig["fixed"]["colorPreset"] } }))}
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
              onChange={(e) => update((d) => ({ ...d, fixed: { ...d.fixed, ringPlacement: e.target.value as "inside" | "outside" } }))}
              className={inputClass}
            >
              <option value="inside">Nằm trong nan dọc</option>
              <option value="outside">Nằm ngoài nan dọc</option>
            </select>
          </label>
          {def.fixedOptions.map((o) => (
            <label key={o.key} className="flex flex-col gap-1 text-[11.5px] font-semibold text-text-muted">
              {o.label}
              <select
                value={draft.fixed.options[o.key] ?? o.defaultValue}
                onChange={(e) => update((d) => ({ ...d, fixed: { ...d.fixed, options: { ...d.fixed.options, [o.key]: e.target.value } } }))}
                className={inputClass}
              >
                {o.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      {def.fields.map((field) => {
        const rule = draft.rules[field.key];
        const warnings = ruleWarnings(rule.rows);
        return (
          <section key={field.key} className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-extrabold">{field.label}</h3>
              <label className="flex items-center gap-1.5 text-[11.5px] text-text-faint">
                theo
                <select value={rule.by} onChange={(e) => setDriver(field.key, e.target.value as SpecDriver)} className="h-7 rounded-md border border-line bg-white px-1.5 text-[11.5px] font-semibold text-text">
                  {field.drivers.map((d) => (
                    <option key={d} value={d}>
                      {SPEC_DRIVER_LABEL[d]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {field.hint && <p className="text-[11.5px] text-text-faint">{field.hint}</p>}
            {rule.rows.length > 0 && (
              <div className="grid grid-cols-[1fr_1fr_1fr_28px] items-center gap-2 text-[11px] font-bold text-text-muted">
                <span>Từ</span>
                <span>Đến</span>
                <span>{field.unit === "vòng" ? "Số vòng" : "Số nan"}</span>
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
                      setRows(field.key, rule.rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
                    }}
                    className={inputClass}
                  />
                ))}
                <button
                  type="button"
                  title="Xóa dòng"
                  onClick={() => setRows(field.key, rule.rows.filter((_, j) => j !== i))}
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
                setRows(field.key, [...rule.rows, { from: last ? last.to + 1 : 0, to: last ? last.to + 5 : 0, value: last ? last.value : 0 }]);
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
        {status === "saved" && <span className="text-[12px] font-semibold text-accent">Đã lưu {SPEC_SHAPE_LABEL[shape]}</span>}
        {status === "error" && <span className="text-[12px] font-semibold text-red">Lưu thất bại, thử lại</span>}
        {dirty && status !== "saved" && <span className="text-[12px] text-text-faint">{SPEC_SHAPE_LABEL[shape]}: có thay đổi chưa lưu</span>}
        <button
          type="button"
          onClick={() => {
            setDrafts((d) => (d ? { ...d, [shape]: structuredClone(saved[shape]) } : d));
            setStatus("idle");
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
          {status === "saving" ? "Đang lưu…" : `Lưu ${SPEC_SHAPE_LABEL[shape]}`}
        </button>
      </div>
    </div>
  );
}
