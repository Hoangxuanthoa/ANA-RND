"use client";

import type { FrameInput, HandleInput, LidInput } from "@/lib/breakdown/geometry/types";
import { Field, inputClass, selectClass } from "./field";

const COLOR_PRESETS = [
  { key: "beige", label: "Be", hex: "#e3d0b0" },
  { key: "black", label: "Đen", hex: "#2b2b2b" },
  { key: "white", label: "Trắng", hex: "#f0f0f0" },
  { key: "custom", label: "Tùy chỉnh (RGB)", hex: "" },
];

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[160px] flex-1 flex-col gap-2.5 border-r border-line pr-4 last:border-r-0 last:pr-0">
      <span className="text-[11px] font-bold tracking-wide text-text-muted uppercase">{title}</span>
      {children}
    </div>
  );
}

// Shared by Đáy and Nắp — both are "radial spokes from a centre, or
// parallel chords" patterns with the exact same sub-fields in ANASU
// (bottom_* / lid_* pairs in frame_engine.rb normalize_spec).
interface PatternFieldsProps {
  pattern: "radial" | "parallel" | "none";
  onPatternChange: (v: "radial" | "parallel" | "none") => void;
  radialMode: "center" | "center_ring";
  onRadialModeChange: (v: "center" | "center_ring") => void;
  radialCount: number;
  onRadialCountChange: (v: number) => void;
  centerDiameter: number;
  onCenterDiameterChange: (v: number) => void;
  parallelLines: number;
  onParallelLinesChange: (v: number) => void;
}

function PatternFields({
  pattern,
  onPatternChange,
  radialMode,
  onRadialModeChange,
  radialCount,
  onRadialCountChange,
  centerDiameter,
  onCenterDiameterChange,
  parallelLines,
  onParallelLinesChange,
}: PatternFieldsProps) {
  return (
    <>
      <Field label="Kiểu chia nan">
        <select value={pattern} onChange={(e) => onPatternChange(e.target.value as "radial" | "parallel" | "none")} className={selectClass}>
          <option value="radial">Nan từ tâm</option>
          <option value="parallel">Song song</option>
          <option value="none">Không có (chỉ viền)</option>
        </select>
      </Field>
      {pattern === "radial" && (
        <>
          <Field label="Kiểu nan tâm">
            <select value={radialMode} onChange={(e) => onRadialModeChange(e.target.value as "center" | "center_ring")} className={selectClass}>
              <option value="center">Tất cả đi từ tâm</option>
              <option value="center_ring">Có vòng tâm</option>
            </select>
          </Field>
          {radialMode === "center_ring" && (
            <Field label="Đường kính vòng tâm (mm)">
              <input type="number" value={centerDiameter} onChange={(e) => onCenterDiameterChange(Number(e.target.value))} className={inputClass} />
            </Field>
          )}
          <Field label="Số nan hướng tâm">
            <input type="number" value={radialCount} onChange={(e) => onRadialCountChange(Number(e.target.value))} className={inputClass} />
          </Field>
        </>
      )}
      {pattern === "parallel" && (
        <Field label="Số đường song song">
          <input type="number" value={parallelLines} onChange={(e) => onParallelLinesChange(Number(e.target.value))} className={inputClass} />
        </Field>
      )}
    </>
  );
}

interface SteelFrameFormProps {
  frame: FrameInput;
  onChange: (frame: FrameInput) => void;
  segmentCount: number; // rings.length - 1, drives the per-curve count fields
  lid: LidInput;
  handle: HandleInput;
}

