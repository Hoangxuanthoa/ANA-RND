"use client";

import { buildDiameterSpline } from "@/lib/breakdown/geometry/photoSpline";
import { ovalCornerToRect } from "@/lib/breakdown/geometry/ovalProfileEngine";
import type { HandleInput, LidInput, OvalProfileInput, OvalRingInput } from "@/lib/breakdown/geometry/types";
import { Field, inputClass, selectClass } from "./field";
import { RectLidCard } from "./RectProfileForm";

// Ring identity is positional, same as RoundProfileForm's own ringLabel —
// no free-text "name" field, the role is implied by position in the list.
function ringLabel(index: number, total: number): string {
  if (index === 0) return "Miệng";
  if (index === total - 1) return "Đáy";
  return `Vòng ngang ${index}`;
}

interface OvalProfileFormProps {
  profile: OvalProfileInput;
  lid: LidInput;
  handle: HandleInput;
  // Non-null only when the CURRENT shape was captured via "Khóa dáng" — see
  // onLockShape. While locked, ring length/width/transition/curveDepth stop
  // driving the body (the dense curve does instead), so those fields switch
  // to read-only/hidden and only ring Z position stays editable.
  photoCurve: { z: number; length: number; width: number }[] | null;
  onChange: (profile: OvalProfileInput) => void;
  onChangeLid: (lid: LidInput) => void;
  onChangeHandle: (handle: HandleInput) => void;
  onLockShape: () => void;
  // true = "Quay về gốc" (restore the ring list from right before locking),
  // false = "Giữ hiện tại" (keep whatever rings exist right now as the new
  // manual baseline). Either way this exits locked mode.
  onUnlockShape: (revertToOriginal: boolean) => void;
}

