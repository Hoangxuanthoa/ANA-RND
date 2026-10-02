"use client";

import { useState } from "react";
import { createDefaultMaterial, withSplitAdded, withSplitMoved, withSplitRemoved, type MaterialBand, type MaterialInput, type MaterialZoneSettings } from "@/lib/breakdown/geometry/types";
import { Field, inputClass } from "./field";

const ROTATIONS = [0, 90, 180, 270] as const;
const NUDGE_STEP = 0.05;

function mod1(x: number): number {
  return ((x % 1) + 1) % 1;
}

// A plain controlled <input> that clamps+commits on every keystroke fights
// the user mid-typing (e.g. typing "250" over an already-clamped "299":
// each intermediate digit gets immediately re-clamped and the input's
// displayed text yanked out from under the cursor). Keeps its own local
// text while typing and only commits (clamping happens on the receiving
// end, withSplitMoved) on blur/Enter — same "commit on blur, not on every
// keystroke" pattern DimText already uses in TechnicalDrawing.tsx.
function SplitZInput({ value, onCommit }: { value: number; onCommit: (z: number) => void }) {
  const [text, setText] = useState(() => String(Math.round(value)));
  function commit() {
    const n = Number(text);
    if (Number.isFinite(n)) onCommit(n);
    else setText(String(Math.round(value)));
  }
  return (
    <input
      type="number"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={inputClass + " h-8 flex-1"}
    />
  );
}

// Splits the currently-LARGEST gap (rather than always the whole [minZ,
// maxZ] range) so repeated "+ Thêm khoang" clicks keep subdividing whatever
// is biggest right now, instead of piling new splits on top of each other
// near the middle.
function addMidpointSplit(material: MaterialInput, minZ: number, maxZ: number): MaterialInput {
  const bounds = [minZ, ...[...material.splits].sort((a, b) => a - b), maxZ];
  let bestGap = -1;
  let bestMid = (minZ + maxZ) / 2;
  for (let i = 0; i < bounds.length - 1; i++) {
    const gap = bounds[i + 1] - bounds[i];
    if (gap > bestGap) {
      bestGap = gap;
      bestMid = (bounds[i] + bounds[i + 1]) / 2;
    }
  }
  return withSplitAdded(material, Math.round(bestMid));
}

function ZoneControls({ value, onChange }: { value: MaterialZoneSettings; onChange: (next: MaterialZoneSettings) => void }) {
  const nudgeBtn = "flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-[13px] font-bold text-text-muted hover:bg-bg hover:text-text";
  return (
    <div className="flex flex-col gap-2.5">
      <Field label="Hướng vân">
        <div className="flex items-center gap-1 rounded-md border border-line bg-white p-0.5">
          {ROTATIONS.map((deg) => (
            <button
              key={deg}
              type="button"
              onClick={() => onChange({ ...value, rotationDeg: deg })}
              className={
                value.rotationDeg === deg
                  ? "flex-1 rounded bg-accent px-2 py-1.5 text-[12px] font-bold text-white"
                  : "flex-1 rounded px-2 py-1.5 text-[12px] font-semibold text-text-muted hover:bg-bg"
              }
            >
              {deg}°
            </button>
          ))}
        </div>
      </Field>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...value, flipX: !value.flipX })}
          className={
            value.flipX
              ? "flex-1 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-bold text-white"
              : "flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:text-text"
          }
        >
          Lật ngang
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, flipY: !value.flipY })}
          className={
            value.flipY
              ? "flex-1 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-bold text-white"
              : "flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:text-text"
          }
        >
          Lật dọc
        </button>
      </div>

      <Field label="Di chuyển map">
        <div className="grid w-fit grid-cols-3 gap-1">
          <span />
          <button type="button" className={nudgeBtn} onClick={() => onChange({ ...value, offsetY: mod1(value.offsetY + NUDGE_STEP) })}>
            ▲
          </button>
          <span />
          <button type="button" className={nudgeBtn} onClick={() => onChange({ ...value, offsetX: mod1(value.offsetX - NUDGE_STEP) })}>
            ◀
          </button>
          <button
            type="button"
            className={nudgeBtn + " text-[10px]"}
            onClick={() => onChange({ ...value, offsetX: 0, offsetY: 0 })}
            title="Về vị trí gốc"
          >
            ⟲
          </button>
          <button type="button" className={nudgeBtn} onClick={() => onChange({ ...value, offsetX: mod1(value.offsetX + NUDGE_STEP) })}>
            ▶
          </button>
          <span />
          <button type="button" className={nudgeBtn} onClick={() => onChange({ ...value, offsetY: mod1(value.offsetY - NUDGE_STEP) })}>
            ▼
          </button>
          <span />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Chỉnh to nhỏ (Chiều ngang)">
          <input
            type="number"
            min={0.25}
            max={40}
            step={0.25}
            value={value.repeatX}
            onChange={(e) => onChange({ ...value, repeatX: Math.max(0.25, Number(e.target.value) || 1) })}
            className={inputClass}
          />
        </Field>
        <Field label="Chỉnh to nhỏ (Chiều cao)">
          <input
            type="number"
            min={0.25}
            max={40}
            step={0.25}
            value={value.repeatY}
            onChange={(e) => onChange({ ...value, repeatY: Math.max(0.25, Number(e.target.value) || 1) })}
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );
}

