"use client";

import type { FrameInput, LidInput, OvalFrameInput } from "@/lib/breakdown/geometry/types";
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

interface OvalFrameFormProps {
  ovalFrame: OvalFrameInput;
  frame: FrameInput;
  lid: LidInput;
  hasHorizontalRings: boolean;
  onChangeOvalFrame: (ovalFrame: OvalFrameInput) => void;
  onChangeFrame: (frame: FrameInput) => void;
}

export function OvalFrameForm({ ovalFrame, frame, lid, hasHorizontalRings, onChangeOvalFrame, onChangeFrame }: OvalFrameFormProps) {
  function set<K extends keyof OvalFrameInput>(key: K, value: OvalFrameInput[K]) {
    onChangeOvalFrame({ ...ovalFrame, [key]: value });
  }
  function setFrame<K extends keyof FrameInput>(key: K, value: FrameInput[K]) {
    onChangeFrame({ ...frame, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-4">
        <Column title="Nan dọc thân">
          <Field label="Kiểu chia">
            <select value={ovalFrame.bodyRibMode} onChange={(e) => set("bodyRibMode", e.target.value as OvalFrameInput["bodyRibMode"])} className={selectClass}>
              <option value="fixed_tips">Cố định 2 đầu</option>
              <option value="even">Chia đều, không cố định</option>
            </select>
          </Field>
          {ovalFrame.bodyRibMode === "fixed_tips" ? (
            <>
              <Field label="Số nan mỗi nửa">
                <input
                  type="number"
                  min={0}
                  value={ovalFrame.bodyRibsPerHalf}
                  onChange={(e) => set("bodyRibsPerHalf", Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <p className="text-[11px] text-text-faint">
                2 nan ở tâm cung 2 đầu luôn cố định (không tính ở đây) — số này chia đều theo chiều dài đường viền mỗi nửa (trên/dưới), đối xứng qua trục dài.
              </p>
            </>
          ) : (
            <>
              <Field label="Số nan mỗi 1/4 chu vi">
                <input
                  type="number"
                  min={0}
                  value={ovalFrame.bodyRibsPerQuarter}
                  onChange={(e) => set("bodyRibsPerQuarter", Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <p className="text-[11px] text-text-faint">
                Không cố định nan ở đầu bo — chia đều theo chiều dài chu vi thật trên 1/4 hình rồi lấy đối xứng ra 3 phần còn lại, nên 2 cạnh thẳng luôn giống nhau và 2 đầu bo luôn giống nhau. Tổng số nan = số này × 4.
              </p>
            </>
          )}
        </Column>

        {hasHorizontalRings && (
          <Column title="Vòng ngang">
            <Field label="Vị trí vòng">
              <select value={frame.ringPlacement} onChange={(e) => setFrame("ringPlacement", e.target.value as FrameInput["ringPlacement"])} className={selectClass}>
                <option value="outside">Nằm ngoài nan dọc</option>
                <option value="inside">Nằm trong nan dọc</option>
              </select>
            </Field>
          </Column>
        )}

        <Column title="Đáy">
          <Field label="Hướng nan">
            <select value={ovalFrame.bottomDirection} onChange={(e) => set("bottomDirection", e.target.value as OvalFrameInput["bottomDirection"])} className={selectClass}>
              <option value="length">Theo chiều dài</option>
              <option value="width">Theo chiều rộng</option>
            </select>
          </Field>
          <Field label="Số nan (0 = không có nan)">
            <input type="number" min={0} value={ovalFrame.bottomCount} onChange={(e) => set("bottomCount", Number(e.target.value))} className={inputClass} />
          </Field>
        </Column>

        {lid.mode !== "none" && (
          <Column title="Nắp">
            <Field label="Hướng nan">
              <select value={ovalFrame.lidDirection} onChange={(e) => set("lidDirection", e.target.value as OvalFrameInput["lidDirection"])} className={selectClass}>
                <option value="length">Theo chiều dài</option>
                <option value="width">Theo chiều rộng</option>
              </select>
            </Field>
            <Field label="Số nan (0 = không có nan)">
              <input type="number" min={0} value={ovalFrame.lidCount} onChange={(e) => set("lidCount", Number(e.target.value))} className={inputClass} />
            </Field>
          </Column>
        )}

        <Column title="FI sắt">
          <Field label="Chế độ FI">
            <select value={frame.diameterMode} onChange={(e) => setFrame("diameterMode", e.target.value as FrameInput["diameterMode"])} className={selectClass}>
              <option value="same">Một FI cho tất cả</option>
              <option value="custom">Tùy chỉnh theo bộ phận</option>
            </select>
          </Field>
          {frame.diameterMode === "same" && (
            <Field label="FI tất cả (mm)">
              <input type="number" value={frame.sameDiameter} onChange={(e) => setFrame("sameDiameter", Number(e.target.value))} className={inputClass} />
            </Field>
          )}
        </Column>

        <Column title="Màu khung">
          <Field label="Màu sẵn">
            <select value={frame.colorPreset} onChange={(e) => setFrame("colorPreset", e.target.value)} className={selectClass}>
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
                onChange={(e) => setFrame("customColor", e.target.value)}
                className="h-8 w-10 flex-shrink-0 cursor-pointer rounded-md border border-line bg-transparent p-0.5"
              />
              <input type="text" value={frame.customColor} onChange={(e) => setFrame("customColor", e.target.value)} placeholder="#RRGGBB" className={inputClass} />
            </div>
          ) : (
            <div className="h-6 w-full rounded-md border border-line" style={{ background: COLOR_PRESETS.find((c) => c.key === frame.colorPreset)?.hex ?? "#fff" }} />
          )}
        </Column>
      </div>

      {frame.diameterMode === "custom" && (
        <div className="border-t border-line pt-3.5">
          <span className="mb-2.5 block text-[11px] font-bold tracking-wide text-text-muted uppercase">FI tùy chỉnh theo bộ phận (mm)</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="Miệng">
              <input type="number" value={frame.topDiameter} onChange={(e) => setFrame("topDiameter", Number(e.target.value))} className={inputClass} />
            </Field>
            {hasHorizontalRings && (
              <Field label="Vòng ngang thân">
                <input type="number" value={frame.bodyDiameter} onChange={(e) => setFrame("bodyDiameter", Number(e.target.value))} className={inputClass} />
              </Field>
            )}
            <Field label="Đáy (viền)">
              <input type="number" value={frame.bottomRimDiameter} onChange={(e) => setFrame("bottomRimDiameter", Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Nan dọc">
              <input type="number" value={frame.verticalDiameter} onChange={(e) => setFrame("verticalDiameter", Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Nan đáy">
              <input type="number" value={frame.bottomParallelDiameter} onChange={(e) => setFrame("bottomParallelDiameter", Number(e.target.value))} className={inputClass} />
            </Field>
            {lid.mode !== "none" && (
              <Field label="Nan nắp">
                <input type="number" value={frame.lidParallelDiameter} onChange={(e) => setFrame("lidParallelDiameter", Number(e.target.value))} className={inputClass} />
              </Field>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