// A flat editable ring list — same shape/interaction as RoundProfileForm's
// own (Miệng / Vòng ngang N / Đáy, add always lands right before Đáy at the
// midpoint of its neighbors, remove only for middle rings) — just with
// length+width fields instead of a single diameter, since an oval
// cross-section needs both. This replaces the old fixed
// Miệng/Đáy-cards-plus-a-count-field UI: that model could only ever taper
// mouth→base in a straight line ("Vòng ngang" was Z-only, no shape of its
// own), so there was no way to describe a belly/waist the way Round can —
// now every ring is a first-class control point with its own dims and its
// own transition curve to the next ring, exactly like Round's.
export function OvalProfileForm({ profile, lid, handle, photoCurve, onChange, onChangeLid, onChangeHandle, onLockShape, onUnlockShape }: OvalProfileFormProps) {
  const { rings } = profile;
  const locked = !!photoCurve && photoCurve.length >= 2;
  // 2 independent splines (length-by-Z, width-by-Z) — an oval cross-section
  // needs both dimensions, unlike Round's single diameter-by-Z spline.
  const lockedLengthSpline = locked ? buildDiameterSpline(photoCurve.map((p) => ({ z: p.z, diameter: p.length }))) : null;
  const lockedWidthSpline = locked ? buildDiameterSpline(photoCurve.map((p) => ({ z: p.z, diameter: p.width }))) : null;

  function updateRing(index: number, patch: Partial<OvalRingInput>) {
    onChange({ rings: rings.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
  }

  // Matches RoundProfileForm's addRing: the new ring always lands right
  // before Đáy, at the midpoint z/length/width between Đáy and whichever
  // ring is currently right above it (the last body ring, or Miệng if
  // there are none yet) — guarantees the new ring's z always falls strictly
  // between its neighbors. Locked: pin length/width to the captured curve at
  // this Z so the new ring's OWN cross-section matches the body exactly,
  // instead of a plain midpoint average that could sit visibly off the
  // surface.
  function addRing() {
    const bottomIndex = rings.length - 1;
    const bottom = rings[bottomIndex];
    const previous = rings[bottomIndex - 1];
    const z = (previous.z + bottom.z) / 2;
    const newRing: OvalRingInput = {
      z,
      length: lockedLengthSpline ? lockedLengthSpline(z) : (previous.length + bottom.length) / 2,
      width: lockedWidthSpline ? lockedWidthSpline(z) : (previous.width + bottom.width) / 2,
      transition: "straight",
      curveDepth: 0.18,
    };
    onChange({ rings: [...rings.slice(0, bottomIndex), newRing, bottom] });
  }

  function removeRing(index: number) {
    if (rings.length <= 2) return; // need at least Miệng + Đáy
    onChange({ rings: rings.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`flex flex-col gap-2.5 rounded-lg border p-3 ${locked ? "border-accent bg-accent/5" : "border-line bg-surface"}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[12.5px] font-bold text-text">{locked ? "🔒 Dáng đã khóa" : "Khóa dáng"}</p>
            <p className="text-[11.5px] text-text-faint">
              {locked
                ? "Vòng ngang giờ chỉ chọn vị trí — dáng luôn đúng như lúc khóa, thêm/xóa/di chuyển thoải mái."
                : "Chụp lại dáng hiện tại thành đường biên cố định, để thêm/xóa vòng ngang sau đó không làm sai dáng."}
            </p>
          </div>
          {!locked && (
            <button
              type="button"
              onClick={onLockShape}
              className="h-8 flex-shrink-0 rounded-lg bg-accent px-3 text-[12px] font-bold text-white hover:bg-accent-hover"
            >
              Khóa dáng
            </button>
          )}
        </div>
        {locked && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onUnlockShape(true)}
              className="h-8 flex-1 rounded-lg border border-line bg-surface text-[12px] font-bold text-text-muted hover:text-text"
            >
              Mở khóa — quay về gốc
            </button>
            <button
              type="button"
              onClick={() => onUnlockShape(false)}
              className="h-8 flex-1 rounded-lg border border-line bg-surface text-[12px] font-bold text-text-muted hover:text-text"
            >
              Mở khóa — giữ hiện tại
            </button>
          </div>
        )}
      </div>

      {rings.map((ring, i) => {
        const isLast = i === rings.length - 1;
        const isMiddle = i > 0 && !isLast;
        const nextLabel = !isLast ? ringLabel(i + 1, rings.length) : null;
        const displayLength = lockedLengthSpline ? Math.round(lockedLengthSpline(ring.z)) : ring.length;
        const displayWidth = lockedWidthSpline ? Math.round(lockedWidthSpline(ring.z)) : ring.width;
        return (
          <div key={i} className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wide text-text-muted uppercase">{ringLabel(i, rings.length)}</span>
              {isMiddle && (
                <button type="button" onClick={() => removeRing(i)} className="text-[12px] font-semibold text-red hover:underline">
                  Xóa
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Chiều cao (mm)">
                <input
                  type="number"
                  value={ring.z}
                  disabled={locked && !isMiddle}
                  onChange={(e) => {
                    const z = Number(e.target.value);
                    // Locked: the ring's OWN length/width must track the
                    // captured curve at wherever it now sits — otherwise its
                    // stored value stays pinned to the OLD z's dims, drawing
                    // its physical ring visibly off the body surface.
                    updateRing(i, lockedLengthSpline && lockedWidthSpline ? { z, length: lockedLengthSpline(z), width: lockedWidthSpline(z) } : { z });
                  }}
                  className={locked && !isMiddle ? `${inputClass} bg-bg text-text-faint` : inputClass}
                />
              </Field>
              <Field label="Chiều dài (mm)">
                <input
                  type="number"
                  value={displayLength}
                  disabled={locked}
                  onChange={(e) => updateRing(i, { length: Number(e.target.value) })}
                  className={locked ? `${inputClass} bg-bg text-text-faint` : inputClass}
                />
              </Field>
              <Field label="Chiều rộng (mm)">
                <input
                  type="number"
                  value={displayWidth}
                  disabled={locked}
                  onChange={(e) => updateRing(i, { width: Number(e.target.value) })}
                  className={locked ? `${inputClass} bg-bg text-text-faint` : inputClass}
                />
              </Field>
            </div>
            <p className="mt-1 text-[11px] text-text-faint">2 đầu bo tròn, R = Rộng/2</p>

            {nextLabel && !locked && (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <Field label={`Đường biên đến ${nextLabel}`}>
                  <select value={ring.transition || "straight"} onChange={(e) => updateRing(i, { transition: e.target.value })} className={selectClass}>
                    <option value="straight">Thẳng</option>
                    <option value="outward">Lồi</option>
                    <option value="inward">Lõm</option>
                  </select>
                </Field>
                {ring.transition && ring.transition !== "straight" && (
                  <Field label="Độ cong (0–0.65)">
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      max={0.65}
                      value={ring.curveDepth ?? 0.34}
                      onChange={(e) => updateRing(i, { curveDepth: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </Field>
                )}
              </div>
            )}

            {isLast && (
              <label className="mt-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-text">
                <input type="checkbox" checked={!!ring.cap} onChange={(e) => updateRing(i, { cap: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                Đáy kín (cap)
              </label>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRing}
        className="h-9 rounded-lg border border-dashed border-line text-[13px] font-semibold text-text-muted hover:border-accent hover:text-accent"
      >
        + Thêm vòng ngang
      </button>

      <RectLidCard lid={lid} isSquare={false} mouth={ovalCornerToRect(rings[0])} onChange={onChangeLid} />

      <OvalHandleCard handle={handle} onChange={onChangeHandle} />
    </div>
  );
}

// Simplified vs RectHandleCard/Round's own: no "cạnh" (side) selector — an
// Oval handle always mounts at the 2 cap tips, matching Round's symmetric
// ±mouthRadius mount points — no "cạnh" (side) selector, since both
// mount points are fixed. Logic (standing AND cutout) is Round's own,
// verbatim — see ovalHandlePaths.ts.
function OvalHandleCard({ handle, onChange }: { handle: HandleInput; onChange: (handle: HandleInput) => void }) {
  function set<K extends keyof HandleInput>(key: K, value: HandleInput[K]) {
    onChange({ ...handle, [key]: value });
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
      <Field label="Kiểu quai">
        <select value={handle.type} onChange={(e) => set("type", e.target.value as HandleInput["type"])} className={selectClass}>
          <option value="none">Không có</option>
          <option value="standing">Đứng</option>
          <option value="cutout">Khoét thân</option>
        </select>
      </Field>

      {handle.type === "standing" && (
        <>
          <div className="mt-2.5 grid grid-cols-4 gap-2.5">
            <Field label="Hình dạng quai">
              <select value={handle.shape} onChange={(e) => set("shape", e.target.value as HandleInput["shape"])} className={selectClass}>
                <option value="curve">Cong</option>
                <option value="square">Vuông</option>
              </select>
            </Field>
            <Field label="Số đường quai">
              <select value={handle.lines} onChange={(e) => set("lines", Number(e.target.value) as HandleInput["lines"])} className={selectClass}>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </Field>
            <Field label="Chiều rộng (mm)">
              <input type="number" value={handle.width} onChange={(e) => set("width", Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Chiều cao (mm)">
              <input type="number" value={handle.height} onChange={(e) => set("height", Number(e.target.value))} className={inputClass} />
            </Field>
          </div>
          {handle.lines === 2 && (
            <div className="mt-2.5">
              <Field label="Khoảng cách 2 đường (mm)">
                <input type="number" value={handle.offset} onChange={(e) => set("offset", Number(e.target.value))} className={inputClass} />
              </Field>
            </div>
          )}
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <Field label="Kiểu nghiêng">
              <select value={handle.leanMode} onChange={(e) => set("leanMode", e.target.value as HandleInput["leanMode"])} className={selectClass}>
                <option value="center_axis">Theo tâm miệng</option>
                <option value="vertical">Thẳng đứng</option>
                <option value="manual">Tùy chỉnh góc</option>
              </select>
            </Field>
            {handle.leanMode === "manual" && (
              <Field label="Góc nghiêng (độ)">
                <input type="number" value={handle.leanAngle} onChange={(e) => set("leanAngle", Number(e.target.value))} className={inputClass} />
              </Field>
            )}
          </div>
          {handle.shape === "square" && (
            <div className="mt-2.5">
              <Field label="Bo góc (mm)">
                <input type="number" value={handle.fillet} onChange={(e) => set("fillet", Number(e.target.value))} className={inputClass} />
              </Field>
            </div>
          )}
        </>
      )}

      {handle.type === "cutout" && (
        <div className="mt-2.5 grid grid-cols-4 gap-2.5">
          <Field label="Chiều rộng khoét (mm)">
            <input type="number" value={handle.cutoutWidth} onChange={(e) => set("cutoutWidth", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Chiều sâu khoét (mm)">
            <input type="number" value={handle.cutoutDepth} onChange={(e) => set("cutoutDepth", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Cách miệng (mm)">
            <input type="number" value={handle.cutoutOffset} onChange={(e) => set("cutoutOffset", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Bo góc (mm)">
            <input type="number" value={handle.fillet} onChange={(e) => set("fillet", Number(e.target.value))} className={inputClass} />
          </Field>
        </div>
      )}
    </div>
  );
}
