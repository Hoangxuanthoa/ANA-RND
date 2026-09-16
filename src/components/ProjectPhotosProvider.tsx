"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ProjectPhoto, FeedbackItem } from "@/lib/mock-data";

interface ProjectPhotosContextValue {
  photos: ProjectPhoto[];
  // Files must already be real, persisted URLs (uploaded to R2 by the
  // caller first) — this just creates the DB rows.
  addPhotos: (projectCode: string, files: { fileName: string; url: string }[]) => void;
  deletePhoto: (id: string) => void;
  markPhotoReleased: (id: string, productCode: string) => void;
  addPhotoComment: (id: string, content: string) => void;
}

const ProjectPhotosContext = createContext<ProjectPhotosContextValue | null>(null);

const JSON_HEADERS = { "Content-Type": "application/json" };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Thao tác thất bại — thử lại.");
  return data as T;
}

export function ProjectPhotosProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/project-photos").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/project-photos/comments").then((res) => (res.ok ? res.json() : [])),
    ]).then(([rows, commentRows]: [Omit<ProjectPhoto, "comments">[], (FeedbackItem & { photoId: string })[]]) => {
      setPhotos(rows.map((p) => ({ ...p, comments: commentRows.filter((c) => c.photoId === p.id) })));
    });
  }, []);

  function addPhotos(projectCode: string, files: { fileName: string; url: string }[]) {
    postJson<Omit<ProjectPhoto, "comments">[]>("/api/project-photos", { projectCode, files })
      .then((created) => setPhotos((prev) => [...created.map((p) => ({ ...p, comments: [] })), ...prev]))
      .catch(() => {});
  }

  function deletePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    fetch(`/api/project-photos/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function markPhotoReleased(id: string, productCode: string) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, releasedProductCode: productCode } : p)));
    postJson(`/api/project-photos/${id}/release`, { productCode }).catch(() => {});
  }

  function addPhotoComment(id: string, content: string) {
    postJson<FeedbackItem & { photoId: string }>(`/api/project-photos/${id}/comments`, { content })
      .then((entry) => setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, comments: [...p.comments, entry] } : p))))
      .catch(() => {});
  }

  return (
    <ProjectPhotosContext.Provider value={{ photos, addPhotos, deletePhoto, markPhotoReleased, addPhotoComment }}>
      {children}
    </ProjectPhotosContext.Provider>
  );
}

export function useProjectPhotos() {
  const ctx = useContext(ProjectPhotosContext);
  if (!ctx) throw new Error("useProjectPhotos must be used within ProjectPhotosProvider");
  return ctx;
}