// Lets a band/zone use its OWN image instead of the shared/default upload —
// most khoang just reuse the shared one, so this stays a small opt-in row
// rather than a full second upload widget.
function BandImageRow({ band, sharedImageUrl, onChange }: { band: MaterialBand; sharedImageUrl: string | null; onChange: (next: MaterialBand) => void }) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...band, imageDataUrl: reader.result as string });
    reader.readAsDataURL(file);
  }
  const previewUrl = band.imageDataUrl ?? sharedImageUrl;
  return (
    <div className="flex items-center gap-2 rounded-md bg-bg px-2.5 py-2">
      {previewUrl && <img src={previewUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded border border-line object-cover" />}
      <div className="flex flex-col gap-0.5">
        <label className="cursor-pointer text-[11.5px] font-semibold text-accent hover:underline">
          {band.imageDataUrl ? "Đổi ảnh riêng" : "Dùng ảnh riêng cho phần này"}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
        {band.imageDataUrl && (
          <button type="button" onClick={() => onChange({ ...band, imageDataUrl: null })} className="text-left text-[11px] font-semibold text-text-muted hover:text-text">
            Dùng lại ảnh chung
          </button>
        )}
      </div>
    </div>
  );
}

type TabKey = string; // a band's id, or "bottom" | "lid" | "ringTube"

export function MaterialForm({
  value,
  onChange,
  bodyZRange,
}: {
  value: MaterialInput;
  onChange: (next: MaterialInput) => void;
  bodyZRange: { minZ: number; maxZ: number };
}) {
  const [activeTab, setActiveTab] = useState<TabKey>(() => value.bands[value.bands.length - 1]?.id ?? "bottom-band");
  // Resets `activeTab` whenever it stops pointing at a real band — most
  // notably right after "Xóa vật liệu" + a fresh upload, which builds a
  // brand-new `bands` array (via createDefaultMaterial) with FRESH random
  // ids, orphaning whatever band id was selected before. Adjusting state
  // directly in the render body (React's own sanctioned pattern for
  // resetting state from a prop change — see the useState docs' "storing
  // information from previous renders" section) rather than a useEffect:
  // an effect would still leave `activeTab` stale for the ENTIRE render
  // that follows a bands change (nothing highlighted, edits going nowhere)
  // before catching up a tick later.
  const validTabKeys = new Set<TabKey>(["bottom-band", "lid", "ringTube", ...value.bands.map((b) => b.id)]);
  if (!validTabKeys.has(activeTab)) {
    setActiveTab(value.bands[value.bands.length - 1]?.id ?? "bottom-band");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ ...createDefaultMaterial(), imageDataUrl: reader.result as string, enabled: true });
    };
    reader.readAsDataURL(file);
  }

  if (!value.imageDataUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed border-line bg-surface p-6 text-center">
        <span className="text-[13px] font-semibold text-text-muted">Vật liệu (texture) cho Solid</span>
        <label className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-[12.5px] font-bold text-white hover:bg-accent-hover">
          Tải ảnh vật liệu lên
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
      </div>
    );
  }

  // Display top-to-bottom (matches how "Vòng ngang 1, 2, …" already numbers
  // from the mouth down elsewhere in the app), even though the underlying
  // `bands`/`splits` arrays are stored bottom-to-top (ascending Z).
  const bodyTabs = value.bands.map((band, i) => ({ key: band.id, label: `Khoang ${value.bands.length - i}`, band, splitIndexBelow: i - 1 })).reverse();
  const activeBand =
    activeTab === "bottom-band" ? value.bottom : activeTab === "lid" ? value.lid : activeTab === "ringTube" ? value.ringTube : bodyTabs.find((t) => t.key === activeTab)?.band;

  function updateBodyBand(id: string, next: MaterialBand) {
    onChange({ ...value, bands: value.bands.map((b) => (b.id === id ? next : b)) });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wide text-text-muted uppercase">Vật liệu (texture)</span>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-[12px] font-semibold text-accent hover:underline">
            Đổi ảnh chung
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>
          <button type="button" onClick={() => onChange(createDefaultMaterial())} className="text-[12px] font-semibold text-red hover:underline">
            Xóa vật liệu
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <img src={value.imageDataUrl} alt="Vật liệu" className="h-14 w-14 flex-shrink-0 rounded-md border border-line object-cover" />
        <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          Áp vào Solid (bỏ tick để xem lại màu trơn)
        </label>
      </div>

      <p className="text-[11px] text-text-faint">
        Thân chia thành nhiều khoang, mỗi khoang tự chọn ảnh/hướng/tỷ lệ riêng. Đáy/Nắp/Ống đường ngang trải ảnh kiểu khác thân nên cũng tự chỉnh riêng.
      </p>

      <div className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-white p-0.5">
        {bodyTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={
              activeTab === t.key
                ? "rounded bg-accent px-2 py-1.5 text-[12px] font-bold text-white"
                : "rounded px-2 py-1.5 text-[12px] font-semibold text-text-muted hover:bg-bg"
            }
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(addMidpointSplit(value, bodyZRange.minZ, bodyZRange.maxZ))}
          className="rounded px-2 py-1.5 text-[12px] font-bold text-accent hover:bg-accent-soft"
          title="Chia thêm 1 khoang, tự cắt ở giữa khoang lớn nhất"
        >
          + Khoang
        </button>
      </div>

      {value.splits.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md bg-bg p-2.5">
          <span className="text-[11px] font-bold tracking-wide text-text-muted uppercase">Mốc chia khoang (Z, mm)</span>
          {value.splits
            .map((z, i) => ({ z, i }))
            .reverse()
            .map(({ z, i }) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 flex-shrink-0 text-[11.5px] font-semibold text-text-muted">Mốc {value.splits.length - i}</span>
                <SplitZInput
                  key={Math.round(z)}
                  value={z}
                  onCommit={(next) => onChange(withSplitMoved(value, i, next, bodyZRange.minZ, bodyZRange.maxZ))}
                />
                <button
                  type="button"
                  onClick={() => onChange(withSplitRemoved(value, i))}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-line bg-white text-[13px] font-bold text-text-muted hover:text-red"
                  title="Xóa mốc này"
                >
                  ×
                </button>
              </div>
            ))}
        </div>
      )}

      <div className="flex items-center gap-1 rounded-md border border-line bg-white p-0.5">
        {[
          { key: "bottom-band" as TabKey, label: "Đáy" },
          { key: "lid" as TabKey, label: "Nắp" },
          { key: "ringTube" as TabKey, label: "Ống đường ngang" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={
              activeTab === t.key
                ? "flex-1 rounded bg-accent px-2 py-1.5 text-[12px] font-bold text-white"
                : "flex-1 rounded px-2 py-1.5 text-[12px] font-semibold text-text-muted hover:bg-bg"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab !== "bottom-band" && activeTab !== "lid" && activeTab !== "ringTube" && bodyTabs.length > 1 && (
        <button
          type="button"
          onClick={() => {
            const tab = bodyTabs.find((t) => t.key === activeTab);
            if (!tab || tab.splitIndexBelow < 0) return; // the bottom-most band ("Khoang" with the highest number) has no split below it to remove — delete a different band instead to consolidate downward
            onChange(withSplitRemoved(value, tab.splitIndexBelow));
            setActiveTab("bottom-band");
          }}
          className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:text-red"
        >
          Xóa khoang này (gộp với khoang bên dưới)
        </button>
      )}

      {activeTab === "ringTube" && (
        <>
          <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text">
            <input
              type="checkbox"
              checked={value.ringTube.enabled}
              onChange={(e) => onChange({ ...value, ringTube: { ...value.ringTube, enabled: e.target.checked } })}
              className="h-3.5 w-3.5 accent-[var(--accent)]"
            />
            Đổ ống tại mỗi mốc chia khoang (chỉ để nhìn cho giống thật — không phải khung thép)
          </label>
          {value.ringTube.enabled && (
            <Field label="FI ống (mm)">
              <input
                type="number"
                min={2}
                max={30}
                step={0.5}
                value={value.ringTube.diameterMm}
                onChange={(e) => onChange({ ...value, ringTube: { ...value.ringTube, diameterMm: Math.max(2, Number(e.target.value) || 6) } })}
                className={inputClass}
              />
            </Field>
          )}
        </>
      )}

      {activeBand && (
        <>
          <BandImageRow
            band={activeBand}
            sharedImageUrl={value.imageDataUrl}
            onChange={(next) => {
              if (activeTab === "bottom-band") onChange({ ...value, bottom: next });
              else if (activeTab === "lid") onChange({ ...value, lid: next });
              else if (activeTab === "ringTube") onChange({ ...value, ringTube: { ...value.ringTube, ...next } });
              else updateBodyBand(activeTab, next);
            }}
          />
          <ZoneControls
            value={activeBand.settings}
            onChange={(settings) => {
              const next = { ...activeBand, settings };
              if (activeTab === "bottom-band") onChange({ ...value, bottom: next });
              else if (activeTab === "lid") onChange({ ...value, lid: next });
              else if (activeTab === "ringTube") onChange({ ...value, ringTube: { ...value.ringTube, settings } });
              else updateBodyBand(activeTab, next);
            }}
          />
        </>
      )}
    </div>
  );
}
