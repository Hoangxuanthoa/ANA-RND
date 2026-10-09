"use client";

import { useState } from "react";
import {
  ALL_DRAWING_VIEWS,
  createBlankTemplate,
  DEFAULT_FIELD_ROW_MIN_HEIGHT_MM,
  DEFAULT_TITLE_BLOCK_WIDTH_MM,
  DRAWING_VIEW_LABELS,
  type DrawingTemplate,
  type DrawingTemplateField,
  type DrawingViewKey,
} from "@/lib/breakdown/drawingTemplate";

interface TemplateManagerProps {
  templates: DrawingTemplate[];
  activeTemplateId: string;
  // Admin only — everyone else (any role that can open the breakdown
  // studio) can still see this list and pick one to export with, just not
  // create/edit/delete. See canManageDrawingTemplates.
  canManage: boolean;
  onSelectTemplate: (id: string) => void;
  onCreateTemplate: (template: DrawingTemplate) => void;
  onUpdateTemplate: (id: string, patch: Partial<DrawingTemplate>) => void;
  onDeleteTemplate: (id: string) => void;
  // Modal use (inside Xuất bản vẽ): close handler. Embedded use (Cài đặt Bóc tách > Mẫu bản vẽ): no close.
  onClose?: () => void;
  embedded?: boolean;
}

