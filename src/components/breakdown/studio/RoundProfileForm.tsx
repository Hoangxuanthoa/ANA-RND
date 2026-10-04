"use client";

import { buildDiameterSpline, suggestRingZs, type DiameterPoint } from "@/lib/breakdown/geometry/photoSpline";
import type { HandleInput, LidInput, RingInput, ScallopInput } from "@/lib/breakdown/geometry/types";
import { scallopPetalWidthMm } from "@/lib/breakdown/geometry/scallopEngine";
import { Field, inputClass, selectClass } from "./field";

// Ring identity is positional, same as ANASU's Shape Timeline (Miệng /
// Vòng ngang N / Đáy) — there is no free-text "name" field in the plugin
// UI, the role is implied by position in the list.
function ringLabel(index: number, total: number): string {
  if (index === 0) return "Miệng";
  if (index === total - 1) return "Đáy";
  return `Vòng ngang ${index}`;
}

interface RoundProfileFormProps {
  rings: RingInput[];
  lid: LidInput;
  handle: HandleInput;
  scallop: ScallopInput;
  // Non-null only when the CURRENT shape was captured via "Khóa dáng" — see
  // onLockShape. While locked, ring diameters/transition/curveDepth stop
  // driving the body (the dense curve does instead), so those fields switch
  // to read-only/hidden and only ring Z position stays editable.
  photoCurve: { z: number; diameter: number }[] | null;
  onChangeRings: (rings: RingInput[]) => void;
  onChangeLid: (lid: LidInput) => void;
  onChangeHandle: (handle: HandleInput) => void;
  onChangeScallop: (scallop: ScallopInput) => void;
  onLockShape: () => void;
  // true = "Quay về gốc" (restore the ring list from right before locking),
  // false = "Giữ hiện tại" (keep whatever rings exist right now as the new
  // manual baseline). Either way this exits locked mode.
  onUnlockShape: (revertToOriginal: boolean) => void;
}