export function SteelFrameForm({ frame, onChange, segmentCount, lid, handle }: SteelFrameFormProps) {
  function set<K extends keyof FrameInput>(key: K, value: FrameInput[K]) {
    onChange({ ...frame, [key]: value });
  }

  function setPerCurveCount(index: number, value: number) {
    const next = frame.perCurveCounts.slice();
    while (next.length < segmentCount) next.push(frame.verticalCount);
    next[index] = value;
    onChange({ ...frame, perCurveCounts: next });
  }

  return (
    <div>
      <span className="mb-3 block text-[11px] font-bold tracking-wide text-text-muted uppercase">Khung sắt</span>
      <div className="flex flex-wrap gap-4">
        <Column title="Nan dọc">
          <Field label="Kiểu nan">
            <select
              value={frame.verticalMode}
              onChange={(e) => set("verticalMode", e.target.value as FrameInput["verticalMode"])}
              className={selectClass}
            >
              <option value="continuous">Liên tục miệng → đáy</option>
              <option value="per_curve">Theo từng đoạn</option>
            </select>
          </Field>
          {frame.verticalMode === "continuous" ? (
            <Field label="Số nan dọc">
              <input
                type="number"
                value={frame.verticalCount}
                onChange={(e) => set("verticalCount", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          ) : (
            Array.from({ length: Math.max(segmentCount, 1) }).map((_, i) => (
              <Field key={i} label={`Curve ${i + 1} — số nan`}>
                <input
                  type="number"
                  value={frame.perCurveCounts[i] ?? frame.verticalCount}
                  onChange={(e) => setPerCurveCount(i, Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            ))
          )}
        </Column>

        <Column title="Vòng ngang">
          <Field label="Vị trí vòng">
            <select
              value={frame.ringPlacement}
              onChange={(e) => set("ringPlacement", e.target.value as FrameInput["ringPlacement"])}
              className={selectClass}
            >
              <option value="outside">Nằm ngoài nan dọc</option>
              <option value="inside">Nằm trong nan dọc</option>
            </select>
          </Field>
        </Column>

        <Column title="Đáy">
          <PatternFields
            pattern={frame.bottomPattern}
            onPatternChange={(v) => set("bottomPattern", v)}
            radialMode={frame.bottomRadialMode}
            onRadialModeChange={(v) => set("bottomRadialMode", v)}
            radialCount={frame.bottomRadialCount}
            onRadialCountChange={(v) => set("bottomRadialCount", v)}
            centerDiameter={frame.bottomCenterDiameter}
            onCenterDiameterChange={(v) => set("bottomCenterDiameter", v)}
            parallelLines={frame.bottomParallelLines}
            onParallelLinesChange={(v) => set("bottomParallelLines", v)}
          />
        </Column>

        <Column title="Nắp">
          {lid.mode === "cover" && (
            <Field label="Số nan dọc thân nắp">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={3}
                  value={frame.lidWallCount ?? frame.verticalCount}
                  onChange={(e) => set("lidWallCount", Number(e.target.value))}
                  className={inputClass}
                />
                {frame.lidWallCount !== undefined && (
                  <button
                    type="button"
                    onClick={() => set("lidWallCount", undefined)}
                    title="Dùng lại số nan dọc thân (tự động)"
                    className="flex-shrink-0 text-[11px] font-semibold text-accent hover:underline"
                  >
                    ⟲ Tự động
                  </button>
                )}
              </div>
            </Field>
          )}
          <PatternFields
            pattern={frame.lidPattern}
            onPatternChange={(v) => set("lidPattern", v)}
            radialMode={frame.lidRadialMode}
            onRadialModeChange={(v) => set("lidRadialMode", v)}
            radialCount={frame.lidRadialCount}
            onRadialCountChange={(v) => set("lidRadialCount", v)}
            centerDiameter={frame.lidCenterDiameter}
            onCenterDiameterChange={(v) => set("lidCenterDiameter", v)}
            parallelLines={frame.lidParallelLines}
            onParallelLinesChange={(v) => set("lidParallelLines", v)}
          />
        </Column>

        <Column title="FI sắt">
          <Field label="Chế độ FI">
            <select
              value={frame.diameterMode}
              onChange={(e) => set("diameterMode", e.target.value as FrameInput["diameterMode"])}
              className={selectClass}
            >
              <option value="same">Một FI cho tất cả</option>
              <option value="custom">Tùy chỉnh theo bộ phận</option>
            </select>
          </Field>
          {frame.diameterMode === "same" && (
            <Field label="FI tất cả (mm)">
              <input
                type="number"
                value={frame.sameDiameter}
                onChange={(e) => set("sameDiameter", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          )}
        </Column>

        <Column title="Màu khung">
          <Field label="Màu sẵn">
            <select value={frame.colorPreset} onChange={(e) => set("colorPreset", e.target.value)} className={selectClass}>
              {COLOR_PRESETS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          {frame.colorPreset === "custom" ? (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={frame.customColor}
                onChange={(e) => set("customColor", e.target.value)}
                className="h-8 w-10 flex-shrink-0 cursor-pointer rounded-md border border-line bg-transparent p-0.5"
              />
              <input
                type="text"
                value={frame.customColor}
                onChange={(e) => set("customColor", e.target.value)}
                placeholder="#RRGGBB"
                className={inputClass}
              />
            </div>
          ) : (
            <div
              className="h-6 w-full rounded-md border border-line"
              style={{ background: COLOR_PRESETS.find((c) => c.key === frame.colorPreset)?.hex ?? "#fff" }}
            />
          )}
        </Column>
      </div>

      {frame.diameterMode === "custom" && (
        <div className="mt-4 border-t border-line pt-3.5">
          <span className="mb-2.5 block text-[11px] font-bold tracking-wide text-text-muted uppercase">
            FI tùy chỉnh theo bộ phận (mm)
          </span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="Miệng">
              <input type="number" value={frame.topDiameter} onChange={(e) => set("topDiameter", Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Vòng thân">
              <input type="number" value={frame.bodyDiameter} onChange={(e) => set("bodyDiameter", Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Viền đáy">
              <input type="number" value={frame.bottomRimDiameter} onChange={(e) => set("bottomRimDiameter", Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Nan dọc">
              <input type="number" value={frame.verticalDiameter} onChange={(e) => set("verticalDiameter", Number(e.target.value))} className={inputClass} />
            </Field>

            {frame.bottomPattern === "radial" ? (
              <>
                <Field label="Nan đáy (hướng tâm)">
                  <input type="number" value={frame.bottomRadialDiameter} onChange={(e) => set("bottomRadialDiameter", Number(e.target.value))} className={inputClass} />
                </Field>
                {frame.bottomRadialMode === "center_ring" && (
                  <Field label="Vòng tâm đáy">
                    <input type="number" value={frame.bottomCenterRingDiameter} onChange={(e) => set("bottomCenterRingDiameter", Number(e.target.value))} className={inputClass} />
                  </Field>
                )}
              </>
            ) : (
              <Field label="Nan đáy (song song)">
                <input type="number" value={frame.bottomParallelDiameter} onChange={(e) => set("bottomParallelDiameter", Number(e.target.value))} className={inputClass} />
              </Field>
            )}

            {lid.mode !== "none" && (
              <>
                <Field label="Viền nắp trên">
                  <input type="number" value={frame.lidTopDiameter} onChange={(e) => set("lidTopDiameter", Number(e.target.value))} className={inputClass} />
                </Field>
                {lid.mode === "cover" && (
                  <>
                    <Field label="Nan đứng nắp">
                      <input type="number" value={frame.lidWallDiameter} onChange={(e) => set("lidWallDiameter", Number(e.target.value))} className={inputClass} />
                    </Field>
                    <Field label="Viền nắp dưới">
                      <input type="number" value={frame.lidBottomDiameter} onChange={(e) => set("lidBottomDiameter", Number(e.target.value))} className={inputClass} />
                    </Field>
                  </>
                )}
                {frame.lidPattern === "radial" ? (
                  <>
                    <Field label="Nan nắp (hướng tâm)">
                      <input type="number" value={frame.lidRadialDiameter} onChange={(e) => set("lidRadialDiameter", Number(e.target.value))} className={inputClass} />
                    </Field>
                    {frame.lidRadialMode === "center_ring" && (
                      <Field label="Vòng tâm nắp">
                        <input type="number" value={frame.lidCenterRingDiameter} onChange={(e) => set("lidCenterRingDiameter", Number(e.target.value))} className={inputClass} />
                      </Field>
                    )}
                  </>
                ) : (
                  <Field label="Nan nắp (song song)">
                    <input type="number" value={frame.lidParallelDiameter} onChange={(e) => set("lidParallelDiameter", Number(e.target.value))} className={inputClass} />
                  </Field>
                )}
              </>
            )}

            {handle.type !== "none" && (
              <Field label="Quai">
                <input type="number" value={frame.handleDiameter} onChange={(e) => set("handleDiameter", Number(e.target.value))} className={inputClass} />
              </Field>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