function newFieldId(): string {
  return `f-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function TemplateManager({
  templates,
  activeTemplateId,
  canManage,
  onSelectTemplate,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onClose,
  embedded = false,
}: TemplateManagerProps) {
  const [editingId, setEditingId] = useState(activeTemplateId);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const editing = templates.find((t) => t.id === editingId) ?? templates[0];

  function updateEditing(patch: Partial<DrawingTemplate>) {
    onUpdateTemplate(editing.id, patch);
  }

  function addTemplate() {
    const t = createBlankTemplate(`Template ${templates.length + 1}`);
    onCreateTemplate(t);
    setEditingId(t.id);
  }

  function duplicateTemplate() {
    const copy: DrawingTemplate = {
      ...editing,
      id: `tpl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: `${editing.name} (bản sao)`,
      fields: editing.fields.map((f) => ({ ...f, id: newFieldId() })),
      views: [...editing.views],
    };
    onCreateTemplate(copy);
    setEditingId(copy.id);
  }

  function deleteTemplate(id: string) {
    if (templates.length <= 1) return; // always keep at least one template
    onDeleteTemplate(id);
    setConfirmingDeleteId(null);
    if (editingId === id) setEditingId(templates.find((t) => t.id !== id)!.id);
  }

  function toggleView(key: DrawingViewKey) {
    const has = editing.views.includes(key);
    const views = has ? editing.views.filter((v) => v !== key) : [...editing.views, key];
    updateEditing({ views: ALL_DRAWING_VIEWS.filter((v) => views.includes(v)) });
  }

  function updateField(id: string, label: string) {
    updateEditing({ fields: editing.fields.map((f) => (f.id === id ? { ...f, label } : f)) });
  }

  function updateFieldDefaultValue(id: string, defaultValue: string) {
    updateEditing({ fields: editing.fields.map((f) => (f.id === id ? { ...f, defaultValue } : f)) });
  }

  function removeField(id: string) {
    updateEditing({ fields: editing.fields.filter((f) => f.id !== id) });
  }

  function addField() {
    const field: DrawingTemplateField = { id: newFieldId(), label: "" };
    updateEditing({ fields: [...editing.fields, field] });
  }

  function moveField(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= editing.fields.length) return;
    const fields = [...editing.fields];
    [fields[index], fields[target]] = [fields[target], fields[index]];
    updateEditing({ fields });
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateEditing({ logoDataUrl: reader.result as string });
    reader.readAsDataURL(file);
  }

  return (
    <div className={embedded ? "" : "fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"}>
      <div
        className={
          embedded
            ? "flex h-[78vh] min-h-[520px] w-full flex-col rounded-xl border border-line bg-surface p-5"
            : "flex h-[88vh] w-[900px] max-w-[95vw] flex-col rounded-xl bg-surface p-5 shadow-xl"
        }
      >
        <div className="mb-4 flex flex-shrink-0 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-text">{canManage ? "Quản lý template bản vẽ" : "Chọn template bản vẽ"}</span>
            {!canManage && (
              <span className="rounded bg-bg px-2 py-0.5 text-[11px] font-semibold text-text-faint">Bạn không có quyền tạo/sửa</span>
            )}
          </div>
          {onClose && !embedded && (
            <button type="button" onClick={onClose} className="rounded-md px-2.5 py-1 text-[13px] font-semibold text-text-muted hover:bg-bg hover:text-text">
              Đóng
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 gap-4">
          {/* Left: template list */}
          <div className={canManage ? "flex w-[220px] flex-shrink-0 flex-col gap-2 overflow-y-auto" : "flex w-full flex-col gap-2 overflow-y-auto"}>
            {templates.map((t) => (
              <div key={t.id} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setEditingId(t.id)}
                  className={
                    t.id === editingId
                      ? "flex items-center justify-between rounded-lg border border-accent bg-accent-soft px-3 py-2 text-left text-[13px] font-bold text-accent-soft-text"
                      : "flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-left text-[13px] font-semibold text-text-muted hover:bg-bg"
                  }
                >
                  <span className="truncate">{t.name || "(chưa đặt tên)"}</span>
                  {t.id === activeTemplateId && <span className="ml-1.5 flex-shrink-0 text-[10px] font-bold text-accent">●</span>}
                </button>
                {t.id === editingId && (
                  <div className="flex items-center gap-2 px-1">
                    {activeTemplateId !== t.id && (
                      <button type="button" onClick={() => onSelectTemplate(t.id)} className="text-[11px] font-semibold text-accent hover:underline">
                        Dùng để xuất
                      </button>
                    )}
                    {canManage &&
                      (confirmingDeleteId === t.id ? (
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-text-faint">Xóa thật?</span>
                          <button type="button" onClick={() => deleteTemplate(t.id)} className="rounded bg-red px-1.5 py-0.5 font-bold text-white">
                            Xóa
                          </button>
                          <button type="button" onClick={() => setConfirmingDeleteId(null)} className="font-semibold text-text-muted hover:underline">
                            Hủy
                          </button>
                        </span>
                      ) : (
                        templates.length > 1 && (
                          <button type="button" onClick={() => setConfirmingDeleteId(t.id)} className="text-[11px] font-semibold text-red hover:underline">
                            Xóa
                          </button>
                        )
                      ))}
                  </div>
                )}
              </div>
            ))}
            {canManage && (
              <div className="mt-1 flex flex-col gap-1.5">
                <button type="button" onClick={addTemplate} className="h-9 rounded-lg border border-dashed border-line text-[12.5px] font-semibold text-text-muted hover:border-accent hover:text-accent">
                  + Tạo template mới
                </button>
                <button type="button" onClick={duplicateTemplate} className="h-9 rounded-lg border border-line bg-white text-[12.5px] font-semibold text-text-muted hover:bg-bg">
                  Nhân bản template này
                </button>
              </div>
            )}
          </div>

          {/* Right: editor — Admin only. Everyone else just picks from the
              list on the left. */}
          {canManage && (
            <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-text">Tên template</span>
                  <input
                    value={editing.name}
                    onChange={(e) => updateEditing({ name: e.target.value })}
                    className="h-9 rounded-md border border-line px-2.5 text-[13px] focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-text">Tên công ty (hiện khi không có logo)</span>
                  <input
                    value={editing.companyName}
                    onChange={(e) => updateEditing({ companyName: e.target.value })}
                    className="h-9 rounded-md border border-line px-2.5 text-[13px] focus:border-accent focus:outline-none"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-line bg-white p-3">
                <span className="mb-2 block text-[11px] font-bold tracking-wide text-text-faint uppercase">Logo</span>
                <div className="flex items-center gap-3">
                  {editing.logoDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editing.logoDataUrl} alt="" className="h-12 w-24 flex-shrink-0 rounded border border-line object-contain bg-bg p-1" />
                  )}
                  <div className="flex flex-col gap-1">
                    <label className="cursor-pointer text-[12px] font-semibold text-accent hover:underline">
                      {editing.logoDataUrl ? "Đổi logo" : "Tải logo lên"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                    </label>
                    {editing.logoDataUrl && (
                      <button type="button" onClick={() => updateEditing({ logoDataUrl: null })} className="text-left text-[11px] font-semibold text-text-muted hover:text-text">
                        Xóa logo (dùng tên công ty)
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold text-text">Bề rộng khung tiêu đề (mm)</span>
                    <input
                      type="number"
                      min={40}
                      max={140}
                      value={editing.titleBlockWidthMm}
                      onChange={(e) => updateEditing({ titleBlockWidthMm: Math.max(40, Math.min(140, Number(e.target.value) || DEFAULT_TITLE_BLOCK_WIDTH_MM)) })}
                      className="h-8 w-20 rounded-md border border-line px-2 text-[13px] focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold text-text">Chiều cao mỗi dòng (mm)</span>
                    <input
                      type="number"
                      min={6}
                      max={30}
                      step={0.1}
                      value={editing.fieldRowMinHeightMm}
                      onChange={(e) =>
                        updateEditing({ fieldRowMinHeightMm: Math.max(6, Math.min(30, Number(e.target.value) || DEFAULT_FIELD_ROW_MIN_HEIGHT_MM)) })
                      }
                      className="h-8 w-20 rounded-md border border-line px-2 text-[13px] focus:border-accent focus:outline-none"
                    />
                  </label>
                  <p className="text-[11px] text-text-faint">Dòng vẫn tự giãn cao hơn mức này nếu ít trường — đây chỉ là chiều cao tối thiểu.</p>
                </div>
              </div>

              <div className="rounded-lg border border-line bg-white p-3">
                <span className="mb-2 block text-[11px] font-bold tracking-wide text-text-faint uppercase">Các view hiện trong bản vẽ</span>
                <div className="grid grid-cols-4 gap-2">
                  {ALL_DRAWING_VIEWS.map((key) => (
                    <label key={key} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text">
                      <input type="checkbox" checked={editing.views.includes(key)} onChange={() => toggleView(key)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                      {DRAWING_VIEW_LABELS[key]}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-text-faint">
                  Chọn bao nhiêu view cũng được — bản vẽ tự sắp lưới cho vừa. Back/Left/Right/Bottom hiện giống Front/Side/Top vì sản phẩm hiện tại luôn đối xứng 2 bên.
                </p>
                <label className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-[12.5px] font-semibold text-text">
                  <input
                    type="checkbox"
                    checked={editing.showViewFrame}
                    onChange={(e) => updateEditing({ showViewFrame: e.target.checked })}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                  Hiện tên + khung viền từng view
                </label>
                <p className="mt-1 text-[11px] text-text-faint">Tắt đi để chỉ còn hình, không có ô viền hay chữ MẶT ĐỨNG/ISO... quanh mỗi view.</p>
              </div>

              <div className="rounded-lg border border-line bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wide text-text-faint uppercase">Các trường trong khung tiêu đề</span>
                  <button type="button" onClick={addField} className="text-[11.5px] font-semibold text-accent hover:underline">
                    + Thêm trường
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {editing.fields.map((f, i) => (
                    <div key={f.id} className="flex flex-col gap-1 rounded-md border border-line p-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-col">
                          <button type="button" disabled={i === 0} onClick={() => moveField(i, -1)} className="text-[10px] leading-none text-text-faint hover:text-text disabled:opacity-20">
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={i === editing.fields.length - 1}
                            onClick={() => moveField(i, 1)}
                            className="text-[10px] leading-none text-text-faint hover:text-text disabled:opacity-20"
                          >
                            ▼
                          </button>
                        </div>
                        <input
                          value={f.label}
                          onChange={(e) => updateField(f.id, e.target.value)}
                          placeholder="Tên trường"
                          className="h-8 flex-1 rounded-md border border-line px-2.5 text-[12.5px] focus:border-accent focus:outline-none"
                        />
                        {f.autoFill && (
                          <span className="flex-shrink-0 rounded bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-text-faint">
                            {f.autoFill === "productName" ? "tự điền tên SP" : "tự điền ngày"}
                          </span>
                        )}
                        <button type="button" onClick={() => removeField(f.id)} className="flex-shrink-0 text-[15px] font-bold text-red hover:opacity-70">
                          ×
                        </button>
                      </div>
                      {/* Pre-filled value for every NEW drawing using this
                          template — e.g. a standard tolerance note or address
                          that's the same across most products. Hidden for an
                          autoFill field since that's always computed instead
                          (see fieldValue() in DrawingSheetA4.tsx). Editing this
                          only affects drawings not yet created — it never
                          overwrites a value already typed on an open sheet. */}
                      {!f.autoFill && (
                        <input
                          value={f.defaultValue ?? ""}
                          onChange={(e) => updateFieldDefaultValue(f.id, e.target.value)}
                          placeholder="Giá trị mặc định (điền sẵn cho bản vẽ mới, để trống nếu không cần)"
                          className="h-7 rounded-md border border-line bg-bg px-2.5 text-[11.5px] text-text-muted focus:border-accent focus:bg-white focus:text-text focus:outline-none"
                          style={{ marginLeft: 20 }}
                        />
                      )}
                    </div>
                  ))}
                  {editing.fields.length === 0 && <p className="text-[12px] text-text-faint">Chưa có trường nào — bấm &ldquo;+ Thêm trường&rdquo;.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
