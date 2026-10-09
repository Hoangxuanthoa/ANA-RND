"use client";

import { useEffect, useRef, useState } from "react";
import { TemplateManager } from "@/components/breakdown/studio/TemplateManager";
import {
  createDrawingTemplateRemote,
  deleteDrawingTemplateRemote,
  fetchDrawingTemplates,
  loadActiveTemplateId,
  saveActiveTemplateId,
  updateDrawingTemplateRemote,
  type DrawingTemplate,
} from "@/lib/breakdown/drawingTemplate";

// Cài đặt Bóc tách → "Mẫu bản vẽ": the drawing-sheet templates (title block,
// views, fields…) that used to be managed from inside "Xuất bản vẽ". Same
// TemplateManager, shown inline. Only people who can open this page get here, and
// the server re-checks on every write.
export function DrawingTemplatesTab() {
  const [templates, setTemplates] = useState<DrawingTemplate[] | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  // Debounced per template, 400ms — editing a field fires on every keystroke
  // (TemplateManager has no debounce of its own), so without this each
  // keystroke would PATCH instead of coalescing once typing pauses.
  const updateTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingPatches = useRef<Record<string, Partial<DrawingTemplate>>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDrawingTemplates(), loadActiveTemplateId()]).then(([list, savedActiveId]) => {
      if (cancelled) return;
      setTemplates(list);
      setActiveTemplateId(savedActiveId && list.some((t) => t.id === savedActiveId) ? savedActiveId : list[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectTemplate(id: string) {
    setActiveTemplateId(id);
    saveActiveTemplateId(id);
  }

  async function createTemplate(template: DrawingTemplate) {
    const created = await createDrawingTemplateRemote(template);
    if (!created) return;
    setTemplates((prev) => [...(prev ?? []), created]);
    selectTemplate(created.id);
  }

  function updateTemplate(id: string, patch: Partial<DrawingTemplate>) {
    setTemplates((prev) => (prev ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)));
    pendingPatches.current[id] = { ...pendingPatches.current[id], ...patch };
    clearTimeout(updateTimers.current[id]);
    updateTimers.current[id] = setTimeout(() => {
      const toSend = pendingPatches.current[id];
      delete pendingPatches.current[id];
      if (toSend) updateDrawingTemplateRemote(id, toSend);
    }, 400);
  }

  async function deleteTemplate(id: string) {
    const ok = await deleteDrawingTemplateRemote(id);
    if (!ok) return;
    setTemplates((prev) => {
      const next = (prev ?? []).filter((t) => t.id !== id);
      if (activeTemplateId === id && next.length) selectTemplate(next[0].id);
      return next;
    });
  }

  if (!templates || activeTemplateId === null) return <p className="text-[13px] text-text-faint">Đang tải…</p>;

  return (
    <TemplateManager
      embedded
      templates={templates}
      activeTemplateId={activeTemplateId}
      canManage
      onSelectTemplate={selectTemplate}
      onCreateTemplate={createTemplate}
      onUpdateTemplate={updateTemplate}
      onDeleteTemplate={deleteTemplate}
    />
  );
}
