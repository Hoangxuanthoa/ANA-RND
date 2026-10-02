"use client";

import { RECT_LID_DEFAULT_OVERHANG_MM } from "@/lib/breakdown/geometry/rectProfileEngine";
import type { HandleInput, LidInput, RectCorner, RectProfileInput } from "@/lib/breakdown/geometry/types";
import { Field, inputClass, selectClass } from "./field";

interface RectProfileFormProps {
  profile: RectProfileInput;
  isSquare: boolean;
  lid: LidInput;
  handle: HandleInput;
  onChange: (profile: RectProfileInput) => void;
  onChangeLid: (lid: LidInput) => void;
  onChangeHandle: (handle: HandleInput) => void;
}

// Square is Rectangle with length locked to width (per spec: "Square shape
// sẽ tương tự như Rectangular chỉ là dài và rộng bằng nhau") — same engine,
// same form, just a single "Kích thước" field that writes both.
function CornerFields({
  label,
  corner,
  isSquare,
  showCap,
  onChange,
}: {
  label: string;
  corner: RectCorner;
  isSquare: boolean;
  showCap: boolean;
  onChange: (patch: Partial<RectCorner>) => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
      <span className="mb-2 block text-[11px] font-bold tracking-wide text-text-muted uppercase">{label}</span>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Chiều cao (mm)">
          <input type="number" value={corner.z} onChange={(e) => onChange({ z: Number(e.target.value) })} className={inputClass} />
        </Field>
        <Field label="Góc bo R (mm)">
          <input type="number" min={0} value={corner.cornerR} onChange={(e) => onChange({ cornerR: Number(e.target.value) })} className={inputClass} />
        </Field>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        {isSquare ? (
          <Field label="Kích thước (mm)">
            <input
              type="number"
              value={corner.length}
              onChange={(e) => {
                const v = Number(e.target.value);
                onChange({ length: v, width: v });
              }}
              className={inputClass}
            />
          </Field>
        ) : (
          <>
            <Field label="Chiều dài (mm)">
              <input type="number" value={corner.length} onChange={(e) => onChange({ length: Number(e.target.value) })} className={inputClass} />
            </Field>
            <Field label="Chiều rộng (mm)">
              <input type="number" value={corner.width} onChange={(e) => onChange({ width: Number(e.target.value) })} className={inputClass} />
            </Field>
          </>
        )}
      </div>
      {showCap && (
        <label className="mt-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-text">
          <input type="checkbox" checked={!!corner.cap} onChange={(e) => onChange({ cap: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
          Đáy kín (cap)
        </label>
      )}
    </div>
  );
}

export function RectProfileForm({ profile, isSquare, lid, handle, onChange, onChangeLid, onChangeHandle }: RectProfileFormProps) {
  function updateMouth(patch: Partial<RectCorner>) {
    onChange({ ...profile, mouth: { ...profile.mouth, ...patch } });
  }
  function updateBase(patch: Partial<RectCorner>) {
    onChange({ ...profile, base: { ...profile.base, ...patch } });
  }
  function updateRingZ(index: number, z: number) {
    const horizontalRings = profile.horizontalRings.map((r, i) => (i === index ? { ...r, z } : r));
    onChange({ ...profile, horizontalRings });
  }
  // Picking a COUNT re-spreads that many rings evenly across the total
  // height (mouth→base split into count+1 equal steps) — the quick way to
  // lay them out. Each ring's own height stays a normal editable field
  // afterward (updateRingZ above), so nudging one by hand doesn't get
  // overwritten until the count itself changes again.
  function setRingCount(count: number) {
    const n = Math.max(0, Math.round(count));
    const span = profile.mouth.z - profile.base.z;
    const horizontalRings = Array.from({ length: n }, (_, i) => ({
      z: profile.mouth.z - (span * (i + 1)) / (n + 1),
    }));
    onChange({ ...profile, horizontalRings });
  }

  return (
    <div className="flex flex-col gap-3">
      <CornerFields label="Miệng" corner={profile.mouth} isSquare={isSquare} showCap={false} onChange={updateMouth} />

      <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
        <span className="mb-2 block text-[11px] font-bold tracking-wide text-text-muted uppercase">Vòng ngang</span>
        <Field label="Số vòng ngang">
          <input
            type="number"
            min={0}
            value={profile.horizontalRings.length}
            onChange={(e) => setRingCount(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        {profile.horizontalRings.length > 0 && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {profile.horizontalRings.map((ring, i) => (
              <Field key={i} label={`Vòng ${i + 1} (mm)`}>
                <input type="number" value={ring.z} onChange={(e) => updateRingZ(i, Number(e.target.value))} className={inputClass} />
              </Field>
            ))}
          </div>
        )}
      </div>

      <CornerFields label="Đáy" corner={profile.base} isSquare={isSquare} showCap onChange={updateBase} />

      <RectLidCard lid={lid} isSquare={isSquare} mouth={profile.mouth} onChange={onChangeLid} />

      <RectHandleCard handle={handle} onChange={onChangeHandle} />
    </div>
  );
}

function RectHandleCard({ handle, onChange }: { handle: HandleInput; onChange: (handle: HandleInput) => void }) {
  function set<K extends keyof HandleInput>(key: K, value: HandleInput[K]) {
    onChange({ ...handle, [key]: value });
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Kiểu quai">
          <select value={handle.type} onChange={(e) => set("type", e.target.value as HandleInput["type"])} className={selectClass}>
            <option value="none">Không có</option>
            <option value="standing">Đứng</option>
            <option value="cutout">Khoét thân</option>
          </select>
        </Field>
        {handle.type !== "none" && (
          <Field label="Quai ở cạnh">
            <select value={handle.side} onChange={(e) => set("side", e.target.value as HandleInput["side"])} className={selectClass}>
              <option value="width">Cạnh rộng</option>
              <option value="length">Cạnh dài</option>
            </select>
          </Field>
        )}
      </div>

      {handle.type === "standing" && (
        <>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
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
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
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
                <option value="taper">Theo độ vát</option>
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
        <>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <Field label="Chiều rộng khoét (mm)">
              <input type="number" value={handle.cutoutWidth} onChange={(e) => set("cutoutWidth", Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Chiều sâu khoét (mm)">
              <input type="number" value={handle.cutoutDepth} onChange={(e) => set("cutoutDepth", Number(e.target.value))} className={inputClass} />
            </Field>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <Field label="Cách miệng (mm)">
              <input type="number" value={handle.cutoutOffset} onChange={(e) => set("cutoutOffset", Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Bo góc (mm)">
              <input type="number" value={handle.fillet} onChange={(e) => set("fillet", Number(e.target.value))} className={inputClass} />
            </Field>
          </div>
        </>
      )}
    </div>
  );
}

// Every lid size field shows its RESOLVED number directly (mouth-derived
// default, or the user's own override) instead of an empty box with
// placeholder text — the user wants to see the actual value being used at
// a glance, not have to guess it from a hint. Clearing a field back to ""
// still returns it to "auto" (undefined), same as before.
// Exported for reuse by OvalProfileForm.tsx — Oval's own lid ("nắp") is
// meant to behave exactly like Rectangle's, per the user (independent
// corner rounding that just defaults from the body's own, not forced to
// stay a perfect oval-cap) — see ovalProfileEngine.ts's ovalCornerToRect
// for how an OvalCorner is converted into the RectCorner this expects.
export function RectLidCard({ lid, isSquare, mouth, onChange }: { lid: LidInput; isSquare: boolean; mouth: RectCorner; onChange: (lid: LidInput) => void }) {
  function set<K extends keyof LidInput>(key: K, value: LidInput[K]) {
    onChange({ ...lid, [key]: value });
  }
  const sizeLabel = isSquare ? "Kích thước" : null;
  const flatLength = lid.length ?? mouth.length;
  const flatWidth = lid.width ?? mouth.width;
  const coverLength = lid.length ?? mouth.length + RECT_LID_DEFAULT_OVERHANG_MM;
  const coverWidth = lid.width ?? mouth.width + RECT_LID_DEFAULT_OVERHANG_MM;
  const bottomLength = lid.bottomLength ?? mouth.length + RECT_LID_DEFAULT_OVERHANG_MM;
  const bottomWidth = lid.bottomWidth ?? mouth.width + RECT_LID_DEFAULT_OVERHANG_MM;

  return (
    <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Kiểu nắp">
          <select value={lid.mode || "none"} onChange={(e) => set("mode", e.target.value as LidInput["mode"])} className={selectClass}>
            <option value="none">Không có</option>
            <option value="flat">Nắp bằng</option>
            <option value="cover">Nắp trùm</option>
          </select>
        </Field>
        {lid.mode !== "none" && (
          <Field label="Góc bo R nắp (mm)">
            <input
              type="number"
              min={0}
              value={lid.cornerR ?? mouth.cornerR}
              onChange={(e) => set("cornerR", e.target.value === "" ? undefined : Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        )}
      </div>

      {lid.mode === "flat" && (
        <div className="mt-2.5 border-t border-line pt-2.5">
          <span className="text-[10px] font-bold tracking-wide text-text-faint uppercase">Nắp bằng</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            {isSquare ? (
              <Field label={`${sizeLabel} (mm)`}>
                <input
                  type="number"
                  value={flatLength}
                  onChange={(e) => {
                    const v = e.target.value === "" ? undefined : Number(e.target.value);
                    onChange({ ...lid, length: v, width: v });
                  }}
                  className={inputClass}
                />
              </Field>
            ) : (
              <>
                <Field label="Chiều dài (mm)">
                  <input
                    type="number"
                    value={flatLength}
                    onChange={(e) => set("length", e.target.value === "" ? undefined : Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Chiều rộng (mm)">
                  <input
                    type="number"
                    value={flatWidth}
                    onChange={(e) => set("width", e.target.value === "" ? undefined : Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </>
            )}
          </div>
        </div>
      )}

      {lid.mode === "cover" && (
        <div className="mt-2.5 border-t border-line pt-2.5">
          <span className="text-[10px] font-bold tracking-wide text-text-faint uppercase">Nắp trùm</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            {isSquare ? (
              <Field label={`${sizeLabel} miệng nắp (mm)`}>
                <input
                  type="number"
                  value={coverLength}
                  onChange={(e) => {
                    const v = e.target.value === "" ? undefined : Number(e.target.value);
                    onChange({ ...lid, length: v, width: v });
                  }}
                  className={inputClass}
                />
              </Field>
            ) : (
              <>
                <Field label="Dài miệng nắp (mm)">
                  <input
                    type="number"
                    value={coverLength}
                    onChange={(e) => set("length", e.target.value === "" ? undefined : Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Rộng miệng nắp (mm)">
                  <input
                    type="number"
                    value={coverWidth}
                    onChange={(e) => set("width", e.target.value === "" ? undefined : Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </>
            )}
          </div>
          <div className="mt-2.5">
            <Field label="Chiều cao nắp (mm)">
              <input type="number" value={lid.height ?? 60} onChange={(e) => set("height", Number(e.target.value))} className={inputClass} />
            </Field>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {isSquare ? (
              <Field label={`${sizeLabel} đáy nắp (mm)`}>
                <input
                  type="number"
                  value={bottomLength}
                  onChange={(e) => {
                    const v = e.target.value === "" ? undefined : Number(e.target.value);
                    onChange({ ...lid, bottomLength: v, bottomWidth: v });
                  }}
                  className={inputClass}
                />
              </Field>
            ) : (
              <>
                <Field label="Dài đáy nắp (mm)">
                  <input
                    type="number"
                    value={bottomLength}
                    onChange={(e) => set("bottomLength", e.target.value === "" ? undefined : Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Rộng đáy nắp (mm)">
                  <input
                    type="number"
                    value={bottomWidth}
                    onChange={(e) => set("bottomWidth", e.target.value === "" ? undefined : Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