export function RoundProfileForm({
  rings,
  lid,
  handle,
  scallop,
  photoCurve,
  onChangeRings,
  onChangeLid,
  onChangeHandle,
  onChangeScallop,
  onLockShape,
  onUnlockShape,
}: RoundProfileFormProps) {
  const locked = !!photoCurve && photoCurve.length >= 2;
  const lockedSpline = locked ? buildDiameterSpline(photoCurve as DiameterPoint[]) : null;

  function updateRing(index: number, patch: Partial<RingInput>) {
    onChangeRings(rings.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  // Matches ANASU's addBodyRing (workflow.js): the new ring always lands
  // right before Đáy, at the MIDPOINT z/diameter between Đáy and whichever
  // ring is currently right above it (the last body ring, or Miệng if
  // there are none yet). This guarantees the new ring's z always falls
  // strictly between its neighbors — never above the ring before it —
  // unlike a flat "+50mm from Đáy" offset which can invert the order.
  function addRing() {
    const bottomIndex = rings.length - 1;
    const bottom = rings[bottomIndex];
    const previous = rings[bottomIndex - 1];
    const z = (previous.z + bottom.z) / 2;
    const newRing: RingInput = {
      z,
      // Locked: pin the diameter to the captured curve at this Z so the new
      // ring's OWN circle matches the body exactly, instead of a plain
      // midpoint average that could sit visibly off the surface.
      diameter: lockedSpline ? lockedSpline(z) : (previous.diameter + bottom.diameter) / 2,
      transition: "straight",
      curveDepth: 0.18,
    };
    onChangeRings([...rings.slice(0, bottomIndex), newRing, bottom]);
  }

  function removeRing(index: number) {
    if (rings.length <= 2) return; // need at least mouth + bottom
    onChangeRings(rings.filter((_, i) => i !== index));
  }

  function resuggestRings() {
    if (!photoCurve) return;
    const heightMm = rings[0]?.z ?? 0;
    const zs = suggestRingZs(photoCurve as DiameterPoint[])
      .map((z) => Math.round(z))
      .filter((z) => z > 0 && z < heightMm);
    const spline = buildDiameterSpline(photoCurve as DiameterPoint[]);
    const middle: RingInput[] = [...new Set(zs)].sort((a, b) => b - a).map((z) => ({ z, diameter: spline(z), transition: "straight", curveDepth: 0.18 }));
    onChangeRings([rings[0], ...middle, rings[rings.length - 1]]);
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
        const displayDiameter = lockedSpline ? Math.round(lockedSpline(ring.z)) : ring.diameter;
        return (
          <div key={i} className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wide text-text-muted uppercase">
                {ringLabel(i, rings.length)}
              </span>
              {isMiddle && (
                <button
                  type="button"
                  onClick={() => removeRing(i)}
                  className="text-[12px] font-semibold text-red hover:underline"
                >
                  Xóa
                </button>
              )}
            </div>

            <div
              className={`grid gap-2.5 ${
                nextLabel && !locked ? (ring.transition && ring.transition !== "straight" ? "grid-cols-4" : "grid-cols-3") : "grid-cols-2"
              }`}
            >
              <Field label="Chiều cao (mm)">
                <input
                  type="number"
                  value={ring.z}
                  disabled={locked && !isMiddle}
                  onChange={(e) => {
                    const z = Number(e.target.value);
                    // Locked: the ring's OWN diameter must track the captured
                    // curve at wherever it now sits — otherwise its stored
                    // value stays pinned to the OLD z's diameter, and
                    // addHorizontalRings would draw its physical ring circle
                    // visibly off the body surface.
                    updateRing(i, lockedSpline ? { z, diameter: lockedSpline(z) } : { z });
                  }}
                  className={locked && !isMiddle ? `${inputClass} bg-bg text-text-faint` : inputClass}
                />
              </Field>
              <Field label="Đường kính (mm)">
                <input
                  type="number"
                  value={displayDiameter}
                  disabled={locked}
                  onChange={(e) => updateRing(i, { diameter: Number(e.target.value) })}
                  className={locked ? `${inputClass} bg-bg text-text-faint` : inputClass}
                />
              </Field>
              {nextLabel && !locked && (
                <Field label={`Đường biên đến ${nextLabel}`}>
                  <select
                    value={ring.transition || "straight"}
                    onChange={(e) => updateRing(i, { transition: e.target.value })}
                    className={selectClass}
                  >
                    <option value="straight">Thẳng</option>
                    <option value="outward">Lồi</option>
                    <option value="inward">Lõm</option>
                  </select>
                </Field>
              )}
              {nextLabel && !locked && ring.transition && ring.transition !== "straight" && (
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

            {isLast && (
              <label className="mt-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-text">
                <input
                  type="checkbox"
                  checked={!!ring.cap}
                  onChange={(e) => updateRing(i, { cap: e.target.checked })}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Đáy kín (cap)
              </label>
            )}
          </div>
        );
      })}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={addRing}
          className="h-9 flex-1 rounded-lg border border-dashed border-line text-[13px] font-semibold text-text-muted hover:border-accent hover:text-accent"
        >
          + Thêm vòng ngang
        </button>
        {locked && (
          <button
            type="button"
            onClick={resuggestRings}
            className="h-9 flex-shrink-0 rounded-lg border border-dashed border-line px-3 text-[13px] font-semibold text-text-muted hover:border-accent hover:text-accent"
          >
            Đề xuất lại
          </button>
        )}
      </div>

      <div className="mt-2 rounded-lg border border-line bg-surface p-3.5 shadow-sm">
        <Field label="Kiểu nắp">
          <select
            value={lid.mode || "none"}
            onChange={(e) => onChangeLid({ ...lid, mode: e.target.value as LidInput["mode"] })}
            className={selectClass}
          >
            <option value="none">Không có</option>
            <option value="flat">Flat</option>
            <option value="cover">Cover</option>
          </select>
        </Field>

        {lid.mode !== "none" && (
          <div className="mt-3 border-t border-line pt-2.5">
            <span className="text-[10px] font-bold tracking-wide text-text-faint uppercase">Thông số nắp</span>
            <div className={`mt-1.5 grid gap-2.5 ${lid.mode === "cover" ? "grid-cols-3" : "grid-cols-2"}`}>
              <Field label="Đường kính nắp (mm)">
                <input
                  type="number"
                  value={lid.diameter ?? ""}
                  placeholder="Mặc định bằng miệng"
                  onChange={(e) => onChangeLid({ ...lid, diameter: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
              <Field label="Chiều cao nắp (mm)">
                <input
                  type="number"
                  value={lid.height ?? 60}
                  onChange={(e) => onChangeLid({ ...lid, height: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
              {lid.mode === "cover" && (
                <Field label="Đường kính đáy nắp (mm)">
                  <input
                    type="number"
                    value={lid.bottomDiameter ?? ""}
                    placeholder="Mặc định gấp đôi đường kính nắp"
                    onChange={(e) => onChangeLid({ ...lid, bottomDiameter: Number(e.target.value) })}
                    className={inputClass}
                  />
                </Field>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
        <Field label="Kiểu quai">
          <select
            value={handle.type}
            onChange={(e) => onChangeHandle({ ...handle, type: e.target.value as HandleInput["type"] })}
            className={selectClass}
          >
            <option value="none">Không có</option>
            <option value="standing">Đứng</option>
            <option value="cutout">Khoét thân</option>
          </select>
        </Field>

        {handle.type !== "none" && (
          <div className="mt-3 border-t border-line pt-2.5">
            <span className="text-[10px] font-bold tracking-wide text-text-faint uppercase">Thông số quai</span>

            {handle.type === "standing" && (
              <>
                <div className="mt-1.5 grid grid-cols-4 gap-2.5">
                  <Field label="Hình dạng quai">
                    <select
                      value={handle.shape}
                      onChange={(e) => onChangeHandle({ ...handle, shape: e.target.value as HandleInput["shape"] })}
                      className={selectClass}
                    >
                      <option value="curve">Cong</option>
                      <option value="square">Vuông</option>
                    </select>
                  </Field>
                  <Field label="Số đường quai">
                    <select
                      value={handle.lines}
                      onChange={(e) => onChangeHandle({ ...handle, lines: Number(e.target.value) as HandleInput["lines"] })}
                      className={selectClass}
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </Field>
                  <Field label="Chiều rộng (mm)">
                    <input
                      type="number"
                      value={handle.width}
                      onChange={(e) => onChangeHandle({ ...handle, width: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Chiều cao (mm)">
                    <input
                      type="number"
                      value={handle.height}
                      onChange={(e) => onChangeHandle({ ...handle, height: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </Field>
                </div>
                {handle.lines === 2 && (
                  <div className="mt-2.5">
                    <Field label="Khoảng cách 2 đường (mm)">
                      <input
                        type="number"
                        value={handle.offset}
                        onChange={(e) => onChangeHandle({ ...handle, offset: Number(e.target.value) })}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                )}
                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  <Field label="Kiểu nghiêng">
                    <select
                      value={handle.leanMode}
                      onChange={(e) => onChangeHandle({ ...handle, leanMode: e.target.value as HandleInput["leanMode"] })}
                      className={selectClass}
                    >
                      <option value="center_axis">Theo tâm miệng</option>
                      <option value="vertical">Thẳng đứng</option>
                      <option value="manual">Tùy chỉnh góc</option>
                    </select>
                  </Field>
                  {handle.leanMode === "manual" && (
                    <Field label="Góc nghiêng (độ)">
                      <input
                        type="number"
                        value={handle.leanAngle}
                        onChange={(e) => onChangeHandle({ ...handle, leanAngle: Number(e.target.value) })}
                        className={inputClass}
                      />
                    </Field>
                  )}
                </div>
                {handle.shape === "square" && (
                  <div className="mt-2.5">
                    <Field label="Bo góc (mm)">
                      <input
                        type="number"
                        value={handle.fillet}
                        onChange={(e) => onChangeHandle({ ...handle, fillet: Number(e.target.value) })}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                )}
              </>
            )}

            {handle.type === "cutout" && (
              <div className="mt-1.5 grid grid-cols-4 gap-2.5">
                <Field label="Hình dạng khoét">
                  <select
                    value={handle.cutoutShape ?? "rect"}
                    onChange={(e) => onChangeHandle({ ...handle, cutoutShape: e.target.value as "rect" | "round" })}
                    className={selectClass}
                  >
                    <option value="rect">Chữ nhật</option>
                    <option value="round">Tròn</option>
                  </select>
                </Field>
                <Field label={handle.cutoutShape === "round" ? "Đường kính khoét (mm)" : "Chiều rộng khoét (mm)"}>
                  <input
                    type="number"
                    value={handle.cutoutWidth}
                    onChange={(e) => onChangeHandle({ ...handle, cutoutWidth: Number(e.target.value) })}
                    className={inputClass}
                  />
                </Field>
                {handle.cutoutShape !== "round" && (
                  <Field label="Chiều sâu khoét (mm)">
                    <input
                      type="number"
                      value={handle.cutoutDepth}
                      onChange={(e) => onChangeHandle({ ...handle, cutoutDepth: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </Field>
                )}
                <Field label="Cách miệng (mm)">
                  <input
                    type="number"
                    value={handle.cutoutOffset}
                    onChange={(e) => onChangeHandle({ ...handle, cutoutOffset: Number(e.target.value) })}
                    className={inputClass}
                  />
                </Field>
                {handle.cutoutShape !== "round" && (
                  <Field label="Bo góc (mm)">
                    <input
                      type="number"
                      value={handle.fillet}
                      onChange={(e) => onChangeHandle({ ...handle, fillet: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </Field>
                )}
              </div>
            )}
            {handle.type === "cutout" && handle.cutoutShape === "round" && (
              <p className="mt-1.5 text-[11px] text-text-faint">
                Quai tròn: nan dọc tại tâm quai bị cắt đúng đoạn trong vòng tròn; nếu "Cách miệng" &gt; 0, một đoạn nan dọc ngắn sẽ nối từ
                đỉnh vòng tròn lên miệng.
              </p>
            )}
          </div>
        )}
      </div>

      <ScallopCard rings={rings} scallop={scallop} onChange={onChangeScallop} disabled={handle.type === "cutout"} />
    </div>
  );
}

function ScallopCard({
  rings,
  scallop,
  onChange,
  disabled,
}: {
  rings: RingInput[];
  scallop: ScallopInput;
  onChange: (scallop: ScallopInput) => void;
  disabled: boolean;
}) {
  const mouthRadius = Math.max(rings[0]?.diameter ?? 0, 0) / 2;
  const autoWidth = scallopPetalWidthMm(mouthRadius, Math.max(scallop.count, 3));
  const autoHeight = autoWidth / 2;

  function set<K extends keyof ScallopInput>(key: K, value: ScallopInput[K]) {
    onChange({ ...scallop, [key]: value });
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
      <label className="flex items-center gap-2 text-[12.5px] font-semibold text-text">
        <input
          type="checkbox"
          checked={scallop.enabled}
          disabled={disabled}
          onChange={(e) => set("enabled", e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        Miệng cánh hoa (scallop)
      </label>
      {disabled && <p className="mt-1 text-[11.5px] text-text-faint">Chưa dùng chung được với Kiểu quai khoét thân.</p>}

      {scallop.enabled && !disabled && (
        <div className="mt-2.5 flex flex-col gap-2.5">
          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Số cánh hoa">
              <input type="number" min={3} value={scallop.count} onChange={(e) => set("count", Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Chiều rộng cánh hoa (mm)">
              <input type="number" value={Math.round(autoWidth)} disabled className={`${inputClass} bg-bg text-text-faint`} />
            </Field>
            <Field label="Chiều cao cánh hoa (mm)">
              <input
                type="number"
                value={scallop.height ?? ""}
                placeholder={`Mặc định ${autoHeight.toFixed(1)} (= nửa chiều rộng)`}
                onChange={(e) => set("height", e.target.value === "" ? undefined : Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Kiểu khung sắt miệng">
              <select value={scallop.frameStyle} onChange={(e) => set("frameStyle", e.target.value as ScallopInput["frameStyle"])} className={selectClass}>
                <option value="continuous">Liền mạch (bo góc)</option>
                <option value="separate">Cánh rời hàn nối</option>
              </select>
            </Field>
            {scallop.frameStyle === "continuous" && (
              <Field label="Bo góc điểm tiếp giáp (mm)">
                <input type="number" min={0} value={scallop.filletMm} onChange={(e) => set("filletMm", Number(e.target.value))} className={inputClass} />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Nan dọc bắt từ">
              <select value={scallop.verticalAnchor} onChange={(e) => set("verticalAnchor", e.target.value as ScallopInput["verticalAnchor"])} className={selectClass}>
                <option value="valley">Điểm tiếp giáp</option>
                <option value="apex">Đỉnh cánh hoa</option>
              </select>
            </Field>
            <Field label="Mật độ nan dọc">
              <select value={scallop.verticalEvery} onChange={(e) => set("verticalEvery", Number(e.target.value))} className={selectClass}>
                <option value={1}>Mỗi vị trí 1 nan</option>
                <option value={2}>Cách 1 (mỗi 2 cánh)</option>
                <option value={3}>Cách 2 (mỗi 3 cánh)</option>
                <option value={4}>Cách 3 (mỗi 4 cánh)</option>
              </select>
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
